import { useEffect, useMemo, useRef, useState } from "react";
import { FeatureCard, InputField, LogoUploadField, MiniLine, MiniStat, Panel, SidebarLink, StatusPanel, ThemeToggle } from "./components/AppUI";
import HomeSection from "./sections/HomeSection";
import InventorySection from "./sections/InventorySection";
import TreasurySection from "./sections/TreasurySection";
import { accessStorageKey, activeSectionStorageKey, availableThemes, emptyAccessSetup, emptyBusinessProfile, emptyCashCloseForm, emptyCashOpenForm, emptyLoginForm, emptyProductForm, emptySaleForm, emptyTreasuryFilter, navItems, paymentMethodOptions, scanLockMs, sessionStorageKey, sidebarCollapsedStorageKey } from "./lib/appConfig";
import { buildBusinessProfileForm, buildDateQuery, buildInitials, buildTreasuryPresetFilter, createEmptyCashSummary, createEmptyReports, escapeHtml, formatDate, formatDateTime, formatInteger, formatMoney, handleText, normalizeProductForm, normalizeText, readLocalJson, sectionDescription, sectionEyebrow, sectionTitle } from "./lib/appHelpers";
const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8001/api";
function App() {
  const [items, setItems] = useState([]);
  const [reports, setReports] = useState(createEmptyReports());
  const [cashSummary, setCashSummary] = useState(createEmptyCashSummary());
  const [dailySales, setDailySales] = useState([]);
  const [categories, setCategories] = useState([]);
  const [movements, setMovements] = useState([]);
  const [activeSection, setActiveSection] = useState("home");
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [saleForm, setSaleForm] = useState(emptySaleForm);
  const [cashOpenForm, setCashOpenForm] = useState(emptyCashOpenForm);
  const [cashCloseForm, setCashCloseForm] = useState(emptyCashCloseForm);
  const [treasuryFilter, setTreasuryFilter] = useState(emptyTreasuryFilter);
  const [treasuryPreset, setTreasuryPreset] = useState("all");
  const [treasuryMetric, setTreasuryMetric] = useState("revenue");
  const [theme, setTheme] = useState("dark");
  const [themeTransition, setThemeTransition] = useState(null);
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [accessSetupForm, setAccessSetupForm] = useState(emptyAccessSetup);
  const [businessProfileForm, setBusinessProfileForm] = useState(emptyBusinessProfile);
  const [loginForm, setLoginForm] = useState(emptyLoginForm);
  const scanInputRef = useRef(null);
  const audioContextRef = useRef(null);
  const lastScanRef = useRef({ code: "", time: 0 });
  const themeTransitionTimeoutRef = useRef(null);
  const themeCommitTimeoutRef = useRef(null);

  useEffect(() => {
    refreshAll();
    const savedTheme = window.localStorage.getItem("appstock-theme");
    if (savedTheme && availableThemes[savedTheme]) setTheme(savedTheme);
    const savedAccess = readLocalJson(accessStorageKey);
    if (savedAccess?.password && savedAccess?.userName) {
      setAccessConfig(savedAccess);
      setBusinessProfileForm(buildBusinessProfileForm(savedAccess));
      setLoginForm((current) => ({ ...current, userName: savedAccess.userName }));
    }
    if (window.localStorage.getItem(sessionStorageKey) === "open") setSessionOpen(true);
    const savedSection = window.localStorage.getItem(activeSectionStorageKey);
    if (savedSection && navItems.some((item) => item.id === savedSection)) setActiveSection(savedSection);
    if (window.localStorage.getItem(sidebarCollapsedStorageKey) === "true") setSidebarCollapsed(true);
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
    window.localStorage.setItem(sidebarCollapsedStorageKey, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

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
    const term = normalizeText(searchTerm);
    if (!term) return items;
    return items.filter((item) => normalizeText(item.name).includes(term) || normalizeText(item.code).includes(term) || normalizeText(item.category).includes(term));
  }, [items, searchTerm]);
  const inventoryValue = useMemo(() => items.reduce((total, item) => total + item.quantity * item.sale_price, 0), [items]);
  const costValue = useMemo(() => items.reduce((total, item) => total + item.quantity * item.cost_price, 0), [items]);
  const latestMovements = useMemo(() => movements.slice(0, 5), [movements]);
  const treasuryFilterActive = Boolean(treasuryFilter.startDate || treasuryFilter.endDate);
  const currentDateLabel = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
  const currentNavLabel = navItems.find((item) => item.id === activeSection)?.label ?? "Inicio";
  const branchName = accessConfig?.businessName || "Tu local";
  const businessLogo = accessConfig?.businessLogoDataUrl || "";

  function handleThemeChange(nextTheme, event) {
    const target = event?.currentTarget;
    const rect = target instanceof HTMLElement ? target.getBoundingClientRect() : null;
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;

    if (themeTransitionTimeoutRef.current) window.clearTimeout(themeTransitionTimeoutRef.current);
    if (themeCommitTimeoutRef.current) window.clearTimeout(themeCommitTimeoutRef.current);

    setThemeTransition({ key: Date.now(), x, y });

    if (nextTheme !== theme) {
      themeCommitTimeoutRef.current = window.setTimeout(() => {
        setTheme(nextTheme);
        themeCommitTimeoutRef.current = null;
      }, 120);
    }

    themeTransitionTimeoutRef.current = window.setTimeout(() => {
      setThemeTransition(null);
      themeTransitionTimeoutRef.current = null;
    }, 980);
  }
  async function refreshAll(filters = treasuryFilter) {
    setLoading(true);
    setError("");
    try {
      const treasuryQuery = buildDateQuery(filters);
      const [itemsResponse, reportsResponse, movementsResponse, cashResponse, categoriesResponse, dailySalesResponse] = await Promise.all([
        fetch(`${API_URL}/items`),
        fetch(`${API_URL}/reports/summary${treasuryQuery}`),
        fetch(`${API_URL}/movements?limit=12`),
        fetch(`${API_URL}/reports/cash-summary${treasuryQuery}`),
        fetch(`${API_URL}/categories`),
        fetch(`${API_URL}/reports/daily-sales${treasuryQuery}`),
      ]);
      if (!itemsResponse.ok || !reportsResponse.ok || !movementsResponse.ok || !cashResponse.ok || !categoriesResponse.ok || !dailySalesResponse.ok) throw new Error("No se pudieron cargar los datos principales.");
      const [itemsData, reportsData, movementsData, cashData, categoriesData, dailySalesData] = await Promise.all([
        itemsResponse.json(), reportsResponse.json(), movementsResponse.json(), cashResponse.json(), categoriesResponse.json(), dailySalesResponse.json(),
      ]);
      setItems([...itemsData].sort((a, b) => a.name.localeCompare(b.name)));
      setReports(reportsData);
      setMovements(movementsData);
      setCashSummary(cashData);
      setCategories(categoriesData);
      setDailySales(dailySalesData);
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
    const payload = {
      businessName: accessSetupForm.businessName.trim(),
      businessAddress: accessSetupForm.businessAddress.trim(),
      businessWhatsapp: accessSetupForm.businessWhatsapp.trim(),
      businessTaxId: accessSetupForm.businessTaxId.trim(),
      businessLogoDataUrl: accessSetupForm.businessLogoDataUrl || "",
      userName: accessSetupForm.userName.trim(),
      password: accessSetupForm.password,
    };
    if (!payload.businessName || !payload.userName || payload.password.length < 4) {
      setError("Completa el nombre del local, el usuario y una clave de al menos 4 caracteres.");
      return;
    }
    if (accessSetupForm.password !== accessSetupForm.confirmPassword) {
      setError("La confirmacion de la clave no coincide.");
      return;
    }
    window.localStorage.setItem(accessStorageKey, JSON.stringify(payload));
    window.localStorage.setItem(sessionStorageKey, "open");
    setAccessConfig(payload);
    setBusinessProfileForm(buildBusinessProfileForm(payload));
    setLoginForm({ userName: payload.userName, password: "" });
    setAccessSetupForm(emptyAccessSetup);
    setSessionOpen(true);
    setError("");
    setMessage(`Bienvenido a ${payload.businessName}. El acceso local quedo configurado.`);
  }

  function handleBusinessProfileSave(event) {
    event.preventDefault();
    if (!accessConfig) return;
    const payload = {
      ...accessConfig,
      businessName: businessProfileForm.businessName.trim(),
      businessAddress: businessProfileForm.businessAddress.trim(),
      businessWhatsapp: businessProfileForm.businessWhatsapp.trim(),
      businessTaxId: businessProfileForm.businessTaxId.trim(),
      businessLogoDataUrl: businessProfileForm.businessLogoDataUrl || "",
    };
    if (!payload.businessName) {
      setError("Completa al menos el nombre comercial para imprimir tickets presentables.");
      return;
    }
    window.localStorage.setItem(accessStorageKey, JSON.stringify(payload));
    setAccessConfig(payload);
    setBusinessProfileForm(buildBusinessProfileForm(payload));
    setError("");
    setMessage(`Perfil comercial actualizado para ${payload.businessName}.`);
  }

  function handleLogoUpload(event, setter) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecciona una imagen valida para el logo.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setError("El logo debe pesar menos de 1 MB para guardarlo localmente.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setter((current) => ({ ...current, businessLogoDataUrl: typeof reader.result === "string" ? reader.result : "" }));
      setError("");
    };
    reader.onerror = () => setError("No se pudo leer el archivo del logo.");
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function clearLogo(setter) {
    setter((current) => ({ ...current, businessLogoDataUrl: "" }));
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
    if (!cashSummary.current_session) {
      setError("Antes de registrar una venta, abri la caja del dia desde Tesoreria.");
      setActiveSection("treasury");
      setScanState("warning");
      playTone("warning");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = { code: saleForm.code, amount: Number(saleForm.amount), unit_price: saleForm.unit_price === "" ? null : Number(saleForm.unit_price), payment_method: saleForm.payment_method };
      const response = await fetch(`${API_URL}/sales`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "No se pudo registrar la venta.");
      setSaleForm(emptySaleForm);
      setMessage(`Venta registrada para ${data.item_name}. Preparando ticket de impresión.`);
      setScanState("success");
      playTone("success");
      await refreshAll();
      const printStarted = printSaleTicket(data, { business: accessConfig, cashierName: accessConfig?.userName || "Mostrador", channelLabel: "Mostrador" });
      if (!printStarted) {
        setMessage(`Venta registrada para ${data.item_name}. Habilitá las ventanas emergentes para imprimir el ticket.`);
      }
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


  function printSaleTicket(sale, options) {
  const printWindow = window.open("", "_blank", "width=420,height=760");
  if (!printWindow) return false;

  const business = options?.business ?? {};
  const branchLabel = escapeHtml(business.businessName || options?.branchName || "Comercio");
  const businessAddress = business.businessAddress ? escapeHtml(business.businessAddress) : "";
  const businessWhatsapp = business.businessWhatsapp ? escapeHtml(business.businessWhatsapp) : "";
  const businessTaxId = business.businessTaxId ? escapeHtml(business.businessTaxId) : "";
  const businessLogo = business.businessLogoDataUrl || "";
  const cashierLabel = escapeHtml(options?.cashierName || "Mostrador");
  const channelLabel = escapeHtml(options?.channelLabel || "Mostrador");
  const paymentMethodLabel = escapeHtml(sale.payment_method || "Efectivo");
  const saleNumber = `V-${String(sale.id).padStart(6, "0")}`;
  const saleDateTime = formatDateTime(sale.created_at);
  const subtotal = Number(sale.quantity) * Number(sale.unit_price);
  const ticketMeta = [
    businessAddress,
    businessWhatsapp ? `WhatsApp ${businessWhatsapp}` : "",
    businessTaxId ? `CUIT ${businessTaxId}` : "",
  ].filter(Boolean).join(" · ");
  const logoMarkup = businessLogo ? `<div class="logo-wrap"><img src="${businessLogo}" alt="Logo del comercio" class="logo" /></div>` : "";
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Ticket ${saleNumber}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #efe7dc; color: #1f2937; font-family: "Segoe UI", Arial, sans-serif; }
  .sheet { width: 80mm; min-height: 100vh; margin: 0 auto; background: #fffdfa; padding: 10mm 7mm 8mm; }
  .top { text-align: center; border-bottom: 1px dashed #c8b6a1; padding-bottom: 12px; }
  .logo-wrap { display: flex; justify-content: center; margin-bottom: 10px; }
  .logo { max-width: 26mm; max-height: 18mm; object-fit: contain; }
  .eyebrow { font-size: 9px; letter-spacing: 0.26em; text-transform: uppercase; color: #8a6f57; }
  h1 { margin: 6px 0 4px; font-size: 19px; line-height: 1.15; }
  .meta { color: #6b7280; font-size: 10px; line-height: 1.45; }
  .section { margin-top: 14px; }
  .row { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; font-size: 11px; }
  .label { color: #6b7280; }
  .value { font-weight: 600; text-align: right; }
  .product { margin-top: 14px; border: 1px solid #e8dccd; border-radius: 14px; padding: 11px; background: linear-gradient(180deg, #fffdf9 0%, #f8f0e6 100%); }
  .product-name { font-size: 15px; font-weight: 700; line-height: 1.25; }
  .product-meta { margin-top: 5px; color: #7b6857; font-size: 9px; text-transform: uppercase; letter-spacing: 0.12em; }
  .totals { margin-top: 14px; padding-top: 10px; border-top: 1px dashed #c8b6a1; }
  .total-strong { font-size: 16px; font-weight: 700; }
  .foot { margin-top: 14px; padding-top: 10px; border-top: 1px dashed #c8b6a1; text-align: center; }
  .foot strong { display: block; margin-bottom: 4px; font-size: 11px; }
  .foot small { color: #6b7280; font-size: 10px; line-height: 1.45; }
</style>
</head>
<body>
  <main class="sheet">
    <header class="top">
      ${logoMarkup}
      <div class="eyebrow">Ticket de venta</div>
      <h1>${branchLabel}</h1>
      ${ticketMeta ? `<div class="meta">${ticketMeta}</div>` : ""}
    </header>

    <section class="section">
      <div class="row"><span class="label">Venta</span><span class="value">${saleNumber}</span></div>
      <div class="row"><span class="label">Fecha y hora</span><span class="value">${escapeHtml(saleDateTime)}</span></div>
      <div class="row"><span class="label">Cajero</span><span class="value">${cashierLabel}</span></div>
      <div class="row"><span class="label">Canal</span><span class="value">${channelLabel}</span></div>
      <div class="row"><span class="label">Medio de pago</span><span class="value">${paymentMethodLabel}</span></div>
    </section>

    <section class="product">
      <div class="product-name">${escapeHtml(sale.item_name)}</div>
      <div class="product-meta">${escapeHtml(sale.category)} · COD ${escapeHtml(sale.code)}</div>
      <div class="section">
        <div class="row"><span class="label">Cantidad</span><span class="value">${formatInteger(sale.quantity)}</span></div>
        <div class="row"><span class="label">Precio unitario</span><span class="value">${formatMoney(sale.unit_price)}</span></div>
        <div class="row"><span class="label">Subtotal</span><span class="value">${formatMoney(subtotal)}</span></div>
      </div>
    </section>

    <section class="totals">
      <div class="row total-strong"><span>Total</span><span>${formatMoney(sale.revenue)}</span></div>
      <div class="row"><span class="label">Items</span><span class="value">${formatInteger(sale.quantity)}</span></div>
      <div class="row"><span class="label">Pago</span><span class="value">${paymentMethodLabel}</span></div>
    </section>

    <footer class="foot">
      <strong>Gracias por su compra</strong>
      <small>Conserve este comprobante para cambios, consultas o control de caja.</small>
    </footer>
  </main>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  const triggerPrint = () => {
    printWindow.print();
    printWindow.onafterprint = () => printWindow.close();
  };
  window.setTimeout(triggerPrint, 180);
  return true;
}

  async function applyTreasuryFilter(event) {
    event.preventDefault();
    setTreasuryPreset("custom");
    await refreshAll(treasuryFilter);
  }

  async function applyTreasuryPreset(preset) {
    const nextFilter = buildTreasuryPresetFilter(preset);
    setTreasuryPreset(preset);
    setTreasuryFilter(nextFilter);
    await refreshAll(nextFilter);
  }

  async function clearTreasuryFilter() {
    const nextFilter = { ...emptyTreasuryFilter };
    setTreasuryPreset("all");
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

  const themeShiftOverlay = themeTransition ? (
    <div
      key={themeTransition.key}
      className="theme-shift-overlay"
      style={{ "--theme-shift-x": `${themeTransition.x}px`, "--theme-shift-y": `${themeTransition.y}px` }}
      aria-hidden="true"
    >
      <div className="theme-shift-glow" />
      <div className="theme-shift-wave theme-shift-wave-primary" />
      <div className="theme-shift-wave theme-shift-wave-secondary" />
    </div>
  ) : null;
  if (!accessConfig) {
    return (
      <main className="auth-shell min-h-screen px-4 py-8 sm:px-6 lg:px-10">
        {themeShiftOverlay}
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
              <ThemeToggle theme={theme} themes={availableThemes} onChange={handleThemeChange} compact />
            </div>
            <form className="mt-8 space-y-4" onSubmit={handleAccessSetup}>
              <InputField label="Nombre del local" name="businessName" value={accessSetupForm.businessName} onChange={handleText(setAccessSetupForm)} placeholder="Ejemplo: Almacen San Martin" />
              <InputField label="Dirección comercial" name="businessAddress" value={accessSetupForm.businessAddress} onChange={handleText(setAccessSetupForm)} placeholder="Av. Principal 123, Ciudad" />
              <InputField label="WhatsApp" name="businessWhatsapp" value={accessSetupForm.businessWhatsapp} onChange={handleText(setAccessSetupForm)} placeholder="+54 9 11 1234 5678" />
              <InputField label="CUIT" name="businessTaxId" value={accessSetupForm.businessTaxId} onChange={handleText(setAccessSetupForm)} placeholder="30-12345678-9" />
              <LogoUploadField label="Logo del comercio (opcional)" logoDataUrl={accessSetupForm.businessLogoDataUrl} onSelect={(event) => handleLogoUpload(event, setAccessSetupForm)} onClear={() => clearLogo(setAccessSetupForm)} />
              <InputField label="Usuario local" name="userName" value={accessSetupForm.userName} onChange={handleText(setAccessSetupForm)} placeholder="Administrador" />
              <InputField label="Clave local" name="password" type="password" value={accessSetupForm.password} onChange={handleText(setAccessSetupForm)} placeholder="Minimo 4 caracteres" />
              <InputField label="Confirmar clave" name="confirmPassword" type="password" value={accessSetupForm.confirmPassword} onChange={handleText(setAccessSetupForm)} placeholder="Repeti la clave" />
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
        {themeShiftOverlay}
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
              <ThemeToggle theme={theme} themes={availableThemes} onChange={handleThemeChange} compact />
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
      {themeShiftOverlay}
      <div className={`dashboard-layout grid min-h-screen ${sidebarCollapsed ? "lg:grid-cols-[104px_minmax(0,1fr)]" : "lg:grid-cols-[290px_minmax(0,1fr)]"}`}>
        <aside className={`sidebar-shell border-r px-5 py-6 lg:px-6 ${sidebarCollapsed ? "sidebar-shell-collapsed" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <div className={sidebarCollapsed ? "sidebar-collapse-hidden" : ""}>
              <div className="brand-title text-3xl font-semibold">AppStock Local</div>
              <div className="brand-subtitle mt-1 text-xs uppercase tracking-[0.24em]">Panel de control comercial</div>
            </div>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((current) => !current)}
              className={`sidebar-toggle section-button section-button-idle rounded-2xl px-3 py-3 text-xs font-semibold transition ${sidebarCollapsed ? "sidebar-toggle-collapsed" : ""}`}
              aria-label={sidebarCollapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
              title={sidebarCollapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
            >
              <span aria-hidden="true">{sidebarCollapsed ? "»" : "«"}</span>
            </button>
          </div>
          <div className="branch-card mt-8 rounded-[28px] p-5">
            <div className={`flex items-center gap-4 ${sidebarCollapsed ? "justify-center" : ""}`}>
              {businessLogo ? <img src={businessLogo} alt={`Logo de ${branchName}`} className="business-logo h-14 w-14 rounded-2xl object-cover" /> : <div className="avatar-badge flex h-14 w-14 items-center justify-center rounded-2xl text-sm font-semibold">{buildInitials(branchName)}</div>}
              <div className={sidebarCollapsed ? "sidebar-collapse-hidden" : ""}>
                <div className="content-strong text-xl font-semibold">{branchName}</div>
                <div className="content-muted text-sm">Estado operativo local</div>
              </div>
            </div>
          </div>
          <nav className="mt-8 space-y-2">
            {navItems.map((item) => <SidebarLink key={item.id} item={item} active={activeSection === item.id} collapsed={sidebarCollapsed} onClick={() => setActiveSection(item.id)} />)}
          </nav>
          <div className={`soft-card mt-8 rounded-[28px] p-5 ${sidebarCollapsed ? "sidebar-collapse-hidden" : ""}`}>
            <div className="panel-description text-xs uppercase tracking-[0.24em]">Resumen rápido</div>
            <div className="mt-4 space-y-4">
              <MiniLine label="Ventas del período" value={formatMoney(cashSummary.today_revenue)} />
              <MiniLine label="Caja esperada" value={formatMoney(cashSummary.expected_cash_now)} />
              <MiniLine label="Stock bajo" value={lowStockItems.length} />
            </div>
          </div>
          <div className="mt-auto pt-8">
            <button type="button" onClick={handleLogout} className={`section-button section-button-idle rounded-2xl px-4 py-3 text-sm font-semibold transition ${sidebarCollapsed ? "sidebar-logout-compact" : "w-full"}`} aria-label="Cerrar sesión local" title="Cerrar sesión local">
              {sidebarCollapsed ? "CS" : "Cerrar sesión local"}
            </button>
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
                <ThemeToggle theme={theme} themes={availableThemes} onChange={handleThemeChange} />
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
            {activeSection === "home" ? <HomeSection reports={reports} cashSummary={cashSummary} inventoryValue={inventoryValue} costValue={costValue} lowStockItems={lowStockItems} latestMovements={latestMovements} branchName={branchName} loading={loading} setActiveSection={setActiveSection} totalCategories={categories.length} totalItems={items.length} businessProfileForm={businessProfileForm} setBusinessProfileForm={setBusinessProfileForm} handleBusinessProfileSave={handleBusinessProfileSave} handleLogoUpload={handleLogoUpload} clearLogo={clearLogo} saving={saving} handleText={handleText} formatMoney={formatMoney} topProduct={reports.top_products[0]} /> : null}
            {activeSection === "inventory" ? <InventorySection loading={loading} searchTerm={searchTerm} setSearchTerm={setSearchTerm} refreshAll={refreshAll} scanState={scanState} scanInputRef={scanInputRef} scanCode={scanCode} setScanCode={setScanCode} processScan={processScan} scanAmount={scanAmount} setScanAmount={setScanAmount} saving={saving} submitScan={submitScan} scanCandidate={scanCandidate} productForm={productForm} handleText={handleText} setProductForm={setProductForm} categories={categories} resetProductEditor={resetProductEditor} editingId={editingId} submitProduct={submitProduct} newCategoryName={newCategoryName} setNewCategoryName={setNewCategoryName} submitCategory={submitCategory} filteredItems={filteredItems} startEditing={startEditing} handleDelete={handleDelete} movements={movements} inventoryValue={inventoryValue} lowStockItems={lowStockItems} setActiveSection={setActiveSection} formatMoney={formatMoney} /> : null}
            {activeSection === "treasury" ? <TreasurySection cashSummary={cashSummary} submitCashClose={submitCashClose} cashCloseForm={cashCloseForm} setCashCloseForm={setCashCloseForm} submitCashOpen={submitCashOpen} cashOpenForm={cashOpenForm} setCashOpenForm={setCashOpenForm} saleForm={saleForm} setSaleForm={setSaleForm} submitSale={submitSale} treasuryFilter={treasuryFilter} setTreasuryFilter={setTreasuryFilter} treasuryPreset={treasuryPreset} treasuryMetric={treasuryMetric} setTreasuryMetric={setTreasuryMetric} applyTreasuryPreset={applyTreasuryPreset} applyTreasuryFilter={applyTreasuryFilter} clearTreasuryFilter={clearTreasuryFilter} exportTreasuryCsv={exportTreasuryCsv} printTreasurySummary={printTreasurySummary} saving={saving} treasuryFilterActive={treasuryFilterActive} reports={reports} dailySales={dailySales} handleText={handleText} formatMoney={formatMoney} formatInteger={formatInteger} formatDate={formatDate} formatDateTime={formatDateTime} paymentMethodOptions={paymentMethodOptions} /> : null}
          </section>
        </div>
      </div>
    </main>
  );
}

export default App;









