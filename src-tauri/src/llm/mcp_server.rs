/**
 * This implement the local tools as a MCP server, and it includes
 * a tool to get the actual context of the user
 *
 */
use crate::constants::HOURS_AGO;
use crate::llm;
use crate::sql;
use anyhow;
use rmcp::transport::streamable_http_server::{
    session::local::LocalSessionManager, StreamableHttpService,
};
use rmcp::{
    handler::server::{router::tool::ToolRouter, wrapper::Parameters},
    model::*,
    schemars,
    service::RequestContext,
    tool, tool_handler, tool_router, ErrorData as McpError, RoleServer, ServerHandler,
};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tokio::sync::{Mutex, RwLock};
use tokio_util::sync::CancellationToken;

const BIND_ADDRESS: &str = "127.0.0.1:8000";

/// MCP Server Manager that handles the streamable HTTP server
pub struct McpServerManager {
    app_handle: AppHandle,
    server_handle: Arc<RwLock<Option<tokio::task::JoinHandle<()>>>>,
    cancellation_token: Arc<RwLock<CancellationToken>>,
    is_running: Arc<RwLock<bool>>,
}

impl McpServerManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            server_handle: Arc::new(RwLock::new(None)),
            cancellation_token: Arc::new(RwLock::new(CancellationToken::new())),
            is_running: Arc::new(RwLock::new(false)),
        }
    }

    /// Check if the server is currently running
    pub async fn is_running(&self) -> bool {
        *self.is_running.read().await
    }

    /// Start the MCP server in the background
    pub async fn start(&self) -> anyhow::Result<()> {
        // Check if server is already running
        if *self.is_running.read().await {
            return Err(anyhow::anyhow!("MCP Server is already running"));
        }

        // Create a new cancellation token for this server instance
        let new_token = CancellationToken::new();

        // Update the manager's cancellation token
        {
            let mut token_guard = self.cancellation_token.write().await;
            *token_guard = new_token.clone();
        }

        let app_handle = self.app_handle.clone();
        let token = new_token.clone();
        let is_running = self.is_running.clone();

        let handle = tokio::spawn(async move {
            if let Err(e) = Self::run_server(app_handle, token).await {
                tracing::error!("MCP Server error: {}", e);
            }
            // Mark as not running when task completes
            *is_running.write().await = false;
            tracing::info!("MCP Server task completed and marked as not running");
        });

        // Store the handle and mark as running
        *self.server_handle.write().await = Some(handle);
        *self.is_running.write().await = true;

        tracing::info!("MCP Server started in background");
        Ok(())
    }

    /// Stop the MCP server
    pub async fn stop(&self) -> anyhow::Result<()> {
        // Check if server is running
        let was_running = {
            let running_guard = self.is_running.read().await;
            *running_guard
        };

        if !was_running {
            return Err(anyhow::anyhow!("MCP Server is not running"));
        }

        tracing::info!("Stopping MCP Server...");

        // Signal cancellation first
        {
            let token_guard = self.cancellation_token.read().await;
            token_guard.cancel();
        }

        // Wait for the server task to complete with timeout
        let handle_option = self.server_handle.write().await.take();
        if let Some(handle) = handle_option {
            // Use tokio::time::timeout to avoid hanging indefinitely
            match tokio::time::timeout(std::time::Duration::from_secs(10), handle).await {
                Ok(join_result) => {
                    if let Err(e) = join_result {
                        tracing::error!("Error in MCP server task: {}", e);
                    }
                }
                Err(_) => {
                    tracing::warn!("MCP server stop timed out, but continuing...");
                }
            }
        }

        // Ensure is_running is set to false
        *self.is_running.write().await = false;
        tracing::info!("MCP Server stopped");
        Ok(())
    }

    /// Internal method to run the server
    async fn run_server(
        app_handle: AppHandle,
        cancellation_token: CancellationToken,
    ) -> anyhow::Result<()> {
        let service = StreamableHttpService::new(
            move || Ok(LoycaServer::new(app_handle.clone())),
            LocalSessionManager::default().into(),
            Default::default(),
        );

        let router = axum::Router::new().nest_service("/mcp", service);
        let tcp_listener = tokio::net::TcpListener::bind(BIND_ADDRESS).await?;

        tracing::info!("MCP Server starting on {}", BIND_ADDRESS);

        let _ = axum::serve(tcp_listener, router)
            .with_graceful_shutdown(async move {
                cancellation_token.cancelled().await;
                tracing::info!("MCP Server shutdown signal received");
            })
            .await;
        Ok(())
    }
}

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
pub struct SemanticSearchArgs {
    /// The search query to find similar content
    pub query: String,
    /// The number of hours ago to search for content. If not provided, defaults to HOURS_AGO hours.
    pub hours_ago: Option<u32>,
}

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
pub struct OcrArgs {
    /// The ID of the screenshot to perform OCR on
    pub screenshot_id: u32,
}

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
pub struct UserContextArgs {
    /// The number of hours ago to search for content. If not provided, defaults to 1 hour.
    pub hours_ago: Option<i64>,
}

#[derive(Clone)]
pub struct LoycaServer {
    app_handle: AppHandle,
    tool_router: ToolRouter<LoycaServer>,
    // Keep track of async operations state if needed
    state: Arc<Mutex<ServerState>>,
}

#[derive(Debug, Default)]
struct ServerState {
    // Add any server state here if needed
    request_count: u64,
}

#[tool_router]
impl LoycaServer {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            tool_router: Self::tool_router(),
            state: Arc::new(Mutex::new(ServerState::default())),
        }
    }

    #[tool(description = "Extract the user's context from their recent activity")]
    async fn get_user_context(
        &self,
        Parameters(args): Parameters<UserContextArgs>,
    ) -> Result<CallToolResult, McpError> {
        match llm::suggestions::screenshots_context(args.hours_ago) {
            Ok(content) => {
                if content.is_empty() {
                    Ok(CallToolResult::success(vec![Content::text(
                        "No context found",
                    )]))
                } else {
                    Ok(CallToolResult::success(vec![Content::text(content)]))
                }
            }
            Err(_err) => {
                #[cfg(debug_assertions)]
                println!("Error calling get_user_context: {:?}", _err);

                Err(McpError::internal_error(
                    "tool_not_found",
                    Some(json!({ "tool": "get_user_context" })),
                ))
            }
        }
    }

    #[tool(
        description = "Perform semantic search on screenshot descriptions to find relevant visual content"
    )]
    async fn semantic_search_screenshots(
        &self,
        Parameters(args): Parameters<SemanticSearchArgs>,
    ) -> Result<CallToolResult, McpError> {
        let hours_ago = args.hours_ago.unwrap_or(HOURS_AGO);

        match llm::local_tools::semantic_search_screenshots(
            &self.app_handle,
            &args.query,
            hours_ago,
        )
        .await
        {
            Ok(process_window_infos) => {
                if process_window_infos.is_empty() {
                    Ok(CallToolResult::error(vec![Content::text(
                        "No relevant screenshots found.",
                    )]))
                } else {
                    let mut to_return = Vec::new();
                    let now = chrono::Utc::now();
                    for (process_name, window_infos) in process_window_infos {
                        let context = window_infos
                            .iter()
                            .map(|info| {
                                let minutes_ago = (now - info.created_at).num_minutes();
                                format!(
                                    "{} minutes ago (category={}, id={}): {}",
                                    minutes_ago,
                                    info.llm_category.clone(),
                                    info.window_id,
                                    info.llm_description.clone()
                                )
                            })
                            .collect::<Vec<_>>()
                            .join("\n");
                        to_return.push(format!(
                            "<process={}>\n{}\n</process>",
                            process_name, context
                        ));
                    }
                    Ok(CallToolResult::success(vec![Content::text(
                        to_return.join("\n"),
                    )]))
                }
            }
            Err(_err) => {
                #[cfg(debug_assertions)]
                println!("Error calling semantic_search_screenshots: {:?}", _err);

                Err(McpError::internal_error(
                    "tool_not_found",
                    Some(json!({ "tool": "semantic_search_screenshots" })),
                ))
            }
        }
    }

    #[tool(description = "Perform OCR on a screenshot using its ID")]
    async fn ocr_screenshot(
        &self,
        Parameters(args): Parameters<OcrArgs>,
    ) -> Result<CallToolResult, McpError> {
        match llm::local_tools::get_ocr(&self.app_handle, args.screenshot_id).await {
            Ok(ocr_response) => {
                if ocr_response.is_empty() {
                    Ok(CallToolResult::error(vec![Content::text(
                        "No screenshot found with the provided ID.",
                    )]))
                } else {
                    Ok(CallToolResult::success(vec![Content::text(ocr_response)]))
                }
            }
            Err(_err) => {
                #[cfg(debug_assertions)]
                println!("Error calling ocr_screenshot: {:?}", _err);

                Err(McpError::internal_error(
                    "tool_not_found",
                    Some(json!({ "tool": "ocr_screenshot" })),
                ))
            }
        }
    }

    // List all tools available to the user.
    pub fn list_tools(&self, enabled_only: bool) -> Vec<llm::model::Tool> {
        let local_tools = sql::queries::get_all_tools_by_server("_local".to_string())
            .unwrap_or_else(|e| {
                tracing::warn!("Failed to get local tools from database: {}", e);
                Vec::new()
            });

        let mut tools: Vec<llm::model::Tool> = self
            .tool_router
            .list_all()
            .into_iter()
            .map(|tool| llm::model::Tool {
                _type: "function".to_string(),
                function: llm::model::Function {
                    name: tool.name.to_string(),
                    description: tool.description.unwrap_or_default().to_string(),
                    parameters: Value::Object((*tool.input_schema).clone()),
                },
            })
            .collect();

        if enabled_only {
            tools = tools
                .into_iter()
                .filter(|tool| {
                    let db_tool = local_tools.iter().find(|t| t.name == tool.function.name);
                    db_tool.map_or(false, |t| t.enabled)
                })
                .collect();
        }
        tools
    }

    pub fn list_tool_names(&self) -> Vec<String> {
        let tools = self
            .tool_router
            .list_all()
            .into_iter()
            .map(|tool| tool.name.to_string())
            .collect();

        tools
    }

    pub fn merge_with_tools(
        &self,
        mcp_tools: Option<Vec<llm::model::Tool>>,
    ) -> Option<Vec<llm::model::Tool>> {
        let mut combined = self.list_tools(true); // enabled_only
        let mut known_names: HashSet<String> = combined
            .iter()
            .map(|tool| tool.function.name.clone())
            .collect();

        if let Some(mcp_tools) = mcp_tools {
            for tool in mcp_tools {
                if known_names.insert(tool.function.name.clone()) {
                    combined.push(tool);
                }
            }
        }

        Some(combined)
    }

    pub async fn call_tool(
        &self,
        tool_name: &str,
        args: JsonObject,
    ) -> Result<CallToolResult, McpError> {
        let incoming = serde_json::Value::Object(args);

        match tool_name {
            "get_user_context" => {
                // Deserialize into the typed args struct
                let params: UserContextArgs = serde_json::from_value(incoming).map_err(|e| {
                    McpError::internal_error(
                        "invalid_parameters",
                        Some(json!({ "tool": tool_name, "error": e.to_string() })),
                    )
                })?;
                // wrap into Parameters<> and call the tool
                self.get_user_context(Parameters(params)).await
            }

            "semantic_search_screenshots" => {
                let params: SemanticSearchArgs = serde_json::from_value(incoming).map_err(|e| {
                    McpError::internal_error(
                        "invalid_parameters",
                        Some(json!({ "tool": tool_name, "error": e.to_string() })),
                    )
                })?;
                self.semantic_search_screenshots(Parameters(params)).await
            }

            "ocr_screenshot" => {
                let params: OcrArgs = serde_json::from_value(incoming).map_err(|e| {
                    McpError::internal_error(
                        "invalid_parameters",
                        Some(json!({ "tool": tool_name, "error": e.to_string() })),
                    )
                })?;
                self.ocr_screenshot(Parameters(params)).await
            }

            other => Err(McpError::internal_error(
                "tool_not_found",
                Some(json!({ "tool": other })),
            )),
        }
    }
}

#[tool_handler]
impl ServerHandler for LoycaServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            protocol_version: ProtocolVersion::V_2024_11_05,
            capabilities: ServerCapabilities::builder()
                .enable_resources()
                .enable_tools()
                .build(),
            server_info: Implementation {
                name: "loyca-mcp-server".to_string(),
                version: "1.0.0".to_string(),
                title: Some("Loyca MCP Server".to_string()),
                website_url: None,
                icons: None,
            },
            instructions: Some(format!(
                "Loyca MCP Server provides semantic search and OCR capabilities for activity history. Available tools: {}",
                &self.list_tool_names().join(", ")
            )),
        }
    }

    async fn list_resources(
        &self,
        _request: Option<PaginatedRequestParam>,
        _: RequestContext<RoleServer>,
    ) -> Result<ListResourcesResult, McpError> {
        Ok(ListResourcesResult {
            resources: vec![
                RawResource::new("loyca://status", "Server Status".to_string()).no_annotation(),
                RawResource::new("loyca://tools", "Available Tools".to_string()).no_annotation(),
            ],
            next_cursor: None,
        })
    }

    async fn read_resource(
        &self,
        ReadResourceRequestParam { uri }: ReadResourceRequestParam,
        _: RequestContext<RoleServer>,
    ) -> Result<ReadResourceResult, McpError> {
        match uri.as_str() {
            "loyca://status" => {
                let state = self.state.lock().await;
                let status = json!({
                    "server": "loyca-mcp-server",
                    "version": "1.0.0",
                    "status": "running",
                    "request_count": state.request_count,
                    "bind_address": BIND_ADDRESS
                });

                Ok(ReadResourceResult {
                    contents: vec![ResourceContents::text(
                        serde_json::to_string_pretty(&status).unwrap(),
                        uri,
                    )],
                })
            }
            "loyca://tools" => {
                let tools_info = &self
                    .tool_router
                    .list_all()
                    .iter()
                    .map(|t| {
                        json!({
                            "name": t.name,
                            "description": t.description,
                            "parameters": t.input_schema
                        })
                    })
                    .collect::<Vec<_>>();

                Ok(ReadResourceResult {
                    contents: vec![ResourceContents::text(
                        serde_json::to_string_pretty(&tools_info).unwrap(),
                        uri,
                    )],
                })
            }
            _ => Err(McpError::resource_not_found(
                "resource_not_found",
                Some(json!({ "uri": uri })),
            )),
        }
    }

    async fn list_resource_templates(
        &self,
        _request: Option<PaginatedRequestParam>,
        _: RequestContext<RoleServer>,
    ) -> Result<ListResourceTemplatesResult, McpError> {
        Ok(ListResourceTemplatesResult {
            next_cursor: None,
            resource_templates: Vec::new(),
        })
    }

    async fn initialize(
        &self,
        _request: InitializeRequestParam,
        context: RequestContext<RoleServer>,
    ) -> Result<InitializeResult, McpError> {
        if let Some(http_request_part) = context.extensions.get::<axum::http::request::Parts>() {
            let initialize_headers = &http_request_part.headers;
            let initialize_uri = &http_request_part.uri;
            tracing::info!(?initialize_headers, %initialize_uri, "Loyca MCP server initialized");
        }

        // Increment request count on initialization
        {
            let mut state = self.state.lock().await;
            state.request_count += 1;
        }

        Ok(self.get_info())
    }
}

// Tauri commands for MCP server management
#[tauri::command]
pub async fn start_mcp_server(app_handle: AppHandle) -> Result<String, String> {
    let manager = app_handle.state::<Arc<McpServerManager>>();

    match manager.start().await {
        Ok(()) => Ok(format!(
            "MCP Server started successfully on {}",
            BIND_ADDRESS
        )),
        Err(e) => Err(format!("Failed to start MCP Server: {}", e)),
    }
}

#[tauri::command]
pub async fn stop_mcp_server(app_handle: AppHandle) -> Result<String, String> {
    let manager = app_handle.state::<Arc<McpServerManager>>();

    match manager.stop().await {
        Ok(()) => Ok("MCP Server stopped successfully".to_string()),
        Err(e) => Err(format!("Failed to stop MCP Server: {}", e)),
    }
}

#[tauri::command]
pub async fn get_mcp_server_status(app_handle: AppHandle) -> Result<serde_json::Value, String> {
    let manager = app_handle.state::<Arc<McpServerManager>>();
    let is_running = manager.is_running().await;

    Ok(serde_json::json!({
        "running": is_running,
        "bind_address": BIND_ADDRESS,
        "server_info": {
            "name": "loyca-mcp-server",
            "version": "1.0.0"
        }
    }))
}
