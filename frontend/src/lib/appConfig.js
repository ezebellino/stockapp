export const emptyProductForm = { code: "", name: "", category: "General", quantity: 0, min_quantity: 0, sale_price: 0, cost_price: 0 };
export const emptySaleForm = { code: "", amount: 1, unit_price: "", payment_method: "Efectivo" };
export const emptyCashOpenForm = { opening_amount: "", notes: "" };
export const emptyCashCloseForm = { actual_cash_amount: "", notes: "" };
export const emptyCashMovementForm = { movement_type: "EXPENSE", amount: "", concept: "", notes: "" };
export const emptyTreasuryFilter = { startDate: "", endDate: "" };
export const emptyBusinessProfile = { businessName: "", businessAddress: "", businessWhatsapp: "", businessTaxId: "", businessLogoDataUrl: "" };
export const emptyAccessSetup = { ...emptyBusinessProfile, userName: "", password: "", confirmPassword: "" };
export const emptyLoginForm = { userName: "", password: "" };
export const emptyScaleConfig = { enabled: false, provider: "mock", connection_type: "manual", port: "", baudrate: 9600, host: "", tcp_port: 0, unit: "kg", timeout_ms: 1200, stable_read_count: 2, simulated_weight: 1.25 };
export const scaleProviderOptions = ["mock", "serial"];
export const scaleConnectionOptions = ["manual", "serial", "hid", "tcp", "bluetooth"];
export const scaleUnitOptions = ["kg", "g"];

export const availableThemes = {
  dark: { label: "Oscuro", modeLabel: "Operación nocturna", summary: "Vista intensa para uso continuo y contraste alto." },
  sepia: { label: "Claro sepia", modeLabel: "Operación cálida", summary: "Una variante amable y luminosa para jornadas largas." },
  enterprise: { label: "Empresarial", modeLabel: "Editorial ejecutivo", summary: "Preset inspirado en Stitch para dirección, métricas y lectura institucional." },
};

export const navItems = [
  { id: "home", label: "Ventas", short: "VT", icon: "sales" },
  { id: "inventory", label: "Inventario", short: "IV", icon: "inventory" },
  { id: "treasury", label: "Tesorería privada", short: "TP", icon: "treasury" },
];

export const scanLockMs = 1200;
export const accessStorageKey = "appstock-local-access";
export const sessionStorageKey = "appstock-session-open";
export const activeSectionStorageKey = "appstock-active-section";
export const sidebarCollapsedStorageKey = "appstock-sidebar-collapsed";
export const guidedTourEnabledStorageKey = "appstock-guided-tour-enabled";
export const guidedTourSeenStorageKey = "appstock-guided-tour-seen";
export const paymentMethodOptions = ["Efectivo", "Débito", "Crédito", "Transferencia", "Mercado Pago", "Otro"];
