import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { getVersion } from "@tauri-apps/api/app"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { invoke } from "@tauri-apps/api/core"
import { PhysicalSize } from "@tauri-apps/api/dpi"
import { relaunch } from "@tauri-apps/plugin-process"
import { check, type Update } from "@tauri-apps/plugin-updater"
import packageJson from "../package.json"
import { loadAccounts, saveAccounts } from "./services/account-store"
import { loadServices, saveServices, type CustomService } from "./services/service-store"

type Account = {
  id: string
  name: string
  email: string | null
  avatarUrl: string | null
  avatar: string
  favorite: boolean
  order: number
  url?: string
}
// Ganti dengan link toko utama Anda (ini dipakai di halaman login awal)
const LICENSE_PURCHASE_URL = "https://lynk.id/toko_anda" 

const TELEGRAM_CHANNEL_URL = ""
const APP_VERSION = packageJson.version
type LicenseState = { plan: string; status: string; expires_at: string | null; lifetime: boolean; last_validated_at: string; device_id: string }
const licensePlanLabel = (plan: string) => ({ five_minutes: "5 Minutes", one_day: "1 Day", seven_days: "7 Days", thirty_days: "30 Days", one_year: "1 Year", lifetime: "Lifetime" }[plan] || plan)
const licenseStatusLabel = (status: string) => status ? status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Unavailable"
const licenseExpiryLabel = (state: LicenseState | null) => state?.lifetime ? "Lifetime" : state?.expires_at ? new Date(state.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—"

const plans = [
  {
    name: "5 Days Trial",
    originalPrice: "Rp20.000",
    price: "Gratis", // Ubah jadi Rp0 atau Gratis
    description: "Try AkariuMulti for 5 days completely free",
    buttonText: "Get Trial License",
    url: "http://lynk.id/akariu/x0o7833nq5lx" // Ganti dengan link khusus produk trial
  },
  {
    name: "1 Year",
    originalPrice: "Rp125.000",
    price: "Rp35.000",
    description: "AkariuMulti access for 1 year",
    buttonText: "Buy License",
    url: "http://lynk.id/akariu/vdoe4l50mdno" // Ganti dengan link produk 1 tahun
  },
  {
    name: "Lifetime",
    originalPrice: "Rp280.000",
    price: "Rp50.000",
    description: "AkariuMulti access with no expiration",
    buttonText: "Buy License",
    url: "http://lynk.id/akariu/3x41jz8xxmom" // Ganti dengan link produk lifetime
  },
]
const starter: Account[] = [
  {
    id: "main",
    name: "Flow Main",
    email: null,
    avatarUrl: "/google-flow.png",
    avatar: "YK",
    favorite: true,
    order: 0,
  },
  {
    id: "client",
    name: "Client A",
    email: null,
    avatarUrl: "/google-flow.png",
    avatar: "CA",
    favorite: false,
    order: 1,
  },
  {
    id: "backup",
    name: "Backup",
    email: null,
    avatarUrl: "/google-flow.png",
    avatar: "B",
    favorite: false,
    order: 2,
  },
]

export default function App() {
  const [licensed, setLicensed] = useState(false)
  const [licenseChecking, setLicenseChecking] = useState(true)
  const [licenseError, setLicenseError] = useState("")
  const [licenseState, setLicenseState] = useState<LicenseState | null>(null)
  const [deviceId, setDeviceId] = useState("")
  const [key, setKey] = useState("")
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountsLoaded, setAccountsLoaded] = useState(false)
  // State untuk Custom Services
  const [customServices, setCustomServices] = useState<CustomService[]>([])
  const [servicesLoaded, setServicesLoaded] = useState(false)
  const [addServiceOpen, setAddServiceOpen] = useState(false)
  const [newServiceName, setNewServiceName] = useState("")
  const [newServiceUrl, setNewServiceUrl] = useState("")
  const [addServiceError, setAddServiceError] = useState("")
  const [profile, setProfile] = useState<{
    name: string
    avatar: string | null
  }>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("akariumulti-profile") ||
          '{"name":"AkariuMulti","avatar":null}'
      )
    } catch {
      return { name: "AkariuMulti", avatar: null }
    }
  })
  const [query, setQuery] = useState("")
const [view, setView] = useState<string>("accounts")
  const [active, setActive] = useState<Account | null>(null)
  const [fullView, setFullView] = useState(false)
  const [navigatorOpen, setNavigatorOpen] = useState(false)
  const [dialog, setDialog] = useState<Account | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  
  // BAGIAN PERBAIKAN 1: Variabel newAccountName dikembalikan
  const [addAccountOpen, setAddAccountOpen] = useState(false)
  const [newAccountName, setNewAccountName] = useState("") 
  const [newAccountUrl, setNewAccountUrl] = useState("https://flow.google")
  const [addAccountError, setAddAccountError] = useState("")
  // ========================================================
  
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragPoint, setDragPoint] = useState({ x: 0, y: 0 })
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [dragTargetId, setDragTargetId] = useState<string | null>(null)
  const [dragPreviewIds, setDragPreviewIds] = useState<string[] | null>(null)
useEffect(() => { 
    void (async () => { 
      try { 
        setLicenseChecking(true);
        
        // Panggil backend Rust untuk mengecek dan memvalidasi lisensi
        try {
          // Jika Anda belum menggunakan Keygen/API nyata, validasi ini akan gagal
          // dan otomatis melempar ke blok "catch", membuat licensed = false
          const state = await invoke<LicenseState>("validate_license");
          setLicenseState(state);
          setLicensed(true);
        } catch (err) {
          console.warn("Status Lisensi: Belum Aktif / Invalid", err);
          setLicensed(false);
        } finally {
          setLicenseChecking(false);
        }

        await invoke("expand_main_window"); 
        const w = getCurrentWindow(); 
        await w.show(); 
        await w.setFocus(); 
      } catch (error) { 
        console.error(error);
      } 
    })() 
  }, [])
  const dragSourceRef = useRef<HTMLElement | null>(null)
  const dragPointerIdRef = useRef<number | null>(null)
  const dragSourceIdRef = useRef<string | null>(null)
  const dragTargetIdRef = useRef<string | null>(null)
  const dragInsertAfterRef = useRef(false)
  const handleRename = (a: Account) => {
    const n = prompt("Rename account", a.name)
    if (n)
      setAccounts(accounts.map((x) => (x.id === a.id ? { ...x, name: n } : x)))
    setMenu(null)
  }
  const handleDelete = (a: Account) => {
    setDialog(a)
    setMenu(null)
  }
  const confirmDelete = async () => {
    if (!dialog) return
    const removing = dialog
    try {
      const profileCleaned = await invoke<boolean>("remove_google_flow_account", {
        accountId: removing.id,
      })
      setAccounts((current) => current.filter((account) => account.id !== removing.id))
      if (active?.id === removing.id) {
        setActive(null)
        setFullView(false)
        setNavigatorOpen(false)
        setView("accounts")
      }
      if (!profileCleaned) console.warn("Account removed; profile cleanup is pending")
      setDialog(null)
    } catch (error) {
      console.error("Unable to remove account", error)
    }
  }
  const handleToggleFavorite = (a: Account) => {
    setAccounts(
      accounts.map((x) => (x.id === a.id ? { ...x, favorite: !x.favorite } : x))
    )
    setMenu(null)
  }
  const handleAddAccount = () => {
    setNewAccountName("")
    setAddAccountError("")
    setAddAccountOpen(true)
  }
  const createService = () => {
    const name = newServiceName.trim()
    let url = newServiceUrl.trim()
    
    if (!name) { setAddServiceError("Please enter a web name."); return }
    if (!url) { setAddServiceError("Please enter a URL."); return }
    
    // Otomatis tambahkan https:// jika user lupa mengetiknya
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    const newService: CustomService = {
      id: crypto.randomUUID(),
      name,
      url,
    }
    setCustomServices([...customServices, newService])
    setAddServiceOpen(false)
    setNewServiceName("")
    setNewServiceUrl("")
  }

  const deleteService = (id: string, name: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus web custom "${name}"? Akun yang menggunakan web ini tidak akan terhapus, tapi menu ini akan hilang dari Sidebar.`)) {
      setCustomServices(customServices.filter(s => s.id !== id))
      if (view === `custom-${id}`) setView("accounts")
    }
  }
const createAccount = () => {
    const name = newAccountName.trim()
    if (!name) {
      setAddAccountError("Please enter an account name.")
      return
    }
    if (name.length > 80) {
      setAddAccountError("Account name must be 80 characters or fewer.")
      return
    }
    
// MENENTUKAN LOGO BERDASARKAN URL YANG DIPILIH
    let determinedAvatarUrl = "/google-flow.png";
    if (newAccountUrl.includes("dola.com")) {
      determinedAvatarUrl = "/dola.png";
    } else if (newAccountUrl.includes("migoo.ai")) {
      determinedAvatarUrl = "/migoo.png";
    } else if (customServices.some(s => s.url === newAccountUrl)) {
      // Jika url-nya adalah custom web, gunakan custom.png
      determinedAvatarUrl = "/custom.png"; 
    }

    const a: Account = {
      id: crypto.randomUUID(),
      name,
      email: null,
      avatarUrl: determinedAvatarUrl,
      avatar: "NF",
      favorite: false,
      order: accounts.length,
      url: newAccountUrl,
    }
    setAccounts([...accounts, a])
    setAddAccountOpen(false)
  }
  const updateProfileAvatar = (avatar: string) => {
    const next = { ...profile, avatar }
    setProfile(next)
    localStorage.setItem("akariumulti-profile", JSON.stringify(next))
  }
  useEffect(() => {
    if (!licensed || accountsLoaded) return
    void loadAccounts().then((saved) => setAccounts(saved as Account[])).finally(() => setAccountsLoaded(true))
  }, [licensed, accountsLoaded])
  useEffect(() => {
    if (licensed && accountsLoaded) void saveAccounts(accounts)
  }, [accounts, licensed, accountsLoaded])
  // Efek untuk memuat Custom Services pertama kali aplikasi dibuka
  useEffect(() => {
    if (!licensed || servicesLoaded) return
    void loadServices().then((saved) => setCustomServices(saved)).finally(() => setServicesLoaded(true))
  }, [licensed, servicesLoaded])

  // Efek untuk otomatis menyimpan jika ada perubahan di customServices
  useEffect(() => {
    if (licensed && servicesLoaded) void saveServices(customServices)
  }, [customServices, licensed, servicesLoaded])
  useEffect(() => {
    const activeStillExists = active !== null && accounts.some((account) => account.id === active.id)
    if (view === "flow" && !activeStillExists) {
      setActive(null)
      setFullView(false)
      setNavigatorOpen(false)
      setView("accounts")
    } else if (view !== "flow" && (fullView || navigatorOpen)) {
      setFullView(false)
      setNavigatorOpen(false)
    }
  }, [active, accounts, view, fullView, navigatorOpen])
  const favoriteCount = accounts.filter((a) => a.favorite).length
const visible = useMemo(() => {
    return accounts.filter((a) => {
      const matchesSearch = `${a.name} ${a.email}`.toLowerCase().includes(query.toLowerCase());
      if (!matchesSearch) return false;
      if (view === "favorites") return a.favorite;
      if (view === "flow-accounts") return !a.url || a.url.includes("flow.google");
      if (view === "dola-accounts") return a.url && a.url.includes("dola");
      if (view === "migoo-accounts") return a.url && a.url.includes("migoo");
      
      // Filter untuk Custom Web
      if (view.startsWith("custom-")) {
        const customId = view.replace("custom-", "");
        const targetService = customServices.find(s => s.id === customId);
        if (targetService) {
          return a.url === targetService.url;
        }
        return false;
      }
      
      return true;
    });
  }, [accounts, query, view, customServices]);
  const displayed = useMemo(() => {
    if (!dragPreviewIds || view !== "accounts") return visible
    const byId = new Map(accounts.map((account) => [account.id, account]))
    return dragPreviewIds.map((id) => byId.get(id)).filter(Boolean) as Account[]
  }, [accounts, dragPreviewIds, view, visible])
  const finishPointerDrag = (commit: boolean) => {
    const sourceId = dragSourceIdRef.current
    const targetId = dragTargetIdRef.current
    if (commit && sourceId && targetId && sourceId !== targetId) {
      setAccounts((current) => {
        const sourceIndex = current.findIndex((a) => a.id === sourceId)
        const targetIndex = current.findIndex((a) => a.id === targetId)
        if (sourceIndex < 0 || targetIndex < 0) return current
        const next = [...current]
        const [source] = next.splice(sourceIndex, 1)
        const insertionIndex = next.findIndex((a) => a.id === targetId)
        next.splice(insertionIndex + (dragInsertAfterRef.current ? 1 : 0), 0, source)
        return next.map((a, index) => ({ ...a, order: index }))
      })
    }
    if (dragSourceRef.current && dragPointerIdRef.current !== null) {
      try { dragSourceRef.current.releasePointerCapture(dragPointerIdRef.current) } catch { }
    }
    dragSourceRef.current = null
    dragPointerIdRef.current = null
    dragSourceIdRef.current = null
    dragTargetIdRef.current = null
    setDraggingId(null)
    setDragTargetId(null)
    setDragPreviewIds(null)
  }
  useEffect(() => {
    const accountAtPoint = (x: number, y: number) => {
      const candidates = Array.from(document.querySelectorAll<HTMLElement>("[data-account-id]"))
        .filter((element) => element.dataset.accountId !== dragSourceIdRef.current)
        .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      const hit = candidates.find(({ rect }) =>
        x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
      )
      if (hit) return { id: hit.element.dataset.accountId || null, after: x > (hit.rect.left + hit.rect.right) / 2 }
      const nearest = candidates
        .map(({ element, rect }) => ({
          element,
          rect,
          distance: Math.hypot((rect.left + rect.right) / 2 - x, (rect.top + rect.bottom) / 2 - y),
        }))
        .sort((a, b) => a.distance - b.distance)[0]
      if (!nearest) return null
      return { id: nearest.element.dataset.accountId || null, after: x > (nearest.rect.left + nearest.rect.right) / 2 }
    }
    const onMove = (event: PointerEvent) => {
      if (dragPointerIdRef.current !== event.pointerId) return
      event.preventDefault()
      setDragPoint({ x: event.clientX, y: event.clientY })
      const hit = accountAtPoint(event.clientX, event.clientY)
      const targetId = hit?.id || null
      dragInsertAfterRef.current = hit?.after || false
      dragTargetIdRef.current = targetId
      setDragTargetId(targetId)
      if (targetId) setDragPreviewIds((current) => {
        const ids = current || accounts.map((a) => a.id)
        const from = ids.indexOf(dragSourceIdRef.current || "")
        const to = ids.indexOf(targetId)
        if (from < 0 || to < 0 || from === to) return ids
        const next = [...ids]
        const [moved] = next.splice(from, 1)
        const targetIndex = next.indexOf(targetId)
        next.splice(targetIndex + (dragInsertAfterRef.current ? 1 : 0), 0, moved)
        return next
      })
    }
    const onUp = (event: PointerEvent) => {
      if (dragPointerIdRef.current === event.pointerId) finishPointerDrag(true)
    }
    const onCancel = (event: PointerEvent) => {
      if (dragPointerIdRef.current === event.pointerId) finishPointerDrag(false)
    }
    window.addEventListener("pointermove", onMove, { passive: false })
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onCancel)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onCancel)
    }
  }, [accounts])
  const beginPointerDrag = (id: string, event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || view !== "accounts" || query.trim()) return
    if ((event.target as HTMLElement).closest("button, a, input, textarea, select")) return
    const rect = event.currentTarget.getBoundingClientRect()
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragSourceRef.current = event.currentTarget
    dragPointerIdRef.current = event.pointerId
    dragSourceIdRef.current = id
    dragTargetIdRef.current = null
    dragInsertAfterRef.current = false
    setDraggingId(id)
    setDragTargetId(null)
    setDragPreviewIds(accounts.map((a) => a.id))
    setDragOffset({ x: event.clientX - rect.left, y: event.clientY - rect.top })
    setDragPoint({ x: event.clientX, y: event.clientY })
  }
  const activateLicense = async () => {
    if (!key.trim()) { 
      setLicenseError("Masukkan kunci lisensi terlebih dahulu"); 
      return; 
    }
    
    setLicenseChecking(true); 
    setLicenseError("");
    
    try {
      // Ini akan memanggil Rust yang sekarang terhubung ke Keygen
      const activated = await invoke<LicenseState>("activate_license", { licenseKey: key });
      
      setLicenseState(activated); 
      setLicensed(true);
      setKey(""); // Bersihkan input
      
      const w = getCurrentWindow();
      await invoke("expand_main_window"); 
      await w.show(); 
      await w.setFocus(); 
    } catch (error) { 
      // Akan menampilkan alasan DARI SERVER (misal: "Lisensi kedaluwarsa" dll)
      setLicenseError(typeof error === "string" ? error : "Gagal terhubung ke Server");
    } finally { 
      setLicenseChecking(false); 
    }
  }
  const openLicensePurchase = (url?: string) =>
    invoke("open_external_url", { url: url || LICENSE_PURCHASE_URL })
// Paksa pindah ke halaman License jika belum ada lisensi (kecuali sedang buka Info)
  useEffect(() => {
    if (!licenseChecking && !licensed && view !== "info" && view !== "license") {
      setView("license")
    }
  }, [licensed, licenseChecking, view])
  if (view === "flow" && active)
    return (
      <div className={`app ${fullView ? "full" : ""}`}>
  {!fullView && <Sidebar view="flow" setView={setView} profile={profile} licenseState={licenseState} customServices={customServices} onAddService={() => setAddServiceOpen(true)} onDeleteService={deleteService} licensed={licensed} />}
        <main className="content flow-content">
          <FlowShell
            account={active}
            accounts={accounts}
            fullView={fullView}
            navigatorOpen={navigatorOpen}
            onToggleFullView={() => {
              setNavigatorOpen(false)
              setFullView((current) => !current)
            }}
            onToggleNavigator={() => setNavigatorOpen((current) => !current)}
            onSelectAccount={(account) => {
              setNavigatorOpen(false)
              if (account.id !== active.id) setActive(account)
            }}
            onBack={() => {
              void invoke("close_google_flow")
              setFullView(false)
              setNavigatorOpen(false)
              setView("accounts")
            }}
          />
        </main>
      </div>
    )
  return (
    <div className="app">
      <Sidebar view={view} setView={setView} profile={profile} licenseState={licenseState} customServices={customServices} onAddService={() => setAddServiceOpen(true)} onDeleteService={deleteService} licensed={licensed} />
      <main className="content">
        <header>
          <div>
            <div className="eyebrow">
              AKARIUMULTI /{" "}
              {view === "settings"
                ? "SETTINGS"
                : view === "favorites"
                ? "FAVORITES"
                : view.toUpperCase()}
            </div>
            <h1>
              {view === "settings" ? "Settings"
                : view === "favorites" ? "Favorite Accounts"
                : view === "license" ? "License"
                : view === "updates" ? "Updates"
                : view === "info" ? "How to Use AkariuMulti"
                : view === "flow-accounts" ? "Google Flow Accounts"
                : view === "dola-accounts" ? "Dola Accounts"
                : view === "migoo-accounts" ? "Migoo.ai Accounts"
                : "All Accounts"}
            </h1>
            <p>
              {view === "settings"
                ? "Keep AkariuMulti personal, private, and ready to use."
                : view === "favorites"
                ? "Your favorite Google Flow accounts in one place."
                : view === "license"
                ? "Choose the AkariuMulti license that fits your needs."
                : view === "updates"
                ? "Keep AkariuMulti up to date with the latest version."
                : view === "info"
                ? "A quick guide to managing your Google Flow accounts."
                : "Manage your Google Flow accounts in one place."}
            </p>
            {view === "accounts" && (
              <div className="account-count">
                {accounts.length}{" "}
                {accounts.length === 1 ? "Account" : "Accounts"}
              </div>
            )}
            {view === "favorites" && (
              <div className="account-count">{favoriteCount} Favorites</div>
            )}
          </div>
          {view === "accounts" && (
            <div className="header-actions">
              <div className="search">
                ⌕
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search accounts..."
                />
              </div>
              <button className="primary" onClick={handleAddAccount}>
                ＋ Add Account
              </button>
            </div>
          )}
        </header>
        {view === "settings" ? (
          <Settings profile={profile} onAvatarChange={updateProfileAvatar} />
        ) : view === "license" ? (
          <LicensePage 
            licenseState={licenseState} 
            onBuy={(url) => openLicensePurchase(url)} 
            licensed={licensed}
            licenseKey={key}
            setLicenseKey={setKey}
            onActivate={activateLicense}
            licenseChecking={licenseChecking}
            licenseError={licenseError}
          />
        ) : view === "updates" ? (
          <UpdatesPage />
        ) : view === "info" ? (
          <InfoPage />
        ) : (
          <>
            <div className="grid">
              {displayed.map((a) => (
                <Card
                  key={a.id}
                  a={a}
                  customServices={customServices}
                  menuOpen={menu === a.id}
                  onMenu={() => setMenu(menu === a.id ? null : a.id)}
                  onOpen={() => {
                    setActive(a)
                    setView("flow")
                  }}
                  onFavorite={() => handleToggleFavorite(a)}
                  onDelete={() => handleDelete(a)}
                  onRename={() => handleRename(a)}
                  dragEnabled={view === "accounts" && !query.trim()}
                  isDragging={draggingId === a.id}
                  isDropTarget={dragTargetId === a.id}
                  onPointerDown={(event) => beginPointerDrag(a.id, event)}
                />
              ))}
              {view === "accounts" && (
                <AddAccountCard onAdd={handleAddAccount} />
              )}
            </div>
            {draggingId && <DragPreview account={accounts.find((a) => a.id === draggingId) || null} point={dragPoint} offset={dragOffset} />}
          </>
        )}
        {dialog && (
          <div className="overlay">
            <div className="dialog">
              <h2>Delete {dialog.name}?</h2>
              <p>
                This removes the account card from AkariuMulti. Your Google
                account is not affected.
              </p>
              <div className="dialog-actions">
                <button className="secondary" onClick={() => setDialog(null)}>
                  Cancel
                </button>
                <button
                  className="danger"
                  onClick={() => void confirmDelete()}
                >
                  Delete account
                </button>
              </div>
            </div>
          </div>
        )}
        {addAccountOpen && (
          <div className="overlay">
            <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="add-account-title">
              <h2 id="add-account-title">Add Account</h2>
              <p>Enter a name for this account.</p>
              
              <input
                autoFocus
                value={newAccountName}
                onChange={(event) => {
                  setNewAccountName(event.target.value)
                  setAddAccountError("")
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") createAccount()
                }}
                placeholder="Enter account name"
                maxLength={80}
              />

              <select 
                value={newAccountUrl} 
                onChange={(e) => setNewAccountUrl(e.target.value)}
                style={{ width: "100%", height: "46px", marginTop: "10px", borderRadius: "10px", background: "#131619", color: "#e8e9e9", border: "1px solid #363a3d", padding: "0 14px" }}
              >
                <option value="https://flow.google">Google Flow</option>
                <option value="https://dola.com">Dola</option>
                <option value="https://migoo.ai">Migoo</option>
                {/* Looping untuk Custom Services */}
                {customServices.map((service) => (
                  <option key={service.id} value={service.url}>{service.name}</option>
                ))}
              </select>

              {addAccountError && <p className="dialog-error">{addAccountError}</p>}
              
              <div className="dialog-actions">
                <button className="secondary" onClick={() => setAddAccountOpen(false)}>
                  Cancel
                </button>
                <button className="primary" onClick={createAccount}>
                  Add Account
                </button>
              </div>
            </div>
          </div>
        )}
      {/* BAGIAN PERBAIKAN 2: Penutup Main dan Div yang hilang */}
        {addServiceOpen && (
          <div className="overlay">
            <div className="dialog" role="dialog" aria-modal="true">
              <h2>Add Custom Web</h2>
              <p>Masukkan nama dan URL website baru.</p>
              
              <input
                autoFocus
                value={newServiceName}
                onChange={(event) => {
                  setNewServiceName(event.target.value)
                  setAddServiceError("")
                }}
                placeholder="Nama Web (misal: ChatGPT)"
                maxLength={40}
              />

              <input
                value={newServiceUrl}
                onChange={(event) => {
                  setNewServiceUrl(event.target.value)
                  setAddServiceError("")
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") createService()
                }}
                placeholder="URL (misal: chatgpt.com)"
                style={{ marginTop: "10px", width: "100%", height: "46px", borderRadius: "10px", background: "#131619", color: "#e8e9e9", border: "1px solid #363a3d", padding: "0 14px" }}
              />

              {addServiceError && <p className="dialog-error">{addServiceError}</p>}
              
              <div className="dialog-actions">
                <button className="secondary" onClick={() => setAddServiceOpen(false)}>
                  Cancel
                </button>
                <button className="primary" onClick={createService}>
                  Add Web
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
// ========================================================

function Brand() {
  return (
    <div className="brand">
      <img className="brand-image" src="/foursquare.png" alt="AkariuMulti logo" />
      <span>AKARIUMULTI</span>
    </div>
  )
}
function Sidebar({
  view,
  setView,
  profile,
  licenseState,
  customServices,
  onAddService,
  onDeleteService,
  licensed, // <--- TAMBAHKAN INI
}: {
  licensed: boolean
  view: string
  setView: (v: any) => void
  profile: { name: string; avatar: string | null }
  licenseState: LicenseState | null
  customServices: import("./services/service-store").CustomService[]
  onAddService: () => void
  onDeleteService: (id: string, name: string) => void
}) {
  return (
    <aside>
      <Brand />
      <div className="side-label">WORKSPACE</div>
      
      <button disabled={!licensed} className={view === "accounts" ? "active" : ""} onClick={() => setView("accounts")}>
        <SidebarIcon name="accounts" /> <span>All Accounts</span>
      </button>
      
      <button disabled={!licensed} className={view === "flow-accounts" ? "active" : ""} onClick={() => setView("flow-accounts")}>
        <SidebarIcon name="accounts" /> <span>Flow</span>
      </button>

      <button disabled={!licensed} className={view === "dola-accounts" ? "active" : ""} onClick={() => setView("dola-accounts")}>
        <SidebarIcon name="accounts" /> <span>Dola</span>
      </button>

      <button disabled={!licensed} className={view === "migoo-accounts" ? "active" : ""} onClick={() => setView("migoo-accounts")}>
        <SidebarIcon name="accounts" /> <span>Migoo.ai</span>
      </button>
      <button disabled={!licensed} className={view === "favorites" ? "active" : ""} onClick={() => setView("favorites")}>
        <SidebarIcon name="favorites" /> <span>Favorites</span>
      </button>
      {/* CUSTOM SERVICES SECTION */}
      {customServices.length > 0 && <div className="side-label">CUSTOM WEB</div>}
      
      {customServices.map((service) => (
        <div key={service.id} style={{ display: "flex", width: "100%", alignItems: "center" }}>
          <button
            disabled={!licensed}
            className={view === `custom-${service.id}` ? "active" : ""}
            onClick={() => setView(`custom-${service.id}`)}
            style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            <SidebarIcon name="accounts" /> <span>{service.name}</span>
          </button>
          <button 
            onClick={() => onDeleteService(service.id, service.name)}
            style={{ background: "transparent", border: "none", color: "#666", width: "30px", padding: 0, cursor: "pointer", fontSize: "12px" }}
            title="Hapus web ini"
          >
            ✕
          </button>
        </div>
      ))}

      <button disabled={!licensed} onClick={onAddService} style={{ color: "#8a8e91", marginTop: "4px" }}>
        <span>＋ Add Custom Web</span>
      </button>
      <div className="rule" />
<div className="side-label">GENERAL</div>
      <button
        className={view === "license" ? "active" : ""}
        onClick={() => setView("license")}
      >
        <SidebarIcon name="license" /> <span>License</span>
      </button>

      {/* Menu Updates dihapus */}

      <button
        className={view === "info" ? "active" : ""}
        onClick={() => setView("info")}
      >
        <SidebarIcon name="info" /> <span>Info</span>
      </button>

      {/* Menu Settings dihapus */}
      <div className="side-bottom">
        <div 
          className="avatar" 
          style={{ 
            // Jika licensed aktif, pakai gradasi menyala. Jika tidak, pakai warna abu-abu gelap
            background: licensed 
              ? "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)" 
              : "#2a2d30", 
            
            // Jika licensed aktif, teks putih. Jika tidak, teks abu-abu redup
            color: licensed ? "white" : "#6c7074", 
            
            border: "none",
            
            // Jika licensed aktif, berikan efek cahaya (glow). Jika tidak, hilangkan cahayanya
            boxShadow: licensed 
              ? "0 4px 12px rgba(168, 85, 247, 0.4)" 
              : "none",
              
            transition: "all 0.5s ease" // Efek transisi halus saat berubah warna
          }}
        >
          {profile.avatar ? (
            <img src={profile.avatar} alt="AkariuMulti profile" />
          ) : (
            "AM" 
          )}
        </div>
        <div>
          <div className="side-license-info">
            <small>
              <span>License {licenseState ? licenseStatusLabel(licenseState.status) : "Unavailable"}: <b>{licenseState ? licensePlanLabel(licenseState.plan) : "—"}</b></span>
              <span>Expired: <b>{licenseExpiryLabel(licenseState)}</b></span>
            </small>
          </div>
        </div>
      </div>
    </aside>
  )
}
function SidebarIcon({ name }: { name: "accounts" | "favorites" | "license" | "updates" | "info" | "settings" }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true }
  const paths = {
    accounts: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    favorites: <path d="m12 4 2.5 5.1 5.6.8-4 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-4 5.6-.8L12 4Z" />,
    license: <><path d="M7 4h10l2 3v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7l2-3Z" /><path d="M9 4v4h6V4M9 13h6M9 17h4" /></>,
    updates: <><path d="M20 11a8 8 0 0 0-14.7-4L4 9" /><path d="M4 4v5h5M4 13a8 8 0 0 0 14.7 4L20 15" /><path d="M20 20v-5h-5" /></>,
    info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></>,
    settings: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="1.8" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="1.8" fill="currentColor" stroke="none" /><circle cx="10" cy="18" r="1.8" fill="currentColor" stroke="none" /></>,
// --- TAMBAHKAN BARIS INI UNTUK IKON WEBSITE ---
    website: <><circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /><path d="M2 12h20" /></>,
  }
  return <svg className="sidebar-icon" {...common}>{paths[name]}</svg>
}
function LicensePage({ 
  licenseState, 
  onBuy,
  licensed,
  licenseKey,
  setLicenseKey,
  onActivate,
  licenseChecking,
  licenseError
}: { 
  licenseState: LicenseState | null; 
  onBuy: (url?: string) => void;
  licensed: boolean;
  licenseKey: string;
  setLicenseKey: (k: string) => void;
  onActivate: () => void;
  licenseChecking: boolean;
  licenseError: string;
}) {
  return (
    <div className="feature-page">
      {!licensed && (
        <section className="info-card" style={{ marginBottom: "20px" }}>
          <div className="eyebrow">ACTIVATION</div>
          <h2>Enter your license</h2>
          <p>Activate AkariuMulti to unlock all workspaces and features.</p>
          <input
            autoFocus
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            placeholder="Enter your license key"
            onKeyDown={(e) => e.key === "Enter" && onActivate()}
            disabled={licenseChecking}
            style={{ width: "100%", height: "46px", borderRadius: "10px", background: "#131619", color: "#e8e9e9", border: "1px solid #363a3d", padding: "0 14px", marginTop: "10px", marginBottom: "10px" }}
          />
          <button className="primary wide" onClick={onActivate} disabled={licenseChecking}>
            {licenseChecking ? "Activating…" : "Activate AkariuMulti →"}
          </button>
          {licenseError && <p className="dialog-error" style={{marginTop: "10px"}}>{licenseError}</p>}
        </section>
      )}

      {licensed && (
        <section className="license-info">
          <div className="eyebrow">CURRENT LICENSE</div>
          <h2>Current License</h2>
          <div className="license-stats">
            <span>
              <b>Plan</b>
              {licenseState ? licensePlanLabel(licenseState.plan) : "—"}
            </span>
            <span>
              <b>Status</b>
              {licenseState ? licenseStatusLabel(licenseState.status) : "Unavailable"}
            </span>
            <span>
              <b>Expires</b>
              {licenseExpiryLabel(licenseState)}
            </span>
          </div>
        </section>
      )}

      <div className="plan-grid">
        {plans.map((plan) => (
          <section className="plan-card" key={plan.name}>
            <div className="eyebrow">{plan.name.toUpperCase()}</div>
            <s>{plan.originalPrice}</s>
            <strong>{plan.price}</strong>
            <p>{plan.description}.</p>
            <button className="primary" onClick={() => onBuy(plan.url)}>
              {plan.buttonText}
            </button>
          </section>
        ))}
      </div>
    </div>
  )
}
function UpdatesPage() {
  type UpdatePhase = "checking" | "upToDate" | "available" | "downloading" | "installing" | "relaunching" | "error"
  const [phase, setPhase] = useState<UpdatePhase>("checking")
  const [currentVersion, setCurrentVersion] = useState("—")
  const [latestVersion, setLatestVersion] = useState("—")
  const [releaseNotes, setReleaseNotes] = useState<string[]>([])
  const [availableUpdate, setAvailableUpdate] = useState<Update | null>(null)
  const [downloaded, setDownloaded] = useState(0)
  const [contentLength, setContentLength] = useState<number | null>(null)
  const checking = useRef(false)

  const checkForUpdates = async () => {
    if (checking.current) return
    checking.current = true
    setPhase("checking")
    try {
      const installedVersion = await getVersion()
      setCurrentVersion(installedVersion)
      const update = await check()
      setAvailableUpdate(update)
      if (!update) {
        setLatestVersion(installedVersion)
        setReleaseNotes([])
        setPhase("upToDate")
        return
      }
      setLatestVersion(update.version)
      setReleaseNotes(update.body ? update.body.split(/\r?\n/).filter(Boolean) : [])
      setPhase("available")
    } catch {
      setAvailableUpdate(null)
      setPhase("error")
    } finally {
      checking.current = false
    }
  }

  useEffect(() => {
    void checkForUpdates()
  }, [])

  const installUpdate = async () => {
    if (!availableUpdate) return
    setDownloaded(0)
    setContentLength(null)
    setPhase("downloading")
    try {
      await availableUpdate.downloadAndInstall((event) => {
        if (event.event === "Started") {
          setContentLength(event.data.contentLength ?? null)
          setDownloaded(0)
        } else if (event.event === "Progress") {
          setDownloaded((value) => value + event.data.chunkLength)
        } else if (event.event === "Finished") {
          setPhase("installing")
        }
      })
      setPhase("relaunching")
      await relaunch()
    } catch {
      setPhase("error")
    }
  }

  const status: Record<UpdatePhase, string> = {
    checking: "Checking for updates",
    upToDate: "Up to date",
    available: "Update available",
    downloading: "Downloading",
    installing: "Installing",
    relaunching: "Relaunching",
    error: "Update unavailable",
  }
  const progress = contentLength ? Math.min(100, Math.round((downloaded / contentLength) * 100)) : null
  const busy = phase === "checking" || phase === "downloading" || phase === "installing" || phase === "relaunching"

  return (
    <div className="feature-page">
      <section className="info-card">
        <div>
          <div className="eyebrow">CURRENT VERSION</div>
          <h2>{currentVersion}</h2>
        </div>
        <div>
          <div className="eyebrow">LATEST VERSION</div>
          <h2>{latestVersion}</h2>
        </div>
        <span className="badge">{status[phase]}</span>
        <button className="primary" disabled={busy || phase === "upToDate" || !availableUpdate} onClick={() => void installUpdate()}>
          {phase === "downloading" ? "Downloading…" : phase === "installing" ? "Installing…" : phase === "relaunching" ? "Relaunching…" : "Update Now"}
        </button>
        {phase === "error" && <button className="secondary" onClick={() => void checkForUpdates()}>Retry</button>}
        {phase === "downloading" && <div className="update-progress" role="status">{progress === null ? `${Math.round(downloaded / 1024)} KB downloaded` : `${progress}% downloaded`}</div>}
      </section>
      <section className="info-card release-notes">
        <div className="eyebrow">WHAT'S NEW</div>
        {releaseNotes.length === 0 && <p>{phase === "upToDate" ? "You are using the latest version." : "Release notes are not available."}</p>}
        {releaseNotes.map((note) => (
          <p key={note}>• {note}</p>
        ))}
      </section>
    </div>
  )
}
function InfoPage() {
  // 1. Ubah default dari "en" menjadi "id"
  const [lang, setLang] = useState<"en" | "id">("id")

  // 2. Tambahkan info tentang Custom Web di konten teksnya
  const content = {
    en: {
      steps: [
        ["The Ultimate Account Pool", "Keep all your Google Flow, Dola, Migoo, and ANY custom AI websites in one single workspace."],
        ["Add Custom Websites", "Not limited to default websites. You can add your own favorite AI tools or web apps by clicking '+ Add Custom Web'."],
        ["One-Click Switching", "Jump from one account to another instantly without the tedious process of logging in and out."],
        ["Beat Generation Limits", "Hit your daily usage limit on one account? Just click on your backup account and continue your work."]
      ],
      whyTitle: "Why choose AkariuMulti over a browser?",
      whySubtitle: "Maximize your productivity and efficiency.",
      whyBadge: "WORK SMART",
      reasons: [
        ["🚫 Zero Tab Clutter", "Stop getting lost in dozens of open tabs. AkariuMulti keeps your workspace clean in one dedicated app."],
        ["⚡ Instant Transitions", "Time is money. Switching between accounts takes literally one click, saving you time."],
        ["🤖 All-in-One Hub", "Run Flow, Dola, Migoo, or ANY custom web apps side-by-side smoothly in a single interface."],
        ["🛡️ Focused Resource", "Designed specifically to handle multiple AI accounts efficiently without eating up your RAM."]
      ]
    },
    id: {
      steps: [
        ["Pusat Akun Terpadu", "Kumpulkan semua akun Google Flow, Dola, Migoo, dan website AI CUSTOM apa pun yang anda punya untuk banyak akun (Penyedia kredit Harian) di satu tempat."],
        ["Bebas Tambah Website", "Tidak terbatas pada web bawaan. Anda bisa menambahkan web AI favorit Anda sendiri melalui menu '+ Add Custom Web' di Sidebar."],
        ["Pindah Akun 1 Klik", "Pindah antar akun secara instan. Bekerja lebih efisien tanpa repot login dan logout berulang kali."],
        ["Atasi Limit Harian", "Limit harian di satu akun habis? Cukup ganti ke akun cadanganmu dan lanjutkan pekerjaan tanpa hambatan."]
      ],
      whyTitle: "Mengapa memilih AkariuMulti dibanding browser?",
      whySubtitle: "Maksimalkan produktivitas dan efisiensi Anda.",
      whyBadge: "KERJA CERDAS",
      reasons: [
        ["🚫 Bebas Tab Menumpuk", "Berhenti pusing dengan puluhan tab. AkariuMulti menjaga ruang kerjamu tetap bersih di satu aplikasi khusus."],
        ["⚡ Transisi Instan", "Waktu adalah uang. Pindah antar akun hanya butuh satu klik, jauh lebih cepat daripada browser biasa."],
        ["🤖 Hub AI All-in-One", "Buka Flow, Dola, Migoo, atau Web Custom Anda sendiri secara beriringan dengan lancar di satu antarmuka."],
        ["🛡️ Hemat Resource RAM", "Dirancang khusus untuk mengelola banyak akun AI secara efisien tanpa membuat komputer lemot."]
      ]
    }
  }

  const current = content[lang]

  return (
    <div className="feature-page info-page">
      {/* Tombol Pemilih Bahasa */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "30px", justifyContent: "center" }}>
        <button 
          className={lang === "en" ? "primary" : "secondary"} 
          onClick={() => setLang("en")}
          style={{ width: "150px" }}
        >
          English
        </button>
        <button 
          className={lang === "id" ? "primary" : "secondary"} 
          onClick={() => setLang("id")}
          style={{ width: "150px" }}
        >
          Bahasa Indonesia
        </button>
      </div>

      <div className="info-steps">
        {current.steps.map((step, i) => (
          <section className="info-step" key={step[0]}>
            <div className="step-number">{String(i + 1).padStart(2, "0")}</div>
            <div>
              <h2>{step[0]}</h2>
              <p>{step[1]}</p>
            </div>
          </section>
        ))}
      </div>

      <section className="privacy-info info-card">
        <div className="privacy-heading">
          <div className="eyebrow">{current.whySubtitle.toUpperCase()}</div>
          <h2>{current.whyTitle}</h2>
          <span className="badge">{current.whyBadge}</span>
        </div>
        
        {current.reasons.map((reason) => (
          <div className="privacy-row" key={reason[0]}>
            <span>{reason[0].split(" ")[0]}</span>
            <div>
              <h3>{reason[0].substring(reason[0].indexOf(" ") + 1)}</h3>
              <p>{reason[1]}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
// ========================================================

function AddAccountCard({ onAdd }: { onAdd: () => void }) {
  return (
    <button className="add-card" onClick={onAdd}>
      <span>＋</span>
      <b>Add Account</b>
      <small>Add another Google Flow account</small>
    </button>
  )
}

function Card({
  a,
  customServices, // <--- TAMBAH INI
  menuOpen,
  onMenu,
  onOpen,
  onFavorite,
  onDelete,
  onRename,
  dragEnabled,
  isDragging,
  isDropTarget,
  onPointerDown,
}: {
  a: Account
  customServices: import("./services/service-store").CustomService[] // <--- TAMBAH INI JUGA
  menuOpen: boolean
  onMenu: () => void
  onOpen: () => void
  onFavorite: () => void
  onDelete: () => void
  onRename: () => void
  dragEnabled: boolean
  isDragging: boolean
  isDropTarget: boolean
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
}) {
  return (
    <article data-account-id={a.id} onPointerDown={onPointerDown} className={`card ${dragEnabled ? "is-draggable" : ""} ${isDragging ? "is-dragging" : ""} ${isDropTarget ? "is-drop-target" : ""}`}>
      <div className="card-top">
        <button
          className={`star ${a.favorite ? "fav" : ""}`}
          onClick={onFavorite}
        >
          {a.favorite ? "★" : "☆"}
        </button>
        <div className="menu-wrap">
          <button className="more" onClick={onMenu}>
            •••
          </button>
          {menuOpen && (
            <div className="account-menu">
              <button onClick={onRename}>Rename</button>
              <button onClick={onFavorite}>
                {a.favorite ? "Remove from Favorites" : "Add to Favorites"}
              </button>
              <div className="menu-rule" />
              <button className="menu-danger" onClick={onDelete}>
                Delete Account
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="avatar large">
        <img
          src={a.avatarUrl || "/google-flow.png"}
          alt="Google Flow account"
          draggable={false}
        />
      </div>
<h2>{a.name}</h2>
      <button className="primary wide" onClick={onOpen}>
        {(() => {
          if (a.url?.includes("dola")) return "Open Dola"
          if (a.url?.includes("migoo")) return "Open Migoo"
          
          // Cek apakah URL akun sama dengan URL web custom
          const custom = customServices.find(s => s.url === a.url)
          if (custom) return `Open ${custom.name}`
          
          return "Open Google Flow"
        })()} <span>→</span>
      </button>
      <div className="card-links">
        <button onClick={onRename}>✎ Rename</button>
        <button onClick={onDelete}>⌫ Remove</button>
      </div>
    </article>
  )
}
function DragPreview({ account, point, offset }: { account: Account | null; point: { x: number; y: number }; offset: { x: number; y: number } }) {
  if (!account) return null
  return (
    <div className="custom-drag-layer" aria-hidden="true">
      <article className="drag-preview-card" style={{ transform: `translate3d(${point.x - offset.x}px, ${point.y - offset.y}px, 0) scale(1.04) rotate(2deg)` }}>
        <div className="card-top"><span className={`star ${account.favorite ? "fav" : ""}`}>{account.favorite ? "★" : "☆"}</span><span className="more">•••</span></div>
        <div className="avatar large"><img src={account.avatarUrl || "/google-flow.png"} alt="" /></div>
        <h2>{account.name}</h2>
        <div className="primary wide">
          {account.url?.includes("dola") ? "Open Dola" : account.url?.includes("migoo") ? "Open Migoo" : "Open Google Flow"} <span>→</span>
        </div>
      </article>
    </div>
  )
}
function Settings({
  profile,
  onAvatarChange,
}: {
  profile: { name: string; avatar: string | null }
  onAvatarChange: (avatar: string) => void
}) {
  return (
    <div className="settings">
      <section>
        <label className="setting-icon profile-avatar-input">
          {profile.avatar ? (
            <img src={profile.avatar} alt="AkariuMulti profile" />
          ) : (
            "YK"
          )}
          <input
            id="profile-avatar-input"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = () =>
                typeof reader.result === "string" &&
                onAvatarChange(reader.result)
              reader.readAsDataURL(file)
            }}
          />
          <button
            type="button"
            className="profile-avatar-edit"
            aria-label="Change profile photo"
            title="Change profile photo"
            onClick={(e) => {
              e.preventDefault()
              document.getElementById("profile-avatar-input")?.click()
            }}
          >
            ✎
          </button>
        </label>
        <div>
          <div className="eyebrow">PROFILE</div>
          <h2>Your AkariuMulti profile</h2>
          <p>Local desktop profile used for your account manager.</p>
        </div>
      </section>
      <section>
        <div>
          <div className="eyebrow">PRIVACY & SECURITY</div>
          <h2>Your data stays local</h2>
          <p>
            AkariuMulti stores account metadata on this device. Google passwords
            and credentials are never captured.
          </p>
        </div>
        <span className="badge">LOCAL ONLY</span>
      </section>
      <section>
        <div>
          <div className="eyebrow">ABOUT</div>
          <h2>
            AkariuMulti <span className="muted">{APP_VERSION}</span>
          </h2>
          <p>Google Flow desktop workspace and multi-account manager.</p>
        </div>
      </section>
    </div>
  )
}
function FlowShell({
  account,
  accounts,
  fullView,
  navigatorOpen,
  onToggleFullView,
  onToggleNavigator,
  onSelectAccount,
  onBack,
}: {
  account: Account
  accounts: Account[]
  fullView: boolean
  navigatorOpen: boolean
  onToggleFullView: () => void
  onToggleNavigator: () => void
  onSelectAccount: (account: Account) => void
  onBack: () => void
}) {
  const [status, setStatus] = useState("Loading Google Flow...")
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let cancelled = false
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    invoke("open_google_flow", {
      accountId: account.id,
      url: account.url || "https://flow.google",
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    })
      .then(() => {
        if (!cancelled) setStatus("Google Flow ready")
        containerRef.current?.dispatchEvent(new Event("akariumulti-webview-ready"))
      })
      .catch((error) => {
        console.error("Google Flow WebView failed", error)
        if (!cancelled) setStatus("Unable to open Google Flow. Please try again.")
      })
    return () => {
      cancelled = true
      void invoke("close_google_flow", { accountId: account.id })
    }
  }, [account.id])
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const syncBounds = () => {
      const rect = container.getBoundingClientRect()
      void invoke("resize_google_flow", { accountId: account.id, x: rect.left, y: rect.top, width: rect.width, height: rect.height })
    }
    const onReady = () => syncBounds()
    container.addEventListener("akariumulti-webview-ready", onReady)
    const observer = new ResizeObserver(syncBounds)
    observer.observe(container)
    syncBounds()
    return () => {
      observer.disconnect()
      container.removeEventListener("akariumulti-webview-ready", onReady)
    }
  }, [navigatorOpen, fullView])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && fullView) onToggleFullView()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [fullView, onToggleFullView])
  return (
    <div className={`flow-shell ${navigatorOpen ? "navigator-open" : ""}`}>
      <div className="flow-bar">
        <button className="back" onClick={onBack}>‹ Accounts</button>
        <span>{status}</span>
        <div className="flow-controls">
          <div className="mini-navigator">
            <button className="navigator-trigger" onClick={onToggleNavigator} aria-expanded={navigatorOpen}>
              <img src={account.avatarUrl || "/google-flow.png"} alt="" />
              <span>{account.name}</span>
              <span aria-hidden="true">▾</span>
            </button>
            {navigatorOpen && (
              <div className="navigator-menu">
                {accounts.map((candidate) => (
                  <button
                    key={candidate.id}
                    className={candidate.id === account.id ? "selected" : ""}
                    onClick={() => onSelectAccount(candidate)}
                  >
                    <img src={candidate.avatarUrl || "/google-flow.png"} alt="" />
                    <span>{candidate.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="fullscreen" onClick={onToggleFullView}>
            {fullView ? "Exit Full View" : "Full View"}
          </button>
        </div>
      </div>
      <div ref={containerRef} className="webview-host" aria-label="Google Flow WebView" />
    </div>
  )
}
