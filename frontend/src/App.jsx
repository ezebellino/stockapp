import { forwardRef, useEffect, useRef, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8001/api";
const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
const emptyProductForm = { code: "", name: "", category: "General", quantity: 0, min_quantity: 0, sale_price: 0, cost_price: 0 };
const emptySaleForm = { code: "", amount: 1, unit_price: "" };
const emptyCashOpenForm = { opening_amount: "", notes: "" };
const emptyCashCloseForm = { actual_cash_amount: "", notes: "" };
const emptyTreasuryFilter = { startDate: "", endDate: "" };
const availableThemes = {
  dark: { label: "Oscuro" },
  sepia: { label: "Claro sepia" },
};
const scanLockMs = 1200;

function App() {
  const [items, setItems] = useState([]);
  const [reports, setReports] = useState(createEmptyReports());
  const [cashSummary, setCashSummary] = useState(createEmptyCashSummary());
  const [categories, setCategories] = useState([]);
  const [movements, setMovements] = useState([]);
  const [activeSection, setActiveSection] = useState("inventory");
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
  const scanInputRef = useRef(null);
  const audioContextRef = useRef(null);
  const lastScanRef = useRef({ code: "", time: 0 });

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    if (activeSection !== "inventory") return undefined;
    focusScanner();
    function keepFocus(event) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.tagName === "BUTTON" ||
          target.isContentEditable)
      ) {
        return;
      }
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
  }, [activeSection]);

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
        itemsResponse.json(),
        reportsResponse.json(),
        movementsResponse.json(),
        cashResponse.json(),
        categoriesResponse.json(),
      ]);
      setItems([...itemsData].sort((a, b) => a.name.localeCompare(b.name)));
      setReports(reportsData);
      setMovements(movementsData);
      setCashSummary(cashData);
      setCategories(categoriesData);
      if (cashData.current_session) {
        setCashCloseForm((current) => ({
          ...current,
          actual_cash_amount: current.actual_cash_amount === "" ? String(cashData.expected_cash_now.toFixed(2)) : current.actual_cash_amount,
        }));
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
      const response = await fetch(`${API_URL}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "No se pudo guardar la categoria.");
      setCategories((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name)));
      setProductForm((current) => ({ ...current, category: data.name }));
      setNewCategoryName("");
      setMessage(`Categoria creada: ${data.name}.`);
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
      setError("Escanea o escribe un codigo antes de registrar.");
      setScanState("error");
      playTone("error");
      focusScanner();
      return;
    }
    const now = Date.now();
    if (lastScanRef.current.code === normalizedCode && now - lastScanRef.current.time < scanLockMs) {
      setMessage("Lectura duplicada bloqueada para evitar doble ingreso accidental.");
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
        setMessage("Codigo no encontrado. Completa el alta rapida para crear el producto.");
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
    if (!window.confirm(`Eliminar ${item.name}? Esta accion no se puede deshacer.`)) return;
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
      setError("No se pudo abrir la vista de impresion.");
      return;
    }
    const periodLabel = treasuryFilter.startDate || treasuryFilter.endDate ? `${treasuryFilter.startDate || "inicio"} a ${treasuryFilter.endDate || "hoy"}` : "Jornada actual";
    const topProducts = reports.top_products.map((row) => `<li>${escapeHtml(row.name)}: ${row.quantity} uds - ${formatMoney(row.revenue)}</li>`).join("");
    const sessions = cashSummary.recent_sessions.map((session) => `<tr><td>${session.id}</td><td>${escapeHtml(session.status)}</td><td>${escapeHtml(formatDateTime(session.opened_at))}</td><td>${escapeHtml(session.closed_at ? formatDateTime(session.closed_at) : "Abierta")}</td><td>${formatMoney(session.expected_cash_amount)}</td><td>${session.actual_cash_amount == null ? "-" : formatMoney(session.actual_cash_amount)}</td><td>${session.difference_amount == null ? "-" : formatMoney(session.difference_amount)}</td></tr>`).join("");
    printWindow.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8" /><title>Cierre de tesoreria</title><style>body{font-family:Segoe UI,Arial,sans-serif;margin:32px;color:#1f2937}h1,h2{margin:0 0 12px}section{margin-top:24px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.card{border:1px solid #d6d3d1;border-radius:16px;padding:16px;background:#faf7f2}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #d6d3d1;padding:8px;text-align:left;font-size:12px}ul{padding-left:18px}small{color:#6b7280}</style></head><body><h1>Cierre de tesoreria</h1><small>Periodo: ${escapeHtml(periodLabel)}</small><section class="grid"><div class="card"><strong>Recaudacion</strong><div>${formatMoney(cashSummary.today_revenue)}</div></div><div class="card"><strong>Ganancia</strong><div>${formatMoney(cashSummary.today_profit)}</div></div><div class="card"><strong>Ventas</strong><div>${cashSummary.today_sales_count}</div></div><div class="card"><strong>Caja esperada</strong><div>${formatMoney(cashSummary.expected_cash_now)}</div></div></section><section><h2>Productos mas vendidos</h2><ul>${topProducts || "<li>Sin datos suficientes.</li>"}</ul></section><section><h2>Jornadas</h2><table><thead><tr><th>ID</th><th>Estado</th><th>Apertura</th><th>Cierre</th><th>Esperado</th><th>Real</th><th>Diferencia</th></tr></thead><tbody>${sessions || "<tr><td colspan=\"7\">Sin jornadas registradas.</td></tr>"}</tbody></table></section></body></html>`);
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

  const lowStockItems = items.filter((item) => item.quantity <= item.min_quantity);
  const treasuryFilterActive = Boolean(treasuryFilter.startDate || treasuryFilter.endDate);
  const filteredItems = items.filter((item) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return item.name.toLowerCase().includes(term) || item.code.toLowerCase().includes(term) || item.category.toLowerCase().includes(term);
  });

  return (
    <main className="app-shell min-h-screen px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="hero-shell overflow-hidden rounded-[30px] shadow-panel backdrop-blur">
          <div className="grid gap-6 px-6 py-7 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              <span className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">AppStock local</span>
              <div className="space-y-3">
                <h1 className="content-strong max-w-3xl text-3xl font-semibold leading-tight sm:text-5xl">Stock, ventas, tesoreria y trazabilidad en una sola cabina.</h1>
                <p className="content-muted max-w-3xl text-sm sm:text-base">Ahora las categorias quedan persistidas para elegirlas rapido y poder sumar nuevas a medida que el negocio crece.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <SectionButton active={activeSection === "inventory"} onClick={() => setActiveSection("inventory")}>Inventario</SectionButton>
                <SectionButton active={activeSection === "treasury"} onClick={() => setActiveSection("treasury")}>Tesoreria</SectionButton>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard label="Recaudacion" value={formatMoney(reports.total_revenue)} />
              <MetricCard label="Ganancia" value={formatMoney(reports.total_profit)} />
              <MetricCard label="Unidades vendidas" value={reports.total_units_sold} />
              <MetricCard label="Stock bajo" value={reports.low_stock_count} emphasis={reports.low_stock_count > 0} />
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <Panel title="Ingreso por escaner" description="Autoenfoque constante, enter del lector y proteccion contra doble lectura." action={<button type="button" onClick={focusScanner} className="rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-200 transition hover:bg-sky-500/20">Enfocar</button>}>
            <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <ScannerStatus state={scanState} />
              <div className="card-surface content-muted rounded-2xl px-4 py-3 text-xs uppercase tracking-[0.2em]">Enter del lector: envio inmediato</div>
            </div>
            <form className="space-y-4" onSubmit={submitScan}>
              <InputField ref={scanInputRef} label="Codigo escaneado" name="scanCode" value={scanCode} onChange={(event) => setScanCode(event.target.value)} onKeyDown={async (event) => { if (event.key === "Enter") { event.preventDefault(); await processScan(); } }} placeholder="Escanea o escribe el codigo" autoComplete="off" />
              <InputField label="Cantidad a ingresar" name="scanAmount" type="number" min="1" value={scanAmount} onChange={(event) => setScanAmount(event.target.value)} />
              <button type="submit" disabled={saving} className="w-full rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60">Registrar ingreso</button>
            </form>
            <StatusPanel message={message} error={error} />
            {scanCandidate ? <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">Codigo nuevo detectado: {scanCandidate.code}. Completa el formulario y guardalo.</div> : null}
          </Panel>

          <Panel title={editingId ? "Editar producto" : "Alta manual de producto"} description="Crea, corrige o completa productos sin salir de la pantalla principal." action={(editingId || scanCandidate) ? <button type="button" onClick={resetProductEditor} className="section-button section-button-idle rounded-full px-4 py-2 text-sm font-medium transition">Limpiar</button> : null}>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={submitProduct}>
              <InputField label="Codigo de barras" name="code" value={productForm.code} onChange={handleText(setProductForm)} />
              <InputField label="Nombre" name="name" value={productForm.name} onChange={handleText(setProductForm)} />
              <CategorySelect label="Categoria" value={productForm.category} categories={categories} onChange={(value) => setProductForm((current) => ({ ...current, category: value }))} />
              <InputField label="Stock actual" name="quantity" type="number" min="0" value={productForm.quantity} onChange={handleText(setProductForm)} />
              <InputField label="Stock minimo" name="min_quantity" type="number" min="0" value={productForm.min_quantity} onChange={handleText(setProductForm)} />
              <InputField label="Precio de venta" name="sale_price" type="number" min="0" step="0.01" value={productForm.sale_price} onChange={handleText(setProductForm)} />
              <InputField label="Costo" name="cost_price" type="number" min="0" step="0.01" value={productForm.cost_price} onChange={handleText(setProductForm)} />
              <button type="submit" disabled={saving} className="md:col-span-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60">{editingId ? "Actualizar producto" : "Guardar producto"}</button>
            </form>
            <form className="soft-card mt-4 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row" onSubmit={submitCategory}>
              <input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder={categories.length === 0 ? "Crea la primera categoria del local" : "Agregar nueva categoria"} className="field-input flex-1 rounded-2xl px-4 py-3 text-sm outline-none transition" />
              <button type="submit" disabled={saving || newCategoryName.trim().length < 2} className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60">Guardar categoria</button>
            </form>
            {categories.length === 0 ? <div className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">Todavia no hay categorias. Carga la primera para dejar el alta de productos lista para el local.</div> : null}
          </Panel>
        </section>        {activeSection === "inventory" ? (
          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Panel title="Control de stock" description="Visualiza inventario, edita datos, busca por codigo o nombre y elimina productos obsoletos." action={<div className="flex flex-wrap gap-3"><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar por codigo, nombre o categoria" className="field-input rounded-full px-4 py-2 text-sm outline-none transition" /><button type="button" onClick={refreshAll} className="section-button section-button-idle rounded-full px-4 py-2 text-sm font-medium transition">Recargar</button></div>}>
              {loading ? <EmptyState>Cargando inventario...</EmptyState> : <InventoryTable items={filteredItems} onEdit={startEditing} onDelete={handleDelete} />}
            </Panel>
            <div className="space-y-6">
              <Panel title="Categorias disponibles" description="Quedan guardadas para reutilizarlas en cada alta de producto.">
                {categories.length === 0 ? <EmptyState>Todavia no hay categorias cargadas.</EmptyState> : categories.map((category) => <div key={category.id} className="card-surface content-default rounded-2xl px-4 py-3 text-sm">{category.name}</div>)}
              </Panel>
              <Panel title="Historial de movimientos" description="Ultimas entradas, ventas y ajustes sobre el inventario.">
                {movements.length === 0 ? <EmptyState>Todavia no hay movimientos registrados.</EmptyState> : movements.map((movement) => <MovementCard key={movement.id} movement={movement} />)}
              </Panel>
            </div>
          </section>
        ) : (
          <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-6">
              <Panel title="Caja diaria" description="Abrir la jornada, seguir el esperado de caja y cerrar con monto real.">
                {cashSummary.current_session ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <MetricCard label="Caja inicial" value={formatMoney(cashSummary.current_session.opening_amount)} />
                      <MetricCard label="Caja esperada" value={formatMoney(cashSummary.expected_cash_now)} />
                      <MetricCard label="Ventas del turno" value={cashSummary.today_sales_count} />
                      <MetricCard label="Unidades del turno" value={cashSummary.today_units_sold} />
                    </div>
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-50">Caja abierta desde {formatDateTime(cashSummary.current_session.opened_at)}.</div>
                    <form className="grid gap-4 md:grid-cols-2" onSubmit={submitCashClose}>
                      <InputField label="Monto real al cierre" name="actual_cash_amount" type="number" min="0" step="0.01" value={cashCloseForm.actual_cash_amount} onChange={handleText(setCashCloseForm)} />
                      <InputField label="Observaciones de cierre" name="notes" value={cashCloseForm.notes} onChange={handleText(setCashCloseForm)} />
                      <button type="submit" disabled={saving} className="md:col-span-2 rounded-2xl bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60">Cerrar caja</button>
                    </form>
                  </div>
                ) : (
                  <form className="grid gap-4 md:grid-cols-2" onSubmit={submitCashOpen}>
                    <InputField label="Monto inicial" name="opening_amount" type="number" min="0" step="0.01" value={cashOpenForm.opening_amount} onChange={handleText(setCashOpenForm)} />
                    <InputField label="Observaciones de apertura" name="notes" value={cashOpenForm.notes} onChange={handleText(setCashOpenForm)} />
                    <button type="submit" disabled={saving} className="md:col-span-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60">Abrir caja</button>
                  </form>
                )}
              </Panel>

              <Panel title="Registrar venta" description="Impacta stock, recaudacion y ganancias estimadas.">
                <form className="grid gap-4 md:grid-cols-2" onSubmit={submitSale}>
                  <InputField label="Codigo de barras" name="code" value={saleForm.code} onChange={handleText(setSaleForm)} />
                  <InputField label="Cantidad" name="amount" type="number" min="1" value={saleForm.amount} onChange={handleText(setSaleForm)} />
                  <InputField label="Precio unitario opcional" name="unit_price" type="number" min="0" step="0.01" value={saleForm.unit_price} onChange={handleText(setSaleForm)} />
                  <div className="flex items-end"><button type="submit" disabled={saving} className="w-full rounded-2xl bg-fuchsia-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-fuchsia-300 disabled:cursor-not-allowed disabled:opacity-60">Registrar venta</button></div>
                </form>
              </Panel>
            </div>

            <div className="space-y-6">
              <Panel title="Periodo de analisis" description="Filtra tesoreria por rango de fechas para revisar cierres y ventas.">
                <form className="grid gap-4 md:grid-cols-2" onSubmit={applyTreasuryFilter}>
                  <InputField label="Desde" name="startDate" type="date" value={treasuryFilter.startDate} onChange={handleText(setTreasuryFilter)} />
                  <InputField label="Hasta" name="endDate" type="date" value={treasuryFilter.endDate} onChange={handleText(setTreasuryFilter)} />
                  <button type="submit" disabled={saving} className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60">Aplicar filtro</button>
                  <button type="button" onClick={clearTreasuryFilter} className="section-button section-button-idle rounded-2xl px-4 py-3 text-sm font-semibold transition">Ver todo</button>
                  <button type="button" onClick={exportTreasuryCsv} disabled={saving} className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60">Descargar CSV</button>
                  <button type="button" onClick={printTreasurySummary} className="rounded-2xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/20">Imprimir resumen</button>
                </form>
                {treasuryFilterActive ? <div className="mt-4 rounded-2xl border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">Mostrando tesoreria desde {treasuryFilter.startDate ? formatDate(treasuryFilter.startDate) : "el inicio"} hasta {treasuryFilter.endDate ? formatDate(treasuryFilter.endDate) : "hoy"}.</div> : null}
              </Panel>
              <Panel title="Resumen de caja" description={treasuryFilterActive ? "Totales del periodo filtrado y detalle de jornadas." : "Vista rapida del dia y ultimos cierres de jornada."}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetricCard label={treasuryFilterActive ? "Recaudacion filtrada" : "Recaudacion del dia"} value={formatMoney(cashSummary.today_revenue)} />
                  <MetricCard label={treasuryFilterActive ? "Ganancia filtrada" : "Ganancia del dia"} value={formatMoney(cashSummary.today_profit)} />
                  <MetricCard label={treasuryFilterActive ? "Ventas filtradas" : "Ventas del dia"} value={cashSummary.today_sales_count} />
                  <MetricCard label="Caja esperada" value={formatMoney(cashSummary.expected_cash_now)} />
                </div>
                <div className="mt-5">
                  <h3 className="panel-description text-sm font-semibold uppercase tracking-[0.2em]">Jornadas registradas</h3>
                  <div className="mt-3 space-y-3">
                    {cashSummary.recent_sessions.length === 0 ? <EmptyState>No hay jornadas en ese periodo.</EmptyState> : cashSummary.recent_sessions.map((session) => <CashSessionCard key={session.id} session={session} />)}
                  </div>
                </div>
              </Panel>
              <Panel title="Reportes inteligentes" description="Lectura rapida de recaudacion, ganancia y comportamiento de ventas.">
                <div className="grid gap-4 lg:grid-cols-2">
                  <ReportList title="Productos mas vendidos" rows={reports.top_products} renderLabel={(row) => row.name} renderMeta={(row) => `${row.quantity} uds - ${formatMoney(row.revenue)}`} />
                  <ReportList title="Categorias mas vendidas" rows={reports.top_categories} renderLabel={(row) => row.category} renderMeta={(row) => `${row.quantity} uds - ${formatMoney(row.revenue)}`} />
                </div>
                <div className="soft-card mt-5 rounded-2xl p-4">
                  <h3 className="panel-description text-sm font-semibold uppercase tracking-[0.2em]">Insights</h3>
                  <div className="mt-3 space-y-2">{reports.insights.length === 0 ? <EmptyState>Sin insights todavia.</EmptyState> : reports.insights.map((insight) => <div key={insight} className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-50">{insight}</div>)}</div>
                </div>
                <div className="mt-5">
                  <h3 className="panel-description text-sm font-semibold uppercase tracking-[0.2em]">Ultimas ventas del periodo</h3>
                  <div className="mt-3 space-y-3">{reports.recent_sales.length === 0 ? <EmptyState>No hay ventas en ese periodo.</EmptyState> : reports.recent_sales.map((sale) => <RecentSaleCard key={sale.id} sale={sale} />)}</div>
                </div>
              </Panel>
            </div>
          </section>
        )}
      </div>
    </main>
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
function CashSessionCard({ session }) { const diff = Number(session.difference_amount || 0); const closed = session.closed_at ? formatDateTime(session.closed_at) : "Turno en curso"; return <div className="card-surface rounded-2xl p-4"><div className="flex items-center justify-between gap-3"><div><div className="content-strong font-medium">{session.status === "OPEN" ? "Caja abierta" : "Caja cerrada"}</div><div className="content-muted text-xs uppercase tracking-[0.18em]">Apertura: {formatDateTime(session.opened_at)}</div></div><div className={`rounded-full px-3 py-1 text-xs font-semibold ${diff < 0 ? "bg-rose-500/15 text-rose-100" : "bg-emerald-500/15 text-emerald-100"}`}>{session.status === "OPEN" ? formatMoney(session.expected_cash_amount) : `${diff >= 0 ? "+" : ""}${formatMoney(diff)}`}</div></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div className="soft-card rounded-2xl px-4 py-3"><span className="content-faint block text-xs uppercase tracking-[0.18em]">Esperado</span><span className="content-strong mt-1 block font-medium">{formatMoney(session.expected_cash_amount)}</span></div><div className="soft-card rounded-2xl px-4 py-3"><span className="content-faint block text-xs uppercase tracking-[0.18em]">Real / cierre</span><span className="content-strong mt-1 block font-medium">{session.actual_cash_amount == null ? closed : formatMoney(session.actual_cash_amount)}</span></div></div>{session.notes ? <div className="soft-card content-default mt-4 rounded-2xl px-4 py-3 text-sm">{session.notes}</div> : null}</div>; }
function ReportList({ title, rows, renderLabel, renderMeta }) { return <div className="soft-card rounded-2xl p-4"><h3 className="panel-description text-sm font-semibold uppercase tracking-[0.2em]">{title}</h3><div className="mt-3 space-y-3">{rows.length === 0 ? <EmptyState>Sin datos suficientes.</EmptyState> : rows.map((row) => <div key={renderLabel(row)} className="card-surface rounded-2xl px-4 py-3"><div className="content-strong font-medium">{renderLabel(row)}</div><div className="content-muted text-sm">{renderMeta(row)}</div></div>)}</div></div>; }
function RecentSaleCard({ sale }) { return <div className="card-surface rounded-2xl px-4 py-3"><div className="flex items-center justify-between gap-3"><div><div className="content-strong font-medium">{sale.item_name}</div><div className="content-muted text-xs uppercase tracking-[0.18em]">{sale.code} - {sale.category}</div></div><div className="text-right"><div className="text-emerald-200 font-medium">{formatMoney(sale.revenue)}</div><div className="content-muted text-xs">{sale.quantity} uds</div></div></div><div className="content-faint mt-3 text-xs uppercase tracking-[0.18em]">{formatDateTime(sale.created_at)}</div></div>; }

function handleText(setter) { return (event) => { const { name, value } = event.target; setter((current) => ({ ...current, [name]: value })); }; }
function Panel({ title, description, action, children }) { return <article className="panel-shell rounded-[28px] p-5 shadow-panel backdrop-blur"><div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="panel-title text-xl font-semibold">{title}</h2><p className="panel-description text-sm">{description}</p></div>{action}</div>{children}</article>; }
function SectionButton({ active, children, onClick }) { return <button type="button" onClick={onClick} className={`section-button rounded-full px-4 py-2 text-sm font-medium transition ${active ? "section-button-active" : "section-button-idle"}`}>{children}</button>; }
function MetricCard({ label, value, emphasis = false }) { return <div className="metric-card rounded-2xl px-4 py-4"><div className="metric-label text-xs uppercase tracking-[0.22em]">{label}</div><div className={`mt-2 text-2xl font-semibold ${emphasis ? "metric-value-emphasis" : "metric-value"}`}>{value}</div></div>; }
function StatusPanel({ message, error }) { if (!message && !error) return null; return <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${error ? "border-rose-400/30 bg-rose-500/10 text-rose-100" : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"}`}>{error || message}</div>; }
function ScannerStatus({ state }) { const states = { ready: { label: "Lector listo", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" }, processing: { label: "Procesando lectura", className: "border-sky-400/30 bg-sky-400/10 text-sky-100" }, success: { label: "Lectura confirmada", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" }, warning: { label: "Codigo nuevo", className: "border-amber-400/30 bg-amber-400/10 text-amber-100" }, error: { label: "Revisar lectura", className: "border-rose-400/30 bg-rose-400/10 text-rose-100" }, blocked: { label: "Doble lectura bloqueada", className: "border-orange-400/30 bg-orange-400/10 text-orange-100" } }; const current = states[state] ?? states.ready; return <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${current.className}`}>{current.label}</div>; }
function EmptyState({ children }) { return <div className="empty-state rounded-2xl border border-dashed px-4 py-10 text-center text-sm">{children}</div>; }
function ThemeToggle({ theme, onChange }) { return <div className="theme-toggle inline-flex items-center gap-2 rounded-full px-2 py-2">{Object.entries(availableThemes).map(([value, config]) => <button key={value} type="button" onClick={() => onChange(value)} className={`theme-pill rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${theme === value ? "theme-pill-active" : "theme-pill-idle"}`}>{config.label}</button>)}</div>; }
function InventoryTable({ items, onEdit, onDelete }) { return <div className="overflow-x-auto"><table className="inventory-table min-w-full border-separate border-spacing-y-2 text-left text-sm"><thead className="content-muted text-xs uppercase tracking-[0.2em]"><tr><th className="px-3 py-2">Codigo</th><th className="px-3 py-2">Producto</th><th className="px-3 py-2">Categoria</th><th className="px-3 py-2">Stock</th><th className="px-3 py-2">Venta</th><th className="px-3 py-2">Costo</th><th className="px-3 py-2">Acciones</th></tr></thead><tbody>{items.map((item) => { const isLow = item.quantity <= item.min_quantity; return <tr key={item.id} className="inventory-row"><td className="inventory-code rounded-l-2xl px-3 py-3 font-mono text-xs">{item.code}</td><td className="content-strong px-3 py-3 font-medium">{item.name}</td><td className="content-default px-3 py-3">{item.category}</td><td className="px-3 py-3"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${isLow ? "bg-rose-500/15 text-rose-200" : "bg-emerald-500/15 text-emerald-200"}`}>{item.quantity} / min {item.min_quantity}</span></td><td className="content-default px-3 py-3">{formatMoney(item.sale_price)}</td><td className="content-default px-3 py-3">{formatMoney(item.cost_price)}</td><td className="rounded-r-2xl px-3 py-3"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => onEdit(item)} className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-100 transition hover:bg-sky-500/20">Editar</button><button type="button" onClick={() => onDelete(item)} className="rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-100 transition hover:bg-rose-500/20">Eliminar</button></div></td></tr>; })}</tbody></table></div>; }
function MovementCard({ movement }) { const isOut = movement.quantity_delta < 0; return <div className="card-surface rounded-2xl p-4"><div className="flex items-center justify-between gap-3"><div><div className="content-strong font-medium">{movement.item_name}</div><div className="content-muted text-xs uppercase tracking-[0.18em]">{movement.movement_type} - {movement.reference}</div></div><div className={`rounded-full px-3 py-1 text-xs font-semibold ${isOut ? "bg-rose-500/15 text-rose-100" : "bg-emerald-500/15 text-emerald-100"}`}>{isOut ? movement.quantity_delta : `+${movement.quantity_delta}`}</div></div></div>; }
function CategorySelect({ label, value, categories, onChange }) { return <label className="block"><span className="field-label mb-2 block text-sm font-medium">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition">{categories.length === 0 ? <option value="General">General</option> : categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select></label>; }
const InputField = forwardRef(function InputField({ label, ...props }, ref) { return <label className="block"><span className="field-label mb-2 block text-sm font-medium">{label}</span><input ref={ref} {...props} className="field-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition" /></label>; });

export default App;



















