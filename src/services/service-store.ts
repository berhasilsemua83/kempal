import { invoke } from "@tauri-apps/api/core"

export type CustomService = {
  id: string;
  name: string;
  url: string;
}

export async function loadServices(): Promise<CustomService[]> {
  try {
    const data = await invoke<CustomService[] | null>("load_services");
    return data || [];
  } catch (error) {
    console.error("Gagal memuat services", error);
    return [];
  }
}

export async function saveServices(services: CustomService[]): Promise<void> {
  try {
    await invoke("save_services", { services });
  } catch (error) {
    console.error("Gagal menyimpan services", error);
  }
}
