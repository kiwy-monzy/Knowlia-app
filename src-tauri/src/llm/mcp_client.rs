use anyhow::{Context, Result};
use futures::future::join_all;
use rmcp::{service::RunningService, transport::ConfigureCommandExt, RoleClient, ServiceExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tokio::process::Command;
use tokio::sync::RwLock;

use crate::sql;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct McpServerConfig {
    pub name: String,
    #[serde(flatten)]
    pub transport: McpServerTransportConfig,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "protocol", rename_all = "lowercase")]
pub enum McpServerTransportConfig {
    Streamable {
        url: String,
    },
    Sse {
        url: String,
    },
    Stdio {
        command: String,
        #[serde(default)]
        args: Vec<String>,
        #[serde(default)]
        envs: HashMap<String, String>,
    },
}

impl McpServerTransportConfig {
    pub async fn start(&self) -> Result<RunningService<RoleClient, ()>> {
        let client = match self {
            McpServerTransportConfig::Streamable { url } => {
                let transport =
                    rmcp::transport::StreamableHttpClientTransport::from_uri(url.to_string());
                ().serve(transport).await?
            }
            McpServerTransportConfig::Sse { url } => {
                let transport = rmcp::transport::SseClientTransport::start(url.to_owned()).await?;
                ().serve(transport).await?
            }
            McpServerTransportConfig::Stdio {
                command,
                args,
                envs,
            } => {
                let transport = rmcp::transport::child_process::TokioChildProcess::new(
                    Command::new(command).configure(|cmd| {
                        cmd.args(args)
                            .envs(envs)
                            .stderr(Stdio::inherit())
                            .stdout(Stdio::inherit());
                    }),
                )?;
                ().serve(transport).await?
            }
        };
        Ok(client)
    }
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct McpConfigFile {
    #[serde(rename = "mcpServers")]
    mcp_servers: HashMap<String, McpServerEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "protocol", rename_all = "lowercase")]
enum McpServerEntry {
    Streamable {
        url: String,
    },
    Sse {
        url: String,
    },
    Stdio {
        command: String,
        #[serde(default)]
        args: Vec<String>,
        #[serde(default, skip_serializing_if = "HashMap::is_empty")]
        env: HashMap<String, String>,
    },
}

impl From<&McpServerConfig> for McpServerEntry {
    fn from(config: &McpServerConfig) -> Self {
        match &config.transport {
            McpServerTransportConfig::Streamable { url } => {
                McpServerEntry::Streamable { url: url.clone() }
            }
            McpServerTransportConfig::Sse { url } => McpServerEntry::Sse { url: url.clone() },
            McpServerTransportConfig::Stdio {
                command,
                args,
                envs,
            } => McpServerEntry::Stdio {
                command: command.clone(),
                args: args.clone(),
                env: envs.clone(),
            },
        }
    }
}

impl McpServerEntry {
    fn to_config(&self, name: &str) -> McpServerConfig {
        let transport = match self {
            McpServerEntry::Streamable { url } => {
                McpServerTransportConfig::Streamable { url: url.clone() }
            }
            McpServerEntry::Sse { url } => McpServerTransportConfig::Sse { url: url.clone() },
            McpServerEntry::Stdio { command, args, env } => McpServerTransportConfig::Stdio {
                command: command.clone(),
                args: args.clone(),
                envs: env.clone(),
            },
        };

        McpServerConfig {
            name: name.to_string(),
            transport,
        }
    }
}

impl McpServerConfig {
    /// Creates a new server configuration with stdio transport.
    pub fn new_stdio(
        name: impl Into<String>,
        command: impl Into<String>,
        args: Vec<impl Into<String>>,
    ) -> Self {
        Self {
            name: name.into(),
            transport: McpServerTransportConfig::Stdio {
                command: command.into(),
                args: args.into_iter().map(|s| s.into()).collect(),
                envs: HashMap::new(),
            },
        }
    }

    /// Creates a new server configuration with streamable transport.
    pub fn new_streamable(name: impl Into<String>, url: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            transport: McpServerTransportConfig::Streamable { url: url.into() },
        }
    }

    /// Creates a new server configuration with SSE transport.
    pub fn new_sse(name: impl Into<String>, url: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            transport: McpServerTransportConfig::Sse { url: url.into() },
        }
    }

    /// Adds environment variables to the configuration (only for stdio transport).
    pub fn with_envs(mut self, envs: HashMap<String, String>) -> Self {
        if let McpServerTransportConfig::Stdio {
            envs: ref mut server_envs,
            ..
        } = self.transport
        {
            *server_envs = envs;
        }
        self
    }

    /// Starts the server and establishes an RMCP connection.
    async fn start(&self) -> Result<RunningService<RoleClient, ()>> {
        self.transport.start().await
    }
}

struct ManagedServer {
    config: McpServerConfig,
    client: RunningService<RoleClient, ()>,
}

/// Manages a collection of running MCP servers.
///
/// `McpClientManager` is a thread-safe, cloneable handle to the shared state of the servers.
#[derive(Clone)]
pub struct McpClientManager {
    servers: Arc<RwLock<HashMap<String, ManagedServer>>>,
    config_path: PathBuf,
}

impl McpClientManager {
    #[cfg(test)]
    pub fn new() -> Self {
        Self {
            servers: Arc::new(RwLock::new(HashMap::new())),
            config_path: PathBuf::from("mcp_config.json"), // Default path, will be updated
        }
    }

    pub fn with_config_path(config_path: PathBuf) -> Self {
        Self {
            servers: Arc::new(RwLock::new(HashMap::new())),
            config_path,
        }
    }

    fn load_config_file(&self) -> Result<McpConfigFile> {
        if !self.config_path.exists() {
            return Ok(McpConfigFile::default());
        }

        let content = fs::read_to_string(&self.config_path).with_context(|| {
            format!(
                "Failed to read MCP config from {}",
                self.config_path.display()
            )
        })?;

        if content.trim().is_empty() {
            return Ok(McpConfigFile::default());
        }

        let config: McpConfigFile = serde_json::from_str(&content).with_context(|| {
            format!(
                "Failed to parse MCP config from {}",
                self.config_path.display()
            )
        })?;

        Ok(config)
    }

    fn save_config_file(&self, config: &McpConfigFile) -> Result<()> {
        let content =
            serde_json::to_string_pretty(config).context("Failed to serialize MCP config")?;

        // Ensure the parent directory exists
        if let Some(parent) = self.config_path.parent() {
            fs::create_dir_all(parent).with_context(|| {
                format!("Failed to create config directory {}", parent.display())
            })?;
        }

        fs::write(&self.config_path, content).with_context(|| {
            format!(
                "Failed to write MCP config to {}",
                self.config_path.display()
            )
        })?;

        Ok(())
    }

    pub async fn load_servers_from_config(&self) -> Result<()> {
        let config_file = self.load_config_file()?;

        let server_in_db = sql::queries::get_all_servers()?;

        for (name, entry) in config_file.mcp_servers {
            let server_config = entry.to_config(&name);
            if let Err(e) = self.add_server_without_saving(server_config).await {
                tracing::error!("Failed to load MCP server '{}': {}", name, e);
            }

            // Update DB reference
            if server_in_db.contains(&name) {
                match self.list_tools(&name).await {
                    Ok(tools) => {
                        sql::queries::insert_tools(name.to_string(), tools)?;
                    }
                    Err(e) => {
                        tracing::error!("Failed to list tools for MCP server '{}': {}", name, e);
                    }
                }
            } else {
                // Delete server from DB
                sql::queries::delete_tool_server(name.to_string())?;
            }
        }

        Ok(())
    }

    async fn add_server_without_saving(&self, config: McpServerConfig) -> Result<()> {
        let name = config.name.clone();
        let mut servers = self.servers.write().await;

        if servers.contains_key(&name) {
            return Err(anyhow::anyhow!(
                "Server with name '{}' already exists",
                name
            ));
        }

        let client = config.start().await?;
        let server = ManagedServer { config, client };
        servers.insert(name, server);

        Ok(())
    }

    fn update_config_file(&self) -> Result<()> {
        // This method will be called after server changes to update the config file
        // We need to get the current servers and save them to the config file
        let servers = futures::executor::block_on(self.servers.read());
        let mut config_file = McpConfigFile::default();

        for (name, server) in servers.iter() {
            config_file
                .mcp_servers
                .insert(name.clone(), McpServerEntry::from(&server.config));
        }

        self.save_config_file(&config_file)
    }

    /// Adds and starts a new MCP server based on the provided configuration.
    pub async fn add_server(&self, config: McpServerConfig) -> Result<()> {
        self.add_server_without_saving(config).await?;
        self.update_config_file()?;
        Ok(())
    }

    /// Stops and removes a server by its name.
    pub async fn remove_server(&self, name: &str) -> Result<()> {
        let mut servers = self.servers.write().await;
        if servers.remove(name).is_some() {
            drop(servers); // Release the lock before updating config file
            self.update_config_file()?;
            Ok(())
        } else {
            Err(anyhow::anyhow!("Server '{}' not found", name))
        }
    }

    /// Returns a list of names of all currently running servers.
    pub async fn list_servers(&self) -> Vec<String> {
        self.servers.read().await.keys().cloned().collect()
    }

    /// Retrieves a copy of the configuration for a specific server.
    pub async fn get_server_config(&self, name: &str) -> Option<McpServerConfig> {
        self.servers
            .read()
            .await
            .get(name)
            .map(|s| s.config.clone())
    }

    /// Checks if a server with the given name is currently running.
    pub async fn is_server_running(&self, name: &str) -> bool {
        self.servers.read().await.contains_key(name)
    }

    /// Shuts down and removes all running servers.
    pub async fn shutdown_all(&self) {
        self.servers.write().await.clear();
        // Don't update config file on shutdown - keep the servers for next startup
    }

    /// Lists the available tools for a specific server.
    pub async fn list_tools(&self, server_name: &str) -> Result<Vec<rmcp::model::Tool>> {
        let servers = self.servers.read().await;
        let server = servers
            .get(server_name)
            .ok_or_else(|| anyhow::anyhow!("Server '{}' not found", server_name))?;

        let tools = server.client.list_tools(Default::default()).await?;
        Ok(tools.tools)
    }

    /// Retrieves all tools from all running servers concurrently.
    pub async fn get_all_tools(&self) -> Result<HashMap<String, Vec<rmcp::model::Tool>>> {
        let servers = self.servers.read().await;

        let futures = servers.iter().map(|(name, server)| async move {
            server
                .client
                .list_tools(Default::default())
                .await
                .map(|tools| (name.clone(), tools.tools))
        });

        let results: Vec<_> = join_all(futures).await;
        results
            .into_iter()
            .map(|result| result.map_err(Into::into))
            .collect()
    }

    /// Finds the configuration of the first server that provides a specific tool.
    async fn find_server_by_tool(&self, tool_name: &str) -> Result<Option<McpServerConfig>> {
        let servers = self.servers.read().await;

        for server in servers.values() {
            match server.client.list_tools(Default::default()).await {
                Ok(tool_list) => {
                    if tool_list
                        .tools
                        .iter()
                        .any(|tool| tool.name.as_ref() == tool_name)
                    {
                        return Ok(Some(server.config.clone()));
                    }
                }
                Err(e) => {
                    // Propagate errors from the client call, as a failing server
                    // could be the one that holds the tool.
                    return Err(e.into());
                }
            }
        }

        // If the loop completes, no server had the tool.
        Ok(None)
    }

    /// Calls a specific tool on a specific server with the given arguments.
    pub async fn call_tool(
        &self,
        tool_name: &str,
        arguments: Option<serde_json::Map<String, serde_json::Value>>,
    ) -> Result<rmcp::model::CallToolResult> {
        let Some(server_info) = self.find_server_by_tool(tool_name).await? else {
            return Err(anyhow::anyhow!("No server found for tool '{}'", tool_name));
        };

        let servers = self.servers.read().await;
        let server = servers
            .get(&server_info.name)
            .ok_or_else(|| anyhow::anyhow!("Server '{}' not found", server_info.name))?;

        let result = server
            .client
            .call_tool(rmcp::model::CallToolRequestParam {
                name: tool_name.to_string().into(),
                arguments,
            })
            .await?;
        Ok(result)
    }
}

#[tauri_crate::command]
pub async fn get_mcp_server_config(
    app_handle: AppHandle,
    name: String,
) -> Result<Option<McpServerConfig>, String> {
    let mcp_manager = app_handle.state::<McpClientManager>();
    Ok(mcp_manager.get_server_config(&name).await)
}

#[tauri_crate::command]
pub async fn list_mcp_tools(server_name: String) -> Result<Vec<sql::model::ToolData>, String> {
    match sql::queries::get_all_tools_by_server(server_name) {
        Ok(tools) => {
            if tools.is_empty() {
                Err("No tools found".to_string())
            } else {
                Ok(tools)
            }
        }
        Err(err) => Err(err.to_string()),
    }
}

#[tauri_crate::command]
pub async fn update_tool_status(
    server_name: String,
    tool_name: String,
    status: bool,
) -> Result<(), String> {
    sql::queries::update_tool_status(server_name, tool_name, status)?;
    Ok(())
}

#[tauri_crate::command]
pub async fn update_tool_status_by_server(server_name: String, status: bool) -> Result<(), String> {
    sql::queries::update_tool_status_by_server(server_name, status)?;
    Ok(())
}

#[tauri_crate::command]
pub async fn add_mcp_server(
    app_handle: AppHandle,
    name: String,
    protocol: String,
    command: Option<String>,
    args: Option<Vec<String>>,
    envs: Option<HashMap<String, String>>,
    url: Option<String>,
) -> Result<(), String> {
    let config = match protocol.as_str() {
        "stdio" => {
            let command =
                command.ok_or_else(|| "Command is required for stdio protocol".to_string())?;
            let args = args.unwrap_or_default();
            let mut config = McpServerConfig::new_stdio(name, command, args);
            if let Some(envs) = envs {
                config = config.with_envs(envs);
            }
            config
        }
        "streamable" => {
            let url = url.ok_or_else(|| "URL is required for streamable protocol".to_string())?;
            McpServerConfig::new_streamable(name, url)
        }
        "sse" => {
            let url = url.ok_or_else(|| "URL is required for SSE protocol".to_string())?;
            McpServerConfig::new_sse(name, url)
        }
        _ => {
            return Err(format!("Unknown protocol: {}", protocol));
        }
    };

    let mcp_manager = app_handle.state::<McpClientManager>();
    mcp_manager
        .add_server(config.clone())
        .await
        .map_err(|e| format!("Failed to add MCP server: {}", e))?;

    // Insert tools into the database
    match mcp_manager.list_tools(&config.name).await {
        Ok(tools) => {
            sql::queries::insert_tools(config.name.clone(), tools)?;
        }
        Err(e) => {
            return Err(format!(
                "Failed to list tools for MCP server '{}': {}",
                config.name, e
            ));
        }
    }

    Ok(())
}

#[tauri_crate::command]
pub async fn remove_mcp_server(app_handle: AppHandle, name: String) -> Result<(), String> {
    let mcp_manager = app_handle.state::<McpClientManager>();
    mcp_manager
        .remove_server(&name)
        .await
        .map_err(|e| format!("Failed to remove MCP server '{}': {}", name, e))?;

    // Remove tools from the database
    sql::queries::delete_tool_server(name)?;
    Ok(())
}

#[tauri_crate::command]
pub async fn list_mcp_servers(app_handle: AppHandle) -> Result<Vec<String>, String> {
    let mcp_manager = app_handle.state::<McpClientManager>();
    Ok(mcp_manager.list_servers().await)
}

#[tauri_crate::command]
pub async fn is_mcp_server_running(app_handle: AppHandle, name: String) -> Result<bool, String> {
    let mcp_manager = app_handle.state::<McpClientManager>();
    Ok(mcp_manager.is_server_running(&name).await)
}

#[cfg(test)]
mod tests {

    use super::*;
    use anyhow::Result;
    // use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

    #[tokio::test]
    async fn test_mcp_client_manager() -> Result<()> {
        // Initialize logging
        // tracing_subscriber::registry()
        //     .with(
        //         tracing_subscriber::EnvFilter::try_from_default_env()
        //             .unwrap_or_else(|_| format!("info,{}=debug", env!("CARGO_CRATE_NAME")).into()),
        //     )
        //     .with(tracing_subscriber::fmt::layer())
        //     .init();

        println!("🚀 Starting MCP client manager test");

        let manager = McpClientManager::new();

        // Create filesystem server config
        let config = McpServerConfig::new_stdio(
            "filesystem",
            "npx",
            vec!["-y", "@modelcontextprotocol/server-filesystem", "."],
        );

        // Add server
        println!("📦 Adding filesystem server...");
        manager.add_server(config).await?;

        // Verify server is running
        assert!(manager.is_server_running("filesystem").await);
        println!("✅ Filesystem server is running");

        // Test the server through the manager's public API
        println!("🔍 Testing filesystem server via manager...");

        // List tools
        let tools = manager.list_tools("filesystem").await?;
        println!("🔧 Available tools count: {}", tools.len());
        assert!(!tools.is_empty());

        let json_str = r#"{ "path": "." }"#;
        let args: serde_json::Map<String, serde_json::Value> = serde_json::from_str(json_str)?;

        // Test list_allowed_directories
        let allowed_dirs_result = manager.call_tool("list_directory", Some(args)).await?;
        println!("📊 Allowed directories: {:?}", allowed_dirs_result);

        // List all servers
        let servers = manager.list_servers().await;
        println!("📋 Active servers: {:?}", servers);
        assert_eq!(servers.len(), 1);
        assert!(servers.contains(&"filesystem".to_string()));

        // Remove server
        println!("🧹 Removing filesystem server...");
        manager.remove_server("filesystem").await?;
        println!("✅ Server removal completed");

        // Verify server is removed
        let is_running = manager.is_server_running("filesystem").await;
        let remaining_servers = manager.list_servers().await;
        println!("📋 Remaining servers: {:?}", remaining_servers);

        assert!(!is_running);
        assert!(remaining_servers.is_empty());
        println!("✅ Filesystem server removed successfully");

        fs::remove_file(manager.config_path)?;

        println!("✅ MCP client manager test completed successfully!");
        Ok(())
    }
}
