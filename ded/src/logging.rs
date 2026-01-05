use std::fs;
use std::path::PathBuf;
use time::{macros::format_description, UtcOffset};
use tracing::Level;
use tracing_subscriber::fmt::time::OffsetTime as TracingOffsetTime;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

pub fn init_logging(app_data_dir: &PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    // Create logs directory if it doesn't exist
    let logs_dir = app_data_dir.join("logs");
    if !logs_dir.exists() {
        fs::create_dir_all(&logs_dir)?;
    }

    // Create log file path with current date
    let now = time::OffsetDateTime::now_utc();
    let date_str = now
        .format(&format_description!("[year]-[month]-[day]"))
        .unwrap();
    let log_file_name = format!("{}.log", date_str);
    let log_file_path = logs_dir.join(log_file_name);
    let log_file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file_path)?;

    // --- Filters ---
    let env_filter = EnvFilter::builder()
        .with_default_directive(Level::INFO.into())
        .from_env_lossy()
        .add_directive("loyca_ai_lib=debug".parse()?)
        .add_directive("tokio_util=warn".parse()?)
        .add_directive("hyper=warn".parse()?)
        .add_directive("reqwest=warn".parse()?)
        .add_directive("rustls=warn".parse()?);

    // --- Time format ---
    let time_format = format_description!("[year]-[month]-[day] [hour]:[minute]:[second]");
    let local_offset = UtcOffset::current_local_offset().unwrap_or(UtcOffset::UTC);
    let timer = TracingOffsetTime::new(local_offset, time_format);

    // --- Separate writers and layers ---
    let stdout_layer = fmt::layer()
        .with_writer(std::io::stdout)
        .with_timer(timer.clone())
        .with_target(false)
        .with_file(true)
        .with_line_number(true)
        .compact()
        .with_ansi(true);

    let file_layer = fmt::layer()
        .with_writer(log_file)
        .with_timer(timer)
        .with_target(false)
        .with_file(true)
        .with_line_number(true)
        .compact()
        .with_ansi(false);

    tracing_subscriber::registry()
        .with(env_filter)
        .with(stdout_layer)
        .with(file_layer)
        .init();

    Ok(())
}

pub fn cleanup_old_logs(
    app_data_dir: &PathBuf,
    max_age_days: u64,
) -> Result<(), Box<dyn std::error::Error>> {
    let logs_dir = app_data_dir.join("logs");
    if !logs_dir.exists() {
        return Ok(());
    }

    let max_age = std::time::Duration::from_secs(max_age_days * 24 * 60 * 60);
    let now = std::time::SystemTime::now();

    for entry in fs::read_dir(logs_dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_file() {
            if let Some(extension) = path.extension() {
                if extension == "log" {
                    if let Ok(metadata) = entry.metadata() {
                        if let Ok(created) = metadata.created() {
                            if let Ok(age) = now.duration_since(created) {
                                if age > max_age {
                                    if let Err(e) = fs::remove_file(&path) {
                                        tracing::warn!(
                                            "Failed to remove old log file {:?}: {}",
                                            path,
                                            e
                                        );
                                    } else {
                                        tracing::info!("Removed old log file: {:?}", path);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(())
}
