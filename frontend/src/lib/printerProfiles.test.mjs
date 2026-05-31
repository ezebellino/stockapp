import assert from "node:assert/strict";

import {
  defaultTicketPrinterConfig,
  normalizeTicketPrinterConfig,
  buildTicketPrintCss,
} from "./printerProfiles.js";

const gadnicConfig = normalizeTicketPrinterConfig({ profileId: "gadnic-it1050" });

assert.equal(gadnicConfig.profileId, "gadnic-it1050");
assert.equal(gadnicConfig.paperWidthMm, 80);
assert.equal(gadnicConfig.horizontalPaddingMm, 4);
assert.equal(gadnicConfig.fontSizePx, 10);

const css = buildTicketPrintCss(gadnicConfig);
assert.match(css, /@page \{ size: 80mm auto; margin: 0; \}/);
assert.match(css, /\.sheet \{ width: 80mm;/);
assert.match(css, /padding: 5mm 4mm 5mm;/);

const customConfig = normalizeTicketPrinterConfig({
  profileId: "custom",
  paperWidthMm: 58,
  horizontalPaddingMm: 3,
  verticalPaddingMm: 4,
  fontSizePx: 9,
});
assert.equal(customConfig.profileId, "custom");
assert.equal(customConfig.paperWidthMm, 58);
assert.match(buildTicketPrintCss(customConfig), /@page \{ size: 58mm auto; margin: 0; \}/);

const invalidConfig = normalizeTicketPrinterConfig({
  profileId: "missing-profile",
  paperWidthMm: 15,
  horizontalPaddingMm: -2,
  fontSizePx: 30,
});
assert.deepEqual(invalidConfig, defaultTicketPrinterConfig);
