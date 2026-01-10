use crate::{
    constants::CONTEXT_WINDOW,
    helpers::emit_error,
    llm::{
        client::{LLMClient, CANCELLATION_TOKEN},
        mcp_client::McpClientManager,
        mcp_server::LoycaServer,
        model::{Function, Message, Tool},
        system_prompts::CHAT_SYSTEM_PROMPT,
    },
    sql::{
        self,
        model::{MessageData, ToolData},
    },
};
use tauri::{AppHandle, Manager};

fn is_tool_enabled(tool: &rmcp::model::Tool, db_tools: Vec<ToolData>) -> bool {
    let db_tool = db_tools.iter().find(|t| t.name == tool.name);
    db_tool.map_or(false, |t| t.enabled)
}

// Convert rmcp::model::Tool to our local Tool format
fn convert_mcp_tool(mcp_tool: &rmcp::model::Tool) -> Tool {
    Tool {
        _type: "function".to_string(),
        function: Function {
            name: mcp_tool.name.to_string(),
            description: mcp_tool.description.clone().unwrap_or_default().to_string(),
            parameters: serde_json::Value::Object((*mcp_tool.input_schema).clone()),
        },
    }
}

/// Get all chat sessions
#[tauri_crate::command]
pub async fn get_all_sessions() -> Result<Vec<crate::sql::model::ChatSession>, String> {
    sql::queries::get_all_chat_sessions().map_err(|e| e.to_string())
}

/// Get all messages for a specific session
#[tauri_crate::command]
pub async fn get_session_messages(session_id: String) -> Result<Vec<crate::sql::model::MessageData>, String> {
    println!("get_session_messages called with session_id: {}", session_id);
    let session_id = session_id.parse::<i64>().map_err(|e| {
        println!("Failed to parse session_id: {}", e);
        e.to_string()
    })?;
    
    println!("Calling get_session_messages with parsed session_id: {}", session_id);
    let result = crate::sql::queries::get_session_messages(session_id).map_err(|e| {
        println!("Database error: {}", e);
        e.to_string()
    })?;
    
    println!("Successfully retrieved {} messages", result.len());
    Ok(result)
}

/// Call the model with tools.
/// - If session_id is None, a new session will be created.
#[tauri_crate::command]
pub async fn call_model(
    app_handle: AppHandle,
    prompt: String,
    stream: Option<bool>,
    session_id: Option<i64>,
    custom_prompt: Option<&str>,
) -> Result<i64, String> {
    let global_config = sql::get_config()?;
    let mut messages = vec![];

    let actual_session_id = if let Some(session_id) = session_id {
        let history = sql::queries::get_messages_by_session_id(session_id)?;
        for msg in history.iter().take(CONTEXT_WINDOW) {
            messages.push(if msg.role == "system" {
                Message::system(msg.content.clone())
            } else if msg.role == "user" {
                Message::user(msg.content.clone(), None)
            } else {
                Message::assistant(msg.content.clone(), None)
            });
        }
        session_id
    } else {
        let mut title = prompt.clone();
        title.truncate(20);
        let system_prompt = if custom_prompt.is_some() {
            custom_prompt.unwrap()
        } else {
            CHAT_SYSTEM_PROMPT
        };
        sql::queries::insert_chat_session(title, system_prompt)?
    };

    messages.push(Message::user(prompt.clone(), None));

    // Get all MCP tools and convert them to the expected format
    let loyca_server = LoycaServer::new(app_handle.clone());
    let mcp_manager = app_handle.state::<McpClientManager>();
    let mcp_tools = match mcp_manager.get_all_tools().await {
        Ok(tools_map) => {
            let mut converted_tools = Vec::new();
            for (server_name, tools) in tools_map {
                let db_tools = sql::queries::get_all_tools_by_server(server_name)?;
                for tool in tools {
                    // only add enabled tools
                    if is_tool_enabled(&tool, db_tools.clone()) {
                        converted_tools.push(convert_mcp_tool(&tool));
                        
                    }
                }
            }

            Some(converted_tools)
        }
        Err(e) => {
            tracing::error!("Failed to get MCP tools: {}", e);
            None
        }
    };

    let all_mcp_tools = if global_config.enable_tools == "true" {
        loyca_server.merge_with_tools(mcp_tools)
    } else {
        None
    };

    let use_vision = global_config.use_same_model == "true";

    tracing::info!("🔥 CALL_MODEL STARTED - stream: {:?}, session_id: {:?}", stream, session_id.as_ref());

    let llm_client = LLMClient::from_config(
        global_config,
        stream.unwrap_or(true),
        all_mcp_tools,
        0.7, // temperature
        use_vision,
    );
    let app_handle_clone = app_handle.clone();
    tokio::spawn(async move {
        match llm_client
            .complete_and_handle(&app_handle_clone, messages)
            .await
        {
            Ok((content, was_interrupted)) => {
                if !was_interrupted {
                    // store messages + response into the database
                    if let Err(e) = sql::queries::insert_message(MessageData {
                        id: None,
                        session_id: actual_session_id,
                        role: "user".to_string(),
                        content: prompt,
                        created_at: chrono::Utc::now(),
                    }) {
                        emit_error(&app_handle_clone, e.to_string().as_str()).ok();
                        tracing::error!("Failed to insert user message: {}", e);
                    }
                    // assistant message
                    if let Err(e) = sql::queries::insert_message(MessageData {
                        id: None,
                        session_id: actual_session_id,
                        role: "assistant".to_string(),
                        content: content.clone(),
                        created_at: chrono::Utc::now(),
                    }) {
                        emit_error(&app_handle_clone, e.to_string().as_str()).ok();
                        tracing::error!("Failed to insert assistant message: {}", e);
                    }
                }
            }
            Err(err) => {
                emit_error(&app_handle_clone, err.to_string().as_str()).ok();
                tracing::error!("LLM completion failed: {}", err);
            }
        }
    });

    Ok(actual_session_id)
}

#[tauri_crate::command]
pub async fn stop_model() -> Result<(), String> {
    let mut global_token = CANCELLATION_TOKEN.lock().unwrap();
    if let Some(token) = global_token.take() {
        token.cancel();
        Ok(())
    } else {
        Err("No active model call to stop".to_string())
    }
}

#[tauri_crate::command]
pub async fn validate_connection(use_vision: bool) -> Result<bool, String> {
    let global_config = sql::get_config()?;
    let llm_client = LLMClient::from_config(global_config, false, None, 0.0, use_vision);
    match llm_client.validate_connection().await {
        Ok(result) => Ok(result),
        Err(err) => {
            tracing::error!("LLM connection validation failed: {}", err);
            Err(err.to_string())
        }
    }
}
