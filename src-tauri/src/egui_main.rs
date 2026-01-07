mod app;
mod rtsp_player;
mod document_viewer;
mod file_explorer;

pub use app::App;

// When compiling to web using trunk:
#[cfg(target_arch = "wasm32")]
pub fn start_web_app() {
    // Redirect `log` message to `console.log` and friends:
    eframe::WebLogger::init(log::LevelFilter::Debug).ok();

    let web_options = eframe::WebOptions::default();

    wasm_bindgen_futures::spawn_local(async {
        eframe::WebRunner::new()
            .start(
                "the_canvas_id", // hardcode it
                web_options,
                Box::new(|cc| Box::new(App::new(cc))),
            )
            .await
            .expect("failed to start eframe");
    });
}
