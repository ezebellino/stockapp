const clampNumber = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

export const ticketPrinterProfiles = [
  {
    id: "gadnic-it1050",
    label: "GADNIC IT1050 - térmica 80 mm",
    paperWidthMm: 80,
    horizontalPaddingMm: 4,
    verticalPaddingMm: 5,
    fontSizePx: 10,
    logoMaxWidthMm: 24,
    logoMaxHeightMm: 16,
  },
  {
    id: "thermal-80mm",
    label: "Térmica genérica 80 mm",
    paperWidthMm: 80,
    horizontalPaddingMm: 5,
    verticalPaddingMm: 6,
    fontSizePx: 10,
    logoMaxWidthMm: 24,
    logoMaxHeightMm: 16,
  },
  {
    id: "thermal-58mm",
    label: "Térmica compacta 58 mm",
    paperWidthMm: 58,
    horizontalPaddingMm: 3,
    verticalPaddingMm: 4,
    fontSizePx: 9,
    logoMaxWidthMm: 18,
    logoMaxHeightMm: 12,
  },
];

export const defaultTicketPrinterConfig = {
  ...ticketPrinterProfiles[0],
  profileId: ticketPrinterProfiles[0].id,
};

export function normalizeTicketPrinterConfig(rawConfig) {
  const rawProfileId = String(rawConfig?.profileId || rawConfig?.id || defaultTicketPrinterConfig.profileId);
  const profile = ticketPrinterProfiles.find((item) => item.id === rawProfileId);
  if (!profile && rawProfileId !== "custom") return defaultTicketPrinterConfig;

  const base = profile ?? defaultTicketPrinterConfig;
  return {
    ...base,
    profileId: profile?.id ?? "custom",
    id: profile?.id ?? "custom",
    label: profile?.label ?? "Personalizada",
    paperWidthMm: clampNumber(rawConfig?.paperWidthMm, base.paperWidthMm, 48, 90),
    horizontalPaddingMm: clampNumber(rawConfig?.horizontalPaddingMm, base.horizontalPaddingMm, 0, 12),
    verticalPaddingMm: clampNumber(rawConfig?.verticalPaddingMm, base.verticalPaddingMm, 0, 16),
    fontSizePx: clampNumber(rawConfig?.fontSizePx, base.fontSizePx, 8, 14),
    logoMaxWidthMm: clampNumber(rawConfig?.logoMaxWidthMm, base.logoMaxWidthMm, 0, 35),
    logoMaxHeightMm: clampNumber(rawConfig?.logoMaxHeightMm, base.logoMaxHeightMm, 0, 25),
  };
}

export function applyTicketPrinterProfile(profileId) {
  const profile = ticketPrinterProfiles.find((item) => item.id === profileId);
  return normalizeTicketPrinterConfig(profile ?? defaultTicketPrinterConfig);
}

export function buildTicketPrintCss(config) {
  const printer = normalizeTicketPrinterConfig(config);
  const lineFontSize = printer.fontSizePx;
  const productFontSize = Math.max(lineFontSize + 3, 11);
  const titleFontSize = Math.max(lineFontSize + 8, 16);
  const totalFontSize = Math.max(lineFontSize + 6, 14);

  return `
  @page { size: ${printer.paperWidthMm}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: #111827; font-family: Arial, "Segoe UI", sans-serif; font-size: ${lineFontSize}px; }
  .sheet { width: ${printer.paperWidthMm}mm; min-height: 100vh; margin: 0 auto; background: #fff; padding: ${printer.verticalPaddingMm}mm ${printer.horizontalPaddingMm}mm ${printer.verticalPaddingMm}mm; }
  .top { text-align: center; border-bottom: 1px dashed #555; padding-bottom: 8px; }
  .logo-wrap { display: flex; justify-content: center; margin-bottom: 8px; }
  .logo { max-width: ${printer.logoMaxWidthMm}mm; max-height: ${printer.logoMaxHeightMm}mm; object-fit: contain; }
  .eyebrow { font-size: ${Math.max(lineFontSize - 1, 8)}px; letter-spacing: 0.12em; text-transform: uppercase; color: #374151; }
  h1 { margin: 5px 0 3px; font-size: ${titleFontSize}px; line-height: 1.12; }
  .meta { color: #374151; font-size: ${Math.max(lineFontSize - 1, 8)}px; line-height: 1.35; }
  .section { margin-top: 10px; }
  .row { display: flex; justify-content: space-between; gap: 8px; padding: 3px 0; font-size: ${lineFontSize}px; }
  .row.compact { padding: 1px 0 0; }
  .label { color: #374151; }
  .value { font-weight: 700; text-align: right; }
  .lines { margin-top: 10px; border-top: 1px dashed #555; border-bottom: 1px dashed #555; padding: 8px 0; }
  .line-item + .line-item { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #999; }
  .line-head { display: flex; justify-content: space-between; gap: 8px; }
  .product-name { font-size: ${productFontSize}px; font-weight: 700; line-height: 1.2; }
  .product-meta { margin-top: 3px; color: #4b5563; font-size: ${Math.max(lineFontSize - 2, 8)}px; text-transform: uppercase; }
  .totals { margin-top: 10px; padding-top: 8px; border-top: 1px dashed #555; }
  .total-strong { font-size: ${totalFontSize}px; font-weight: 700; }
  .foot { margin-top: 10px; padding-top: 8px; border-top: 1px dashed #555; text-align: center; }
  .foot strong { display: block; margin-bottom: 4px; font-size: ${Math.max(lineFontSize + 1, 10)}px; }
  .foot small { color: #374151; font-size: ${Math.max(lineFontSize - 1, 8)}px; line-height: 1.35; }
`;
}
