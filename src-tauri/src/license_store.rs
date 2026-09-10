use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{path::BaseDirectory, AppHandle, Manager, Runtime};

// Ini adalah alamat API resmi Keygen Anda
const API: &str = "https://api.keygen.sh/v1/accounts/e117caf4-882d-4eba-a5a2-46e4303018a2";

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

// Mengambil Hardware ID Permanen (Anti-Reinstall / Anti Curang)
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

// Fungsi Internal untuk Cek Kunci ke Keygen API
async fn call_validate<R: Runtime>(
    a: &AppHandle<R>,
    key: &str,
) -> Result<serde_json::Value, String> {
    let hwid = device(a)?;
    let client = reqwest::Client::new();
    
    let body = serde_json::json!({
        "meta": {
            "key": key,
            "scope": { "fingerprint": hwid }
        }
    });

    let res = client
        .post(format!("{}/licenses/actions/validate-key", API))
        .header("Content-Type", "application/vnd.api+json")
        .header("Accept", "application/vnd.api+json")
        .json(&body)
        .send()
        .await
        .map_err(|_| "Gagal terhubung ke Server Lisensi (Cek koneksi internet)".to_string())?;

    let json: serde_json::Value = res
        .json()
        .await
        .map_err(|_| "Respon server tidak valid".to_string())?;
        
    Ok(json)
}

#[tauri::command]
pub async fn activate_license<R: Runtime>(
    a: AppHandle<R>,
    license_key: String,
) -> Result<LicenseState, String> {
    let key = license_key.trim();
    if key.is_empty() {
        return Err("Lisensi kosong atau tidak valid".into());
    };

    // 1. Cek lisensinya dulu ke Keygen
    let mut json = call_validate(&a, key).await?;
    let mut code = json["meta"]["code"].as_str().unwrap_or("");

    // 2. Jika valid tapi belum diaktifkan di PC ini, daftarkan PC ini!
    if code == "NO_MACHINE" || code == "NO_MACHINES" {
        let hwid = device(&a)?;
        
        // AMBIL ID LISENSI DARI SERVER UNTUK DIIKAT KE KOMPUTER INI
        let license_id = json["data"]["id"].as_str().unwrap_or(""); 

        let client = reqwest::Client::new();
        let body = serde_json::json!({
            "data": {
                "type": "machines",
                "attributes": {
                    "fingerprint": hwid
                },
                "relationships": {  // <--- INI BAGIAN YANG TADI "MISSING"
                    "license": {
                        "data": { "type": "licenses", "id": license_id }
                    }
                }
            }
        });

        let res = client
            .post(format!("{}/machines", API))
            .header("Authorization", format!("License {}", key)) // Otorisasi pakai kunci lisensinya
            .header("Content-Type", "application/vnd.api+json")
            .header("Accept", "application/vnd.api+json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Gagal mendaftar PC: {}", e))?;

        if !res.status().is_success() {
            let err_json: serde_json::Value = res.json().await.unwrap_or_default();
            let err_detail = err_json["errors"][0]["detail"]
                .as_str()
                .unwrap_or("Gagal mengaktifkan lisensi di perangkat ini.");
            return Err(err_detail.to_string());
        }

        // Cek ulang untuk memastikan statusnya sekarang menjadi VALID
        json = call_validate(&a, key).await?;
        code = json["meta"]["code"].as_str().unwrap_or("");
    }

    // 3. Baca hasil akhirnya
    let valid = json["meta"]["valid"].as_bool().unwrap_or(false);
    
    if !valid {
        let err_msg = match code {
            "FINGERPRINT_SCOPE_MISMATCH" => "Lisensi ini sudah terpakai di komputer lain.",
            "EXPIRED" => "Lisensi sudah kedaluwarsa.",
            "SUSPENDED" => "Lisensi Anda dibekukan sementara.",
            _ => "Lisensi tidak valid atau tidak ditemukan."
        };
        return Err(err_msg.to_string());
    }

    // 4. Jika valid, simpan ke komputer
    let expiry = json["data"]["attributes"]["expiry"].as_str().map(|s| s.to_string());
    let status = json["data"]["attributes"]["status"].as_str().unwrap_or("ACTIVE").to_string();

    let state = LicenseState {
        plan: "Premium Access".to_string(), // Otomatis Premium
        status,
        expires_at: expiry.clone(),
        lifetime: expiry.is_none(),
        last_validated_at: chrono::Utc::now().to_rfc3339(),
        device_id: device(&a)?,
    };

    entry()?.set_password(key).map_err(|e| e.to_string())?;
    write(&a, &state)?;
    
    Ok(state)
}

#[tauri::command]
pub async fn validate_license<R: Runtime>(a: AppHandle<R>) -> Result<LicenseState, String> {
    let key = entry()?
        .get_password()
        .map_err(|_| "Tidak ada lisensi tersimpan".to_string())?;
        
    let json = call_validate(&a, &key).await?;
    let valid = json["meta"]["valid"].as_bool().unwrap_or(false);
    
    if !valid {
        let code = json["meta"]["code"].as_str().unwrap_or("");
        let err_msg = match code {
            "FINGERPRINT_SCOPE_MISMATCH" => "Lisensi terpakai di PC lain.",
            "EXPIRED" => "Lisensi kedaluwarsa.",
            _ => "Lisensi tidak valid."
        };
        // Hapus file lisensi lokal karena sudah tidak valid
        let _ = clear_license_state(a.clone());
        return Err(err_msg.to_string());
    }

    let expiry = json["data"]["attributes"]["expiry"].as_str().map(|s| s.to_string());
    let status = json["data"]["attributes"]["status"].as_str().unwrap_or("ACTIVE").to_string();

    let state = LicenseState {
        plan: "Premium Access".to_string(),
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
