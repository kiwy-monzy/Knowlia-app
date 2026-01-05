use crate::constants::{
    AFK_IMAGE_SIMILARITY_THRESHOLD, EMBEDDING_SIZE, IMAGE_SIMILARITY_THRESHOLD,
    TIME_DIFFERENCE_THRESHOLD, WINDOW_LABELS,
};
use crate::embedding::create_embedding_internal;
use crate::llm::client::LLMClient;
use crate::llm::model::Message;
use crate::llm::system_prompts::IMAGE_ANALYSIS_SYSTEM_PROMPT;
use crate::sql::model::WindowInfoData;
use crate::{helpers, sql, window_manager};
use chrono;
use once_cell::sync::Lazy;
use screenshots::Screen;
use std::sync::{Arc, Mutex};
use tauri::AppHandle;

static ANALYSIS_IN_PROGRESS: Lazy<Arc<Mutex<bool>>> = Lazy::new(|| Arc::new(Mutex::new(false)));

struct AnalysisResult {
    description: String,
    keywords: String,
    category: String,
}

#[tauri::command]
pub async fn take_screenshot(
    app_handle: AppHandle,
    screen_type: String,
    from_test: bool,
) -> Result<WindowInfoData, String> {
    #[cfg(target_os = "linux")]
    let _guard = window_manager::linux::ScreenshotGuard::new()
        .map_err(|e| format!("Failed to activate screenshot guard: {}", e))?;

    let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;

    if screens.is_empty() {
        return Err("No screens found".to_string());
    }

    let (raw_image, window_info_opt) = match screen_type.as_str() {
        "fullscreen" => {
            let screen = &screens[0]; // Use primary screen
            let image = screen
                .capture()
                .map_err(|e| format!("Failed to capture screen: {}", e))?;

            // Convert from screenshots::image (v0.24.9) to image (v0.25.8)
            let raw_image =
                image::RgbaImage::from_raw(image.width(), image.height(), image.into_raw())
                    .ok_or_else(|| "Failed to convert image format".to_string())?;

            (raw_image, None)
        }
        "window" => {
            let image = window_manager::capture_active_window()
                .map_err(|e| format!("Failed to capture active window: {}", e))?;
            let window_info = window_manager::get_active_window_info()
                .map_err(|e| format!("Failed to get active window info: {}", e))?;
            (image, Some(window_info))
        }
        _ => return Err("Invalid screen type. Use 'fullscreen' or 'window'".to_string()),
    };

    let data_url = helpers::image_to_url(raw_image)?;

    if let Some(window_info) = window_info_opt {
        let is_loyca_avatar = window_info.title.clone().to_lowercase().contains("avatar")
            && window_info.process_name.clone().contains("loyca-ai");
        match sql::queries::add_app(
            window_info.pid,
            &window_info.process_name,
            &window_info.title,
            from_test || is_loyca_avatar,
        ) {
            Ok(_) => {
                let window_info_data = WindowInfoData {
                    window_id: 0,
                    title: window_info.title.clone(),
                    process_name: window_info.process_name.clone(),
                    app_pid: window_info.pid,
                    screenshot_url: data_url.clone(),
                    focus_time: 0,
                    llm_description: String::new(),
                    llm_keywords: String::new(),
                    llm_category: String::new(),
                    created_at: chrono::Utc::now(),
                    description_embedding: vec![0.0; EMBEDDING_SIZE],
                };

                if is_loyca_avatar {
                    // Return immediately if it's Loyca.AI avatar
                    tracing::debug!("Loyca.AI avatar detected, skipping analysis");
                    return Ok(window_info_data);
                }

                match analyze_image(&app_handle, &window_info_data).await {
                    Ok(analysis_result) => {
                        let description_embedding = create_embedding_internal(
                            &app_handle,
                            analysis_result.description.clone(),
                            true,
                        )
                        .await
                        .unwrap_or_else(|e| {
                            tracing::error!("Failed to create embedding for description: {}", e);
                            vec![0.0; EMBEDDING_SIZE]
                        });

                        // Save to database
                        let mut updated_window_info = window_info_data;
                        updated_window_info.llm_description = analysis_result.description;
                        updated_window_info.llm_keywords = analysis_result.keywords;
                        updated_window_info.llm_category = analysis_result.category;
                        updated_window_info.description_embedding = description_embedding;
                        if !from_test {
                            sql::queries::update_llm_window_info(updated_window_info.clone())
                                .unwrap();
                        }

                        return Ok(updated_window_info);
                    }
                    Err(e) => {
                        tracing::error!("Failed to analyze image: {}", e);
                        return Err(format!("Failed to analyze image: {}", e));
                    }
                }
            }

            Err(e) => {
                tracing::error!("Failed to add app info: {}", e);
                return Err(format!("Failed to add app info: {}", e));
            }
        }
    }
    tracing::error!("Failed to get window info");
    return Err("Failed to get window info".to_string());
}

/// Returns few-shot example messages for keyword extraction
fn get_few_shot_messages(app_handle: &AppHandle) -> Result<Vec<Message>, String> {
    let mut messages = Vec::new();

    // System message
    messages.push(Message::system(IMAGE_ANALYSIS_SYSTEM_PROMPT));

    // Example 1: Code Editor
    let code_editor_path =
        helpers::resolve_resource(app_handle, "assets/screenshot_examples/code-editor.png")?;

    if let Ok(image_url) = helpers::image_path_to_url(code_editor_path.as_str()) {
        messages.push(Message::user(
            "This application whose process name is \"dev.zed.Zed\" has the following title: \"loyca-ai - sql.rs\".".to_string(),
            Some(image_url),
        ));
    };

    messages.push(Message::assistant(
r#"<description>
A Rust file, `sql.rs`, is open in the "loyca-ai" Tauri project. The code implements a thread-safe, lazily-initialized singleton pattern for a SQLite database connection using the `once_cell` and `Mutex` crates. The `init` function retrieves the application's data directory via the Tauri API to create or open an `sqlite.db` file with `rusqlite`.
</description>
<keywords>Rust, Tauri, SQLite, rusqlite, database connection, singleton pattern, thread safety, OnceCell, backend development</keywords>
<category>code editor</category>"#,
        None
    ));

    // Example 2: Reddit Browser
    let reddit_path =
        helpers::resolve_resource(app_handle, "assets/screenshot_examples/reddit.png")?;

    if let Ok(image_url) = helpers::image_path_to_url(reddit_path.as_str()) {
        messages.push(Message::user(
            "This application whose process name is \"app.zen_browser.zen\" has the following title: \"Reddit - The heart of the internet — Zen Browser\".".to_string(),
            Some(image_url),
        ));
    };

    messages.push(Message::assistant(
r#"<description>
The user is browsing their Reddit feed. Two posts are visible: one from the subreddit r/PeterExplainsTheJoke titled "What game??", showing an image of a Chuck E. Cheese building with smoke coming from it and the caption "Somebody beat the game". Below it is a post from r/LocalLLaMA titled "Local reasoning model", asking for recommendations for non-Chinese AI reasoning models.
</description>
<keywords>Reddit, social media, meme, r/PeterExplainsTheJoke, r/LocalLLaMA, AI models, LLM, reasoning model, browsing</keywords>
<category>social media</category>"#,
        None
    ));

    Ok(messages)
}

async fn analyze_image(
    app_handle: &AppHandle,
    window_info: &WindowInfoData,
) -> Result<AnalysisResult, String> {
    // Check if analysis is already in progress
    {
        let mut is_analyzing = ANALYSIS_IN_PROGRESS.lock().unwrap();
        if *is_analyzing {
            return Err("Image analysis already in progress".to_string());
        }
        *is_analyzing = true;
    }

    let is_loyca_app = window_info.process_name.contains("loyca-ai");

    // Ensure we reset the flag when function exits, regardless of success or failure
    let _guard = AnalysisGuard;
    let global_config = sql::get_config()?;

    let latest_window_info = sql::queries::get_window_info_by_pid(window_info.app_pid, 1)?;
    let mut previous_description: Option<String> = None;

    if latest_window_info.len() == 1 {
        let latest_window_info = &latest_window_info[0];

        if latest_window_info.app_pid == window_info.app_pid {
            // Check if title and PID match for context enhancement
            if latest_window_info.title == window_info.title
                && latest_window_info.process_name == window_info.process_name
            {
                previous_description = Some(latest_window_info.llm_description.clone());
            }

            // RMS similarity over RGB
            // If both images are not of the same size, this throws an error
            let similarity = helpers::image_similarity(
                &window_info.screenshot_url,
                &latest_window_info.screenshot_url,
            )
            .unwrap_or(0.0);

            if similarity > AFK_IMAGE_SIMILARITY_THRESHOLD {
                return Err(format!(
                    "Avoiding reprocessing (similarity: {:.2} > {:.2})",
                    similarity, AFK_IMAGE_SIMILARITY_THRESHOLD
                ));
            }

            if similarity > IMAGE_SIMILARITY_THRESHOLD {
                let time_difference =
                    (window_info.created_at - latest_window_info.created_at).as_seconds_f32();

                // if is similar and has passed less than threshold, avoid reprocessing
                if time_difference < TIME_DIFFERENCE_THRESHOLD {
                    return Err(format!(
                        "Avoiding reprocessing (similarity: {:.2} > {:.2}, time {:.1} > {:.1} seconds)",
                        similarity,
                        IMAGE_SIMILARITY_THRESHOLD,
                        time_difference,
                        TIME_DIFFERENCE_THRESHOLD
                    ));
                }
            }
        }
    }

    let mut messages = get_few_shot_messages(app_handle)?;

    let mut formated_prompt = format!(
        "This application whose process name is \"{}\" has the following title: \"{}\"",
        window_info.process_name, window_info.title
    );

    formated_prompt.push_str(
        ". Describe only what you can see in this screenshot without making assumptions about user intentions or goals. Don't forget to use <description>, <keywords>, and <category> tags separately.",
    );

    // Add previous description context if available
    if let Some(prev_desc) = previous_description {
        formated_prompt.push_str(&format!(
            "\n\nPrevious analysis of this same application: {}",
            prev_desc
        ));
    }

    if is_loyca_app {
        formated_prompt
            .push_str("\n\n Note that you are Loyca.ai and the user is configuring you.");
    }

    messages.push(Message::user(
        formated_prompt,
        Some(window_info.screenshot_url.clone()),
    ));

    let llm_client = LLMClient::from_config(global_config, false, None, 0.7, true);

    let (llm_response, _) = llm_client
        .complete_and_handle(&app_handle, messages)
        .await?;

    // Parse the response to extract description, keywords, and category
    if let (Some(description), Some(keywords), Some(category_raw)) = (
        helpers::extract_xml_tag_content(&llm_response, "description"),
        helpers::extract_xml_tag_content(&llm_response, "keywords"),
        helpers::extract_xml_tag_content(&llm_response, "category"),
    ) {
        // Normalize the category to ensure it matches one of the valid labels
        let category = if is_loyca_app {
            "loyca.ai".to_string()
        } else {
            helpers::normalize_category(&category_raw, WINDOW_LABELS)
        };

        Ok(AnalysisResult {
            description,
            keywords,
            category,
        })
    } else {
        tracing::error!("Failed to parse XML tags from response: {}", llm_response);
        Err(format!(
            "Failed to parse XML tags from response: {}",
            llm_response
        ))
    }
}

// Guard struct to ensure the analysis flag is reset when the function exits
struct AnalysisGuard;

impl Drop for AnalysisGuard {
    fn drop(&mut self) {
        let mut is_analyzing = ANALYSIS_IN_PROGRESS.lock().unwrap();
        *is_analyzing = false;
    }
}
