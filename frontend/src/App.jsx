import { forwardRef, useEffect, useRef, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8001/api";
const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
const emptyProductForm = { code: "", name: "", category: "General", quantity: 0, min_quantity: 0, sale_price: 0, cost_price: 0 };
const emptySaleForm = { code: "", amount: 1, unit_price: "" };

function App() {
  const [items, setItems] = useState([]);
  const [reports, setReports] = useState(createEmptyReports());
  const [movements, setMovements] = useState([]);
  const [activeSection, setActiveSection] = useState("inventory");
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [saleForm, setSaleForm] = useState(emptySaleForm);
  const [scanCode, setScanCode] = useState("");
  const [scanAmount, setScanAmount] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [scanCandidate, setScanCandidate] = useState(null);
  const [message, setMessage] = useState("Sistema listo para operar stock, ventas y reportes.");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const scanInputRef = useRef(null);

  useEffect(() => {
    refreshAll();
  }, []);

  async function refreshAll() {
    setLoading(true);
    setError("");
    try {
      const [itemsResponse, reportsResponse, movementsResponse] = await Promise.all([
        fetch(`${API_URL}/items`),
        fetch(`${API_URL}/reports/summary`),
        fetch(`${API_URL}/movements?limit=12`),
      ]);
      if (!itemsResponse.ok || !reportsResponse.ok || !movementsResponse.ok) throw new Error("No se pudieron cargar los datos principales.");
      const [itemsData, reportsData, movementsData] = await Promise.all([itemsResponse.json(), reportsResponse.json(), movementsResponse.json()]);
      setItems([...itemsData].sort((a, b) => a.name.localeCompare(b.name)));
      setReports(reportsData);
      setMovements(movementsData);
    } catch (err) {
      setError(err.message);
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
      resetProductEditor();
      await refreshAll();
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
      await refreshAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitScan(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setScanCandidate(null);
    try {
      const response = await fetch(`${API_URL}/items/${scanCode}/scan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: Number(scanAmount) }) });
      if (response.status === 404) {
        const nextProduct = { ...emptyProductForm, code: scanCode, quantity: Number(scanAmount) };
        setScanCandidate(nextProduct);
        setProductForm(nextProduct);
        setEditingId(null);
        setActiveSection("inventory");
        setMessage("Codigo no encontrado. Completa el alta rapida para crear el producto.");
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "No se pudo registrar el ingreso.");
      setScanCode("");
      setScanAmount(1);
      setMessage(`Ingreso registrado para ${data.name}. Stock actual: ${data.quantity}.`);
      scanInputRef.current?.focus();
      await refreshAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
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
    } catch (err) {
      setError(err.message);
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
    setProductForm(emptyProductForm);
  }

  const lowStockItems = items.filter((item) => item.quantity <= item.min_quantity);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.22),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.14),_transparent_22%),#020617] px-4 py-6 text-slate-100 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[30px] border border-white/10 bg-slate-900/75 shadow-panel backdrop-blur">
          <div className="grid gap-6 px-6 py-7 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              <span className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">AppStock local</span>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-white sm:text-5xl">Stock, ventas, tesoreria y trazabilidad en una sola cabina.</h1>
                <p className="max-w-3xl text-sm text-slate-300 sm:text-base">Ahora tambien ves el historial de movimientos para seguir entradas, ventas y ajustes sobre cada producto.</p>
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
          <Panel title="Ingreso por escaner" description="Si el codigo no existe, se habilita alta rapida con ese codigo ya cargado." action={<button type="button" onClick={() => scanInputRef.current?.focus()} className="rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-200 transition hover:bg-sky-500/20">Enfocar</button>}>
            <form className="space-y-4" onSubmit={submitScan}>
              <InputField ref={scanInputRef} label="Codigo escaneado" name="scanCode" value={scanCode} onChange={(event) => setScanCode(event.target.value)} placeholder="Escanea o escribe el codigo" />
              <InputField label="Cantidad a ingresar" name="scanAmount" type="number" min="1" value={scanAmount} onChange={(event) => setScanAmount(event.target.value)} />
              <button type="submit" disabled={saving} className="w-full rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60">Registrar ingreso</button>
            </form>
            <StatusPanel message={message} error={error} />
            {scanCandidate ? <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">Codigo nuevo detectado: {scanCandidate.code}. Completa el formulario y guardalo.</div> : null}
          </Panel>

          <Panel title={editingId ? "Editar producto" : "Alta manual de producto"} description="Crea, corrige o completa productos sin salir de la pantalla principal." action={(editingId || scanCandidate) ? <button type="button" onClick={resetProductEditor} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10">Limpiar</button> : null}>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={submitProduct}>
              <InputField label="Codigo de barras" name="code" value={productForm.code} onChange={handleText(setProductForm)} />
              <InputField label="Nombre" name="name" value={productForm.name} onChange={handleText(setProductForm)} />
              <InputField label="Categoria" name="category" value={productForm.category} onChange={handleText(setProductForm)} />
              <InputField label="Stock actual" name="quantity" type="number" min="0" value={productForm.quantity} onChange={handleText(setProductForm)} />
              <InputField label="Stock minimo" name="min_quantity" type="number" min="0" value={productForm.min_quantity} onChange={handleText(setProductForm)} />
              <InputField label="Precio de venta" name="sale_price" type="number" min="0" step="0.01" value={productForm.sale_price} onChange={handleText(setProductForm)} />
              <InputField label="Costo" name="cost_price" type="number" min="0" step="0.01" value={productForm.cost_price} onChange={handleText(setProductForm)} />
              <button type="submit" disabled={saving} className="md:col-span-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60">{editingId ? "Actualizar producto" : "Guardar producto"}</button>
            </form>
          </Panel>
        </section>

        {activeSection === "inventory" ? (
          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Panel title="Control de stock" description="Visualiza inventario, edita datos y elimina productos obsoletos." action={<button type="button" onClick={refreshAll} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10">Recargar</button>}>
              {loading ? <EmptyState>Cargando inventario...</EmptyState> : <InventoryTable items={items} onEdit={startEditing} onDelete={handleDelete} />}
            </Panel>
            <div className="space-y-6">
              <Panel title="Zona de reposicion" description="Productos en o por debajo de su stock minimo.">
                {lowStockItems.length === 0 ? <EmptyState>No hay productos en stock bajo.</EmptyState> : lowStockItems.map((item) => <LowStockCard key={item.id} item={item} />)}
              </Panel>
              <Panel title="Historial de movimientos" description="Ultimas entradas, ventas y ajustes sobre el inventario.">
                {movements.length === 0 ? <EmptyState>Todavia no hay movimientos registrados.</EmptyState> : movements.map((movement) => <MovementCard key={movement.id} movement={movement} />)}
              </Panel>
            </div>
          </section>
        ) : (
          <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Panel title="Registrar venta" description="Impacta stock, recaudacion y ganancias estimadas.">
              <form className="grid gap-4 md:grid-cols-2" onSubmit={submitSale}>
                <InputField label="Codigo de barras" name="code" value={saleForm.code} onChange={handleText(setSaleForm)} />
                <InputField label="Cantidad" name="amount" type="number" min="1" value={saleForm.amount} onChange={handleText(setSaleForm)} />
                <InputField label="Precio unitario opcional" name="unit_price" type="number" min="0" step="0.01" value={saleForm.unit_price} onChange={handleText(setSaleForm)} />
                <div className="flex items-end"><button type="submit" disabled={saving} className="w-full rounded-2xl bg-fuchsia-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-fuchsia-300 disabled:cursor-not-allowed disabled:opacity-60">Registrar venta</button></div>
              </form>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <MetricCard label="Ventas registradas" value={reports.total_sales_count} />
                <MetricCard label="Valor stock a costo" value={formatMoney(reports.inventory_cost_value)} />
                <MetricCard label="Valor stock a venta" value={formatMoney(reports.inventory_sale_value)} />
                <MetricCard label="Productos activos" value={reports.total_products} />
              </div>
              <div className="mt-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Ultimos movimientos</h3>
                <div className="mt-3 space-y-3">{movements.length === 0 ? <EmptyState>Todavia no hay movimientos registrados.</EmptyState> : movements.slice(0, 6).map((movement) => <MovementCard key={movement.id} movement={movement} />)}</div>
              </div>
            </Panel>
            <Panel title="Reportes inteligentes" description="Lectura rapida de recaudacion, ganancia y comportamiento de ventas.">
              <div className="grid gap-4 lg:grid-cols-2">
                <ReportList title="Productos mas vendidos" rows={reports.top_products} renderLabel={(row) => row.name} renderMeta={(row) => `${row.quantity} uds · ${formatMoney(row.revenue)}`} />
                <ReportList title="Categorias mas vendidas" rows={reports.top_categories} renderLabel={(row) => row.category} renderMeta={(row) => `${row.quantity} uds · ${formatMoney(row.revenue)}`} />
              </div>
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Insights</h3>
                <div className="mt-3 space-y-2">{reports.insights.map((insight) => <div key={insight} className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-50">{insight}</div>)}</div>
              </div>
              <div className="mt-5">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Ultimas ventas</h3>
                <div className="mt-3 space-y-3">{reports.recent_sales.length === 0 ? <EmptyState>Todavia no hay ventas registradas.</EmptyState> : reports.recent_sales.map((sale) => <SaleCard key={sale.id} sale={sale} />)}</div>
              </div>
            </Panel>
          </section>
        )}
      </div>
    </main>
  );
}

function createEmptyReports() { return { total_products: 0, total_units: 0, low_stock_count: 0, inventory_cost_value: 0, inventory_sale_value: 0, total_revenue: 0, total_profit: 0, total_sales_count: 0, total_units_sold: 0, top_products: [], top_categories: [], recent_sales: [], insights: ["Todavia no hay datos suficientes para generar insights."] }; }
function normalizeProductForm(form) { return { code: String(form.code).trim(), name: String(form.name).trim(), category: String(form.category).trim() || "General", quantity: Number(form.quantity), min_quantity: Number(form.min_quantity), sale_price: Number(form.sale_price), cost_price: Number(form.cost_price) }; }
function formatMoney(value) { return money.format(Number(value || 0)); }
function handleText(setter) { return (event) => { const { name, value } = event.target; setter((current) => ({ ...current, [name]: value })); }; }

function Panel({ title, description, action, children }) { return <article className="rounded-[28px] border border-white/10 bg-slate-900/75 p-5 shadow-panel backdrop-blur"><div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold text-white">{title}</h2><p className="text-sm text-slate-400">{description}</p></div>{action}</div>{children}</article>; }
function SectionButton({ active, children, onClick }) { return <button type="button" onClick={onClick} className={`rounded-full px-4 py-2 text-sm font-medium transition ${active ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"}`}>{children}</button>; }
function MetricCard({ label, value, emphasis = false }) { return <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"><div className="text-xs uppercase tracking-[0.22em] text-slate-400">{label}</div><div className={`mt-2 text-2xl font-semibold ${emphasis ? "text-rose-300" : "text-white"}`}>{value}</div></div>; }
function StatusPanel({ message, error }) { if (!message && !error) return null; return <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${error ? "border-rose-400/30 bg-rose-500/10 text-rose-100" : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"}`}>{error || message}</div>; }
function EmptyState({ children }) { return <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-400">{children}</div>; }
function InventoryTable({ items, onEdit, onDelete }) { return <div className="overflow-x-auto"><table className="min-w-full border-separate border-spacing-y-2 text-left text-sm"><thead className="text-xs uppercase tracking-[0.2em] text-slate-400"><tr><th className="px-3 py-2">Codigo</th><th className="px-3 py-2">Producto</th><th className="px-3 py-2">Categoria</th><th className="px-3 py-2">Stock</th><th className="px-3 py-2">Venta</th><th className="px-3 py-2">Costo</th><th className="px-3 py-2">Acciones</th></tr></thead><tbody>{items.map((item) => { const isLow = item.quantity <= item.min_quantity; return <tr key={item.id} className="bg-slate-950/75 text-slate-200"><td className="rounded-l-2xl px-3 py-3 font-mono text-xs text-sky-200">{item.code}</td><td className="px-3 py-3 font-medium text-white">{item.name}</td><td className="px-3 py-3">{item.category}</td><td className="px-3 py-3"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${isLow ? "bg-rose-500/15 text-rose-200" : "bg-emerald-500/15 text-emerald-200"}`}>{item.quantity} / min {item.min_quantity}</span></td><td className="px-3 py-3">{formatMoney(item.sale_price)}</td><td className="px-3 py-3">{formatMoney(item.cost_price)}</td><td className="rounded-r-2xl px-3 py-3"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => onEdit(item)} className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-100 transition hover:bg-sky-500/20">Editar</button><button type="button" onClick={() => onDelete(item)} className="rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-100 transition hover:bg-rose-500/20">Eliminar</button></div></td></tr>; })}</tbody></table></div>; }
function LowStockCard({ item }) { return <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4"><div className="flex items-center justify-between gap-3"><div><div className="font-medium text-white">{item.name}</div><div className="text-xs uppercase tracking-[0.2em] text-rose-100">{item.category}</div></div><div className="text-right text-sm text-rose-50"><div>Actual: {item.quantity}</div><div>Minimo: {item.min_quantity}</div></div></div></div>; }
function MovementCard({ movement }) { const isOut = movement.quantity_delta < 0; return <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"><div className="flex items-center justify-between gap-3"><div><div className="font-medium text-white">{movement.item_name}</div><div className="text-xs uppercase tracking-[0.18em] text-slate-400">{movement.movement_type} · {movement.reference}</div></div><div className={`rounded-full px-3 py-1 text-xs font-semibold ${isOut ? "bg-rose-500/15 text-rose-100" : "bg-emerald-500/15 text-emerald-100"}`}>{isOut ? movement.quantity_delta : `+${movement.quantity_delta}`}</div></div></div>; }
function ReportList({ title, rows, renderLabel, renderMeta }) { return <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">{title}</h3><div className="mt-3 space-y-3">{rows.length === 0 ? <EmptyState>Sin datos suficientes.</EmptyState> : rows.map((row) => <div key={renderLabel(row)} className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3"><div className="font-medium text-white">{renderLabel(row)}</div><div className="text-sm text-slate-400">{renderMeta(row)}</div></div>)}</div></div>; }
function SaleCard({ sale }) { return <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"><div className="flex items-center justify-between gap-3"><div><div className="font-medium text-white">{sale.item_name}</div><div className="text-xs uppercase tracking-[0.18em] text-slate-400">{sale.category}</div></div><div className="text-right text-sm text-slate-200"><div>{sale.quantity} uds</div><div>{formatMoney(sale.revenue)}</div></div></div></div>; }
const InputField = forwardRef(function InputField({ label, ...props }, ref) { return <label className="block"><span className="mb-2 block text-sm font-medium text-slate-200">{label}</span><input ref={ref} {...props} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20" /></label>; });

export default App;
