import { forwardRef, useEffect, useMemo, useRef, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8001/api";
const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
const emptyProductForm = { code: "", name: "", category: "General", quantity: 0, min_quantity: 0, sale_price: 0, cost_price: 0 };
const emptySaleForm = { code: "", amount: 1, unit_price: "" };
const emptyCashOpenForm = { opening_amount: "", notes: "" };
const emptyCashCloseForm = { actual_cash_amount: "", notes: "" };
const emptyTreasuryFilter = { startDate: "", endDate: "" };
const emptyAccessSetup = { businessName: "", userName: "", password: "", confirmPassword: "" };
const emptyLoginForm = { userName: "", password: "" };
const availableThemes = { dark: { label: "Oscuro" }, sepia: { label: "Claro sepia" } };
const navItems = [
  { id: "home", label: "Inicio", short: "IN" },
  { id: "inventory", label: "Inventario", short: "IV" },
  { id: "treasury", label: "Tesorería", short: "TS" },
];
const scanLockMs = 1200;
const accessStorageKey = "appstock-local-access";
const sessionStorageKey = "appstock-session-open";
const activeSectionStorageKey = "appstock-active-section";

function App() {
  const [items, setItems] = useState([]);
  const [reports, setReports] = useState(createEmptyReports());
  const [cashSummary, setCashSummary] = useState(createEmptyCashSummary());
  const [categories, setCategories] = useState([]);
  const [movements, setMovements] = useState([]);
  const [activeSection, setActiveSection] = useState("home");
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [saleForm, setSaleForm] = useState(emptySaleForm);
  const [cashOpenForm, setCashOpenForm] = useState(emptyCashOpenForm);
  const [cashCloseForm, setCashCloseForm] = useState(emptyCashCloseForm);
  const [treasuryFilter, setTreasuryFilter] = useState(emptyTreasuryFilter);
  const [theme, setTheme] = useState("dark");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [scanAmount, setScanAmount] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [scanCandidate, setScanCandidate] = useState(null);
  const [message, setMessage] = useState("Sistema listo para operar stock, ventas y reportes.");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanState, setScanState] = useState("ready");
  const [searchTerm, setSearchTerm] = useState("");
  const [accessConfig, setAccessConfig] = useState(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [accessSetupForm, setAccessSetupForm] = useState(emptyAccessSetup);
  const [loginForm, setLoginForm] = useState(emptyLoginForm);
  const scanInputRef = useRef(null);
  const audioContextRef = useRef(null);
  const lastScanRef = useRef({ code: "", time: 0 });

  useEffect(() => {
    refreshAll();
    const savedTheme = window.localStorage.getItem("appstock-theme");
    if (savedTheme && availableThemes[savedTheme]) setTheme(savedTheme);
    const savedAccess = readLocalJson(accessStorageKey);
    if (savedAccess?.password && savedAccess?.userName) {
      setAccessConfig(savedAccess);
      setLoginForm((current) => ({ ...current, userName: savedAccess.userName }));
    }
    if (window.localStorage.getItem(sessionStorageKey) === "open") setSessionOpen(true);
    const savedSection = window.localStorage.getItem(activeSectionStorageKey);
    if (savedSection && navItems.some((item) => item.id === savedSection)) setActiveSection(savedSection);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    window.localStorage.setItem("appstock-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(activeSectionStorageKey, activeSection);
  }, [activeSection]);

  useEffect(() => {
    if (!sessionOpen) return undefined;
    function handleShortcut(event) {
      if (event.key !== "F2") return;
      event.preventDefault();
      setActiveSection("inventory");
      setMessage("Escáner listo para recibir un código.");
      window.setTimeout(() => focusScanner(), 30);
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [sessionOpen, activeSection]);

  useEffect(() => {
    if (!sessionOpen || activeSection !== "inventory") return undefined;
    focusScanner();
    function keepFocus(event) {
      const target = event.target;
      if (target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.tagName === "BUTTON" || target.isContentEditable)) return;
      window.setTimeout(() => focusScanner(), 0);
    }
    function onVisibilityChange() {
      if (!document.hidden) window.setTimeout(() => focusScanner(), 50);
    }
    document.addEventListener("pointerdown", keepFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("pointerdown", keepFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [activeSection, sessionOpen]);

  const lowStockItems = useMemo(() => items.filter((item) => item.quantity <= item.min_quantity), [items]);
  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => item.name.toLowerCase().includes(term) || item.code.toLowerCase().includes(term) || item.category.toLowerCase().includes(term));
  }, [items, searchTerm]);
  const inventoryValue = useMemo(() => items.reduce((total, item) => total + item.quantity * item.sale_price, 0), [items]);
  const costValue = useMemo(() => items.reduce((total, item) => total + item.quantity * item.cost_price, 0), [items]);
  const latestMovements = useMemo(() => movements.slice(0, 5), [movements]);
  const treasuryFilterActive = Boolean(treasuryFilter.startDate || treasuryFilter.endDate);
  const currentDateLabel = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
  const currentNavLabel = navItems.find((item) => item.id === activeSection)?.label ?? "Inicio";
  const branchName = accessConfig?.businessName || "Tu local";

  async function refreshAll(filters = treasuryFilter) {
    setLoading(true);
    setError("");
    try {
      const treasuryQuery = buildDateQuery(filters);
      const [itemsResponse, reportsResponse, movementsResponse, cashResponse, categoriesResponse] = await Promise.all([
        fetch(`${API_URL}/items`),
        fetch(`${API_URL}/reports/summary${treasuryQuery}`),
        fetch(`${API_URL}/movements?limit=12`),
        fetch(`${API_URL}/reports/cash-summary${treasuryQuery}`),
        fetch(`${API_URL}/categories`),
      ]);
      if (!itemsResponse.ok || !reportsResponse.ok || !movementsResponse.ok || !cashResponse.ok || !categoriesResponse.ok) throw new Error("No se pudieron cargar los datos principales.");
      const [itemsData, reportsData, movementsData, cashData, categoriesData] = await Promise.all([
        itemsResponse.json(), reportsResponse.json(), movementsResponse.json(), cashResponse.json(), categoriesResponse.json(),
      ]);
      setItems([...itemsData].sort((a, b) => a.name.localeCompare(b.name)));
      setReports(reportsData);
      setMovements(movementsData);
      setCashSummary(cashData);
      setCategories(categoriesData);
      if (cashData.current_session) {
        setCashCloseForm((current) => ({ ...current, actual_cash_amount: current.actual_cash_amount === "" ? String(cashData.expected_cash_now.toFixed(2)) : current.actual_cash_amount }));
      } else {
        setCashCloseForm(emptyCashCloseForm);
      }
      if (!categoriesData.some((category) => category.name === productForm.category) && categoriesData.length > 0 && !editingId && !scanCandidate) {
        setProductForm((current) => ({ ...current, category: categoriesData[0].name }));
      }
    } catch (err) {
      setError(err.message);
      setScanState("error");
    } finally {
      setLoading(false);
    }
  }

  function handleAccessSetup(event) {
    event.preventDefault();
    const payload = { businessName: accessSetupForm.businessName.trim(), userName: accessSetupForm.userName.trim(), password: accessSetupForm.password };
    if (!payload.businessName || !payload.userName || payload.password.length < 4) {
      setError("Completá el nombre del local, el usuario y una clave de al menos 4 caracteres.");
      return;
    }
    if (accessSetupForm.password !== accessSetupForm.confirmPassword) {
      setError("La confirmación de la clave no coincide.");
      return;
    }
    window.localStorage.setItem(accessStorageKey, JSON.stringify(payload));
    window.localStorage.setItem(sessionStorageKey, "open");
    setAccessConfig(payload);
    setLoginForm({ userName: payload.userName, password: "" });
    setAccessSetupForm(emptyAccessSetup);
    setSessionOpen(true);
    setError("");
    setMessage(`Bienvenido a ${payload.businessName}. El acceso local quedó configurado.`);
  }

  function handleLogin(event) {
    event.preventDefault();
    if (!accessConfig) return;
    if (loginForm.userName.trim() !== accessConfig.userName || loginForm.password !== accessConfig.password) {
      setError("Usuario o clave incorrectos.");
      return;
    }
    window.localStorage.setItem(sessionStorageKey, "open");
    setSessionOpen(true);
    setError("");
    setMessage(`Bienvenido de nuevo, ${accessConfig.userName}.`);
  }

  function handleLogout() {
    window.localStorage.removeItem(sessionStorageKey);
    setSessionOpen(false);
    setLoginForm((current) => ({ ...current, password: "" }));
    setError("");
    setMessage("Sesión local cerrada correctamente.");
  }
  async function submitProduct(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const method = editingId ? "PUT" : "POST";
      const url = editingId ? `${API_URL}/items/${editingId}` : `${API_URL}/items`;
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(normalizeProductForm(productForm)) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "No se pudo guardar el producto.");
      setMessage(editingId ? "Producto actualizado correctamente." : "Producto creado correctamente.");
      setScanState("success");
      playTone("success");
      resetProductEditor();
      await refreshAll();
      focusScanner();
    } catch (err) {
      setError(err.message);
      setScanState("error");
      playTone("error");
    } finally {
      setSaving(false);
    }
  }

  async function submitCategory(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/categories`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newCategoryName }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "No se pudo guardar la categoría.");
      setCategories((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name)));
      setProductForm((current) => ({ ...current, category: data.name }));
      setNewCategoryName("");
      setMessage(`Categoría creada: ${data.name}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitSale(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { code: saleForm.code, amount: Number(saleForm.amount), unit_price: saleForm.unit_price === "" ? null : Number(saleForm.unit_price) };
      const response = await fetch(`${API_URL}/sales`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "No se pudo registrar la venta.");
      setSaleForm(emptySaleForm);
      setMessage(`Venta registrada para ${data.item_name}.`);
      setScanState("success");
      playTone("success");
      await refreshAll();
      focusScanner();
    } catch (err) {
      setError(err.message);
      setScanState("error");
      playTone("error");
    } finally {
      setSaving(false);
    }
  }

  async function submitCashOpen(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/cash-session/open`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opening_amount: Number(cashOpenForm.opening_amount), notes: cashOpenForm.notes }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "No se pudo abrir la caja.");
      setCashOpenForm(emptyCashOpenForm);
      setCashCloseForm({ actual_cash_amount: String(data.expected_cash_amount.toFixed(2)), notes: "" });
      setMessage("Caja diaria abierta correctamente.");
      await refreshAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitCashClose(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/cash-session/close`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actual_cash_amount: Number(cashCloseForm.actual_cash_amount), notes: cashCloseForm.notes }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "No se pudo cerrar la caja.");
      setCashCloseForm(emptyCashCloseForm);
      setMessage(`Caja cerrada. Diferencia: ${formatMoney(data.difference_amount || 0)}.`);
      await refreshAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function processScan() {
    const normalizedCode = scanCode.trim();
    if (!normalizedCode) {
      setError("Escaneá o escribí un código antes de registrar.");
      setScanState("error");
      playTone("error");
      focusScanner();
      return;
    }
    const now = Date.now();
    if (lastScanRef.current.code === normalizedCode && now - lastScanRef.current.time < scanLockMs) {
      setMessage("Lectura duplicada bloqueada para evitar un doble ingreso accidental.");
      setScanState("blocked");
      playTone("blocked");
      focusScanner();
      return;
    }
    lastScanRef.current = { code: normalizedCode, time: now };
    setSaving(true);
    setError("");
    setScanCandidate(null);
    setScanState("processing");
    try {
      const response = await fetch(`${API_URL}/items/${normalizedCode}/scan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: Number(scanAmount) }) });
      if (response.status === 404) {
        const fallbackCategory = categories[0]?.name ?? "General";
        const nextProduct = { ...emptyProductForm, code: normalizedCode, quantity: Number(scanAmount), category: fallbackCategory };
        setScanCandidate(nextProduct);
        setProductForm(nextProduct);
        setEditingId(null);
        setActiveSection("inventory");
        setMessage("Código no encontrado. Completá el alta rápida para crear el producto.");
        setScanState("warning");
        playTone("warning");
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "No se pudo registrar el ingreso.");
      setScanCode("");
      setScanAmount(1);
      setMessage(`Ingreso registrado para ${data.name}. Stock actual: ${data.quantity}.`);
      setScanState("success");
      playTone("success");
      await refreshAll();
    } catch (err) {
      setError(err.message);
      setScanState("error");
      playTone("error");
    } finally {
      setSaving(false);
      focusScanner();
    }
  }

  async function submitScan(event) {
    event.preventDefault();
    await processScan();
  }

  async function handleDelete(item) {
    if (!window.confirm(`¿Eliminar ${item.name}? Esta acción no se puede deshacer.`)) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/items/${item.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "No se pudo eliminar el producto.");
      }
      if (editingId === item.id) resetProductEditor();
      setMessage(`Producto eliminado: ${item.name}.`);
      await refreshAll();
      focusScanner();
    } catch (err) {
      setError(err.message);
      setScanState("error");
      playTone("error");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(item) {
    setEditingId(item.id);
    setScanCandidate(null);
    setProductForm({ code: item.code, name: item.name, category: item.category, quantity: item.quantity, min_quantity: item.min_quantity, sale_price: item.sale_price, cost_price: item.cost_price });
    setActiveSection("inventory");
    setMessage(`Editando ${item.name}.`);
  }

  function resetProductEditor() {
    setEditingId(null);
    setScanCandidate(null);
    setProductForm({ ...emptyProductForm, category: categories[0]?.name ?? "General" });
  }

  async function exportTreasuryCsv() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/reports/export.csv${buildDateQuery(treasuryFilter)}`);
      if (!response.ok) throw new Error("No se pudo exportar el CSV.");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tesoreria-${treasuryFilter.startDate || "inicio"}-${treasuryFilter.endDate || "hoy"}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setMessage("Reporte CSV descargado correctamente.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }
  function printTreasurySummary() {
    const printWindow = window.open("", "_blank", "width=980,height=720");
    if (!printWindow) {
      setError("No se pudo abrir la vista de impresión.");
      return;
    }
    const periodLabel = treasuryFilter.startDate || treasuryFilter.endDate ? `${treasuryFilter.startDate || "inicio"} a ${treasuryFilter.endDate || "hoy"}` : "Jornada actual";
    const topProducts = reports.top_products.map((row) => `<li>${escapeHtml(row.name)}: ${row.quantity} unidades - ${formatMoney(row.revenue)}</li>`).join("");
    const sessions = cashSummary.recent_sessions.map((session) => `<tr><td>${session.id}</td><td>${escapeHtml(session.status)}</td><td>${escapeHtml(formatDateTime(session.opened_at))}</td><td>${escapeHtml(session.closed_at ? formatDateTime(session.closed_at) : "Abierta")}</td><td>${formatMoney(session.expected_cash_amount)}</td><td>${session.actual_cash_amount == null ? "-" : formatMoney(session.actual_cash_amount)}</td><td>${session.difference_amount == null ? "-" : formatMoney(session.difference_amount)}</td></tr>`).join("");
    printWindow.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8" /><title>Cierre de tesorería</title><style>body{font-family:Segoe UI,Arial,sans-serif;margin:32px;color:#1f2937}h1,h2{margin:0 0 12px}section{margin-top:24px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.card{border:1px solid #d6d3d1;border-radius:16px;padding:16px;background:#faf7f2}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #d6d3d1;padding:8px;text-align:left;font-size:12px}ul{padding-left:18px}small{color:#6b7280}</style></head><body><h1>Cierre de tesorería</h1><small>Período: ${escapeHtml(periodLabel)}</small><section class="grid"><div class="card"><strong>Recaudación</strong><div>${formatMoney(cashSummary.today_revenue)}</div></div><div class="card"><strong>Ganancia</strong><div>${formatMoney(cashSummary.today_profit)}</div></div><div class="card"><strong>Ventas</strong><div>${cashSummary.today_sales_count}</div></div><div class="card"><strong>Caja esperada</strong><div>${formatMoney(cashSummary.expected_cash_now)}</div></div></section><section><h2>Productos más vendidos</h2><ul>${topProducts || "<li>Sin datos suficientes.</li>"}</ul></section><section><h2>Jornadas</h2><table><thead><tr><th>ID</th><th>Estado</th><th>Apertura</th><th>Cierre</th><th>Esperado</th><th>Real</th><th>Diferencia</th></tr></thead><tbody>${sessions || "<tr><td colspan=\"7\">Sin jornadas registradas.</td></tr>"}</tbody></table></section></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  async function applyTreasuryFilter(event) {
    event.preventDefault();
    await refreshAll(treasuryFilter);
  }

  async function clearTreasuryFilter() {
    const nextFilter = { ...emptyTreasuryFilter };
    setTreasuryFilter(nextFilter);
    await refreshAll(nextFilter);
  }

  function focusScanner() {
    if (activeSection !== "inventory") return;
    if (scanInputRef.current && document.activeElement !== scanInputRef.current) {
      scanInputRef.current.focus();
      scanInputRef.current.select?.();
    }
  }

  function playTone(kind) {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioContextRef.current) audioContextRef.current = new AudioContextClass();
    const audioContext = audioContextRef.current;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const settings = {
      success: { frequency: 880, duration: 0.08, volume: 0.03 },
      warning: { frequency: 620, duration: 0.12, volume: 0.03 },
      error: { frequency: 240, duration: 0.16, volume: 0.04 },
      blocked: { frequency: 420, duration: 0.05, volume: 0.03 },
    }[kind] ?? { frequency: 720, duration: 0.08, volume: 0.03 };
    oscillator.type = "sine";
    oscillator.frequency.value = settings.frequency;
    gainNode.gain.value = settings.volume;
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    const startAt = audioContext.currentTime;
    oscillator.start(startAt);
    oscillator.stop(startAt + settings.duration);
  }

  if (!accessConfig) {
    return (
      <main className="auth-shell min-h-screen px-4 py-8 sm:px-6 lg:px-10">
        <div className="auth-grid mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.08fr_0.92fr]">
          <section className="auth-showcase rounded-[34px] p-8 shadow-panel lg:p-12">
            <span className="eyebrow">Sistema local profesional</span>
            <h1 className="auth-title mt-4 text-4xl font-semibold leading-tight sm:text-6xl">Tu operación diaria, en español y lista para generar valor real.</h1>
            <p className="auth-text mt-4 max-w-2xl text-base sm:text-lg">Configurá el acceso local una sola vez y empezá a trabajar con inventario, caja, reportes y control por escáner desde una interfaz clara, ordenada y profesional.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <FeatureCard title="Inicio claro" description="Un Home de bienvenida con métricas y estado del local." />
              <FeatureCard title="Inventario sólido" description="Altas, edición, escáner y alertas de stock bajo." />
              <FeatureCard title="Tesorería útil" description="Caja diaria, ventas, reportes y exportación rápida." />
            </div>
          </section>
          <section className="auth-card rounded-[34px] p-8 shadow-panel lg:p-10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="eyebrow">Primer acceso</span>
                <h2 className="auth-title mt-3 text-3xl font-semibold">Crear acceso local</h2>
                <p className="auth-text mt-2 text-sm">Este ingreso solo protege la apertura del sistema en esta PC del local.</p>
              </div>
              <ThemeToggle theme={theme} onChange={setTheme} compact />
            </div>
            <form className="mt-8 space-y-4" onSubmit={handleAccessSetup}>
              <InputField label="Nombre del local" name="businessName" value={accessSetupForm.businessName} onChange={handleText(setAccessSetupForm)} placeholder="Ejemplo: Almacén San Martín" />
              <InputField label="Usuario local" name="userName" value={accessSetupForm.userName} onChange={handleText(setAccessSetupForm)} placeholder="Administrador" />
              <InputField label="Clave local" name="password" type="password" value={accessSetupForm.password} onChange={handleText(setAccessSetupForm)} placeholder="Mínimo 4 caracteres" />
              <InputField label="Confirmar clave" name="confirmPassword" type="password" value={accessSetupForm.confirmPassword} onChange={handleText(setAccessSetupForm)} placeholder="Repetí la clave" />
              <button type="submit" className="primary-button w-full rounded-2xl px-4 py-3 text-sm font-semibold">Ingresar al sistema</button>
            </form>
            <StatusPanel message={message} error={error} />
          </section>
        </div>
      </main>
    );
  }

  if (!sessionOpen) {
    return (
      <main className="auth-shell min-h-screen px-4 py-8 sm:px-6 lg:px-10">
        <div className="auth-grid mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_0.92fr]">
          <section className="auth-showcase rounded-[34px] p-8 shadow-panel lg:p-12">
            <span className="eyebrow">Bienvenido a {branchName}</span>
            <h1 className="auth-title mt-4 text-4xl font-semibold leading-tight sm:text-6xl">Control total del negocio desde una sola cabina.</h1>
            <p className="auth-text mt-4 max-w-2xl text-base sm:text-lg">Ingresá con tu acceso local para continuar con las ventas, el inventario, la caja diaria y los reportes inteligentes del comercio.</p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <MiniStat label="Productos activos" value={items.length} />
              <MiniStat label="Categorías cargadas" value={categories.length} />
              <MiniStat label="Movimientos recientes" value={movements.length} />
              <MiniStat label="Caja esperada" value={formatMoney(cashSummary.expected_cash_now)} />
            </div>
          </section>
          <section className="auth-card rounded-[34px] p-8 shadow-panel lg:p-10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="eyebrow">Acceso local</span>
                <h2 className="auth-title mt-3 text-3xl font-semibold">Ingresar al sistema</h2>
                <p className="auth-text mt-2 text-sm">Protección local para esta PC. No requiere Internet ni cuentas externas.</p>
              </div>
              <ThemeToggle theme={theme} onChange={setTheme} compact />
            </div>
            <form className="mt-8 space-y-4" onSubmit={handleLogin}>
              <InputField label="Usuario" name="userName" value={loginForm.userName} onChange={handleText(setLoginForm)} />
              <InputField label="Clave" name="password" type="password" value={loginForm.password} onChange={handleText(setLoginForm)} placeholder="Ingresá tu clave local" />
              <button type="submit" className="primary-button w-full rounded-2xl px-4 py-3 text-sm font-semibold">Entrar</button>
            </form>
            <StatusPanel message={message} error={error} />
          </section>
        </div>
      </main>
    );
  }
  return (
    <main className="app-shell min-h-screen">
      <div className="dashboard-layout grid min-h-screen lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="sidebar-shell border-r px-5 py-6 lg:px-6">
          <div>
            <div className="brand-title text-3xl font-semibold">AppStock Local</div>
            <div className="brand-subtitle mt-1 text-xs uppercase tracking-[0.24em]">Panel de control comercial</div>
          </div>
          <div className="branch-card mt-8 rounded-[28px] p-5">
            <div className="flex items-center gap-4">
              <div className="avatar-badge flex h-14 w-14 items-center justify-center rounded-2xl text-sm font-semibold">{buildInitials(branchName)}</div>
              <div>
                <div className="content-strong text-xl font-semibold">{branchName}</div>
                <div className="content-muted text-sm">Estado operativo local</div>
              </div>
            </div>
          </div>
          <nav className="mt-8 space-y-2">
            {navItems.map((item) => <SidebarLink key={item.id} item={item} active={activeSection === item.id} onClick={() => setActiveSection(item.id)} />)}
          </nav>
          <div className="soft-card mt-8 rounded-[28px] p-5">
            <div className="panel-description text-xs uppercase tracking-[0.24em]">Resumen rápido</div>
            <div className="mt-4 space-y-4">
              <MiniLine label="Ventas del período" value={formatMoney(cashSummary.today_revenue)} />
              <MiniLine label="Caja esperada" value={formatMoney(cashSummary.expected_cash_now)} />
              <MiniLine label="Stock bajo" value={lowStockItems.length} />
            </div>
          </div>
          <div className="mt-auto pt-8">
            <button type="button" onClick={handleLogout} className="section-button section-button-idle w-full rounded-2xl px-4 py-3 text-sm font-semibold transition">Cerrar sesión local</button>
          </div>
        </aside>

        <div className="main-shell px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          <header className="topbar-shell flex flex-col gap-4 rounded-[30px] px-5 py-5 shadow-panel sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="panel-description text-xs uppercase tracking-[0.26em]">{sectionEyebrow(activeSection)}</div>
              <h1 className="panel-title mt-2 text-3xl font-semibold sm:text-4xl">{sectionTitle(activeSection, branchName)}</h1>
              <p className="panel-description mt-2 text-sm sm:text-base">{sectionDescription(activeSection)}</p>
            </div>
            <div className="flex flex-col gap-3 sm:items-end">
              <div className="flex flex-wrap items-center gap-3">
                <ThemeToggle theme={theme} onChange={setTheme} />
                <div className="date-pill rounded-2xl px-4 py-3 text-right">
                  <div className="panel-description text-[11px] uppercase tracking-[0.24em]">Fecha actual</div>
                  <div className="panel-title mt-1 text-sm font-semibold capitalize">{currentDateLabel}</div>
                </div>
              </div>
              <div className="welcome-line text-sm">Sesión local activa para <strong>{accessConfig.userName}</strong> en <strong>{currentNavLabel}</strong>.</div>
            </div>
          </header>

          <StatusPanel message={message} error={error} />

          <section className="mt-6">
            {activeSection === "home" ? renderHomeSection({ reports, cashSummary, inventoryValue, costValue, lowStockItems, latestMovements, branchName, loading, setActiveSection, totalCategories: categories.length, totalItems: items.length }) : null}
            {activeSection === "inventory" ? renderInventorySection({ loading, searchTerm, setSearchTerm, refreshAll, scanState, scanInputRef, scanCode, setScanCode, processScan, scanAmount, setScanAmount, saving, submitScan, scanCandidate, productForm, handleText, setProductForm, categories, resetProductEditor, editingId, submitProduct, newCategoryName, setNewCategoryName, submitCategory, filteredItems, startEditing, handleDelete, movements, inventoryValue, lowStockItems, setActiveSection }) : null}
            {activeSection === "treasury" ? renderTreasurySection({ cashSummary, submitCashClose, cashCloseForm, setCashCloseForm, submitCashOpen, cashOpenForm, setCashOpenForm, saleForm, setSaleForm, submitSale, treasuryFilter, setTreasuryFilter, applyTreasuryFilter, clearTreasuryFilter, exportTreasuryCsv, printTreasurySummary, saving, treasuryFilterActive, reports }) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function renderHomeSection({ reports, cashSummary, inventoryValue, costValue, lowStockItems, latestMovements, branchName, loading, setActiveSection, totalCategories, totalItems }) {
  const topProduct = reports.top_products[0];
  const needsOnboarding = totalCategories === 0 || totalItems === 0;
  return (
    <div className="space-y-6">
      {needsOnboarding ? <Panel title="Primeros pasos" description="Dejá el sistema listo para operar desde esta misma pantalla."><div className="onboarding-grid grid gap-4 lg:grid-cols-3"><QuickAction title="Cargar categorías" description={totalCategories === 0 ? "Creá la primera categoría para ordenar el catálogo." : totalCategories + " categorías disponibles para reutilizar."} onClick={() => setActiveSection("inventory")} emphasis={totalCategories === 0} /><QuickAction title="Cargar productos" description={totalItems === 0 ? "Empezá con el primer producto del local." : totalItems + " productos listos para vender o reponer."} onClick={() => setActiveSection("inventory")} emphasis={totalItems === 0} /><QuickAction title="Abrir caja diaria" description={cashSummary.current_session ? "La caja ya está abierta y operativa." : "Activá el turno para registrar ventas y cierres."} onClick={() => setActiveSection("treasury")} emphasis={!cashSummary.current_session} /></div></Panel> : null}
      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Panel title={`Bienvenido a ${branchName}`} description="Tu punto de entrada para revisar el estado general del negocio, la caja y el inventario del local.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Recaudación" value={formatMoney(reports.total_revenue)} />
            <MetricCard label="Ganancia" value={formatMoney(reports.total_profit)} />
            <MetricCard label="Valor de inventario" value={formatMoney(inventoryValue)} />
            <MetricCard label="Caja esperada" value={formatMoney(cashSummary.expected_cash_now)} />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <QuickAction title="Ir a Inventario" description="Altas, edición, escáner y stock." onClick={() => setActiveSection("inventory")} />
            <QuickAction title="Abrir Tesorería" description="Caja diaria, ventas y reportes." onClick={() => setActiveSection("treasury")} />
            <QuickAction title="Ver alertas" description={`${lowStockItems.length} productos en reposición.`} onClick={() => setActiveSection("inventory")} emphasis={lowStockItems.length > 0} />
          </div>
        </Panel>
        <Panel title="Estado operativo" description="Resumen inmediato del local y del turno actual.">
          <div className="space-y-4">
            <StatusRow label="Caja" value={cashSummary.current_session ? "Abierta" : "Cerrada"} strong={Boolean(cashSummary.current_session)} />
            <StatusRow label="Ventas del día" value={cashSummary.today_sales_count} />
            <StatusRow label="Unidades vendidas" value={cashSummary.today_units_sold} />
            <StatusRow label="Costo inmovilizado" value={formatMoney(costValue)} />
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Actividad reciente" description="Últimos movimientos relevantes del sistema local.">
          {loading ? <EmptyState>Cargando actividad…</EmptyState> : latestMovements.length === 0 ? <EmptyState>Todavía no hay actividad registrada.</EmptyState> : <div className="space-y-3">{latestMovements.map((movement) => <MovementCard key={movement.id} movement={movement} />)}</div>}
        </Panel>
        <Panel title="Inteligencia comercial" description="Lectura rápida para decidir qué mirar primero.">
          <div className="space-y-4">
            <InsightCard title="Producto líder" value={topProduct ? topProduct.name : "Sin ventas todavía"} helper={topProduct ? `${topProduct.quantity} unidades vendidas` : "Registrá ventas para ver tendencias."} />
            <InsightCard title="Productos con stock bajo" value={lowStockItems.length} helper={lowStockItems.length > 0 ? "Conviene revisar compras o reposición." : "Sin alertas críticas por ahora."} />
            <InsightCard title="Margen estimado" value={formatMoney(reports.total_profit)} helper="Calculado sobre ventas registradas y costo cargado." />
          </div>
        </Panel>
      </section>
    </div>
  );
}
function renderInventorySection(props) {
  const { loading, searchTerm, setSearchTerm, refreshAll, scanState, scanInputRef, scanCode, setScanCode, processScan, scanAmount, setScanAmount, saving, submitScan, scanCandidate, productForm, handleText, setProductForm, categories, resetProductEditor, editingId, submitProduct, newCategoryName, setNewCategoryName, submitCategory, filteredItems, startEditing, handleDelete, movements, inventoryValue, lowStockItems, setActiveSection } = props;
  const needsSetup = categories.length === 0 || filteredItems.length === 0;
  const stockCoverage = filteredItems.length === 0 ? 0 : Math.max(0, Math.round(((filteredItems.length - lowStockItems.length) / filteredItems.length) * 100));
  return (
    <div className="space-y-6">
      {needsSetup ? <Panel title="Inventario listo para despegar" description="Una ayuda breve para dejar operativo el catálogo en pocos minutos."><div className="onboarding-grid grid gap-4 lg:grid-cols-3"><QuickAction title="Crear categorías" description={categories.length === 0 ? "Definí rubros como almacén, bebidas o limpieza." : "Sumá nuevas categorías cuando el negocio crezca."} onClick={() => document.getElementById("new-category-input")?.focus()} emphasis={categories.length === 0} /><QuickAction title="Agregar producto manualmente" description="Usá el formulario para cargar nombre, código, costo y precio." onClick={() => document.getElementById("product-code-input")?.focus()} emphasis={filteredItems.length === 0} /><QuickAction title="Ir a tesorería" description="Cuando ya tengas productos, abrí caja y empezá a registrar ventas." onClick={() => setActiveSection("treasury")} /></div></Panel> : null}
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Buscador y escáner" description="Buscá productos, registrá ingresos y mantené el foco listo para el lector de códigos.">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <label className="block"><span className="field-label mb-2 block text-sm font-medium">Buscar por nombre, código o categoría</span><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar producto…" className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition" /></label><ShortcutHint>Presioná <strong>F2</strong> para saltar al lector desde cualquier sección.</ShortcutHint>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]"><button type="button" onClick={refreshAll} className="section-button section-button-idle rounded-2xl px-4 py-3 text-sm font-semibold transition">Actualizar datos</button><SummaryBadge label="Valor inventario" value={formatMoney(inventoryValue)} /></div>
            </div>
            <div className="card-surface rounded-[28px] p-5">
              <div className="flex items-center justify-between gap-3"><h3 className="panel-title text-lg font-semibold">Ingreso por escáner</h3><ScannerStatus state={scanState} /></div>
              <form className="mt-4 space-y-4" onSubmit={submitScan}>
                <InputField ref={scanInputRef} label="Código escaneado" id="product-code-input" name="scanCode" value={scanCode} onChange={(event) => setScanCode(event.target.value)} onKeyDown={async (event) => { if (event.key === "Enter") { event.preventDefault(); await processScan(); } }} placeholder="Escaneá o escribí el código" autoComplete="off" />
                <InputField label="Cantidad a ingresar" name="scanAmount" type="number" min="1" value={scanAmount} onChange={(event) => setScanAmount(event.target.value)} />
                <button type="submit" disabled={saving} className="primary-button w-full rounded-2xl px-4 py-3 text-sm font-semibold">Registrar ingreso</button>
              </form>
              {scanCandidate ? <div className="warning-box mt-4 rounded-2xl px-4 py-3 text-sm">Código nuevo detectado. Completá el alta rápida para guardarlo.</div> : null}
            </div>
          </div>
        </Panel>
        <Panel title={editingId ? "Editar producto" : "Nuevo producto"} description="Alta manual, edición y carga de categorías sin salir del panel principal." action={(editingId || scanCandidate) ? <button type="button" onClick={resetProductEditor} className="section-button section-button-idle rounded-full px-4 py-2 text-sm font-medium transition">Limpiar</button> : null}>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={submitProduct}>
            <InputField label="Código de barras" name="code" value={productForm.code} onChange={handleText(setProductForm)} />
            <InputField label="Nombre del producto" name="name" value={productForm.name} onChange={handleText(setProductForm)} />
            <CategorySelect label="Categoría" value={productForm.category} categories={categories} onChange={(value) => setProductForm((current) => ({ ...current, category: value }))} />
            <InputField label="Stock actual" name="quantity" type="number" min="0" value={productForm.quantity} onChange={handleText(setProductForm)} />
            <InputField label="Stock mínimo" name="min_quantity" type="number" min="0" value={productForm.min_quantity} onChange={handleText(setProductForm)} />
            <InputField label="Precio de venta" name="sale_price" type="number" min="0" step="0.01" value={productForm.sale_price} onChange={handleText(setProductForm)} />
            <InputField label="Costo" name="cost_price" type="number" min="0" step="0.01" value={productForm.cost_price} onChange={handleText(setProductForm)} />
            <button type="submit" disabled={saving} className="primary-button md:col-span-2 rounded-2xl px-4 py-3 text-sm font-semibold">{editingId ? "Actualizar producto" : "Guardar producto"}</button>
          </form>
          <form className="soft-card mt-4 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row" onSubmit={submitCategory}>
            <input id="new-category-input" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder={categories.length === 0 ? "Creá la primera categoría del local" : "Agregar nueva categoría"} className="field-input flex-1 rounded-2xl px-4 py-3 text-sm outline-none transition" />
            <button type="submit" disabled={saving || newCategoryName.trim().length < 2} className="section-button section-button-active rounded-2xl px-4 py-3 text-sm font-semibold transition">Guardar categoría</button>
          </form>
        </Panel>
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Cat\u00e1logo de productos" description="Visualiz\u00e1 inventario, edit\u00e1 datos, busc\u00e1 r\u00e1pido y elimin\u00e1 productos obsoletos." action={<div className="flex flex-wrap gap-2"><SummaryBadge label="Productos visibles" value={filteredItems.length} /><SummaryBadge label="Cobertura sana" value={`${stockCoverage}%`} /></div>}>{loading ? <EmptyState>Cargando inventario\u2026</EmptyState> : <InventoryTable items={filteredItems} onEdit={startEditing} onDelete={handleDelete} />}</Panel>
        <div className="space-y-6">
          <Panel title="Estado de stock" description="Una vista r\u00e1pida para priorizar la reposici\u00f3n."><div className="grid gap-4 sm:grid-cols-2"><MetricCard label="Categor\u00edas" value={categories.length} /><MetricCard label="Stock bajo" value={lowStockItems.length} emphasis={lowStockItems.length > 0} /></div><div className="inventory-health mt-5 rounded-[24px] p-4"><div className="flex items-center justify-between gap-3"><div><div className="panel-description text-xs uppercase tracking-[0.22em]">Salud del inventario</div><div className="content-strong mt-1 text-lg font-semibold">{stockCoverage}% de productos por encima del m\u00ednimo</div></div><div className="health-pill rounded-full px-3 py-2 text-xs font-semibold">{lowStockItems.length === 0 ? "Sin alertas" : `${lowStockItems.length} con alerta`}</div></div><div className="progress-track mt-4 h-3 overflow-hidden rounded-full"><div className="progress-bar h-full rounded-full" style={{ width: `${stockCoverage}%` }} /></div></div></Panel>
          <Panel title="Últimos movimientos" description="Entradas, ventas y ajustes más recientes del inventario.">{movements.length === 0 ? <EmptyState>Todavía no hay movimientos registrados.</EmptyState> : <div className="space-y-3">{movements.map((movement) => <MovementCard key={movement.id} movement={movement} />)}</div>}</Panel>
        </div>
      </section>
    </div>
  );
}

function renderTreasurySection(props) {
  const { cashSummary, submitCashClose, cashCloseForm, setCashCloseForm, submitCashOpen, cashOpenForm, setCashOpenForm, saleForm, setSaleForm, submitSale, treasuryFilter, setTreasuryFilter, applyTreasuryFilter, clearTreasuryFilter, exportTreasuryCsv, printTreasurySummary, saving, treasuryFilterActive, reports } = props;
  const dailySales = createDailySalesSeries(reports.recent_sales);
  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel title="Control de caja" description="Abrí o cerrá el turno, registrá ventas y seguí el balance del día en tiempo real.">
          <div className="grid gap-4 lg:grid-cols-2">
            <ActionCard title="Abrir caja" description="Iniciá el turno con el saldo base verificado."><form className="space-y-3" onSubmit={submitCashOpen}><InputField label="Monto inicial" name="opening_amount" type="number" min="0" step="0.01" value={cashOpenForm.opening_amount} onChange={handleText(setCashOpenForm)} /><InputField label="Observaciones de apertura" name="notes" value={cashOpenForm.notes} onChange={handleText(setCashOpenForm)} /><button type="submit" disabled={saving || Boolean(cashSummary.current_session)} className="primary-button w-full rounded-2xl px-4 py-3 text-sm font-semibold">Abrir caja</button></form></ActionCard>
            <ActionCard title="Cerrar caja" description="Finalizá el turno y registrá el monto real del cierre." subtle><form className="space-y-3" onSubmit={submitCashClose}><InputField label="Monto real al cierre" name="actual_cash_amount" type="number" min="0" step="0.01" value={cashCloseForm.actual_cash_amount} onChange={handleText(setCashCloseForm)} /><InputField label="Observaciones de cierre" name="notes" value={cashCloseForm.notes} onChange={handleText(setCashCloseForm)} /><button type="submit" disabled={saving || !cashSummary.current_session} className="secondary-button w-full rounded-2xl px-4 py-3 text-sm font-semibold">Cerrar caja</button></form></ActionCard>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Caja esperada" value={formatMoney(cashSummary.expected_cash_now)} /><MetricCard label="Recaudación" value={formatMoney(cashSummary.today_revenue)} /><MetricCard label="Ganancia" value={formatMoney(cashSummary.today_profit)} /><MetricCard label="Ventas del período" value={cashSummary.today_sales_count} /></div>
        </Panel>
        <Panel title="Registrar venta" description="Impacta stock, recaudación y margen estimado automáticamente."><form className="space-y-4" onSubmit={submitSale}><InputField label="Código de barras" name="code" value={saleForm.code} onChange={handleText(setSaleForm)} /><InputField label="Cantidad" name="amount" type="number" min="1" value={saleForm.amount} onChange={handleText(setSaleForm)} /><InputField label="Precio unitario opcional" name="unit_price" type="number" min="0" step="0.01" value={saleForm.unit_price} onChange={handleText(setSaleForm)} /><button type="submit" disabled={saving} className="primary-button w-full rounded-2xl px-4 py-3 text-sm font-semibold">Registrar venta</button></form></Panel>
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]"><Panel title="Pulso diario de ventas" description="Una lectura r\u00e1pida para ver c\u00f3mo se mueve la recaudaci\u00f3n por d\u00eda dentro del per\u00edodo actual.">{dailySales.length === 0 ? <EmptyState>Todav\u00eda no hay suficientes ventas para dibujar el gr\u00e1fico diario.</EmptyState> : <DailySalesChart rows={dailySales} />}</Panel><Panel title="Resumen ejecutivo" description="Indicadores r\u00e1pidos para tomar decisiones sin salir de tesorer\u00eda."><div className="treasury-summary-grid grid gap-4 sm:grid-cols-2"><InsightCard title="Ticket promedio" value={cashSummary.today_sales_count > 0 ? formatMoney(cashSummary.today_revenue / cashSummary.today_sales_count) : formatMoney(0)} helper="Promedio de venta registrado en el per\u00edodo visible." /><InsightCard title="Margen estimado" value={cashSummary.today_revenue > 0 ? `${Math.round((cashSummary.today_profit / cashSummary.today_revenue) * 100)}%` : "0%"} helper="Basado en recaudaci\u00f3n y costo declarado." /><InsightCard title="Caja actual" value={cashSummary.current_session ? "Abierta" : "Cerrada"} helper={cashSummary.current_session ? "Hay un turno operativo en curso." : "No hay turno activo en este momento."} /><InsightCard title="Ventas registradas" value={cashSummary.today_sales_count} helper={`${cashSummary.today_units_sold} unidades vendidas en el per\u00edodo.`} /></div></Panel></section>
      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <Panel title="Período de análisis" description="Filtrá tesorería por rango de fechas para revisar cierres y ventas." action={<div className="flex flex-wrap gap-2"><button type="button" onClick={exportTreasuryCsv} disabled={saving} className="section-button section-button-active rounded-full px-4 py-2 text-sm font-semibold transition">Descargar CSV</button><button type="button" onClick={printTreasurySummary} className="section-button section-button-idle rounded-full px-4 py-2 text-sm font-semibold transition">Imprimir resumen</button></div>}><form className="grid gap-4 md:grid-cols-2" onSubmit={applyTreasuryFilter}><InputField label="Desde" name="startDate" type="date" value={treasuryFilter.startDate} onChange={handleText(setTreasuryFilter)} /><InputField label="Hasta" name="endDate" type="date" value={treasuryFilter.endDate} onChange={handleText(setTreasuryFilter)} /><button type="submit" disabled={saving} className="primary-button rounded-2xl px-4 py-3 text-sm font-semibold">Aplicar filtro</button><button type="button" onClick={clearTreasuryFilter} className="section-button section-button-idle rounded-2xl px-4 py-3 text-sm font-semibold transition">Ver todo</button></form>{treasuryFilterActive ? <div className="info-box mt-4 rounded-2xl px-4 py-3 text-sm">Mostrando tesorería desde {treasuryFilter.startDate ? formatDate(treasuryFilter.startDate) : "el inicio"} hasta {treasuryFilter.endDate ? formatDate(treasuryFilter.endDate) : "hoy"}.</div> : null}</Panel>
          <Panel title="Jornadas registradas" description={treasuryFilterActive ? "Cierres y aperturas del período filtrado." : "Últimos cierres y turnos de caja registrados."}>{cashSummary.recent_sessions.length === 0 ? <EmptyState>No hay jornadas en ese período.</EmptyState> : <div className="space-y-3">{cashSummary.recent_sessions.map((session) => <CashSessionCard key={session.id} session={session} />)}</div>}</Panel>
        </div>
        <div className="space-y-6">
          <Panel title="Reportes inteligentes" description="Lectura rápida de recaudación, ganancia y comportamiento de ventas.">
            <div className="grid gap-4 lg:grid-cols-2"><ReportList title="Productos más vendidos" rows={reports.top_products} renderLabel={(row) => row.name} renderMeta={(row) => `${row.quantity} unidades · ${formatMoney(row.revenue)}`} /><ReportList title="Categorías más vendidas" rows={reports.top_categories} renderLabel={(row) => row.category} renderMeta={(row) => `${row.quantity} unidades · ${formatMoney(row.revenue)}`} /></div>
            <div className="soft-card mt-5 rounded-2xl p-4"><h3 className="panel-description text-sm font-semibold uppercase tracking-[0.2em]">Insights</h3><div className="mt-3 space-y-2">{reports.insights.length === 0 ? <EmptyState>Sin insights todavía.</EmptyState> : reports.insights.map((insight) => <div key={insight} className="success-soft rounded-2xl px-4 py-3 text-sm">{insight}</div>)}</div></div>
            <div className="mt-5"><h3 className="panel-description text-sm font-semibold uppercase tracking-[0.2em]">Últimas ventas del período</h3><div className="mt-3 space-y-3">{reports.recent_sales.length === 0 ? <EmptyState>No hay ventas en ese período.</EmptyState> : reports.recent_sales.map((sale) => <RecentSaleCard key={sale.id} sale={sale} />)}</div></div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
function createEmptyReports() { return { total_products: 0, total_units: 0, low_stock_count: 0, inventory_cost_value: 0, inventory_sale_value: 0, total_revenue: 0, total_profit: 0, total_sales_count: 0, total_units_sold: 0, top_products: [], top_categories: [], recent_sales: [], insights: [] }; }
function createEmptyCashSummary() { return { current_session: null, today_revenue: 0, today_profit: 0, today_sales_count: 0, today_units_sold: 0, expected_cash_now: 0, recent_sessions: [] }; }
function normalizeProductForm(form) { return { code: String(form.code).trim(), name: String(form.name).trim(), category: String(form.category).trim() || "General", quantity: Number(form.quantity), min_quantity: Number(form.min_quantity), sale_price: Number(form.sale_price), cost_price: Number(form.cost_price) }; }
function formatMoney(value) { return money.format(Number(value || 0)); }
function formatDate(value) { return new Date(`${value}T00:00:00`).toLocaleDateString("es-AR"); }
function formatDateTime(value) { return new Date(value).toLocaleString("es-AR"); }
function buildDateQuery(filter) { const params = new URLSearchParams(); if (filter.startDate) params.set("start_date", filter.startDate); if (filter.endDate) params.set("end_date", filter.endDate); const query = params.toString(); return query ? `?${query}` : ""; }
function escapeHtml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#39;"); }
function readLocalJson(key) { try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; } }
function buildInitials(value) { return String(value).split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "AL"; }
function sectionEyebrow(section) { return ({ home: "Visión general", inventory: "Gestión de inventario", treasury: "Finanzas y operaciones" })[section] ?? "Sistema local"; }
function sectionTitle(section, branchName) { return ({ home: `Bienvenido, ${branchName}`, inventory: "Gestión de inventario", treasury: "Control de caja y reportes" })[section] ?? branchName; }
function sectionDescription(section) { return ({ home: "Un inicio claro para revisar caja, inventario y alertas del local.", inventory: "Control total sobre existencias, costos, márgenes y altas por escáner.", treasury: "Seguimiento de caja diaria, ventas, cierres y reportes exportables." })[section] ?? "Panel principal"; }
function handleText(setter) { return (event) => { const { name, value } = event.target; setter((current) => ({ ...current, [name]: value })); }; }

function Panel({ title, description, action, children }) { return <article className="panel-shell rounded-[30px] p-5 shadow-panel backdrop-blur"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="panel-title text-xl font-semibold">{title}</h2><p className="panel-description mt-1 text-sm">{description}</p></div>{action}</div>{children}</article>; }
function ThemeToggle({ theme, onChange }) { return <div className="theme-toggle inline-flex items-center gap-2 rounded-full px-2 py-2">{Object.entries(availableThemes).map(([value, config]) => <button key={value} type="button" onClick={() => onChange(value)} className={`theme-pill rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${theme === value ? "theme-pill-active" : "theme-pill-idle"}`}>{config.label}</button>)}</div>; }
function SidebarLink({ item, active, onClick }) { return <button type="button" onClick={onClick} className={`sidebar-link flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${active ? "sidebar-link-active" : "sidebar-link-idle"}`}><span className="sidebar-badge flex h-10 w-10 items-center justify-center rounded-xl text-[11px] font-bold uppercase tracking-[0.18em]">{item.short}</span><span>{item.label}</span></button>; }
function MetricCard({ label, value, emphasis = false }) { return <div className="metric-card rounded-2xl px-4 py-4"><div className="metric-label text-xs uppercase tracking-[0.22em]">{label}</div><div className={`mt-2 text-2xl font-semibold ${emphasis ? "metric-value-emphasis" : "metric-value"}`}>{value}</div></div>; }
function StatusPanel({ message, error }) { if (!message && !error) return null; return <div className={`status-panel mt-4 rounded-2xl border px-4 py-3 text-sm ${error ? "status-panel-error" : "status-panel-success"}`}>{error || message}</div>; }
function ScannerStatus({ state }) { const states = { ready: { label: "Lector listo", className: "success-soft text-emerald-100" }, processing: { label: "Procesando lectura", className: "info-box text-sky-100" }, success: { label: "Lectura confirmada", className: "success-soft text-emerald-100" }, warning: { label: "Código nuevo", className: "warning-box text-amber-100" }, error: { label: "Revisar lectura", className: "danger-box text-rose-100" }, blocked: { label: "Doble lectura bloqueada", className: "warning-box text-orange-100" } }; const current = states[state] ?? states.ready; return <div className={`rounded-2xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${current.className}`}>{current.label}</div>; }
function EmptyState({ children }) { return <div className="empty-state rounded-2xl border border-dashed px-4 py-10 text-center text-sm">{children}</div>; }
function CategorySelect({ label, value, categories, onChange }) { return <label className="block"><span className="field-label mb-2 block text-sm font-medium">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition">{categories.length === 0 ? <option value="General">General</option> : categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select></label>; }
const InputField = forwardRef(function InputField({ label, ...props }, ref) { return <label className="block"><span className="field-label mb-2 block text-sm font-medium">{label}</span><input ref={ref} {...props} className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition" /></label>; });
function InventoryTable({ items, onEdit, onDelete }) { return <div className="overflow-x-auto"><table className="inventory-table min-w-full border-separate border-spacing-y-2 text-left text-sm"><thead className="content-muted text-xs uppercase tracking-[0.2em]"><tr><th className="px-3 py-2">Producto</th><th className="px-3 py-2">Código</th><th className="px-3 py-2">Categoría</th><th className="px-3 py-2">Stock</th><th className="px-3 py-2">Costo</th><th className="px-3 py-2">Venta</th><th className="px-3 py-2">Acciones</th></tr></thead><tbody>{items.map((item) => { const isLow = item.quantity <= item.min_quantity; return <tr key={item.id} className="inventory-row"><td className="rounded-l-2xl px-3 py-3"><div className="content-strong font-medium">{item.name}</div><div className="content-muted text-xs">{item.category}</div></td><td className="inventory-code px-3 py-3 font-mono text-xs">{item.code}</td><td className="content-default px-3 py-3">{item.category}</td><td className="px-3 py-3"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${isLow ? "danger-box text-rose-100" : "success-soft text-emerald-100"}`}>{item.quantity} / mínimo {item.min_quantity}</span></td><td className="content-default px-3 py-3">{formatMoney(item.cost_price)}</td><td className="content-default px-3 py-3">{formatMoney(item.sale_price)}</td><td className="rounded-r-2xl px-3 py-3"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => onEdit(item)} className="section-button section-button-idle rounded-full px-3 py-1 text-xs font-medium transition">Editar</button><button type="button" onClick={() => onDelete(item)} className="danger-button rounded-full px-3 py-1 text-xs font-medium transition">Eliminar</button></div></td></tr>; })}</tbody></table></div>; }
function MovementCard({ movement }) { const isOut = movement.quantity_delta < 0; return <div className="card-surface rounded-2xl p-4"><div className="flex items-center justify-between gap-3"><div><div className="content-strong font-medium">{movement.item_name}</div><div className="content-muted text-xs uppercase tracking-[0.18em]">{movement.movement_type} · {movement.reference}</div></div><div className={`rounded-full px-3 py-1 text-xs font-semibold ${isOut ? "danger-box text-rose-100" : "success-soft text-emerald-100"}`}>{isOut ? movement.quantity_delta : `+${movement.quantity_delta}`}</div></div></div>; }
function CashSessionCard({ session }) { const diff = Number(session.difference_amount || 0); const closed = session.closed_at ? formatDateTime(session.closed_at) : "Turno en curso"; return <div className="card-surface rounded-2xl p-4"><div className="flex items-center justify-between gap-3"><div><div className="content-strong font-medium">{session.status === "OPEN" ? "Caja abierta" : "Caja cerrada"}</div><div className="content-muted text-xs uppercase tracking-[0.18em]">Apertura: {formatDateTime(session.opened_at)}</div></div><div className={`rounded-full px-3 py-1 text-xs font-semibold ${diff < 0 ? "danger-box text-rose-100" : "success-soft text-emerald-100"}`}>{session.status === "OPEN" ? formatMoney(session.expected_cash_amount) : `${diff >= 0 ? "+" : ""}${formatMoney(diff)}`}</div></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div className="soft-card rounded-2xl px-4 py-3"><span className="content-faint block text-xs uppercase tracking-[0.18em]">Esperado</span><span className="content-strong mt-1 block font-medium">{formatMoney(session.expected_cash_amount)}</span></div><div className="soft-card rounded-2xl px-4 py-3"><span className="content-faint block text-xs uppercase tracking-[0.18em]">Real / cierre</span><span className="content-strong mt-1 block font-medium">{session.actual_cash_amount == null ? closed : formatMoney(session.actual_cash_amount)}</span></div></div>{session.notes ? <div className="soft-card content-default mt-4 rounded-2xl px-4 py-3 text-sm">{session.notes}</div> : null}</div>; }
function ReportList({ title, rows, renderLabel, renderMeta }) { return <div className="soft-card rounded-2xl p-4"><h3 className="panel-description text-sm font-semibold uppercase tracking-[0.2em]">{title}</h3><div className="mt-3 space-y-3">{rows.length === 0 ? <EmptyState>Sin datos suficientes.</EmptyState> : rows.map((row) => <div key={renderLabel(row)} className="card-surface rounded-2xl px-4 py-3"><div className="content-strong font-medium">{renderLabel(row)}</div><div className="content-muted text-sm">{renderMeta(row)}</div></div>)}</div></div>; }
function RecentSaleCard({ sale }) { return <div className="card-surface rounded-2xl px-4 py-3"><div className="flex items-center justify-between gap-3"><div><div className="content-strong font-medium">{sale.item_name}</div><div className="content-muted text-xs uppercase tracking-[0.18em]">{sale.code} · {sale.category}</div></div><div className="text-right"><div className="content-strong font-medium">{formatMoney(sale.revenue)}</div><div className="content-muted text-xs">{sale.quantity} unidades</div></div></div><div className="content-faint mt-3 text-xs uppercase tracking-[0.18em]">{formatDateTime(sale.created_at)}</div></div>; }
function FeatureCard({ title, description }) { return <div className="feature-card rounded-2xl p-5"><div className="content-strong text-lg font-semibold">{title}</div><div className="auth-text mt-2 text-sm">{description}</div></div>; }
function MiniStat({ label, value }) { return <div className="feature-card rounded-2xl p-5"><div className="panel-description text-xs uppercase tracking-[0.24em]">{label}</div><div className="content-strong mt-3 text-2xl font-semibold">{value}</div></div>; }
function QuickAction({ title, description, onClick, emphasis = false }) { return <button type="button" onClick={onClick} className={`quick-action rounded-2xl p-5 text-left transition ${emphasis ? "quick-action-emphasis" : "quick-action-default"}`}><div className="content-strong text-lg font-semibold">{title}</div><div className="panel-description mt-2 text-sm">{description}</div></button>; }
function StatusRow({ label, value, strong = false }) { return <div className="soft-card flex items-center justify-between rounded-2xl px-4 py-3"><span className="panel-description text-sm">{label}</span><span className={`text-sm font-semibold ${strong ? "content-strong" : "content-default"}`}>{value}</span></div>; }
function ShortcutHint({ children }) { return <div className="shortcut-hint rounded-2xl px-4 py-3 text-sm">{children}</div>; }
function InsightCard({ title, value, helper }) { return <div className="soft-card rounded-2xl p-4"><div className="panel-description text-xs uppercase tracking-[0.2em]">{title}</div><div className="content-strong mt-2 text-xl font-semibold">{value}</div><div className="content-muted mt-2 text-sm">{helper}</div></div>; }
function SummaryBadge({ label, value }) { return <div className="soft-card rounded-2xl px-4 py-3 text-right"><div className="panel-description text-[11px] uppercase tracking-[0.22em]">{label}</div><div className="content-strong mt-1 text-sm font-semibold">{value}</div></div>; }
function MiniLine({ label, value }) { return <div className="flex items-center justify-between gap-3"><span className="panel-description text-sm">{label}</span><span className="content-strong text-sm font-semibold">{value}</span></div>; }
function ActionCard({ title, description, subtle = false, children }) { return <div className={`action-card rounded-[28px] p-5 ${subtle ? "action-card-light" : "action-card-strong"}`}><div className="content-strong text-3xl font-semibold">{title}</div><div className="panel-description mt-2 text-sm">{description}</div><div className="mt-5">{children}</div></div>; }

function DailySalesChart({ rows }) { const maxRevenue = Math.max(...rows.map((row) => row.revenue), 1); return <div className="daily-sales-chart"><div className="chart-grid">{rows.map((row) => <div key={row.label} className="chart-column"><div className="chart-meta text-xs">{formatMoney(row.revenue)}</div><div className="chart-bar-wrap"><div className="chart-bar" style={{ height: `${Math.max((row.revenue / maxRevenue) * 100, 8)}%` }} /></div><div className="chart-label text-xs">{row.label}</div><div className="chart-foot text-[11px]">{row.sales} ventas</div></div>)}</div></div>; }
function createDailySalesSeries(sales) { const grouped = sales.reduce((acc, sale) => { const date = new Date(sale.created_at); const label = date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }); const current = acc.get(label) ?? { label, revenue: 0, sales: 0 }; current.revenue += Number(sale.revenue || 0); current.sales += 1; acc.set(label, current); return acc; }, new Map()); return [...grouped.values()].slice(-7); }

export default App;
