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
    match fs::read_to_string(&file) {
        Ok(content) => match serde_json::from_str(&content) {
            Ok(json) => Ok(Some(json)),
            Err(_) => Ok(None),
        },
        Err(_) => Ok(None),
    }
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
    
    // ATOMIC WRITE untuk Custom Services
    let tmp_file = file.with_extension("tmp");
    fs::write(
        &tmp_file,
        serde_json::to_vec(&services).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    
    fs::rename(tmp_file, file).map_err(|e| e.to_string())?;
    
    Ok(())
}
