//!
//! MEGA integration module for Tauri application
//! Provides tree listing and file management functionality
//!

use text_trees::{FormatCharacters, TreeFormatting};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MegaNode {
    pub handle: String,
    pub name: String,
    pub kind: String,
    pub size: Option<u64>,
    pub children: Vec<MegaNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MegaTreeResponse {
    pub cloud_drive: Option<MegaNode>,
    pub inbox: Option<MegaNode>,
    pub rubbish_bin: Option<MegaNode>,
}

/// Application state for MEGA client
pub struct MegaState {
    pub client: Arc<Mutex<Option<mega::Client>>>,
    pub logged_in: Arc<Mutex<bool>>,
}

impl Default for MegaState {
    fn default() -> Self {
        Self {
            client: Arc::new(Mutex::new(None)),
            logged_in: Arc::new(Mutex::new(false)),
        }
    }
}

/// Construct a tree node from MEGA nodes (recursively builds full tree)
fn construct_tree_node(nodes: &mega::Nodes, node: &mega::Node) -> MegaNode {
    // Get all children and partition into folders and files
    let (mut folders, mut files): (Vec<_>, Vec<_>) = node
        .children()
        .iter()
        .filter_map(|hash| nodes.get_node_by_handle(hash))
        .partition(|node| node.kind().is_folder());

    // Sort folders and files by name
    folders.sort_unstable_by_key(|node| node.name());
    files.sort_unstable_by_key(|node| node.name());

    // Recursively construct children (folders first, then files)
    let children = std::iter::empty()
        .chain(folders.iter())
        .chain(files.iter())
        .map(|node| construct_tree_node(nodes, node))
        .collect();

    MegaNode {
        handle: node.handle().to_string(),
        name: node.name().to_string(),
        kind: format!("{:?}", node.kind()),
        size: Some(node.size()),
        children,
    }
}

/// Login to MEGA
#[tauri_crate::command]
pub async fn mega_login(
    email: String,
    password: String,
    mfa: Option<String>,
    state: tauri_crate::State<'_, MegaState>,
) -> Result<String, String> {
    let http_client = reqwest::Client::new();
    let mut mega_client = mega::Client::builder().build(http_client)
        .map_err(|e| format!("Failed to create MEGA client: {}", e))?;

    // Convert Option<String> to Option<&str> for the login call
    let mfa_param = mfa.as_deref();

    mega_client.login(&email, &password, mfa_param).await
        .map_err(|e| format!("MEGA login failed: {}", e))?;

    // Store the client in state
    {
        let mut client_guard = state.client.lock().unwrap();
        *client_guard = Some(mega_client);
    }
    
    {
        let mut logged_in_guard = state.logged_in.lock().unwrap();
        *logged_in_guard = true;
    }

    Ok("Successfully logged into MEGA".to_string())
}

/// Logout from MEGA
#[tauri_crate::command]
pub async fn mega_logout(state: tauri_crate::State<'_, MegaState>) -> Result<String, String> {
    // Move client out so we can await safely
    let client_option = {
        let mut guard = state.client.lock().unwrap();
        guard.take()
    };
    if let Some(mut mega_client) = client_option {
        mega_client.logout().await
            .map_err(|e| format!("MEGA logout failed: {}", e))?;
    }
    {
        let mut guard = state.client.lock().unwrap();
        *guard = None;
    }
    {
        let mut logged_in_guard = state.logged_in.lock().unwrap();
        *logged_in_guard = false;
    }
    Ok("Successfully logged out from MEGA".to_string())
}

/// Get complete tree listing
#[tauri_crate::command]
pub async fn mega_get_tree_listing(
    state: tauri_crate::State<'_, MegaState>
) -> Result<MegaTreeResponse, String> {
    let client = {
        let mut guard = state.client.lock().unwrap();
        guard.take().ok_or("Not logged into MEGA. Please login first.")?
    };

    let nodes = client.fetch_own_nodes().await
        .map_err(|e| format!("Failed to fetch MEGA nodes: {}", e))?;

    let cloud_drive = nodes.cloud_drive()
        .map(|node| construct_tree_node(&nodes, node));
    
    let inbox = nodes.inbox()
        .map(|node| construct_tree_node(&nodes, node));
    
    let rubbish_bin = nodes.rubbish_bin()
        .map(|node| construct_tree_node(&nodes, node));

    // Put the (possibly mutated) client back into the state
    {
        let mut guard = state.client.lock().unwrap();
        *guard = Some(client);
    }

    Ok(MegaTreeResponse {
        cloud_drive,
        inbox,
        rubbish_bin,
    })
}

/// Get cloud drive only
#[tauri_crate::command]
pub async fn mega_get_cloud_drive(
    state: tauri_crate::State<'_, MegaState>
) -> Result<Option<MegaNode>, String> {
    let client = {
        let mut guard = state.client.lock().unwrap();
        guard.take().ok_or("Not logged into MEGA. Please login first.")?
    };

    let nodes = client.fetch_own_nodes().await
        .map_err(|e| format!("Failed to fetch MEGA nodes: {}", e))?;

    let result = nodes.cloud_drive()
        .map(|node| construct_tree_node(&nodes, node));
    {
        let mut guard = state.client.lock().unwrap();
        *guard = Some(client);
    }
    Ok(result)
}

/// Get inbox only
#[tauri_crate::command]
pub async fn mega_get_inbox(
    state: tauri_crate::State<'_, MegaState>
) -> Result<Option<MegaNode>, String> {
    let client = {
        let mut guard = state.client.lock().unwrap();
        guard.take().ok_or("Not logged into MEGA. Please login first.")?
    };

    let nodes = client.fetch_own_nodes().await
        .map_err(|e| format!("Failed to fetch MEGA nodes: {}", e))?;

    let result = nodes.inbox()
        .map(|node| construct_tree_node(&nodes, node));
    {
        let mut guard = state.client.lock().unwrap();
        *guard = Some(client);
    }
    Ok(result)
}

/// Get rubbish bin only
#[tauri_crate::command]
pub async fn mega_get_rubbish_bin(
    state: tauri_crate::State<'_, MegaState>
) -> Result<Option<MegaNode>, String> {
    let client = {
        let mut guard = state.client.lock().unwrap();
        guard.take().ok_or("Not logged into MEGA. Please login first.")?
    };

    let nodes = client.fetch_own_nodes().await
        .map_err(|e| format!("Failed to fetch MEGA nodes: {}", e))?;

    let result = nodes.rubbish_bin()
        .map(|node| construct_tree_node(&nodes, node));
    {
        let mut guard = state.client.lock().unwrap();
        *guard = Some(client);
    }
    Ok(result)
}

// Legacy standalone example code (for reference/testing)
#[allow(dead_code)]
async fn run_standalone(mega: &mut mega::Client, distant_file_path: Option<&str>) -> mega::Result<()> {
    let _stdout = std::io::stdout().lock();

    let nodes = mega.fetch_own_nodes().await?;

    if let Some(distant_file_path) = distant_file_path {
        let root = nodes
            .get_node_by_path(distant_file_path)
            .expect("could not get root node");

        let _tree = construct_tree_node(&nodes, root);
        let _formatting = TreeFormatting::dir_tree(FormatCharacters::box_chars());

        println!();
        // Note: This would need to be adapted for the new MegaNode structure
        println!("MEGA Tree for path: {}", distant_file_path);
        println!();
    } else {
        let _cloud_drive = nodes.cloud_drive().expect("could not get Cloud Drive root");
        let _inbox = nodes.inbox().expect("could not get Inbox root");
        let _rubbish_bin = nodes.rubbish_bin().expect("could not get Rubbish Bin root");

        let _formatting = TreeFormatting::dir_tree(FormatCharacters::box_chars());

        println!();
        println!("=== Cloud Drive ===");
        println!();
        println!();
        println!("=== Inbox ===");
        println!();
        println!();
        println!("=== Rubbish Bin ===");
        println!();
    }

    Ok(())
}

#[allow(dead_code)]
#[tokio::main(flavor = "current_thread")]
async fn main_standalone() {
    let email = "jayshevien@gmail.com";
    let password = "shevienPaty@2";
    let mfa: &str = "";

    println!("Attempting to login to MEGA...");
    println!("Email: {}", email);
    println!("MFA: {}", !mfa.is_empty());

    let args: Vec<String> = std::env::args().skip(1).collect();
    let distant_file_path = match args.as_slice() {
        [] => None,
        [distant_file_path] => Some(distant_file_path.as_str()),
        _ => {
            panic!("expected 0 or 1 command-line arguments: {{distant_file_path}}");
        }
    };

    let http_client = reqwest::Client::new();
    let mut mega = mega::Client::builder().build(http_client).unwrap();

    let mfa_param = if mfa.is_empty() { None } else { Some(mfa) };
    mega.login(&email, &password, mfa_param).await.unwrap();

    let result = run_standalone(&mut mega, distant_file_path).await;
    mega.logout().await.unwrap();

    result.unwrap();
}
