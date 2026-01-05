use crate::{
    helpers::emit_error,
    llm::{
        mcp_client::McpClientManager,
        mcp_server::LoycaServer,
        model::{ApiResponse, CompletionRequest, Message, StreamChunk, Tool},
    },
    sql::model::GlobalConfig,
};
use futures_util::StreamExt;
use reqwest::{Client as HttpClient, Response as HttpResponse};
use tauri::{AppHandle, Emitter, Manager};
use tokio_util::sync::CancellationToken;

use std::sync::Mutex;

// Global cancellation token for stopping model calls
pub static CANCELLATION_TOKEN: Mutex<Option<CancellationToken>> = Mutex::new(None);

pub struct LLMClient {
    client: HttpClient,
    pub stream: bool,
    pub model: String,
    pub api_key: String,
    pub base_url: String,
    pub temperature: f32,
    pub tools: Option<Vec<Tool>>,
}

impl LLMClient {
    // pub fn new(
    //     stream: bool,
    //     model: String,
    //     api_key: String,
    //     base_url: String,
    //     temperature: f32,
    //     tools: Option<Vec<Tool>>,
    // ) -> Self {
    //     let cancellation_token = CancellationToken::new();
    //     {
    //         let mut global_token = CANCELLATION_TOKEN.lock().unwrap();
    //         *global_token = Some(cancellation_token.clone());
    //     }
    //     Self {
    //         client: HttpClient::new(),
    //         stream,
    //         model,
    //         api_key,
    //         base_url,
    //         temperature,
    //         tools,
    //         cancellation_token,
    //     }
    // }

    pub fn from_config(
        config: GlobalConfig,
        stream: bool,
        tools: Option<Vec<Tool>>,
        temperature: f32,
        use_vision: bool,
    ) -> Self {
        // tools are enabled only in streaming mode
        let current_tools = if stream { tools } else { None };

        if use_vision {
            Self {
                client: HttpClient::new(),
                stream,
                model: config.vision_model,
                api_key: config.vision_api_key,
                base_url: config.vision_base_url,
                temperature,
                tools: current_tools,
            }
        } else {
            Self {
                client: HttpClient::new(),
                stream,
                model: config.chat_model,
                api_key: config.chat_api_key,
                base_url: config.chat_base_url,
                temperature,
                tools: current_tools,
            }
        }
    }

    pub async fn validate_connection(&self) -> Result<bool, String> {
        let mut full_url = self.base_url.clone();
        if self.base_url.contains("openrouter") {
            full_url.push_str("/v1/key");
        } else {
            full_url.push_str("/v1/models");
        }

        let response = self
            .client
            .get(&full_url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .send()
            .await;

        match response {
            Ok(resp) => {
                if resp.status().is_success() {
                    Ok(true)
                } else {
                    Err("Invalid API key".to_string())
                }
            }
            Err(err) => Err(err.to_string()),
        }
    }

    pub async fn complete(&self, messages: Vec<Message>) -> Result<HttpResponse, String> {
        let mut full_url = self.base_url.clone();
        full_url.push_str("/v1/chat/completions");

        let request_body = CompletionRequest {
            stream: self.stream,
            messages,
            model: self.model.clone(),
            temperature: self.temperature.clone(),
            tools: self.tools.clone(),
        };

        let mut request_builder = self
            .client
            .post(&full_url)
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", self.api_key));

        if self.base_url.contains("openrouter.ai") {
            request_builder = request_builder
                .header("HTTP-Referer", "https://github.com/Vokturz/loyca-ai")
                .header("X-Title", "Loyca.ai");
        }

        let response = request_builder
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!(
                "API request failed with status {}: {}",
                status, error_text
            ));
        }

        Ok(response)
    }

    async fn handle_stream(
        &self,
        app_handle: &AppHandle,
        response: HttpResponse,
        cancellation_token: &CancellationToken,
    ) -> Result<(String, bool, Vec<crate::llm::model::ToolCall>), String> {
        let mut stream_response = response.bytes_stream();
        let mut buffer = String::new();
        let mut full_content = String::new();
        let mut tool_calls: Vec<crate::llm::model::ToolCall> = Vec::new();
        let mut current_tool_call: Option<crate::llm::model::ToolCall> = None;
        let mut in_reasoning = false;

        loop {
            tokio::select! {
                // Check for cancellation
                _ = cancellation_token.cancelled() => {
                    app_handle
                        .emit("call-cancelled", ())
                        .map_err(|e| format!("Failed to emit cancellation event: {}", e))?;
                    return Ok((full_content, true, tool_calls));
                }
                // Process stream chunks
                chunk_result = stream_response.next() => {
                    let Some(chunk_result) = chunk_result else {
                        break;
                    };
                    let chunk = chunk_result.map_err(|e| format!("Failed to read stream chunk: {}", e))?;
                    buffer.push_str(&String::from_utf8_lossy(&chunk));

                    while let Some(newline_pos) = buffer.find('\n') {
                        let line: String = buffer.drain(..=newline_pos).collect();

                        let trimmed_line = line.trim();
                        if !trimmed_line.starts_with("data: ") {
                            continue;
                        }

                        let data = &trimmed_line[6..]; // Remove the "data: " prefix

                        if data == "[DONE]" {
                            // Add any remaining tool call to the list
                            if let Some(tool_call) = current_tool_call.take() {
                                tool_calls.push(tool_call);
                            }
                            app_handle
                                .emit("call-complete", ())
                                .map_err(|e| format!("Failed to emit completion event: {}", e))?;
                            return Ok((full_content, false, tool_calls));
                        }

                        // Attempt to parse the JSON data from the line.
                        match serde_json::from_str::<StreamChunk>(data) {
                            Ok(chunk_data) => {
                                if let Some(choice) = chunk_data.choices.first() {
                                    // Handle reasoning details
                                    if let Some(reasoning_details) = &choice.delta.reasoning_details {
                                        for reasoning in reasoning_details {
                                            if !in_reasoning {
                                                full_content.push_str("<think>");
                                                app_handle
                                                    .emit("call-chunk", "<think>")
                                                    .map_err(|e| format!("Failed to emit chunk event: {}", e))?;
                                                in_reasoning = true;
                                            }

                                            let mut reasoning_text = String::new();
                                            if let Some(text) = &reasoning.text {
                                                reasoning_text.push_str(text);
                                            }
                                            if let Some(summary) = &reasoning.summary {
                                                reasoning_text.push_str(summary);
                                            }

                                            full_content.push_str(&reasoning_text);
                                            app_handle.emit("call-chunk", reasoning_text).map_err(|e| format!("Failed to emit chunk event: {}", e))?;
                                        }
                                    }

                                    if let Some(content) = &choice.delta.content {
                                        if !content.is_empty() {
                                            // If we were in reasoning mode and now have content, close reasoning
                                            if in_reasoning {
                                                full_content.push_str("</think>\n");
                                                in_reasoning = false;
                                                app_handle.emit("call-chunk", "</think>").map_err(|e| format!("Failed to emit chunk event: {}", e))?;
                                            }

                                            full_content.push_str(content);
                                            // Emit the content piece to the frontend.
                                            app_handle
                                                .emit("call-chunk", content.clone())
                                                .map_err(|e| format!("Failed to emit chunk event: {}", e))?;
                                        }
                                    }

                                    // Handle tool calls in streaming mode
                                    if let Some(delta_tool_calls) = &choice.delta.tool_calls {
                                        for delta_tool_call in delta_tool_calls {
                                            // If we have an ID, this is a new tool call
                                            if let Some(id) = &delta_tool_call.id {
                                                // Save any existing tool call
                                                if let Some(existing_tool_call) = current_tool_call.take() {
                                                    tool_calls.push(existing_tool_call);
                                                }

                                                // Start a new tool call
                                                current_tool_call = Some(crate::llm::model::ToolCall {
                                                    id: Some(id.clone()),
                                                    _type: "function".to_string(),
                                                    function: crate::llm::model::ToolFunction {
                                                        name: delta_tool_call.function.name.clone(),
                                                        arguments: delta_tool_call.function.arguments.clone(),
                                                    },
                                                });
                                            } else if let Some(ref mut tool_call) = current_tool_call {
                                                // Update existing tool call
                                                if let Some(name) = &delta_tool_call.function.name {
                                                    tool_call.function.name = Some(name.clone());
                                                }
                                                if let Some(arguments) = &delta_tool_call.function.arguments {
                                                    if let Some(ref mut existing_args) = tool_call.function.arguments {
                                                        existing_args.push_str(arguments);
                                                    } else {
                                                        tool_call.function.arguments = Some(arguments.clone());
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    if let Some(finish_reason) = &choice.finish_reason {
                                        // Close reasoning if we're finishing while in reasoning mode
                                        if in_reasoning {
                                            full_content.push_str("</think>\n");
                                            in_reasoning = false;
                                        }

                                        if finish_reason == "tool_calls" {
                                            // Add any remaining tool call to the list
                                            if let Some(tool_call) = current_tool_call.take() {
                                                tool_calls.push(tool_call);
                                            }

                                            // Emit tool call event
                                            if let Some(first_tool) = tool_calls.first() {
                                                if let Some(ref name) = first_tool.function.name {
                                                    app_handle
                                                        .emit("tool-call", name.clone())
                                                        .map_err(|e| format!("Failed to emit tool call event: {}", e))?;
                                                }
                                            }
                                        } else {
                                            app_handle
                                                .emit("tool-call", "")
                                                .map_err(|e| format!("Failed to emit tool call event: {}", e))?;
                                        }
                                    }

                                }

                            }
                            Err(e) => {
                                // Log parsing errors but don't crash. Some lines might be malformed.
                                tracing::error!("Failed to parse stream JSON chunk: {}, data: '{}'", e, data);
                                emit_error(app_handle, format!("Failed to parse stream JSON chunk: {}, data: {}", e, data).as_str())?;
                            }
                        }
                    }
                }
            }
        }

        // Close reasoning if we're finishing while in reasoning mode
        if in_reasoning {
            full_content.push_str("</think>\n");
            app_handle
                .emit("call-chunk", "</think>")
                .map_err(|e| format!("Failed to emit chunk event: {}", e))?;
        }

        // Add any remaining tool call to the list
        if let Some(tool_call) = current_tool_call.take() {
            tool_calls.push(tool_call);
        }

        app_handle
            .emit("call-complete", ())
            .map_err(|e| format!("Failed to emit final completion event: {}", e))?;
        Ok((full_content, false, tool_calls))
    }

    pub async fn handle_non_stream(
        &self,
        response: HttpResponse,
    ) -> Result<(String, bool, Vec<crate::llm::model::ToolCall>), String> {
        let api_response: ApiResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse non-streaming response: {}", e))?;

        if let Some(choice) = api_response.choices.first() {
            let tool_calls = choice.message.tool_calls.clone().unwrap_or_default();
            Ok((choice.message.content.clone(), false, tool_calls))
        } else {
            Err("No response content received from API".to_string())
        }
    }

    pub async fn complete_and_handle(
        &self,
        app_handle: &AppHandle,
        mut messages: Vec<Message>,
    ) -> Result<(String, bool), String> {
        let mut final_content = String::new();
        let mut was_interrupted: bool;
        let mcp_manager = app_handle.state::<McpClientManager>();
        let loyca_server = LoycaServer::new(app_handle.clone());

        // Create cancellation token only for streaming case
        let cancellation_token = if self.stream {
            let token = CancellationToken::new();
            {
                let mut global_token = CANCELLATION_TOKEN.lock().unwrap();
                *global_token = Some(token.clone());
            }
            Some(token)
        } else {
            None
        };

        loop {
            let resp = self.complete(messages.clone()).await;
            match resp {
                Ok(response) => {
                    let (content, interrupted, tool_calls) = if self.stream {
                        if let Some(ref token) = cancellation_token {
                            self.handle_stream(app_handle, response, token).await?
                        } else {
                            return Err(
                                "Cancellation token not initialized for streaming".to_string()
                            );
                        }
                    } else {
                        self.handle_non_stream(response).await?
                    };

                    final_content.push_str(&content);
                    was_interrupted = interrupted;

                    if interrupted {
                        break;
                    }

                    // If no tools were called, we're done
                    if tool_calls.is_empty() {
                        break;
                    }

                    // Add assistant message with tool calls to conversation
                    messages.push(Message::assistant(
                        content.clone(),
                        Some(tool_calls.clone()),
                    ));

                    // Process each tool call
                    for tool_call in tool_calls {
                        if let (Some(tool_name), Some(tool_args_str), Some(tool_id)) = (
                            &tool_call.function.name,
                            &tool_call.function.arguments,
                            &tool_call.id,
                        ) {
                            // Parse tool arguments
                            let tool_args: serde_json::Map<String, serde_json::Value> =
                                match serde_json::from_str(tool_args_str) {
                                    Ok(args) => args,
                                    Err(e) => {
                                        let error_content =
                                            format!("Error parsing tool arguments: {}", e);
                                        messages
                                            .push(Message::tool(error_content, tool_id.clone()));
                                        continue;
                                    }
                                };

                            tracing::debug!("Calling tool: {}", tool_name);
                            tracing::debug!("Arguments: {:?}", tool_args);

                            if loyca_server.list_tool_names().contains(&tool_name) {
                                match loyca_server.call_tool(tool_name, tool_args.clone()).await {
                                    Ok(tool_response) => {
                                        let content = tool_response
                                            .content
                                            .iter()
                                            .filter_map(|s| s.as_text())
                                            .map(|s| s.text.clone())
                                            .collect::<Vec<String>>()
                                            .join("\n");

                                        tracing::debug!("Loyca tool response: {}", content.clone());

                                        delay_wipe_tool(&app_handle);
                                        messages.push(Message::tool(content, tool_id.clone()));
                                        continue;
                                    }
                                    Err(e) => {
                                        let error_content = format!("Error calling tool: {}", e);
                                        messages
                                            .push(Message::tool(error_content, tool_id.clone()));
                                    }
                                }
                            }

                            match mcp_manager.call_tool(tool_name, Some(tool_args)).await {
                                Ok(tool_response) => {
                                    // TODO: Handle all possible responses
                                    // Get only text content for now
                                    let content = tool_response
                                        .content
                                        .iter()
                                        .filter_map(|s| s.as_text())
                                        .map(|s| s.text.clone())
                                        .collect::<Vec<String>>()
                                        .join("\n");

                                    tracing::debug!("tool response: {}", content.clone());

                                    delay_wipe_tool(&app_handle);

                                    messages.push(Message::tool(content, tool_id.clone()));
                                }
                                Err(e) => {
                                    let error_content =
                                        format!("Error calling tool {}: {}", tool_name, e);
                                    messages.push(Message::tool(error_content, tool_id.clone()));
                                }
                            }
                        }
                    }
                }
                Err(e) => return Err(e),
            }
        }

        // Clean up cancellation token when done (only for streaming case)
        if self.stream {
            let mut global_token = CANCELLATION_TOKEN.lock().unwrap();
            *global_token = None;
        }

        Ok((final_content, was_interrupted))
    }
}

fn delay_wipe_tool(app_handle: &tauri::AppHandle) {
    let app_handle_clone = app_handle.clone();
    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
        let _ = app_handle_clone.emit("tool-call", "");
    });
}
