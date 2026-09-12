use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{path::BaseDirectory, AppHandle, Manager, Runtime};

// URL Robot "Satpam" Supabase Anda!
const API_VALIDATE: &str = "https://zajcmfjcopgocxfkzlzw.supabase.co/functions/v1/license-api";

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct LicenseState {
    pub plan: String,
    pub status: String,
    pub expires_at: Option<String>,
    pub lifetime: bool,
    pub last_validated_at: String,
    pub device_id: String,
}

fn path<R: Runtime>(a: &AppHandle<R>) -> Result<PathBuf, String> {
    a.path()
        .resolve("license-state.json", BaseDirectory::AppLocalData)
        .map_err(|e| e.to_string())
}

fn read<R: Runtime>(a: &AppHandle<R>) -> Result<Option<LicenseState>, String> {
    let p = path(a)?;
    if !p.exists() {
        return Ok(None);
    };
    serde_json::from_str(&fs::read_to_string(p).map_err(|e| e.to_string())?)
        .map(Some)
        .map_err(|e| e.to_string())
}

fn write<R: Runtime>(a: &AppHandle<R>, s: &LicenseState) -> Result<(), String> {
    let p = path(a)?;
    if let Some(d) = p.parent() {
        fs::create_dir_all(d).map_err(|e| e.to_string())?
    };
    fs::write(p, serde_json::to_vec(s).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

fn entry() -> Result<Entry, String> {
    Entry::new("AkariuMulti", "license-key").map_err(|e| e.to_string())
}

// BACA HARDWARE ID
fn device<R: Runtime>(a: &AppHandle<R>) -> Result<String, String> {
    if let Some(s) = read(a)? {
        if !s.device_id.is_empty() {
            return Ok(s.device_id);
        }
    };
    let id = machine_uid::get().unwrap_or_else(|_| uuid::Uuid::new_v4().to_string());
    write(
        a,
        &LicenseState {
            device_id: id.clone(),
            ..Default::default()
        },
    )?;
    Ok(id)
}

#[tauri::command]
pub fn get_device_id<R: Runtime>(a: AppHandle<R>) -> Result<String, String> {
    device(&a)
}

#[tauri::command]
pub fn get_license_state<R: Runtime>(a: AppHandle<R>) -> Result<Option<LicenseState>, String> {
    read(&a)
}

// TANYA KE SATPAM SUPABASE
async fn call_validate<R: Runtime>(
    a: &AppHandle<R>,
    key: &str,
) -> Result<serde_json::Value, String> {
    let hwid = device(a)?;
    let client = reqwest::Client::new();
    
    // Kirim Lisensi dan Hardware ID ke Supabase
    let body = serde_json::json!({
        "license_key": key,
        "hardware_id": hwid
    });

    let res = client
        .post(API_VALIDATE)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Koneksi gagal: {}", e))?;

    let json: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Respon server error: {}", e))?;
        
    Ok(json)
}

#[tauri::command]
pub async fn activate_license<R: Runtime>(
    a: AppHandle<R>,
    license_key: String,
) -> Result<LicenseState, String> {
    let key = license_key.trim().to_uppercase();
    if key.is_empty() {
        return Err("Lisensi kosong".into());
    };

    let json = call_validate(&a, &key).await?;
    let valid = json["valid"].as_bool().unwrap_or(false);
    
    if !valid {
        let err_msg = json["message"].as_str().unwrap_or("Lisensi tidak valid.");
        return Err(err_msg.to_string());
    }

    let expiry = json["expires_at"].as_str().map(|s| s.to_string());
    let status = json["status"].as_str().unwrap_or("ACTIVE").to_string();
    let plan = json["plan"].as_str().unwrap_or("Premium").to_string();

    let state = LicenseState {
        plan,
        status,
        expires_at: expiry.clone(),
        lifetime: expiry.is_none(),
        last_validated_at: chrono::Utc::now().to_rfc3339(),
        device_id: device(&a)?,
    };

    entry()?.set_password(&key).map_err(|e| e.to_string())?;
    write(&a, &state)?;
    
    Ok(state)
}

#[tauri::command]
pub async fn validate_license<R: Runtime>(a: AppHandle<R>) -> Result<LicenseState, String> {
    let key = entry()?
        .get_password()
        .map_err(|_| "Tidak ada lisensi tersimpan".to_string())?;
        
    let json = call_validate(&a, &key).await?;
    let valid = json["valid"].as_bool().unwrap_or(false);
    
    if !valid {
        let err_msg = json["message"].as_str().unwrap_or("Lisensi tidak valid.");
        let _ = clear_license_state(a.clone());
        return Err(err_msg.to_string());
    }

    let expiry = json["expires_at"].as_str().map(|s| s.to_string());
    let status = json["status"].as_str().unwrap_or("ACTIVE").to_string();
    let plan = json["plan"].as_str().unwrap_or("Premium").to_string();

    let state = LicenseState {
        plan,
        status,
        expires_at: expiry.clone(),
        lifetime: expiry.is_none(),
        last_validated_at: chrono::Utc::now().to_rfc3339(),
        device_id: device(&a)?,
    };
    
    write(&a, &state)?;
    Ok(state)
}

#[tauri::command]
pub fn clear_license_state<R: Runtime>(a: AppHandle<R>) -> Result<(), String> {
    let _ = entry()?.delete_credential();
    let p = path(&a)?;
    if p.exists() {
        fs::remove_file(p).map_err(|e| e.to_string())?
    };
    Ok(())
}
