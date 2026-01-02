use anyhow::{Context, Result};
use mega::{Client, ClientBuilder};
use serde::{Deserialize, Serialize};
use sled::Db;
use std::sync::Arc;
use tokio::sync::Mutex;
use reqwest::Client as ReqwestClient;

const DB_PATH: &str = "mega.knowlia";
const SESSION_KEY: &[u8] = b"mega_session";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MegaSession {
    pub email: String,
    pub password: String,
    pub mfa: Option<String>,
    pub session: Option<Vec<u8>>,
}

pub struct MegaManager {
    db: Arc<Db>,
    client: Arc<Mutex<Option<Client>>>,
}

impl MegaManager {
    pub fn new() -> Result<Self> {
        let db = sled::open(DB_PATH).context("Failed to open sled database")?;
        Ok(Self {
            db: Arc::new(db),
            client: Arc::new(Mutex::new(None)),
        })
    }

    pub async fn login(&self, email: &str, password: &str, mfa: Option<&str>) -> Result<()> {
        let mut session = MegaSession {
            email: email.to_string(),
            password: password.to_string(),
            mfa: mfa.map(|s| s.to_string()),
            session: None,
        };

        let http_client = ReqwestClient::new();
        let mut client = Client::builder().build(http_client)?;
        
        // Try to restore session if exists
        if let Some(session_data) = self.load_session()? {
            if session_data.email == email {
                if let Some(session_bytes) = &session_data.session {
                    if let Ok(session_str) = String::from_utf8(session_bytes.clone()) {
                        if let Ok(_) = client.resume_session(&session_str).await {
                        *self.client.lock().await = Some(client);
                        return Ok(());
                        }
                    }
                }
            }
        }

        // If no session or restore failed, do a fresh login
        let mfa_param = mfa.filter(|s| !s.is_empty());
        client.login(email, password, mfa_param).await?;
        
        // Save the session
        if let Ok(session_str) = client.dump_session() {
            session.session = Some(session_str.into_bytes());
        } else {
            return Err(anyhow::anyhow!("Failed to dump session"));
        }
        self.save_session(&session)?;
        
        *self.client.lock().await = Some(client);
        Ok(())
    }

    pub async fn list_files(&self, path: Option<&str>) -> Result<serde_json::Value> {
        let client_guard = self.client.lock().await;
        let client = client_guard.as_ref().context("Not logged in")?;
        
        let nodes = client.fetch_own_nodes().await?;
        
        if let Some(path) = path {
            if let Some(node) = nodes.get_node_by_path(path) {
                return Ok(serde_json::json!(self.collect_node_info(&nodes, node)));
            }
            return Ok(serde_json::json!([]));
        }

        let mut result = serde_json::Map::new();
        
        if let Some(root) = nodes.cloud_drive() {
            result.insert("cloud_drive".to_string(), self.collect_node_info(&nodes, root));
        }
        if let Some(inbox) = nodes.inbox() {
            result.insert("inbox".to_string(), self.collect_node_info(&nodes, inbox));
        }
        if let Some(rubbish) = nodes.rubbish_bin() {
            result.insert("rubbish_bin".to_string(), self.collect_node_info(&nodes, rubbish));
        }
        
        Ok(serde_json::Value::Object(result))
    }

    fn collect_node_info(&self, nodes: &mega::Nodes, node: &mega::Node) -> serde_json::Value {
        let mut result = serde_json::Map::new();
        
        result.insert("name".to_string(), node.name().into());
        result.insert("handle".to_string(), node.handle().into());
        result.insert("kind".to_string(), format!("{:?}", node.kind()).into());
        result.insert("size".to_string(), node.size().into());
        
        if node.kind().is_folder() {
            let children: Vec<_> = node.children()
                .iter()
                .filter_map(|hash| nodes.get_node_by_handle(hash))
                .map(|node| self.collect_node_info(nodes, node))
                .collect();
            
            result.insert("children".to_string(), children.into());
        }
        
        serde_json::Value::Object(result)
    }

    fn save_session(&self, session: &MegaSession) -> Result<()> {
        let serialized = bincode::serialize(session)?;
        self.db.insert(SESSION_KEY, serialized)?;
        self.db.flush()?;
        Ok(())
    }

    fn load_session(&self) -> Result<Option<MegaSession>> {
        if let Some(session_data) = self.db.get(SESSION_KEY)? {
            let session = bincode::deserialize(&session_data)?;
            Ok(Some(session))
        } else {
            Ok(None)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_mega_manager() {
        let manager = MegaManager::new().unwrap();
        // Note: This is just a test - in a real app, don't hardcode credentials
        let email = "test@example.com";
        let password = "testpassword";
        
        // This will fail with invalid credentials, but tests the structure
        let _ = manager.login(email, password, None).await;
    }
}
