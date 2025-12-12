// Learn more about Tauri commands at https://v2.tauri.app/develop/calling-rust/#commands
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    attach_web_bluetooth_plugin(
        tauri::Builder::default().invoke_handler(tauri::generate_handler![greet]),
    )
    .plugin(
        tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .target(tauri_plugin_log::Target::new(
                tauri_plugin_log::TargetKind::Webview,
            ))
            .build(),
    )
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[cfg(desktop)]
fn attach_web_bluetooth_plugin(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    use tauri_plugin_web_bluetooth::{
        init_with_selection_handler, NativeDialogSelectionHandler, SelectionHandler,
    };

    builder.plugin(init_with_selection_handler(SelectionHandler::new(
        NativeDialogSelectionHandler::new(),
    )))
}

#[cfg(not(desktop))]
fn attach_web_bluetooth_plugin(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder.plugin(tauri_plugin_web_bluetooth::init())
}
