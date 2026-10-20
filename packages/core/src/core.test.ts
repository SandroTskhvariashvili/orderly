import { describe, expect, it } from "vitest";
import { checkDeliveryDate, earliestShipDate, nextDeliveryDate } from "./calendar.ts";
import { mask, toOriginalOffset } from "./mask.ts";
import { normalize, searchCatalog } from "./search.ts";
import type { Product } from "./schema.ts";

describe("calendar", () => {
  // Monday 12 Oct 2026, CEST (+02:00)
  it("ships next day before the 14:00 cutoff", () => {
    expect(earliestShipDate("2026-10-12T13:59:00+02:00")).toBe("2026-10-13");
  });
  it("ships the day after next from the cutoff on", () => {
    expect(earliestShipDate("2026-10-12T14:00:00+02:00")).toBe("2026-10-14");
  });
  it("lands on the customer's next delivery day", () => {
    expect(nextDeliveryDate("2026-10-12T09:00:00+02:00", ["Thu"])).toBe("2026-10-15");
    expect(nextDeliveryDate("2026-10-16T16:00:00+02:00", ["Mon", "Tue"])).toBe("2026-10-19");
  });
  it("rejects a day the customer has no delivery", () => {
    expect(checkDeliveryDate("2026-10-14", "2026-10-12T09:00:00+02:00", ["Tue", "Thu"])).toMatchObject({
      ok: false,
      why: "not_a_delivery_day",
    });
  });
  it("rejects same-day delivery", () => {
    expect(checkDeliveryDate("2026-10-12", "2026-10-12T08:00:00+02:00", ["Mon"])).toMatchObject({ ok: false, why: "too_soon" });
  });
});

describe("mask", () => {
  const text = "Call me on +31 6 2345 6789 or mail anna@example.org.\nIBAN NL91 ABNA 0417 1643 00\nKeizersgracht 112, 1015 CW Amsterdam\n2 cases oat milk";

  it("replaces contact details with stable tokens", () => {
    const m = mask(text);
    expect(m.text).toContain("[PHONE_1]");
    expect(m.text).toContain("[EMAIL_1]");
    expect(m.text).toContain("[IBAN_1]");
    expect(m.text).toContain("[ADDRESS_1]");
    expect(m.text).not.toMatch(/anna@|6789|ABNA|Keizersgracht 112/);
  });

  it("leaves order content alone", () => {
    expect(mask(text).text).toContain("2 cases oat milk");
    expect(mask("12x 750ml vanilla, 3 cases 8oz cups").spans).toHaveLength(0);
  });

  it("reuses the token for a repeated value", () => {
    const m = mask("anna@example.org ... anna@example.org");
    expect(m.text).toBe("[EMAIL_1] ... [EMAIL_1]");
  });

  it("maps masked offsets back to the original text", () => {
    const m = mask(text);
    const at = m.text.indexOf("2 cases oat milk");
    const back = toOriginalOffset(m, at);
    expect(text.slice(back, back + 16)).toBe("2 cases oat milk");
  });
});

describe("search", () => {
  const p = (sku: string, name: string, aliases: string[]): Product => ({
    sku,
    name,
    brand: "Northmill",
    category: "plant-milk",
    unit: "case",
    packSize: "6 × 1 L",
    priceEur: 14,
    aliases,
    stock: 50,
    active: true,
  });
  const catalog = [
    p("PLM-OATB-1L", "Oat Barista 1 L", ["oat milk", "barista oat", "hafermilch"]),
    p("PLM-SOY-1L", "Soy Barista 1 L", ["soy milk", "sojamilch"]),
    p("PLM-ALM-1L", "Almond Barista 1 L", ["almond milk"]),
  ];

  it("normalises units and accents", () => {
    expect(normalize("Leche de AVENA 1 L")).toBe("leche de avena 1l");
  });
  it("finds a product by alias in another language", () => {
    expect(searchCatalog(catalog, "Hafermilch")[0]?.item.sku).toBe("PLM-OATB-1L");
  });
  it("tolerates typos", () => {
    expect(searchCatalog(catalog, "almnd milk")[0]?.item.sku).toBe("PLM-ALM-1L");
  });
  it("matches an exact SKU", () => {
    expect(searchCatalog(catalog, "PLM-SOY-1L")[0]?.item.sku).toBe("PLM-SOY-1L");
  });
});
