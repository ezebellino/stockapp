import { emptyTreasuryFilter } from "./appConfig";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

export function createEmptyReports() { return { total_products: 0, total_units: 0, low_stock_count: 0, inventory_cost_value: 0, inventory_sale_value: 0, total_revenue: 0, total_profit: 0, total_sales_count: 0, total_units_sold: 0, top_products: [], top_categories: [], recent_sales: [], insights: [] }; }
export function createEmptyCashSummary() { return { current_session: null, today_revenue: 0, today_profit: 0, today_sales_count: 0, today_units_sold: 0, expected_cash_now: 0, recent_sessions: [] }; }
export function normalizeProductForm(form) { return { code: String(form.code).trim(), name: String(form.name).trim(), category: String(form.category).trim() || "General", quantity: Number(form.quantity), min_quantity: Number(form.min_quantity), sale_price: Number(form.sale_price), cost_price: Number(form.cost_price) }; }
export function formatMoney(value) { return money.format(Number(value || 0)); }
export function formatInteger(value) { return integer.format(Number(value || 0)); }
export function formatDate(value) { return new Date(`${value}T00:00:00`).toLocaleDateString("es-AR"); }
export function formatDateTime(value) { const parsed = parseAppDateTime(value); return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString("es-AR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }); }
export function buildDateQuery(filter) { const params = new URLSearchParams(); if (filter.startDate) params.set("start_date", filter.startDate); if (filter.endDate) params.set("end_date", filter.endDate); const query = params.toString(); return query ? `?${query}` : ""; }
export function buildTreasuryPresetFilter(preset) { const today = new Date(); const endDate = toDateInputValue(today); if (preset === "all") return { ...emptyTreasuryFilter }; if (preset === "month") return { startDate: toDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)), endDate }; const days = preset === "30d" ? 29 : 6; const start = new Date(today); start.setDate(today.getDate() - days); return { startDate: toDateInputValue(start), endDate }; }
export function toDateInputValue(value) { const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 10); }
export function escapeHtml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#39;"); }
export function readLocalJson(key) { try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; } }
export function buildBusinessProfileForm(config) { return { businessName: config?.businessName || "", businessAddress: config?.businessAddress || "", businessWhatsapp: config?.businessWhatsapp || "", businessTaxId: config?.businessTaxId || "", businessLogoDataUrl: config?.businessLogoDataUrl || "" }; }
export function parseAppDateTime(value) { const raw = String(value || "").trim(); if (!raw) return new Date(NaN); const localMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/); if (localMatch) { const [, year, month, day, hour, minute, second = "00"] = localMatch; return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)); } return new Date(raw); }
export function buildInitials(value) { return String(value).split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "AL"; }
export function sectionEyebrow(section) { return ({ home: "Visión general", inventory: "Gestión de inventario", treasury: "Finanzas y operaciones" })[section] ?? "Sistema local"; }
export function sectionTitle(section, branchName) { return ({ home: `Bienvenido, ${branchName}`, inventory: "Gestión de inventario", treasury: "Control de caja y reportes" })[section] ?? branchName; }
export function sectionDescription(section) { return ({ home: "Un inicio claro para revisar caja, inventario y alertas del local.", inventory: "Control total sobre existencias, costos, márgenes y altas por escáner.", treasury: "Seguimiento de caja diaria, ventas, cierres y reportes exportables." })[section] ?? "Panel principal"; }
export function handleText(setter) { return (event) => { const { name, value } = event.target; setter((current) => ({ ...current, [name]: value })); }; }
export function normalizeText(value) { return String(value || "").normalize("NFD").replace(/[^\S\r\n]+/g, " ").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase(); }
