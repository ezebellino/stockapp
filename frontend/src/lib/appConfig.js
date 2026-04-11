const storageVersion = "v2";

export const emptyProductForm = {
  code: "",
  name: "",
  category: "General",
  provider: "",
  quantity: 0,
  min_quantity: 0,
  sale_price: 0,
  cost_price: 0,
  pricing_mode: "manual",
  markup_percentage: "",
};

export const emptySaleForm = {
  code: "",
  amount: 1,
  unit_price: "",
  payment_method: "Efectivo",
  credit_bank_name: "",
};

export const emptyCashOpenForm = { opening_amount: "", notes: "" };
export const emptyCashCloseForm = { actual_cash_amount: "", notes: "" };
export const emptyCashMovementForm = { movement_type: "EXPENSE", amount: "", concept: "", notes: "" };
export const emptyBankRateForm = { name: "", rate_percentage: "" };
export const emptyTreasuryFilter = { startDate: "", endDate: "" };
export const emptyBusinessProfile = { businessName: "", businessAddress: "", businessWhatsapp: "", businessTaxId: "", businessLogoDataUrl: "" };
export const emptyAccessSetup = { ...emptyBusinessProfile, userName: "", password: "", confirmPassword: "" };
export const emptyLoginForm = { userName: "", password: "" };
export const emptyScaleConfig = { enabled: false, provider: "mock", connection_type: "manual", port: "", baudrate: 9600, host: "", tcp_port: 0, unit: "kg", timeout_ms: 1200, stable_read_count: 2, simulated_weight: 1.25 };
export const scaleProviderOptions = ["mock", "serial"];
export const scaleConnectionOptions = ["manual", "serial", "hid", "tcp", "bluetooth"];
export const scaleUnitOptions = ["kg", "g"];

export const availableThemes = {
  dark: { label: "Oscuro", modeLabel: "Operacion nocturna", summary: "Vista intensa para uso continuo y contraste alto." },
  sepia: { label: "Claro sepia", modeLabel: "Operacion calida", summary: "Una variante amable y luminosa para jornadas largas." },
  enterprise: { label: "Empresarial", modeLabel: "Editorial ejecutivo", summary: "Preset inspirado en Stitch para direccion, metricas y lectura institucional." },
};

export const navItems = [
  { id: "home", label: "Ventas", short: "VT", icon: "sales" },
  { id: "inventory", label: "Inventario", short: "IV", icon: "inventory" },
  { id: "treasury", label: "Tesoreria privada", short: "TP", icon: "treasury" },
];

export const scanLockMs = 1200;
export const accessStorageKey = `appstock-local-access-${storageVersion}`;
export const sessionStorageKey = `appstock-session-open-${storageVersion}`;
export const activeSectionStorageKey = `appstock-active-section-${storageVersion}`;
export const sidebarCollapsedStorageKey = `appstock-sidebar-collapsed-${storageVersion}`;
export const guidedTourEnabledStorageKey = `appstock-guided-tour-enabled-${storageVersion}`;
export const guidedTourSeenStorageKey = `appstock-guided-tour-seen-${storageVersion}`;
export const paymentMethodOptions = ["Efectivo", "Debito", "Credito", "Transferencia", "Mercado Pago", "Otro"];
