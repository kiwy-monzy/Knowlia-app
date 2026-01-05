use std::collections::HashSet;

use crate::constants::{EMBEDDING_SIZE, JACCARD_SIMILARITY_THRESHOLD};
use crate::embedding::create_embedding_internal;
use crate::helpers;
use crate::llm::system_prompts::USER_INTENTION_SYSTEM_PROMPT;
use chrono::{DateTime, Utc};
use tauri::AppHandle;

use crate::llm::client::LLMClient;
use crate::llm::model::Message;
use crate::sql::{self, model::UserIntentionHistory};

/// Returns few-shot example messages for user intention analysis
fn get_few_shot_messages() -> Vec<Message> {
    let mut messages = Vec::new();

    // System message
    messages.push(Message::system(USER_INTENTION_SYSTEM_PROMPT));

    // Example 1: Development workflow - Flowing state
    let example1_prompt = r#"<analysis_request>
<applications>
<application>
  <name>loyca-ai - main.rs</name>
  <time>245 seconds</time>
  <priority>high</priority>
  <description>A Rust file open in VS Code showing the main function implementation for a Tauri application. The code includes window management setup, database initialization, and background task configuration. Multiple function definitions are visible with proper error handling and async/await patterns.</description>
  <category>code editor</category>
</application>

<application>
  <name>Terminal</name>
  <time>45 seconds</time>
  <priority>medium</priority>
  <description>A terminal window showing successful compilation output from `cargo build`. The build completed without errors and shows timing information for various crate dependencies. The prompt indicates the user is in a Rust project directory.</description>
  <category>terminal</category>
</application>

<application>
  <name>Rust Documentation - std::collections::HashMap</name>
  <time>32 seconds</time>
  <priority>low</priority>
  <description>Official Rust documentation page for HashMap showing method signatures, examples, and implementation details. The page displays comprehensive API documentation with code examples and usage patterns for the HashMap data structure.</description>
  <category>research/browsing</category>
</application>

</applications>

</analysis_request>"#;

    messages.push(Message::user(example1_prompt.to_string(), None));

    messages.push(Message::assistant(
        r#"<intention>User is actively developing a Rust application, implementing core functionality with proper testing and documentation research</intention>
<state>flowing</state>
<keywords>Rust development, Tauri application, HashMap, code implementation, terminal, compilation, API documentation</keywords>"#.to_string(),
        None,
    ));

    // Example 2: Mixed work/entertainment - Work takes priority due to focus time
    let example2_prompt = r#"<analysis_request>
<applications>
<application>
  <name>React Component Optimization - Stack Overflow</name>
  <time>180 seconds</time>
  <priority>high</priority>
  <description>A Stack Overflow page showing a question about React component re-rendering optimization. The page displays code snippets with useCallback and useMemo hooks, along with detailed answers explaining performance implications. Multiple code examples and community discussions are visible.</description>
  <category>research/browsing</category>
</application>

<application>
  <name>YouTube - Lo-fi Hip Hop Radio</name>
  <time>95 seconds</time>
  <priority>medium</priority>
  <description>YouTube is playing a lo-fi hip hop music stream. The video shows an animated character studying with books, and the interface indicates it's a 24/7 live stream designed for background music while working or studying.</description>
  <category>video streaming</category>
</application>

<application>
  <name>Twitter - Timeline</name>
  <time>25 seconds</time>
  <priority>low</priority>
  <description>A brief check of Twitter timeline showing technology-related tweets, including posts about React updates, developer tools, and programming discussions. The user appears to have quickly scrolled through without deep engagement.</description>
  <category>social media</category>
</application>

<application>
  <name>VS Code - components/UserProfile.jsx</name>
  <time>65 seconds</time>
  <priority>medium</priority>
  <description>A React component file is open showing a UserProfile component with performance issues. The code includes multiple useEffect hooks and state updates that could be optimized. Comments indicate the developer is working on implementing the solutions found in their research.</description>
  <category>code editor</category>
</application>

</applications>

</analysis_request>"#;

    messages.push(Message::user(example2_prompt.to_string(), None));

    messages.push(Message::assistant(
        r#"<intention>User is working on React performance optimization, researching solutions while maintaining focus with background music and brief social media checks</intention>
<state>focused</state>
<keywords>React optimization, Stack Overflow, performance, useCallback, useMemo, development, background music, research</keywords>"#.to_string(),
        None,
    ));

    // Example 3: Learning vs Entertainment boundary - Learning takes priority
    let example3_prompt = r#"<analysis_request>
<applications>
<application>
  <name>Python Tutorial - Real Python</name>
  <time>220 seconds</time>
  <priority>high</priority>
  <description>A comprehensive Python tutorial page about async/await programming. The content includes detailed explanations, code examples, and practical use cases. The user appears to be actively reading through the material with the page scrolled to a section about asyncio event loops.</description>
  <category>research/browsing</category>
</application>

<application>
  <name>Reddit - r/Python</name>
  <time>85 seconds</time>
  <priority>medium</priority>
  <description>Reddit's Python community page showing posts about Python libraries, coding challenges, and programming discussions. The user is viewing threads related to async programming and performance optimization, which aligns with their current learning topic.</description>
  <category>social media</category>
</application>

<application>
  <name>Discord - Programming Community</name>
  <time>45 seconds</time>
  <priority>low</priority>
  <description>A Discord server for programming discussions where users share code snippets and ask questions. The visible conversation is about Python asyncio troubleshooting, with community members providing helpful suggestions and code reviews.</description>
  <category>chat/messaging</category>
</application>

</applications>

</analysis_request>"#;

    messages.push(Message::user(example3_prompt.to_string(), None));

    messages.push(Message::assistant(
        r#"<intention>User is learning Python async programming through multiple educational sources and engaging with programming communities for deeper understanding</intention>
<state>learning</state>
<keywords>Python, async programming, asyncio, tutorial, learning, programming community, Reddit, Discord, education</keywords>"#.to_string(),
        None,
    ));

    messages
}

/// Extracts user intention and state from app transitions at a specific time
async fn extract_user_intention_at_time(
    app_handle: &AppHandle,
    target_time: DateTime<Utc>,
    time_window_minutes: u64,
) -> Result<UserIntentionHistory, String> {
    // Calculate time window
    let start_time = target_time - chrono::Duration::minutes(time_window_minutes as i64);
    let end_time = target_time + chrono::Duration::minutes(5); // Small buffer for current activity

    // Build context from transitions and associated window info
    let mut context_parts = Vec::new();
    let mut all_keywords_set = HashSet::new();
    let mut all_titles_set = HashSet::new();

    match sql::queries::get_windows_focus_by_title(start_time, end_time) {
        Ok(window_focus_info) => {
            let total_focus_time = window_focus_info
                .iter()
                .fold(0, |acc, info| acc + info.total_focus_time);
            for window_info in &window_focus_info {
                let percentage =
                    (window_info.total_focus_time as f64 / total_focus_time as f64) * 100.0;

                let priority = |x: f64| {
                    if x > 50.0 {
                        "high"
                    } else if x > 25.0 {
                        "medium"
                    } else {
                        "low"
                    }
                };

                if percentage < 10.0 {
                    // Skip to low priority
                    continue;
                }

                let transition_context = format!(
                        "<application>\n  <name>{}</name>\n  <time>{} seconds</time>\n  <priority>{}</priority>\n  <description>{}</description>\n  <category>{}</category>\n</application>\n\n",
                    &window_info.title,
                    window_info.total_focus_time,
                    priority(percentage),
                    &window_info.llm_description,
                    &window_info.llm_category,
                );

                context_parts.push(transition_context);

                all_titles_set.insert(window_info.title.clone());

                // Collect keywords
                all_keywords_set.extend(
                    window_info
                        .llm_keywords
                        .split(',')
                        .map(|s| s.trim().to_string()),
                );
            }
        }
        Err(_) => {}
    }

    // Add current app only if focus time is >=10 seconds and has not been added before
    if let Ok(app) = sql::queries::get_currently_focused_app(None) {
        if app.focus_time >= 10 {
            let window_info = sql::queries::get_window_info_near_time(app.pid, app.updated_at, 5)?;

            if !all_titles_set.contains(&window_info.title) {
                let transition_context = format!(
                "<current_application>\n  <name>{}</name>\n  <time>{} seconds</time>\n  <description>{}</description>\n  <category>{}</category>\n</current_application>\n\n",
                &window_info.title,
                app.focus_time,
                &window_info.llm_description,
                &window_info.llm_category
            );

                context_parts.push(transition_context);

                // Collect keywords
                all_keywords_set.extend(
                    window_info
                        .llm_keywords
                        .split(',')
                        .map(|s| s.trim().to_string()),
                );
            }
        }
    }

    if context_parts.is_empty() {
        return Err("No screenshot analysis available for the specified time range".to_string());
    }

    let last_intentions = sql::queries::get_recent_user_intentions(2, 60).unwrap();

    let mut last_keywords_set = HashSet::new();
    if !last_intentions.is_empty() {
        for intention in &last_intentions {
            last_keywords_set.extend(
                intention
                    .llm_keywords
                    .split(',')
                    .map(|s| s.trim().to_string()),
            );
        }
    }

    // Jaccard similarity calculation
    let mut jaccard_similarity = 0.0;
    if !last_keywords_set.is_empty() {
        let intersection = last_keywords_set.intersection(&all_keywords_set).count();
        let union = last_keywords_set.union(&all_keywords_set).count();
        jaccard_similarity = intersection as f64 / union as f64;
    }

    if jaccard_similarity > JACCARD_SIMILARITY_THRESHOLD {
        return Err(format!(
            "User intention: Skipped due to high similarity in keywords ({:.2} > {:.2} Jaccard Similarity)",
            jaccard_similarity, JACCARD_SIMILARITY_THRESHOLD
        ));
    }

    // Create the prompt
    let user_prompt =
        format!(
        "<analysis_request><applications>\n{}</applications>\n\n</analysis_request>\n\nRemember, you MUST use XML tags <intention>, <state>, and <keywords> in your response.",
        context_parts.join(""),
    );

    tracing::debug!("User intention prompt:\n{}", user_prompt);

    // Prepare messages for LLM with few-shot examples
    let mut messages = get_few_shot_messages();

    // Add the actual user prompt
    messages.push(Message::user(user_prompt, None));

    // Get LLM response using the same pattern as image_analysis
    let global_config = sql::get_config()?;

    let use_vision = global_config.use_same_model == "true";

    let llm_client = LLMClient::from_config(global_config, false, None, 0.7, use_vision);

    let (llm_response, _) = llm_client
        .complete_and_handle(&app_handle, messages)
        .await?;

    // Parse the response
    let (intention, state, keywords) = parse_intention_response(&llm_response)?;

    let user_intention_embedding = create_embedding_internal(&app_handle, intention.clone(), true)
        .await
        .unwrap_or_else(|_e| {
            tracing::error!("Failed to create embedding for description: {}", _e);
            vec![0.0; EMBEDDING_SIZE]
        });

    // Create and return the result
    Ok(UserIntentionHistory {
        id: None,
        llm_user_intention: intention,
        llm_user_state: state,
        llm_keywords: keywords,
        created_at: target_time,
        user_intention_embedding,
    })
}

/// Parses the LLM response to extract intention, state, and keywords
fn parse_intention_response(response: &str) -> Result<(String, String, String), String> {
    let intention = helpers::extract_xml_tag_content(response, "intention")
        .ok_or("Failed to parse intention from LLM response")?;

    let state = helpers::extract_xml_tag_content(response, "state")
        .ok_or("Failed to parse state from LLM response")?;

    let keywords = helpers::extract_xml_tag_content(response, "keywords").unwrap_or_default();

    // Validate state
    let valid_states = [
        "flowing",
        "struggling",
        "idle",
        "focused",
        "learning",
        "communicating",
        "entertaining",
    ];
    if !valid_states.contains(&state.as_str()) {
        return Err(format!(
            "Invalid state '{}'. Must be one of: {}",
            state,
            valid_states.join(", ")
        ));
    }

    Ok((intention, state, keywords))
}

/// Analyzes user intention for the current time with a default time window
pub async fn analyze_current_user_intention(
    app_handle: &AppHandle,
    time_window_minutes: Option<u64>,
    from_test: bool,
) -> Result<UserIntentionHistory, String> {
    let window = time_window_minutes.unwrap_or(15);
    let current_time = chrono::Utc::now();

    // Extract user intention
    let intention_data = extract_user_intention_at_time(&app_handle, current_time, window).await?;

    // Save to database
    let id = if !from_test {
        sql::queries::save_user_intention_history(&intention_data)?
    } else {
        0
    };

    // Return the saved data with ID
    Ok(UserIntentionHistory {
        id: Some(id),
        ..intention_data
    })
}

/// Tauri command to analyze and save user intention
#[tauri::command]
pub async fn analyze_user_intention_command(
    app_handle: tauri::AppHandle,
    time_window_minutes: Option<u64>,
    from_test: bool,
) -> Result<UserIntentionHistory, String> {
    analyze_current_user_intention(&app_handle, time_window_minutes, from_test).await
}

/// Tauri command to get recent user intentions
#[tauri::command]
pub async fn get_user_intentions_command(
    limit: Option<u32>,
) -> Result<Vec<UserIntentionHistory>, String> {
    let actual_limit = limit.unwrap_or(10);
    sql::queries::get_recent_user_intentions(actual_limit, 24 * 60) // one day
        .map_err(|e| format!("Failed to fetch user intentions: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sql::model::GlobalConfig;

    /// Test function to call LLM with few shot examples and a custom prompt
    /// > cargo test test_user_intention_llm_call --lib -- --nocapture --ignored
    #[tokio::test]
    #[ignore = "LLM required"]
    async fn test_user_intention_llm_call() {
        let model =
            std::env::var("TEST_MODEL").unwrap_or_else(|_| "qwen/qwen2.5-vl-7b".to_string());
        let base_url =
            std::env::var("TEST_BASE_URL").unwrap_or_else(|_| "http://127.0.0.1:1234".to_string());
        let api_key = std::env::var("TEST_API_KEY").unwrap_or_else(|_| "NONE".to_string());

        // Create a mock GlobalConfig for testing
        let config = GlobalConfig {
            use_same_model: "true".to_string(),
            vision_api_key: api_key.clone(),
            vision_base_url: base_url.clone(),
            vision_model: model.clone(),
            chat_api_key: api_key.clone(),
            chat_base_url: base_url,
            chat_model: model,
            enable_background_tasks: "false".to_string(),
            screenshot_delay: "30".to_string(),
            user_intention_delay: "15".to_string(),
            window_time_minutes: "60".to_string(),
            app_path: "/tmp/test".to_string(),
            enable_tools: "true".to_string(),
            sidebar_collapse: "false".to_string(),
        };

        // Create LLM client
        let llm_client = LLMClient::from_config(config, false, None, 0.7, true);

        // Get few shot examples
        let mut messages = get_few_shot_messages();

        // Add a test prompt
        let test_prompt = r#"<analysis_request>
<applications>
<application>
  <name>VS Code - test.rs</name>
  <time>300 seconds</time>
  <priority>high</priority>
  <description>A Rust test file is open showing unit tests for a machine learning model. The code includes test functions with assertions, mock data setup, and performance benchmarks. The developer appears to be debugging a failing test related to model accuracy.</description>
  <category>code editor</category>
</application>

<application>
  <name>Terminal</name>
  <time>120 seconds</time>
  <priority>medium</priority>
  <description>Terminal window showing cargo test output with one failing test. The error message indicates an assertion failure in the model accuracy test, with expected vs actual values displayed. The developer has run the test multiple times with --nocapture flag for debugging.</description>
  <category>terminal</category>
</application>

<application>
  <name>Rust Documentation - assert_eq! macro</name>
  <time>45 seconds</time>
  <priority>low</priority>
  <description>Official Rust documentation page for the assert_eq! macro, showing usage examples and panic behavior. The page displays detailed information about assertion macros and debugging techniques for test failures.</description>
  <category>research/browsing</category>
</application>

</applications>

</analysis_request>

Remember, you MUST use XML tags <intention>, <state>, and <keywords> in your response."#;

        messages.push(Message::user(test_prompt.to_string(), None));

        println!("Test Messages constructed successfully!");
        println!("Number of messages: {}", messages.len());
        println!(
            "System message present: {}",
            messages.iter().any(|m| m.role == "system")
        );
        println!(
            "Few-shot examples count: {}",
            messages
                .iter()
                .filter(|m| m.role == "user" || m.role == "assistant")
                .count()
                - 1
        ); // -1 for the test prompt

        // Verify message structure
        assert!(messages.len() >= 7); // System + 3 few-shot examples (user+assistant pairs) + test prompt
        assert!(messages.iter().any(|m| m.role == "system"));
        assert!(messages.last().unwrap().role == "user");

        // If you want to actually call the LLM (requires valid AppHandle and database):
        let http_response = llm_client
            .complete(messages)
            .await
            .expect("LLM call failed");
        let (response, _, _) = llm_client
            .handle_non_stream(http_response)
            .await
            .expect("Failed to handle non-stream response");

        println!("LLM Response: {}", response);

        // Test parsing the response
        let (intention, state, keywords) =
            parse_intention_response(&response).expect("Failed to parse LLM response");

        println!("Parsed Intention: {}", intention);
        println!("Parsed State: {}", state);
        println!("Parsed Keywords: {}", keywords);

        // Validate the parsed data
        assert!(!intention.is_empty());
        assert!(!state.is_empty());
        let valid_states = [
            "flowing",
            "struggling",
            "idle",
            "focused",
            "learning",
            "communicating",
            "entertaining",
        ];
        assert!(valid_states.contains(&state.as_str()));
    }

    #[test]
    fn test_parse_intention_response() {
        let test_response = r#"<intention>User is debugging a failing Rust test, working on model accuracy validation with systematic debugging approach</intention>
<state>focused</state>
<keywords>Rust testing, debugging, model accuracy, assert_eq, cargo test, unit tests, troubleshooting</keywords>"#;

        let (intention, state, keywords) =
            parse_intention_response(test_response).expect("Failed to parse test response");

        assert_eq!(intention, "User is debugging a failing Rust test, working on model accuracy validation with systematic debugging approach");
        assert_eq!(state, "focused");
        assert_eq!(keywords, "Rust testing, debugging, model accuracy, assert_eq, cargo test, unit tests, troubleshooting");
    }

    #[test]
    fn test_parse_intention_response_invalid_state() {
        let test_response = r#"<intention>Some intention</intention>
<state>invalid_state</state>
<keywords>some, keywords</keywords>"#;

        let result = parse_intention_response(test_response);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid state"));
    }

    #[test]
    fn test_get_few_shot_messages() {
        let messages = get_few_shot_messages();

        // Should have system message + 3 example pairs (6 messages) = 7 total
        assert_eq!(messages.len(), 7);

        // First message should be system
        assert_eq!(messages[0].role, "system");

        // Should have alternating user/assistant messages for examples
        for i in (1..messages.len()).step_by(2) {
            assert_eq!(messages[i].role, "user");
            if i + 1 < messages.len() {
                assert_eq!(messages[i + 1].role, "assistant");
            }
        }

        // All assistant messages should contain the required XML tags
        for message in messages.iter().filter(|m| m.role == "assistant") {
            let content = &message.content[0].text.as_ref().unwrap();
            assert!(content.contains("<intention>"));
            assert!(content.contains("<state>"));
            assert!(content.contains("<keywords>"));
        }
    }
}
