use crate::sql::model::{BanditStat, UserIntentionHistory};
use crate::{constants, sql};
use crate::{
    contextual_bandit::{
        context::{BanditContext, UserAction},
        neural_ucb_diag::NeuralUCBDiag,
    },
    notifications::send_notification,
};
use candle_core::Device;
use chrono::{Datelike, Timelike, Utc};
use once_cell::sync::Lazy;
use std::path::Path;
use std::sync::{Arc, Mutex};
use tauri::AppHandle;

// Global bandit agent instance
static BANDIT_AGENT: Lazy<Arc<Mutex<Option<NeuralUCBDiag>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));

// Global storage for the latest bandit context
static LATEST_BANDIT_CONTEXT: Lazy<Arc<Mutex<Option<BanditContext>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));

/// Save the bandit agent to disk
pub fn save_bandit_agent() -> Result<(), String> {
    let global_config = sql::get_config()?;
    let bandit_agent = BANDIT_AGENT.lock().unwrap();
    if let Some(ref agent) = bandit_agent.as_ref() {
        let save_path = Path::new(&global_config.app_path).join(constants::BANDIT_MODEL_PATH);
        agent
            .save(&save_path)
            .map_err(|e| format!("Failed to save bandit agent: {}", e))?;

        tracing::info!("Saved bandit agent to: {}", save_path.display());

        Ok(())
    } else {
        Err("Bandit agent not initialized".to_string())
    }
}

/// Load the bandit agent from disk if it exists
pub fn load_bandit_agent() -> Result<bool, String> {
    let global_config = sql::get_config()?;
    let save_path = Path::new(&global_config.app_path).join(constants::BANDIT_MODEL_PATH);

    if !save_path.exists() {
        return Ok(false);
    }

    let device = Device::Cpu;
    let agent = NeuralUCBDiag::load(&save_path, &device)
        .map_err(|e| format!("Failed to load bandit agent: {}", e))?;

    let mut bandit_agent = BANDIT_AGENT.lock().unwrap();
    *bandit_agent = Some(agent);

    tracing::info!("Loaded bandit agent from: {}", save_path.display());

    Ok(true)
}

/// Initialize the Neural UCB bandit agent
pub fn initialize_bandit_agent() -> Result<(), String> {
    // First try to load existing model
    match load_bandit_agent() {
        Ok(true) => {
            // Successfully loaded existing model
            tracing::info!("Initialized bandit agent from saved model");
            return Ok(());
        }
        Ok(false) => {
            // No saved model found, create new one
            tracing::info!("No saved model found, creating new bandit agent");
        }
        Err(e) => tracing::error!(
            "Error loading saved model ({}), creating new bandit agent",
            e
        ),
    }

    let device = Device::Cpu;

    // Calculate feature dimension (with embedding)
    let dummy_context = BanditContext {
        user_state: "idle".to_string(),
        app_category: "other".to_string(),
        focus_time: 0,
        total_focus_time: 0,
        duration_since_last: 0,
        num_transitions: 0,
        most_frequent_category: "other".to_string(),
        jaccard_similarity: 0.0,
        window_keywords: vec![],
        user_keywords: vec![],
        user_intention_embedding: vec![0.0; crate::constants::EMBEDDING_SIZE],
        hour_of_day: 12,
        day_of_week: 1,
        last_user_intention_str: String::new(),
        app_description_str: "unknown".to_string(),
    };

    let feature_dim = dummy_context.feature_dim(true); // Use embedding
    let hidden_size = 128;
    let lambda = 0.05;
    let nu = 1.0;

    let agent = NeuralUCBDiag::new(feature_dim, lambda, nu, hidden_size, &device)
        .map_err(|e| format!("Failed to initialize NeuralUCBDiag agent: {}", e))?;

    let mut bandit_agent = BANDIT_AGENT.lock().unwrap();
    *bandit_agent = Some(agent);

    tracing::info!(
        "Initialized new Neural UCB bandit agent with feature_dim={}",
        feature_dim
    );

    Ok(())
}

/// Generate BanditContext from user intention and current system state
pub fn generate_bandit_context(
    user_intention: &UserIntentionHistory,
) -> Result<BanditContext, String> {
    let global_config = sql::get_config()?;

    // Get current app focus time and transitions
    let current_app =
        sql::queries::get_currently_focused_app(None).unwrap_or_else(|_| sql::model::AppData {
            pid: 0,
            process_name: "unknown".to_string(),
            focus_time: 0,
            total_focus_time: 0,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            window_id: Some(0),
            title: Some("unknown".to_string()),
            category: Some("unknown".to_string()),
            description: Some("unknown".to_string()),
            is_focused: true,
        });

    let current_category = if current_app.category.is_some() {
        current_app.category.clone().unwrap()
    } else {
        "unknown".to_string()
    };

    // Get transitions in last hour to calculate num_transitions
    let one_hour_ago = user_intention.created_at - chrono::Duration::hours(1);
    let transitions =
        sql::queries::get_transitions_in_time_window(one_hour_ago, user_intention.created_at)
            .unwrap_or_default();
    let num_transitions = transitions.len() as u32;

    // Calculate most frequent category from recent transitions
    let mut category_counts = std::collections::HashMap::new();
    for transition in &transitions {
        if let Ok(window_info) =
            sql::queries::get_window_info_near_time(transition.from_pid, transition.created_at, 5)
        {
            *category_counts.entry(window_info.llm_category).or_insert(0) += 1;
        }
    }
    let most_frequent_category = category_counts
        .into_iter()
        .max_by_key(|(_, count)| *count)
        .map(|(cat, _)| cat)
        .unwrap_or_else(|| current_category.clone());

    // Calculate cumulative focus time (approximate as current focus time for now)
    let total_focus_time = current_app.total_focus_time as i64;

    // Calculate duration since last transition
    let duration_since_last = transitions
        .last()
        .map(|t| (user_intention.created_at.timestamp() - t.created_at.timestamp()) as i64)
        .unwrap_or(0);

    // Calculate Jaccard similarity with previous keywords
    let jaccard_similarity = if let Ok(recent_intentions) = sql::queries::get_recent_user_intentions(
        1,
        global_config.user_intention_delay.parse().unwrap(),
    ) {
        if let Some(prev_intention) = recent_intentions.first() {
            let current_keywords: std::collections::HashSet<String> = user_intention
                .llm_keywords
                .split(',')
                .map(|s| s.trim().to_string())
                .collect();
            let prev_keywords: std::collections::HashSet<String> = prev_intention
                .llm_keywords
                .split(',')
                .map(|s| s.trim().to_string())
                .collect();

            let intersection = current_keywords.intersection(&prev_keywords).count();
            let union = current_keywords.union(&prev_keywords).count();

            if union > 0 {
                intersection as f32 / union as f32
            } else {
                0.0
            }
        } else {
            0.0
        }
    } else {
        0.0
    };

    // Extract keywords
    let user_keywords: Vec<String> = user_intention
        .llm_keywords
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    // Get window keywords (approximate from current window if available)
    let window_keywords = if current_app.pid > 0 {
        sql::queries::get_window_info_near_time(current_app.pid, current_app.updated_at, 5)
            .map(|w| {
                w.llm_keywords
                    .split(',')
                    .map(|s| s.trim().to_string())
                    .collect()
            })
            .unwrap_or_default()
    } else {
        vec![]
    };

    let app_description_str = if current_app.description.is_some() {
        current_app.description.unwrap()
    } else {
        "unknown".to_string()
    };

    let context = BanditContext {
        user_state: user_intention.llm_user_state.clone(),
        app_category: current_category,
        focus_time: current_app.focus_time as i64,
        total_focus_time,
        duration_since_last,
        num_transitions,
        most_frequent_category,
        jaccard_similarity,
        window_keywords,
        user_keywords,
        user_intention_embedding: user_intention.user_intention_embedding.clone(),
        hour_of_day: user_intention.created_at.hour(),
        day_of_week: user_intention.created_at.weekday().num_days_from_monday(),
        last_user_intention_str: user_intention.llm_user_intention.clone(),
        app_description_str,
    };

    // Store the latest context
    store_latest_bandit_context(&context);

    Ok(context)
}

/// Determine the chosen arm using the bandit agent and notify the user
pub async fn determine_chosen_arm_and_notify(
    app_handle: &AppHandle,
    context: &BanditContext,
    from_test: bool,
) -> Result<usize, String> {
    let chosen_arm = {
        let mut bandit_agent = BANDIT_AGENT.lock().unwrap();

        if let Some(ref mut agent) = bandit_agent.as_mut() {
            let device = Device::Cpu;
            let feature_dim = context.feature_dim(true);

            // Prepare context tensor for both arms (0: no assist, 1: assist)
            let context_tensor = context
                .to_tensor(&device, true)
                .map_err(|e| format!("Failed to create context tensor: {}", e))?;
            let zero_context =
                candle_core::Tensor::zeros((1, feature_dim), candle_core::DType::F32, &device)
                    .map_err(|e| format!("Failed to create zero context tensor: {}", e))?;
            let contexts_for_agent = candle_core::Tensor::cat(&[&zero_context, &context_tensor], 0)
                .map_err(|e| format!("Failed to concatenate context tensors: {}", e))?;

            // Get agent's decision
            let (chosen_arm, _g_norm, _ave_sigma, _ave_rew) = agent
                .select(&contexts_for_agent)
                .map_err(|e| format!("Failed to select arm: {}", e))?;

            tracing::info!(
                "Bandit agent chose arm: {} (0=no_assist, 1=assist) [g={:.2}, ave_sigma={:.2}, ave_rew={:.2}]",
                chosen_arm, _g_norm, _ave_sigma, _ave_rew
            );

            Ok(chosen_arm)
        } else {
            Err("Bandit agent not initialized".to_string())
        }
    }?; // Drop the mutex guard here

    // Now handle the chosen arm without holding the mutex
    if chosen_arm == 0 && !from_test {
        // No notification, train with omit
        train_bandit_agent(&context, 0, UserAction::Omit)?;
        drop_latest_bandit_context();
    } else {
        // Notify the user and wait for feedback
        send_notification(app_handle.clone(), from_test).await?;
    }

    Ok(chosen_arm)
}

/// Train the bandit agent with reward feedback (to be called later when we have user feedback)
pub fn train_bandit_agent(
    context: &BanditContext,
    chosen_arm: usize,
    user_action: UserAction,
) -> Result<(), String> {
    let mut bandit_agent = BANDIT_AGENT.lock().unwrap();

    if let Some(ref mut agent) = bandit_agent.as_mut() {
        let device = Device::Cpu;
        let feature_dim = context.feature_dim(true);

        // Prepare context tensor for the chosen arm
        let context_tensor = context
            .to_tensor(&device, true)
            .map_err(|e| format!("Failed to create context tensor: {}", e))?;
        let zero_context =
            candle_core::Tensor::zeros((1, feature_dim), candle_core::DType::F32, &device)
                .map_err(|e| format!("Failed to create zero context tensor: {}", e))?;
        let contexts_for_agent = candle_core::Tensor::cat(&[&zero_context, &context_tensor], 0)
            .map_err(|e| format!("Failed to concatenate context tensors: {}", e))?;

        let reward = context.compute_reward(chosen_arm, user_action);

        let training_context = contexts_for_agent
            .narrow(0, chosen_arm, 1)
            .map_err(|e| format!("Failed to narrow context tensor: {}", e))?;
        agent
            .train(&training_context, reward)
            .map_err(|e| format!("Failed to train bandit agent: {}", e))?;

        tracing::info!(
            "Trained bandit agent with reward: {:.2} for arm: {}",
            reward,
            chosen_arm
        );

        sql::queries::insert_bandit_stat(BanditStat {
            id: None,
            user_state: context.user_state.clone(),
            to_assist: chosen_arm == 1,
            user_action: user_action.to_string(),
            reward,
            created_at: chrono::Utc::now(),
        })?;

        // Drop the mutex guard before calling save to avoid deadlock
        drop(bandit_agent);
        if let Err(e) = save_bandit_agent() {
            tracing::error!("Failed to save bandit agent: {}", e);
        }

        Ok(())
    } else {
        Err("Bandit agent not initialized".to_string())
    }
}

/// Store the latest bandit context
pub fn store_latest_bandit_context(context: &BanditContext) {
    let mut latest_context = LATEST_BANDIT_CONTEXT.lock().unwrap();
    *latest_context = Some(context.clone());

    tracing::info!("Stored latest bandit context");
}

/// Get the latest stored bandit context
pub fn get_latest_bandit_context() -> Option<BanditContext> {
    let latest_context = LATEST_BANDIT_CONTEXT.lock().unwrap();
    latest_context.clone()
}

/// Drop the latest stored bandit context
pub fn drop_latest_bandit_context() {
    let mut latest_context = LATEST_BANDIT_CONTEXT.lock().unwrap();
    *latest_context = None;

    tracing::info!("Dropped latest bandit context");
}

/// Delete the bandit model checkpoint from disk
pub fn delete_bandit_model_checkpoint() -> Result<(), String> {
    let global_config = sql::get_config()?;
    let model_path = Path::new(&global_config.app_path).join(constants::BANDIT_MODEL_PATH);

    if model_path.exists() {
        std::fs::remove_dir_all(&model_path)
            .map_err(|e| format!("Failed to delete model checkpoint: {}", e))?;

        tracing::info!("Deleted bandit model checkpoint: {}", model_path.display());
    }

    Ok(())
}

/// Restart the bandit by clearing stats, deleting model, and reinitializing
pub fn restart_bandit() -> Result<(), String> {
    // Clear bandit stats from database
    sql::queries::delete_all_bandit_stats()
        .map_err(|e| format!("Failed to delete bandit stats: {}", e))?;

    // Delete model checkpoint
    delete_bandit_model_checkpoint()?;

    // Clear in-memory agent
    {
        let mut bandit_agent = BANDIT_AGENT.lock().unwrap();
        *bandit_agent = None;
    }

    // Clear latest context
    drop_latest_bandit_context();

    // Reinitialize with fresh model
    initialize_bandit_agent()?;

    tracing::info!("Successfully restarted bandit");

    Ok(())
}

#[tauri::command]
pub fn get_bandit_stats() -> Result<Vec<sql::model::BanditStat>, String> {
    sql::queries::get_all_bandit_stats().map_err(|e| format!("Failed to get bandit stats: {}", e))
}

#[tauri::command]
pub fn restart_contextual_bandit() -> Result<(), String> {
    restart_bandit()
}

#[tauri::command]
pub async fn get_choosen_arm_from_user_intention_id(
    app_handle: tauri::AppHandle,
    user_intention_id: i64,
    from_test: bool,
) -> Result<usize, String> {
    let user_intention = sql::queries::get_user_intention_by_id(user_intention_id).unwrap();
    match generate_bandit_context(&user_intention) {
        Ok(bandit_context) => {
            match determine_chosen_arm_and_notify(&app_handle, &bandit_context, from_test).await {
                Ok(chosen_arm) => Ok(chosen_arm),
                Err(e) => {
                    tracing::error!("Failed to determine chosen arm: {}", e);
                    Err(e)
                }
            }
        }
        Err(e) => {
            tracing::error!("Failed to generate bandit context: {}", e);
            Err(e)
        }
    }
}
