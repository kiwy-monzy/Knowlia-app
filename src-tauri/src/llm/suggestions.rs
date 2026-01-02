use std::collections::HashSet;

use chrono::{Datelike, Timelike, Utc};
use tauri::{AppHandle, Emitter};

use crate::{
    constants,
    contextual_bandit::context::BanditContext,
    llm::{chat::call_model, system_prompts::SUGGESTIONS_SYSTEM_PROMPT},
    sql,
};

pub async fn call_model_for_suggestions(
    app_handle: AppHandle,
    bandit_context: BanditContext,
    time_window_minutes: Option<i64>,
) -> Result<i64, String> {
    let mut prompt = String::new();

    if let Some(time_window_minutes) = time_window_minutes {
        let (user_intention, user_state, screenshots_context) =
            get_screenshots_context(time_window_minutes);
        prompt.push_str(&format!("Hello!\n<predicted_intention>{}</predicted_intention>\n<user_state>{}</user_state>\n<screenshots>{}</screenshots>\n\n{}",
            user_intention,
            user_state.clone(),
            screenshots_context.join("\n"),
            get_guidelines_by_state(user_state)
        ));
    } else {
        let screenshots_context = format!("<application>\n  <description>{}</description>\n  <category>{}</category>\n</application>",
            &bandit_context.app_description_str,
            &bandit_context.app_category,
        );
        prompt = format!(
                "Hello!\n<predicted_intention>{}</predicted_intention>\n<user_state>{}</user_state>\n<screenshots>\n{}</screenshots>\n\n{}",
                bandit_context.last_user_intention_str,
                bandit_context.user_state.clone(),
                screenshots_context,
                get_guidelines_by_state(bandit_context.user_state)
            );
    }

    app_handle
        .emit("suggestion", -1)
        .map_err(|e| format!("Failed to emit suggestion event: {}", e))?;

    let session_id = call_model(
        app_handle.clone(),
        prompt,
        Some(true),
        None,
        Some(SUGGESTIONS_SYSTEM_PROMPT),
    )
    .await?;

    app_handle
        .emit("suggestion", session_id)
        .map_err(|e| format!("Failed to emit suggestion event: {}", e))?;

    Ok(session_id)
}

/// Retrieve user intention, state, and screenshots context
pub fn get_screenshots_context(time_window_minutes: i64) -> (String, String, Vec<String>) {
    // Calculate time window
    let current_time = chrono::Utc::now();
    let start_time = current_time - chrono::Duration::minutes(time_window_minutes);
    let end_time = current_time + chrono::Duration::minutes(5); // Small buffer for current activity

    let mut screenshots_context = Vec::new();
    let mut all_titles_set = HashSet::new();

    match sql::queries::get_windows_focus_by_title(start_time, end_time) {
        Ok(mut window_focus_info) => {
            let total_focus_time = window_focus_info
                .iter()
                .fold(0, |acc, info| acc + info.total_focus_time);

            window_focus_info = window_focus_info
                .into_iter()
                .filter(|w| (w.total_focus_time as f64 / total_focus_time as f64) > 0.1)
                .collect();

            // since they are sorted by last_seen, we must take the most recent ones
            for window in window_focus_info.iter().rev().take(3) {
                let context = format!("<application>\n  <screenshot_id>{}</screenshot_id>\n  <name>{}</name>\n  <usage_time>{} seconds</usage_time>\n  <description>{}</description>\n  <category>{}</category>\n</application>\n",
                    &window.window_id,
                    &window.title,
                    window.total_focus_time,
                    &window.llm_description,
                    &window.llm_category,
                );
                all_titles_set.insert(window.title.clone());

                screenshots_context.push(context);
            }
        }
        Err(_) => {}
    }

    if let Ok(app) = sql::queries::get_currently_focused_app(None) {
        if app.focus_time >= 10 {
            match sql::queries::get_window_info_near_time(app.pid, app.updated_at, 5) {
                Ok(window_info) => {
                    if !all_titles_set.contains(&window_info.title) {
                        let transition_context = format!(
                        "<current_application>\n  <name>{}</name>\n  <usage_time>{} seconds</usage_time>\n  <description>{}</description>\n  <category>{}</category>\n</current_application>\n",
                        &window_info.title,
                        app.focus_time,
                        &window_info.llm_description,
                        &window_info.llm_category
                    );
                        screenshots_context.push(transition_context);
                    }
                }
                Err(_) => {}
            }
        }
    }

    let mut user_intention = String::new();
    let mut user_state = String::new();

    if let Ok(last_user_intention) =
        sql::queries::get_recent_user_intentions(1, time_window_minutes)
    {
        if !last_user_intention.is_empty() {
            user_intention = last_user_intention[0].llm_user_intention.clone();
            user_state = last_user_intention[0].llm_user_state.clone();
        }
    };

    return (user_intention, user_state, screenshots_context);
}

fn get_guidelines_by_state(user_state: String) -> &'static str {
    match user_state.as_str() {
        "flowing" => "Please don't be intrusive. Offer me a highly relevant tip, a shortcut, or a resource that enhances my work without breaking my concentration.",
        "struggling" => "Please be empathetic and direct. Provide me with a specific solution, a piece of code, a clarifying explanation, or a targeted question to help me get unstuck immediately.",
        "idle" => "Please offer me a gentle, low-friction answer to re-engage. You could summarize my last active task or ask a simple, open-ended question to help me decide what to do next.",
        "focused" => "Please respect my concentration. Provide me a precise piece of information or a tool-based action that directly supports my current task.",
        "learning" => "Please act as a study partner. Reinforce my learning by providing a quick summary of the topic, asking a relevant question to test my knowledge, or offering a practical example.",
        "communicating" => "Please be a collaborative partner. Offer me to draft a reply, summarize the key points of the conversation, or create a follow-up task based on the discussion.",
        "entertaining" => "Please be light and positive. Share a related fun fact or a relevant recommendation. If appropriate, you might gently offer to remind me of pending work tasks when I'm ready to switch back.",
        _ => "Please provide my a suggestion based on my current state and intention.",
    }
}

/// Get screenshots context
#[tauri::command]
pub fn screenshots_context(time_window_minutes: Option<i64>) -> Result<String, String> {
    let (user_intention, user_state, screenshots_context) =
        if let Some(time_window_minutes) = time_window_minutes {
            get_screenshots_context(time_window_minutes)
        } else {
            get_screenshots_context(constants::WINDOW_TIME_MINUTES as i64)
        };

    if screenshots_context.is_empty() {
        return Ok(String::new());
    }

    if user_intention.is_empty() {
        Ok(format!(
            "<screenshots>{}</screenshots>",
            screenshots_context.join("\n")
        ))
    } else {
        Ok(format!(
            "<predicted_intention>{}</predicted_intention>\n<user_state>{}</user_state>\n<screenshots>\n{}</screenshots>",
            user_intention,
            user_state,
            screenshots_context.join("\n")
        ))
    }
}

/// Generate a suggestion
#[tauri::command]
pub async fn generate_fake_suggestion(
    app_handle: AppHandle,
    user_state: String,
    user_intention: String,
    app_description: String,
) -> Result<String, String> {
    let now = Utc::now();

    let context = BanditContext {
        user_state,
        app_category: "other".to_string(),
        focus_time: 0,
        total_focus_time: 0,
        duration_since_last: 0,
        num_transitions: 0,
        most_frequent_category: "".to_string(),
        jaccard_similarity: 0.8,
        window_keywords: Vec::new(),
        user_keywords: Vec::new(),
        user_intention_embedding: vec![0.0; 384],
        hour_of_day: now.hour(),
        day_of_week: now.weekday().num_days_from_monday(),
        last_user_intention_str: user_intention,
        app_description_str: app_description,
    };
    call_model_for_suggestions(app_handle.clone(), context, None).await?;
    Ok("Suggestion generated".to_string())
}
