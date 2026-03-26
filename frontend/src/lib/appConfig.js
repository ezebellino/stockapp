export const emptyProductForm = { code: "", name: "", category: "General", quantity: 0, min_quantity: 0, sale_price: 0, cost_price: 0 };
export const emptySaleForm = { code: "", amount: 1, unit_price: "" };
export const emptyCashOpenForm = { opening_amount: "", notes: "" };
export const emptyCashCloseForm = { actual_cash_amount: "", notes: "" };
export const emptyTreasuryFilter = { startDate: "", endDate: "" };
export const emptyBusinessProfile = { businessName: "", businessAddress: "", businessWhatsapp: "", businessTaxId: "", businessLogoDataUrl: "" };
export const emptyAccessSetup = { ...emptyBusinessProfile, userName: "", password: "", confirmPassword: "" };
export const emptyLoginForm = { userName: "", password: "" };

export const availableThemes = {
  dark: { label: "Oscuro", modeLabel: "Operacion nocturna", summary: "Vista intensa para uso continuo y contraste alto." },
  sepia: { label: "Claro sepia", modeLabel: "Operacion calida", summary: "Una variante amable y luminosa para jornadas largas." },
  enterprise: { label: "Empresarial", modeLabel: "Editorial ejecutivo", summary: "Preset inspirado en Stitch para direccion, metricas y lectura institucional." },
};

export const navItems = [
  { id: "home", label: "Inicio", short: "IN" },
  { id: "inventory", label: "Inventario", short: "IV" },
  { id: "treasury", label: "Tesorería", short: "TS" },
];

export const scanLockMs = 1200;
export const accessStorageKey = "appstock-local-access";
export const sessionStorageKey = "appstock-session-open";
export const activeSectionStorageKey = "appstock-active-section";
export const sidebarCollapsedStorageKey = "appstock-sidebar-collapsed";
