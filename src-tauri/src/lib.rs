use tauri::Manager;

/// Example IPC command — extracts the default downloads directory.
/// Called from the frontend via `invoke("get_downloads_dir")`.
#[tauri::command]
fn get_downloads_dir() -> String {
    dirs::download_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| String::from(""))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![get_downloads_dir])
        .setup(|app| {
            // Optional: spawn the Python server as a sidecar here if desired
            // For now we assume the user starts python main.py manually
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
