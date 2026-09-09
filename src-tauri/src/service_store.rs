use std::{fs, path::PathBuf};
use tauri::{path::BaseDirectory, AppHandle, Manager, Runtime};

fn path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    app.path()
        .resolve("services.json", BaseDirectory::AppLocalData)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_services<R: Runtime>(app: AppHandle<R>) -> Result<Option<serde_json::Value>, String> {
    let file = path(&app)?;
    if !file.exists() {
        return Ok(None);
    }
    serde_json::from_str(&fs::read_to_string(file).map_err(|e| e.to_string())?)
        .map(Some)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_services<R: Runtime>(
    app: AppHandle<R>,
    services: serde_json::Value,
) -> Result<(), String> {
    let file = path(&app)?;
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(
        file,
        serde_json::to_vec(&services).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}
