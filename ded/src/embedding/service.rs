use anyhow::{Error as E, Result};
use candle_core::{Device, Tensor};
use candle_nn::VarBuilder;
use candle_transformers::models::bert::{BertModel, Config, DTYPE};
use hf_hub::{api::tokio::ApiBuilder, Cache, Repo, RepoType};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokenizers::{PaddingParams, Tokenizer};
use tokio::sync::{Mutex, RwLock};

use crate::constants::{EMBEDDING_MODEL_ID, EMBEDDING_MODEL_REVISION};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingRequest {
    pub text: String,
    pub normalize: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct EmbeddingResponse {
    pub embeddings: Vec<f32>,
    pub dimension: usize,
}

pub struct EmbeddingService {
    model: Option<BertModel>,
    tokenizer: Option<Tokenizer>,
    device: Device,
    model_id: String,
    revision: String,
    is_ready: bool,
}

struct ProgressState {
    current: usize,
    total: usize,
}

#[derive(Clone)]
struct ModelDownloadProgress {
    app_handle: AppHandle,
    state: Arc<Mutex<ProgressState>>,
}

impl hf_hub::api::tokio::Progress for ModelDownloadProgress {
    async fn init(&mut self, size: usize, _filename: &str) {
        let mut state = self.state.lock().await;
        state.total = size;
        state.current = 0;
    }

    async fn update(&mut self, current_chunk_size: usize) {
        let mut state = self.state.lock().await;
        if state.total > 0 {
            state.current += current_chunk_size;
            let progress = state.current as f32 / state.total as f32;
            let _ = self.app_handle.emit("embedding-status", progress * 95.0);
        }
    }

    async fn finish(&mut self) {
        // You might want to lock here too for consistency, although it's less critical
        let _state = self.state.lock().await;
        let _ = self.app_handle.emit("embedding-status", 95.0);
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct EmbeddingServiceInfo {
    pub model_id: String,
    pub revision: String,
    pub device: String,
    pub is_ready: bool,
}

impl EmbeddingService {
    pub fn new() -> Result<Self> {
        let device = Device::Cpu;
        let model_id = EMBEDDING_MODEL_ID.to_string();
        let revision = EMBEDDING_MODEL_REVISION.to_string();

        Ok(Self {
            model: None,
            tokenizer: None,
            device,
            model_id,
            revision,
            is_ready: false,
        })
    }

    pub async fn initialize(&mut self, app_handle: AppHandle) -> Result<()> {
        if self.model.is_some() && self.tokenizer.is_some() {
            app_handle.emit("embedding-status", 100.0)?;
            return Ok(());
        }

        let mut progress = 0.0;
        app_handle.emit("embedding-status", progress)?;

        let result = self.download_and_load_model(app_handle.clone()).await;
        match result {
            Ok(_) => {
                progress = 100.0;
                self.is_ready = true;
            }
            Err(_) => {
                progress = -1.0;
                self.is_ready = false;
            }
        }

        app_handle.emit("embedding-status", progress)?;

        result
    }

    async fn download_and_load_model(&mut self, app_handle: AppHandle) -> Result<()> {
        let repo = Repo::with_revision(
            self.model_id.clone(),
            RepoType::Model,
            self.revision.clone(),
        );

        let cache = Cache::default();
        let api = ApiBuilder::from_cache(cache.clone())
            .build()?
            .repo(repo.clone());

        let config_filename = api.get("config.json").await?;
        let tokenizer_filename = api.get("tokenizer.json").await?;

        let progress_tracker = ModelDownloadProgress {
            app_handle: app_handle.clone(),
            state: Arc::new(Mutex::new(ProgressState {
                total: 0,
                current: 0,
            })),
        };

        let weights_filename = if let Some(path) = cache.repo(repo.clone()).get("model.safetensors")
        {
            tracing::info!("Embeddings - Using cached weights file");
            path
        } else {
            api.download_with_progress("model.safetensors", progress_tracker)
                .await?
        };

        async fn update_post_download_progress(
            app_handle: &AppHandle,
            progress: f32,
        ) -> Result<()> {
            app_handle.emit("embedding-status", progress)?;
            Ok(())
        }

        update_post_download_progress(&app_handle, 96.0).await?;
        let config_str = tokio::fs::read_to_string(&config_filename)
            .await
            .map_err(|e| {
                anyhow::anyhow!("Failed to read config file at {:?}: {}", config_filename, e)
            })?;

        let mut value: serde_json::Value = serde_json::from_str(&config_str)
            .map_err(|e| anyhow::anyhow!("Failed to parse config.json: {}", e))?;

        // BertModel only supports GeLU, GELUApproximate, ReLU
        // Ensure hidden_act field exists with a supported value
        if let Some(act) = value.get("hidden_act").and_then(|v| v.as_str()) {
            let act_lc = act.to_ascii_lowercase();
            if act_lc != "gelu" && act_lc != "geluapproximate" && act_lc != "relu" {
                tracing::error!(
                    "Unsupported activation function '{}', defaulting to 'gelu'",
                    act
                );
                value["hidden_act"] = serde_json::Value::String("gelu".to_string());
            }
        } else {
            // Add missing hidden_act field with default value
            tracing::info!("Missing hidden_act field, adding default 'gelu'");
            value["hidden_act"] = serde_json::Value::String("gelu".to_string());
        }

        // Ensure required fields exist with sensible defaults
        if value.get("hidden_size").is_none() {
            let hidden_size = value.get("hidden_dim")
                .or_else(|| value.get("d_model"))
                .and_then(|v| v.as_u64())
                .unwrap_or(768) as i64;
            value["hidden_size"] = serde_json::Value::Number(hidden_size.into());
        }

        if value.get("intermediate_size").is_none() {
            let hidden_size = value.get("hidden_size").and_then(|v| v.as_u64()).unwrap_or(768) as i64;
            value["intermediate_size"] = serde_json::Value::Number((hidden_size * 4).into());
        }

        if value.get("num_attention_heads").is_none() {
            value["num_attention_heads"] = serde_json::Value::Number(12.into());
        }

        if value.get("num_hidden_layers").is_none() {
            value["num_hidden_layers"] = serde_json::Value::Number(12.into());
        }

        if value.get("hidden_dropout_prob").is_none() {
            value["hidden_dropout_prob"] = serde_json::Value::Number(serde_json::Number::from_f64(0.1).unwrap());
        }

        if value.get("attention_probs_dropout_prob").is_none() {
            value["attention_probs_dropout_prob"] = serde_json::Value::Number(serde_json::Number::from_f64(0.1).unwrap());
        }

        if value.get("max_position_embeddings").is_none() {
            value["max_position_embeddings"] = serde_json::Value::Number(512.into());
        }

        if value.get("layer_norm_eps").is_none() {
            value["layer_norm_eps"] = serde_json::Value::Number(serde_json::Number::from_f64(1e-12).unwrap());
        }

        if value.get("type_vocab_size").is_none() {
            value["type_vocab_size"] = serde_json::Value::Number(2.into());
        }

        if value.get("initializer_range").is_none() {
            value["initializer_range"] = serde_json::Value::Number(serde_json::Number::from_f64(0.02).unwrap());
        }

        let config: Config = serde_json::from_value(value)
            .map_err(|e| anyhow::anyhow!("Failed to deserialize Config: {}", e))?;

        update_post_download_progress(&app_handle, 97.0).await?;
        let tokenizer_path = tokenizer_filename.clone();
        let tokenizer = tokio::task::spawn_blocking(move || {
            Tokenizer::from_file(tokenizer_path).map_err(E::msg)
        })
        .await??;

        update_post_download_progress(&app_handle, 98.0).await?;
        let weights_path = weights_filename.clone();
        let device = self.device.clone();
        let vb = tokio::task::spawn_blocking(move || -> Result<VarBuilder> {
            unsafe {
                VarBuilder::from_mmaped_safetensors(&[weights_path], DTYPE, &device)
                    .map_err(|e| anyhow::anyhow!("Failed to load weights: {}", e))
            }
        })
        .await??;

        let model = BertModel::load(vb, &config)?;

        self.model = Some(model);
        self.tokenizer = Some(tokenizer);

        Ok(())
    }

    pub async fn create_embedding(&self, request: EmbeddingRequest) -> Result<EmbeddingResponse> {
        let model = self
            .model
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Model not initialized"))?;

        let mut tokenizer = self
            .tokenizer
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Tokenizer not initialized"))?
            .clone();

        let tokenizer = tokenizer
            .with_padding(None)
            .with_truncation(None)
            .map_err(E::msg)?;

        let tokens = tokenizer
            .encode(request.text, true)
            .map_err(E::msg)?
            .get_ids()
            .to_vec();

        let token_ids = Tensor::new(&tokens[..], &self.device)?.unsqueeze(0)?;
        let token_type_ids = token_ids.zeros_like()?;

        let embeddings = model.forward(&token_ids, &token_type_ids, None)?;

        let (_n_sentence, n_tokens, _hidden_size) = embeddings.dims3()?;
        let embeddings = (embeddings.sum(1)? / (n_tokens as f64))?;

        let embeddings = if request.normalize.unwrap_or(true) {
            normalize_l2(&embeddings)?
        } else {
            embeddings
        };

        let embeddings_vec = embeddings.squeeze(0)?.to_vec1::<f32>()?;
        let dimension = embeddings_vec.len();

        Ok(EmbeddingResponse {
            embeddings: embeddings_vec,
            dimension,
        })
    }

    pub async fn create_batch_embeddings(
        &self,
        texts: Vec<String>,
        normalize: bool,
    ) -> Result<Vec<EmbeddingResponse>> {
        let model = self
            .model
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Model not initialized"))?;

        let mut tokenizer = self
            .tokenizer
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Tokenizer not initialized"))?
            .clone();

        if let Some(pp) = tokenizer.get_padding_mut() {
            pp.strategy = tokenizers::PaddingStrategy::BatchLongest;
        } else {
            let pp = PaddingParams {
                strategy: tokenizers::PaddingStrategy::BatchLongest,
                ..Default::default()
            };
            tokenizer.with_padding(Some(pp));
        }

        let tokens = tokenizer
            .encode_batch(texts.clone(), true)
            .map_err(E::msg)?;

        let token_ids = tokens
            .iter()
            .map(|tokens| {
                let tokens = tokens.get_ids().to_vec();
                Ok(Tensor::new(tokens.as_slice(), &self.device)?)
            })
            .collect::<Result<Vec<_>>>()?;

        let attention_mask = tokens
            .iter()
            .map(|tokens| {
                let tokens = tokens.get_attention_mask().to_vec();
                Ok(Tensor::new(tokens.as_slice(), &self.device)?)
            })
            .collect::<Result<Vec<_>>>()?;

        let token_ids = Tensor::stack(&token_ids, 0)?;
        let attention_mask = Tensor::stack(&attention_mask, 0)?;
        let token_type_ids = token_ids.zeros_like()?;

        let embeddings = model.forward(&token_ids, &token_type_ids, Some(&attention_mask))?;

        let (_n_sentence, n_tokens, _hidden_size) = embeddings.dims3()?;
        let embeddings = (embeddings.sum(1)? / (n_tokens as f64))?;

        let embeddings = if normalize {
            normalize_l2(&embeddings)?
        } else {
            embeddings
        };

        let mut responses = Vec::new();
        for i in 0..texts.len() {
            let embedding = embeddings.get(i)?;
            let embedding_vec = embedding.to_vec1::<f32>()?;
            let dimension = embedding_vec.len();

            responses.push(EmbeddingResponse {
                embeddings: embedding_vec,
                dimension,
            });
        }

        Ok(responses)
    }

    pub async fn compute_similarity(&self, text1: String, text2: String) -> Result<f32> {
        let embeddings = self
            .create_batch_embeddings(vec![text1, text2], true)
            .await?;

        if embeddings.len() != 2 {
            return Err(anyhow::anyhow!("Expected 2 embeddings"));
        }

        let e1 = &embeddings[0].embeddings;
        let e2 = &embeddings[1].embeddings;

        let dot_product: f32 = e1.iter().zip(e2.iter()).map(|(a, b)| a * b).sum();
        let norm1: f32 = e1.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm2: f32 = e2.iter().map(|x| x * x).sum::<f32>().sqrt();

        Ok(dot_product / (norm1 * norm2))
    }

    pub async fn compute_similarity_embeddings(
        &self,
        embeddings1: Vec<f32>,
        embeddings2: Vec<f32>,
    ) -> Result<f32> {
        if embeddings1.len() != embeddings2.len() {
            return Err(anyhow::anyhow!("Embeddings must have the same length"));
        }

        let dot_product: f32 = embeddings1
            .iter()
            .zip(embeddings2.iter())
            .map(|(a, b)| a * b)
            .sum();
        let norm1: f32 = embeddings1.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm2: f32 = embeddings2.iter().map(|x| x * x).sum::<f32>().sqrt();

        Ok(dot_product / (norm1 * norm2))
    }
}

fn normalize_l2(v: &Tensor) -> Result<Tensor> {
    Ok(v.broadcast_div(&v.sqr()?.sum_keepdim(1)?.sqrt()?)?)
}

pub struct EmbeddingManager {
    service: Arc<RwLock<Option<EmbeddingService>>>,
}

impl EmbeddingManager {
    pub fn new() -> Self {
        Self {
            service: Arc::new(RwLock::new(None)),
        }
    }

    pub async fn initialize(&self, app_handle: AppHandle) -> Result<()> {
        let mut service_lock = self.service.write().await;

        if let Some(service) = service_lock.as_mut() {
            if !service.is_ready {
                service.initialize(app_handle).await?;
            } else if service.is_ready {
                app_handle.emit("embedding-status", 100)?;
            }
        } else {
            let mut service = EmbeddingService::new()?;
            service.initialize(app_handle).await?;
            *service_lock = Some(service);
        }

        Ok(())
    }

    pub async fn get_model_info(&self) -> Result<EmbeddingServiceInfo> {
        let service_lock = self.service.read().await;

        let service = service_lock
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Service not initialized"))?;

        Ok(EmbeddingServiceInfo {
            model_id: service.model_id.clone(),
            revision: service.revision.clone(),
            device: if service.device.is_cpu() {
                "CPU".to_string()
            } else {
                "GPU".to_string()
            },
            is_ready: service.is_ready,
        })
    }

    pub async fn create_embedding(&self, request: EmbeddingRequest) -> Result<EmbeddingResponse> {
        let service_lock = self.service.read().await;

        let service = service_lock
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Service not initialized"))?;

        service.create_embedding(request).await
    }

    pub async fn compute_similarity(&self, text1: String, text2: String) -> Result<f32> {
        let service_lock = self.service.read().await;

        let service = service_lock
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Service not initialized"))?;

        service.compute_similarity(text1, text2).await
    }

    pub async fn compute_similarity_embeddings(
        &self,
        embeddings1: Vec<f32>,
        embeddings2: Vec<f32>,
    ) -> Result<f32> {
        let service_lock = self.service.read().await;

        let service = service_lock
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Service not initialized"))?;

        service
            .compute_similarity_embeddings(embeddings1, embeddings2)
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    impl EmbeddingService {
        async fn initialize_test(&mut self) -> Result<()> {
            let repo = Repo::with_revision(
                self.model_id.clone(),
                RepoType::Model,
                self.revision.clone(),
            );

            let cache = Cache::default();
            let api = ApiBuilder::from_cache(cache.clone())
                .with_progress(true)
                .build()?
                .repo(repo.clone());

            let config_filename = api.get("config.json").await?;
            let tokenizer_filename = api.get("tokenizer.json").await?;
            let weights_filename = api.get("model.safetensors").await?;

            let config_str = tokio::fs::read_to_string(&config_filename)
                .await
                .map_err(|e| {
                    anyhow::anyhow!("Failed to read config file at {:?}: {}", config_filename, e)
                })?;

            let mut value: serde_json::Value = serde_json::from_str(&config_str)
                .map_err(|e| anyhow::anyhow!("Failed to parse config.json: {}", e))?;

            // Ensure hidden_act field exists with a supported value
            if let Some(act) = value.get("hidden_act").and_then(|v| v.as_str()) {
                let act_lc = act.to_ascii_lowercase();
                if act_lc != "gelu" && act_lc != "geluapproximate" && act_lc != "relu" {
                    tracing::error!(
                        "Unsupported activation function '{}', defaulting to 'gelu'",
                        act
                    );
                    value["hidden_act"] = serde_json::Value::String("gelu".to_string());
                }
            } else {
                // Add missing hidden_act field with default value
                tracing::info!("Missing hidden_act field, adding default 'gelu'");
                value["hidden_act"] = serde_json::Value::String("gelu".to_string());
            }

            // Ensure required fields exist with sensible defaults
            if value.get("hidden_size").is_none() {
                let hidden_size = value.get("hidden_dim")
                    .or_else(|| value.get("d_model"))
                    .and_then(|v| v.as_u64())
                    .unwrap_or(768) as i64;
                value["hidden_size"] = serde_json::Value::Number(hidden_size.into());
            }

            if value.get("intermediate_size").is_none() {
                let hidden_size = value.get("hidden_size").and_then(|v| v.as_u64()).unwrap_or(768) as i64;
                value["intermediate_size"] = serde_json::Value::Number((hidden_size * 4).into());
            }

            if value.get("num_attention_heads").is_none() {
                value["num_attention_heads"] = serde_json::Value::Number(12.into());
            }

            if value.get("num_hidden_layers").is_none() {
                value["num_hidden_layers"] = serde_json::Value::Number(12.into());
            }

            if value.get("layer_norm_eps").is_none() {
                value["layer_norm_eps"] = serde_json::Value::Number(serde_json::Number::from_f64(1e-12).unwrap());
            }

            if value.get("type_vocab_size").is_none() {
                value["type_vocab_size"] = serde_json::Value::Number(2.into());
            }

            if value.get("initializer_range").is_none() {
                value["initializer_range"] = serde_json::Value::Number(serde_json::Number::from_f64(0.02).unwrap());
            }

            let config: Config = serde_json::from_value(value)
                .map_err(|e| anyhow::anyhow!("Failed to deserialize Config: {}", e))?;

            let tokenizer_path = tokenizer_filename.clone();
            let tokenizer = tokio::task::spawn_blocking(move || {
                Tokenizer::from_file(tokenizer_path).map_err(E::msg)
            })
            .await??;

            let weights_path = weights_filename.clone();
            let device = self.device.clone();
            let vb = tokio::task::spawn_blocking(move || -> Result<VarBuilder> {
                unsafe {
                    VarBuilder::from_mmaped_safetensors(&[weights_path], DTYPE, &device)
                        .map_err(|e| anyhow::anyhow!("Failed to load weights: {}", e))
                }
            })
            .await??;

            let model = BertModel::load(vb, &config)?;

            self.model = Some(model);
            self.tokenizer = Some(tokenizer);

            Ok(())
        }
    }

    #[tokio::test]
    async fn test_embedding_creation() {
        let mut service = EmbeddingService::new().unwrap();

        // Check initial state
        assert!(!service.is_ready);
        assert_eq!(service.model_id, EMBEDDING_MODEL_ID);
        assert_eq!(service.revision, EMBEDDING_MODEL_REVISION);

        // Test embedding request creation
        let request = EmbeddingRequest {
            text: "Hello world".to_string(),
            normalize: Some(true),
        };

        // Since we can't easily initialize the full model in tests,
        // we'll test the service creation and basic properties
        assert!(service.model.is_none());
        assert!(service.tokenizer.is_none());
        assert!(service.device.is_cpu());

        service.initialize_test().await.unwrap();

        let embedding = service
            .create_embedding(request)
            .await
            .expect("Failed to create embedding");
        assert_eq!(embedding.dimension, 384);
    }

    #[tokio::test]
    #[ignore = "all-distilroberta-v1 is a larger model"]
    async fn test_different_model_id() {
        // Test with a different model configuration
        let device = Device::Cpu;
        let custom_model_id = "sentence-transformers/all-distilroberta-v1".to_string();
        let custom_revision = "main".to_string();

        let mut service = EmbeddingService {
            model: None,
            tokenizer: None,
            device,
            model_id: custom_model_id.clone(),
            revision: custom_revision.clone(),
            is_ready: false,
        };

        // Test embedding request creation
        let request = EmbeddingRequest {
            text: "Hello world".to_string(),
            normalize: Some(true),
        };

        service.initialize_test().await.unwrap();

        // Verify the different model ID is set correctly
        assert_eq!(service.model_id, custom_model_id);
        assert_eq!(service.revision, custom_revision);
        assert!(!service.is_ready);
        assert!(service.device.is_cpu());

        let embedding = service
            .create_embedding(request)
            .await
            .expect("Failed to create embedding");
        // This model has a dimension of 768
        assert_eq!(embedding.dimension, 768);
    }

    #[tokio::test]
    async fn test_embedding_manager() {
        let manager = EmbeddingManager::new();

        // Test initial state - service should be None
        let service_lock = manager.service.read().await;
        assert!(service_lock.is_none());
        drop(service_lock);

        // Test embedding request structure
        let request = EmbeddingRequest {
            text: "Manager test".to_string(),
            normalize: None, // Should default to true
        };

        assert_eq!(request.text, "Manager test");
        assert_eq!(request.normalize, None);
    }

    #[tokio::test]
    async fn test_embedding_response_structure() {
        let response = EmbeddingResponse {
            embeddings: vec![0.1, 0.2, 0.3, 0.4],
            dimension: 4,
        };

        assert_eq!(response.embeddings.len(), 4);
        assert_eq!(response.dimension, 4);
        assert_eq!(response.embeddings[0], 0.1);
        assert_eq!(response.embeddings[3], 0.4);
    }

    #[tokio::test]
    async fn test_service_info() {
        let service = EmbeddingService::new().unwrap();

        let info = EmbeddingServiceInfo {
            model_id: service.model_id.clone(),
            revision: service.revision.clone(),
            device: if service.device.is_cpu() {
                "CPU".to_string()
            } else {
                "GPU".to_string()
            },
            is_ready: service.is_ready,
        };

        assert_eq!(info.model_id, EMBEDDING_MODEL_ID);
        assert_eq!(info.revision, EMBEDDING_MODEL_REVISION);
        assert_eq!(info.device, "CPU");
        assert!(!info.is_ready);
    }
}
