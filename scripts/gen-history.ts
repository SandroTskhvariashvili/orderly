// Generates data/fixtures/orders.json: six months of order history for every
// customer, plus a handful of hand-placed orders that the test emails refer to.
//
//   pnpm exec tsx scripts/gen-history.ts
//
// Deterministic: a fixed seed per customer, so the same code always writes the
// same file. Change a basket or an anchor, re-run, and commit the JSON.

import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { Customer, PastOrder, Product, type Weekday } from "@orderly/core/schema";
import { addDays, checkDeliveryDate, earliestShipDate, nextDeliveryDate, weekdayOf } from "@orderly/core/calendar";

const START = "2026-04-13"; // first Monday of the history
const END = "2026-10-11"; // last day before the test inbox opens
const SEED = 20261012;

// --- regular buying patterns ---------------------------------------------------

type Season = "winter" | "summer";
interface Item {
  sku: string;
  base: number; // typical quantity, in the product's selling unit
  p: number; // chance the item is on a given order
  from?: string; // first date the customer buys it (inclusive)
  to?: string; // last date (inclusive), e.g. a product that was discontinued
  season?: Season;
}
interface Plan {
  // [day the order is placed, day it is delivered]. Delivery is the first such
  // weekday on or after the earliest possible ship date.
  slots: Array<[Weekday, Weekday]>;
  everyOtherWeek?: boolean;
  irregularDays?: [number, number]; // instead of slots: one order every n..m days
  p?: number; // chance a slot is used at all (default 0.92)
  until?: string; // last placement date for regular orders (anchors take over after)
  closed?: Array<[string, string]>; // holidays, no orders placed in these ranges
  items: Item[];
}

const i = (sku: string, base: number, p = 1, extra: Partial<Item> = {}): Item => ({ sku, base, p, ...extra });
const WINTER = { season: "winter" as const };
const SUMMER = { season: "summer" as const };
const AUG_SHUTDOWN: [string, string] = ["2026-08-03", "2026-08-23"];

const PLANS: Record<string, Plan> = {
  // Amsterdam ------------------------------------------------------------------
  "C-1001": { // Gracht & Grind, specialty café
    slots: [["Sat", "Tue"], ["Wed", "Fri"]], until: "2026-10-07",
    items: [i("COF-HUILA-1K", 4), i("COF-HUILD-1K", 1, 0.8), i("COF-SEAS-1K", 1, 0.4), i("PLM-OATB-1L", 4), i("DAI-BARIS-1L", 2),
      i("SYR-VAN-750", 3, 0.6), i("PKG-DW8-500", 1, 0.5), i("PKG-LID80-1000", 1, 0.5), i("BAK-CROI-80", 1, 0.7)],
  },
  "C-1002": { // Bakkerij Verhoeven
    slots: [["Mon", "Tue"], ["Thu", "Fri"]],
    items: [i("DAI-WHOLE-1L", 3), i("DAI-WHOLE-2L", 2, 0.6), i("DAI-CREAM-1L", 2), i("DAI-BUTT-250", 2), i("COF-HOUSE-1K", 2, 0.8),
      i("CHO-COCOA-1K", 1, 0.4), i("CHO-CAL54-25", 1, 0.3), i("PKG-BAGS-1000", 1, 0.5), i("PKG-DW8-500", 1, 0.3)],
  },
  "C-1003": { // The Little Fern, brunch. Weekly; the anchor below is the "last week" order.
    slots: [["Mon", "Tue"]], until: "2026-09-28",
    items: [i("COF-HOUSE-1K", 3), i("PLM-OATB-1L", 4), i("DAI-WHOLE-1L", 4), i("JUI-ORNG-1L", 2, 0.9), i("BAK-CROI-80", 1, 0.8),
      i("BAK-PAINC-75", 1, 0.6), i("DAI-YOGH-1K", 2, 0.8), i("SYR-VAN-750", 2, 0.5), i("TEA-EBPYR-100", 1, 0.4)],
  },
  "C-1004": { // Hotel Keizersloot, breakfast buffet
    slots: [["Mon", "Tue"], ["Thu", "Fri"]],
    items: [i("DAI-WHOLE-1L", 4), i("DAI-SEMI-1L", 3), i("PLM-OATB-1L", 2, 0.7), i("JUI-ORNG-1L", 3), i("JUI-APCL-1L", 2),
      i("DAI-YOGH-1K", 3), i("BAK-CROI-45", 1, 0.8), i("BAK-PAINC-75", 1, 0.6), i("BAK-APTU-90", 1, 0.5, { to: "2026-05-31" }),
      i("COF-CREMA-1K", 4), i("TEA-EBPYR-100", 1, 0.6)],
  },
  "C-1005": { // Sixty Ounce Coffee, buys both cup sizes and both lid sizes
    slots: [["Mon", "Tue"], ["Thu", "Fri"]],
    items: [i("COF-HUILA-1K", 3), i("COF-ETGUJ-1K", 1, 0.3), i("COF-SEAS-1K", 2, 0.6), i("DAI-BARIS-1L", 2), i("PLM-OATP-1L", 3),
      i("PKG-DW8-500", 1, 0.5), i("PKG-DW12-500", 1, 0.5), i("PKG-LID80-1000", 1, 0.5), i("PKG-LID90-1000", 1, 0.5), i("CLN-ESPTB-100", 1, 0.3)],
  },
  "C-1006": { // Studio Pandan, small
    slots: [["Wed", "Thu"]],
    items: [i("COF-HOUSE-1K", 2), i("PLM-OATB-1L", 2), i("PLM-COCB-1L", 1, 0.7), i("DAI-WHOLE-1L", 1, 0.8), i("SYR-CLAS-1L", 1, 0.4),
      i("TEA-MATCU-500", 1, 0.5), i("PKG-DW8-500", 1, 0.4), i("PKG-LID80-1000", 1, 0.4)],
  },
  "C-1007": { // Werkhal Noord, coworking kitchen
    slots: [["Wed", "Thu"]], p: 0.85,
    items: [i("COF-HOUSE-1K", 3), i("PLM-OATO-1L", 2), i("DAI-SEMI-1L", 3), i("TEA-EBPYR-100", 1, 0.6), i("TEA-MINT-100", 1, 0.5),
      i("PKG-SUGW-1000", 1, 0.3), i("PKG-STIR-10K", 1, 0.2), i("BAK-BISC-300", 1, 0.6), i("CLN-DISH-5L", 1, 0.3)],
  },
  "C-1008": { // Maple & Rye, busy bakery café
    slots: [["Mon", "Tue"], ["Wed", "Thu"], ["Fri", "Sat"]],
    items: [i("COF-HOUSE-1K", 4), i("PLM-OATB-1L", 5), i("DAI-WHOLE-1L", 4), i("DAI-BUTT-250", 2), i("DAI-CREAM-1L", 1, 0.6),
      i("CHO-CAL54-25", 1, 0.4), i("SYR-CAR-750", 2, 0.5), i("PKG-DW12-500", 1, 0.5), i("PKG-LID90-1000", 1, 0.5), i("PKG-BAGS-1000", 1, 0.4)],
  },
  "C-1009": { // Lucky Pigeon, stopped ordering when the account went on hold
    slots: [["Tue", "Wed"]], until: "2026-09-15",
    items: [i("COF-HAFEN-1K", 2), i("DAI-WHOLE-1L", 2), i("PLM-OATB-1L", 1), i("WAT-SPRK-330", 2), i("WAT-STIL-330", 1),
      i("JUI-LEMO-275", 2, 0.6, SUMMER), i("JUI-ORNG-250", 1, 0.5), i("SYR-CLAS-1L", 1, 0.5), i("PKG-SW7-1000", 1, 0.3, { to: "2026-06-12" })],
  },
  // Rest of NL ---------------------------------------------------------------------
  "C-1010": { // Koffiebar Perron Vijf, Rotterdam
    slots: [["Fri", "Mon"], ["Tue", "Wed"]], until: "2026-10-06",
    items: [i("COF-HAFEN-1K", 3), i("PLM-OATB-1L", 3), i("DAI-WHOLE-1L", 3), i("SYR-VAN-750", 2), i("SYR-HAZ-1L", 1, 0.6, { to: "2026-05-31" }),
      i("SYR-HAZ-750", 1, 0.6, { from: "2026-06-01" }), i("PKG-DW12-500", 1, 0.6), i("PKG-LID90-1000", 1, 0.6), i("BAK-STRW-200", 1, 0.4)],
  },
  "C-1011": { // Het Zoete Hoekje, small bakery, orders when she runs low
    slots: [], irregularDays: [8, 12], until: "2026-09-21",
    items: [i("DAI-WHOLE-1L", 2), i("DAI-CREAM-1L", 1), i("DAI-BUTT-250", 2), i("COF-CREMA-1K", 1), i("PKG-BAGS-1000", 1, 0.5), i("CHO-COCOA-1K", 1, 0.5)],
  },
  "C-1012": { // Dom & Daisy, Utrecht
    slots: [["Mon", "Tue"], ["Thu", "Sat"]],
    items: [i("COF-HUILA-1K", 2), i("COF-HOUSE-1K", 2), i("PLM-OATB-1L", 3), i("PLM-ALMB-1L", 1, 0.6), i("DAI-WHOLE-1L", 3),
      i("SYR-VAN-750", 2, 0.6), i("SYR-CAR-750", 1, 0.5), i("CHO-HOT28-1K", 1, 0.8, WINTER), i("PKG-DW12-500", 1, 0.5), i("PKG-LID90-1000", 1, 0.5)],
  },
  "C-1013": { // Brightwell Analytics, office
    slots: [["Mon", "Tue"]], p: 0.9,
    items: [i("COF-CREMA-1K", 4), i("DAI-SEMI-1L", 3), i("PLM-OATO-1L", 2), i("TEA-EBPYR-100", 1), i("TEA-GINLE-100", 1, 0.5),
      i("PKG-SUGW-1000", 1, 0.3), i("BAK-BISC-300", 1, 0.5), i("WAT-SPRK-330", 2, 0.6)],
  },
  "C-1014": { // Zeeweg Kitchen, restaurant; the chef orders Tuesday and Thursday on Saturday
    slots: [["Sat", "Tue"], ["Sat", "Thu"]], p: 0.85, until: "2026-10-03",
    items: [i("DAI-WHOLE-1L", 2), i("DAI-CREAM-1L", 3), i("DAI-BUTT-250", 1), i("WAT-STIL-750", 3), i("WAT-SPRK-750", 3),
      i("COF-HOUSE-1K", 1), i("JUI-APCL-1L", 1, 0.5), i("CLN-DISH-5L", 1, 0.3)],
  },
  "C-1015": { // Hotel De Zeereep, uses Earl Grey bags in the rooms and loose leaf at afternoon tea
    slots: [["Fri", "Mon"], ["Tue", "Wed"]],
    items: [i("DAI-WHOLE-1L", 5), i("DAI-SEMI-1L", 2), i("PLM-OATB-1L", 2), i("JUI-ORNG-1L", 3), i("WAT-STIL-330", 2),
      i("WAT-SPRK-750", 1), i("TEA-EGPYR-100", 1, 0.7), i("TEA-EGLOO-1K", 1, 0.5), i("TEA-EBPYR-100", 1, 0.7), i("COF-CREMA-1K", 3)],
  },
  "C-1016": { // Leaf & Bean Leiden
    slots: [["Mon", "Tue"], ["Thu", "Fri"]], p: 0.75,
    items: [i("COF-HOUSE-1K", 2), i("COF-PERU-1K", 1), i("PLM-OATP-1L", 3), i("DAI-WHOLE-1L", 2), i("TEA-EBPYR-100", 1, 0.6),
      i("SYR-CHAIC-1L", 2, 0.7), i("CHO-NAPO-500", 1, 0.3), i("PKG-DW12-500", 1, 0.5)],
  },
  // Belgium ----------------------------------------------------------------------
  "C-1017": { // Brood & Bonen, Antwerp
    slots: [["Fri", "Tue"], ["Wed", "Fri"]], until: "2026-10-07",
    items: [i("COF-HOUSE-1K", 3), i("PLM-OATB-1L", 4), i("DAI-WHOLE-1L", 3), i("DAI-BUTT-250", 1, 0.6), i("BAK-CROI-80", 2, 0.8),
      i("SYR-VAN-750", 2, 0.5), i("PKG-BAGS-1000", 1, 0.4), i("PKG-DW8-500", 1, 0.4)],
  },
  "C-1018": { // Café Schelde, Antwerp
    slots: [["Mon", "Tue"], ["Thu", "Fri"]],
    items: [i("COF-HAFEN-1K", 2), i("PLM-OATB-1L", 3), i("DAI-WHOLE-1L", 2), i("SYR-CAR-750", 2), i("SYR-VAN-750", 1, 0.5),
      i("PKG-DW8-500", 1), i("PKG-LID80-1000", 1), i("CHO-HOT28-1K", 1, 0.8, WINTER)],
  },
  "C-1019": { // Patershol Pantry, Ghent. Weekly; the anchor below is "last week".
    slots: [["Thu", "Fri"]], until: "2026-10-01",
    items: [i("COF-PERU-1K", 2), i("COF-HUILD-1K", 1), i("PLM-OATB-1L", 2), i("PLM-ALMB-1L", 1), i("DAI-WHOLE-1L", 2),
      i("TEA-SENCH-100", 1, 0.5), i("TEA-MATCU-500", 1, 0.4), i("BAK-BANBR-900", 2, 0.6)],
  },
  "C-1020": { // Hostel Lys, Ghent
    slots: [["Mon", "Tue"], ["Thu", "Fri"]],
    items: [i("DAI-WHOLE-1L", 4), i("DAI-SEMI-1L", 2, 0.5), i("COF-CREMA-1K", 3), i("JUI-ORNG-1L", 2), i("JUI-APCL-1L", 2),
      i("TEA-EBPYR-100", 1), i("PKG-SUGW-1000", 1, 0.7), i("PKG-STIR-10K", 1, 0.2), i("DAI-CUPS-240", 1, 0.5), i("CHO-HOT28-1K", 1, 0.7, WINTER)],
  },
  "C-1021": { // Maison Sablon, Brussels
    slots: [["Mon", "Wed"], ["Wed", "Fri"]],
    items: [i("COF-HUILA-1K", 2), i("DAI-WHOLE-1L", 3), i("DAI-CREAM-1L", 2), i("DAI-BUTT-250", 2), i("CHO-CAL54-25", 1, 0.4),
      i("CHO-HOT34-1K", 1, 0.8, WINTER), i("TEA-EGLOO-1K", 1, 0.4), i("BAK-ALMCR-90", 1, 0.5), i("SYR-VAN-750", 1, 0.4)],
  },
  // Ireland ------------------------------------------------------------------------
  "C-1022": { // Hatch Lane Coffee. Moved from Haverland to Plainsong over the summer, still buys both.
    slots: [["Mon", "Wed"], ["Wed", "Fri"]],
    items: [i("COF-HOUSE-1K", 3), i("COF-HUILA-1K", 2), i("COF-HUILD-1K", 1, 0.6),
      i("PLM-OATB-1L", 3, 0.95, { to: "2026-07-31" }), i("PLM-OATB-1L", 2, 0.5, { from: "2026-08-01" }),
      i("PLM-OATP-1L", 3, 0.9, { from: "2026-07-15" }), i("DAI-WHOLE-1L", 3), i("SYR-SCAR-750", 2, 0.6), i("SYR-CHOCS-1L", 1, 0.4), i("PKG-DW12-500", 1, 0.5)],
  },
  "C-1023": { // Rathmines Bakehouse
    slots: [["Mon", "Wed"], ["Wed", "Fri"]], p: 0.7,
    items: [i("DAI-BUTT-250", 3), i("DAI-WHOLE-2L", 3), i("DAI-CREAM-1L", 2), i("CHO-CAL54-25", 1, 0.5), i("CHO-CALMK-25", 1, 0.4),
      i("COF-HOUSE-1K", 2), i("PKG-BAGS-1000", 1, 0.5), i("PKG-DW8-500", 1, 0.4)],
  },
  "C-1024": { // Liffeyside Guesthouse
    slots: [["Mon", "Wed"]], p: 0.85,
    items: [i("DAI-WHOLE-1L", 2), i("JUI-ORNG-1L", 2), i("COF-CREMA-1K", 2), i("TEA-EBPYR-100", 1), i("DAI-YOGH-1K", 1),
      i("BAK-CROI-45", 1, 0.5), i("PKG-SUGW-1000", 1, 0.3)],
  },
  "C-1025": { // Bóthar Café, Galway
    slots: [["Mon", "Thu"]], until: "2026-09-28",
    items: [i("COF-HOUSE-1K", 3), i("PLM-OATB-1L", 3), i("DAI-WHOLE-1L", 3), i("SYR-VAN-750", 2), i("SYR-HAZ-750", 1, 0.7),
      i("PKG-DW12-500", 1, 0.6), i("PKG-LID90-1000", 1, 0.6), i("BAK-COOK-60", 1, 0.4)],
  },
  "C-1026": { // Quayside Legal, office
    slots: [["Mon", "Wed"]], everyOtherWeek: true,
    items: [i("COF-CREMA-1K", 2), i("DAI-SEMI-1L", 2), i("PLM-OATO-1L", 1), i("TEA-EBPYR-100", 1), i("BAK-BISC-300", 1, 0.3)],
  },
  // Germany ------------------------------------------------------------------------
  "C-1027": { // Café Graureiher, Berlin
    slots: [["Fri", "Tue"], ["Tue", "Thu"]],
    items: [i("COF-HOUSE-1K", 3), i("PLM-OATB-1L", 4), i("DAI-WHOLE-1L", 3), i("SYR-VAN-750", 2), i("CHO-HOT28-1K", 1, 0.8, WINTER),
      i("PKG-DW12-500", 1, 0.5), i("PKG-LID90-1000", 1, 0.5), i("BAK-CINR-100", 1, 0.4)],
  },
  "C-1028": { // Bäckerei Hoffmann & Söhne. Weekly; the anchor below is "letzte Woche".
    slots: [["Tue", "Thu"]], until: "2026-09-29", closed: [["2026-07-20", "2026-08-02"]],
    items: [i("DAI-WHOLE-1L", 4), i("DAI-CREAM-1L", 3), i("DAI-BUTT-250", 3), i("COF-CREMA-1K", 3), i("PLM-OATB-1L", 2),
      i("PKG-DW12-500", 1, 0.8), i("PKG-BAGS-1000", 2, 0.8), i("CHO-CALMK-25", 1, 0.4)],
  },
  "C-1029": { // Frühstückshaus Lindgren
    slots: [["Mon", "Tue"]], closed: [["2026-08-10", "2026-08-23"]],
    items: [i("COF-HOUSE-1K", 2), i("DAI-WHOLE-1L", 3), i("PLM-OATB-1L", 2), i("JUI-ORNG-1L", 2), i("DAI-YOGH-1K", 2),
      i("TEA-EBPYR-100", 1, 0.5), i("BAK-CINR-100", 1, 0.6)],
  },
  "C-1030": { // Elbkontor Café, Hamburg
    slots: [["Fri", "Wed"], ["Wed", "Fri"]], until: "2026-10-07",
    items: [i("COF-HAFEN-1K", 3), i("COF-CREMA-1K", 2), i("PLM-OATB-1L", 3), i("DAI-WHOLE-1L", 3), i("SYR-CAR-750", 1, 0.5),
      i("BAK-STRW-200", 1, 0.4), i("PKG-DW8-500", 1, 0.5)],
  },
  "C-1031": { // Hotel Alsterblick Garni, Hamburg
    slots: [["Mon", "Wed"]],
    items: [i("COF-CREMA-1K", 4), i("DAI-WHOLE-1L", 5), i("DAI-SKIM-1L", 1), i("DAI-LACFR-1L", 1),
      i("PLM-SOYP-1L", 1, 1, { to: "2026-07-15" }), i("PLM-SOYB-1L", 1, 1, { from: "2026-07-16" }),
      i("JUI-ORNG-1L", 3), i("JUI-APCL-1L", 2), i("DAI-YOGH-1K", 3), i("TEA-EBPYR-100", 1), i("TEA-CHAM-100", 1, 0.5)],
  },
  "C-1032": { // Kaffeekontor Ehrenfeld, Köln
    slots: [["Thu", "Mon"], ["Mon", "Thu"]],
    items: [i("COF-HUILA-1K", 2), i("COF-HAFEN-1K", 2), i("PLM-OATB-1L", 3), i("DAI-BARIS-1L", 1), i("SYR-HAZ-750", 1, 0.5),
      i("PKG-DW8-500", 1, 0.5), i("PKG-LID80-1000", 1, 0.5), i("BAK-CROI-80", 1, 0.5)],
  },
  "C-1033": { // Bäckerei Brandt, on credit hold since early September
    slots: [["Mon", "Thu"]], until: "2026-08-31",
    items: [i("DAI-WHOLE-1L", 3), i("DAI-BUTT-250", 2), i("DAI-CREAM-1L", 2), i("COF-CREMA-1K", 2), i("PKG-BAGS-1000", 1)],
  },
  "C-1034": { // Studio Halbton, design agency office
    slots: [["Thu", "Mon"]], everyOtherWeek: true,
    items: [i("COF-CREMA-1K", 2), i("PLM-OATO-1L", 1), i("DAI-SEMI-1L", 1), i("WAT-SPRK-330", 1, 0.6), i("TEA-GINLE-100", 1, 0.4), i("BAK-BISC-300", 1, 0.5)],
  },
  "C-1035": { // Café Isarlust, München
    slots: [["Mon", "Thu"]],
    items: [i("COF-HOUSE-1K", 3), i("PLM-OATB-1L", 3), i("DAI-WHOLE-1L", 3), i("SYR-VAN-750", 1), i("SYR-CAR-750", 1, 0.5),
      i("BAK-CROI-80", 1, 0.5), i("PKG-DW12-500", 1, 0.5), i("PKG-LID90-1000", 1, 0.5)],
  },
  // Spain --------------------------------------------------------------------------
  "C-1036": { // Forn Sant Gervasi, Barcelona
    slots: [["Mon", "Wed"]], closed: [AUG_SHUTDOWN],
    items: [i("DAI-WHOLE-1L", 5), i("DAI-BUTT-250", 2), i("COF-HOUSE-1K", 3), i("BAK-CROI-80", 2), i("BAK-PAINC-75", 1),
      i("PKG-BAGS-1000", 1, 0.5), i("PKG-DW8-500", 1, 0.4)],
  },
  "C-1037": { // Cafetería Nómada, Barcelona
    slots: [["Mon", "Wed"], ["Wed", "Fri"]], p: 0.65, closed: [AUG_SHUTDOWN],
    items: [i("COF-HUILA-1K", 2), i("COF-SEAS-1K", 1, 0.5), i("PLM-OATB-1L", 3), i("PLM-ALMB-1L", 1, 0.5), i("DAI-WHOLE-1L", 3),
      i("SYR-VAN-750", 1, 0.5), i("PKG-DW8-500", 1, 0.5), i("PKG-LID80-1000", 1, 0.5)],
  },
  "C-1038": { // Casa Olmo Hostal, Madrid. Orders a week ahead.
    slots: [["Fri", "Thu"]], until: "2026-10-02",
    items: [i("COF-CREMA-1K", 3), i("DAI-WHOLE-1L", 4), i("DAI-SEMI-1L", 1), i("JUI-ORNG-1L", 3), i("DAI-YOGH-1K", 2),
      i("BAK-CROI-45", 1), i("TEA-EBPYR-100", 1, 0.5), i("PKG-SUGW-1000", 1, 0.3)],
  },
  "C-1039": { // Horno La Pepa, Valencia
    slots: [["Mon", "Wed"]], p: 0.85, closed: [AUG_SHUTDOWN],
    items: [i("DAI-WHOLE-1L", 3), i("DAI-BUTT-250", 2), i("DAI-CREAM-1L", 1), i("COF-HOUSE-1K", 2), i("CHO-COCOA-1K", 1, 0.5), i("PKG-BAGS-1000", 1, 0.5)],
  },
  "C-1040": { // Brisa Coffee Club, Málaga
    slots: [["Tue", "Fri"]],
    items: [i("COF-HUILA-1K", 2), i("COF-BRAZ-1K", 1, 1, { to: "2026-06-30" }), i("COF-BRSUL-1K", 1, 1, { from: "2026-07-01" }),
      i("PLM-OATB-1L", 3), i("DAI-WHOLE-1L", 2), i("SYR-VAN-750", 1), i("JUI-ORNG-250", 1, 0.5), i("PKG-DW8-500", 1, 0.5),
      i("PKG-CLD16-1000", 1, 0.8, SUMMER)],
  },
};

// --- hand-placed orders ------------------------------------------------------------
// The emails in data/inbox-src lean on these, so they are fixed rather than random.

type Lines = Array<[string, number]>;
interface Anchor { customerId: string; placedOn: string; deliveryDate: string; lines: Lines; why: string }

const ANCHORS: Anchor[] = [
  // "Last order" for customers who write "same as last week / last time".
  { customerId: "C-1003", placedOn: "2026-10-05", deliveryDate: "2026-10-06", why: "last week (E-003)",
    lines: [["COF-HOUSE-1K", 3], ["PLM-OATB-1L", 4], ["DAI-WHOLE-1L", 4], ["JUI-ORNG-1L", 2], ["BAK-CROI-80", 1], ["DAI-YOGH-1K", 2], ["SYR-VAN-750", 2]] },
  { customerId: "C-1011", placedOn: "2026-10-01", deliveryDate: "2026-10-02", why: "last time (E-028)",
    lines: [["DAI-WHOLE-1L", 2], ["DAI-CREAM-1L", 1], ["DAI-BUTT-250", 2], ["COF-CREMA-1K", 1], ["PKG-BAGS-1000", 1]] },
  { customerId: "C-1028", placedOn: "2026-10-06", deliveryDate: "2026-10-08", why: "letzte Woche (E-040)",
    lines: [["DAI-WHOLE-1L", 4], ["DAI-CREAM-1L", 3], ["DAI-BUTT-250", 3], ["COF-CREMA-1K", 3], ["PLM-OATB-1L", 2], ["PKG-DW12-500", 1], ["PKG-BAGS-1000", 2]] },
  { customerId: "C-1019", placedOn: "2026-10-08", deliveryDate: "2026-10-09", why: "last week (E-053)",
    lines: [["COF-PERU-1K", 2], ["COF-HUILD-1K", 1], ["PLM-OATB-1L", 2], ["PLM-ALMB-1L", 1], ["DAI-WHOLE-1L", 2], ["BAK-BANBR-900", 2]] },
  // Delivered orders the complaints refer to.
  { customerId: "C-1025", placedOn: "2026-10-05", deliveryDate: "2026-10-08", why: "broken vanilla bottles (E-025)",
    lines: [["COF-HOUSE-1K", 3], ["PLM-OATB-1L", 3], ["DAI-WHOLE-1L", 3], ["SYR-VAN-750", 4], ["SYR-HAZ-750", 1], ["PKG-DW12-500", 1], ["PKG-LID90-1000", 1]] },
  { customerId: "C-1010", placedOn: "2026-10-09", deliveryDate: "2026-10-12", why: "picked sugar-free vanilla by mistake (E-051)",
    lines: [["COF-HAFEN-1K", 3], ["PLM-OATB-1L", 3], ["DAI-WHOLE-1L", 3], ["SYR-VAN-750", 3], ["SYR-HAZ-750", 1], ["BAK-STRW-200", 1]] },
  // Open orders, placed 7-11 Oct for delivery 13-17 Oct. Changed or cancelled by email.
  { customerId: "C-1001", placedOn: "2026-10-10", deliveryDate: "2026-10-13", why: "changed (E-006)",
    lines: [["COF-HUILA-1K", 4], ["COF-HUILD-1K", 1], ["PLM-OATB-1L", 4], ["DAI-BARIS-1L", 2], ["SYR-VAN-750", 3], ["BAK-CROI-80", 1]] },
  { customerId: "C-1017", placedOn: "2026-10-09", deliveryDate: "2026-10-13", why: "changed (E-023)",
    lines: [["COF-HOUSE-1K", 3], ["PLM-OATB-1L", 4], ["DAI-WHOLE-1L", 3], ["BAK-CROI-80", 2], ["SYR-VAN-750", 2], ["PKG-DW8-500", 1]] },
  { customerId: "C-1030", placedOn: "2026-10-09", deliveryDate: "2026-10-14", why: "moved to Friday (E-029)",
    lines: [["COF-HAFEN-1K", 3], ["COF-CREMA-1K", 2], ["PLM-OATB-1L", 3], ["DAI-WHOLE-1L", 3], ["SYR-CAR-750", 1]] },
  { customerId: "C-1014", placedOn: "2026-10-10", deliveryDate: "2026-10-13", why: "delivered as normal",
    lines: [["DAI-WHOLE-1L", 2], ["DAI-CREAM-1L", 3], ["WAT-STIL-750", 3], ["WAT-SPRK-750", 3], ["COF-HOUSE-1K", 1]] },
  { customerId: "C-1014", placedOn: "2026-10-10", deliveryDate: "2026-10-15", why: "cancelled (E-030)",
    lines: [["DAI-WHOLE-1L", 2], ["DAI-CREAM-1L", 2], ["DAI-BUTT-250", 1], ["WAT-STIL-750", 2], ["WAT-SPRK-750", 3], ["JUI-APCL-1L", 1]] },
  { customerId: "C-1038", placedOn: "2026-10-09", deliveryDate: "2026-10-15", why: "cancelled (E-008)",
    lines: [["COF-CREMA-1K", 3], ["DAI-WHOLE-1L", 4], ["DAI-SEMI-1L", 1], ["JUI-ORNG-1L", 3], ["DAI-YOGH-1K", 2], ["BAK-CROI-45", 1]] },
];

// --- generation ------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s: string) => [...s].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);

const readJson = async <T>(file: string, schema: z.ZodType<T>) => schema.parse(JSON.parse(await readFile(file, "utf8")));
const catalog = await readJson("data/fixtures/catalog.json", z.array(Product));
const customers = await readJson("data/fixtures/customers.json", z.array(Customer));
const bySku = new Map(catalog.map((p) => [p.sku, p]));

// Orders are placed during the working day; the history runs entirely in summer time.
const placedAt = (date: string) => `${date}T10:00:00+02:00`;

function deliveryFor(placedOn: string, deliver: Weekday): string {
  let d = earliestShipDate(placedAt(placedOn));
  while (weekdayOf(d) !== deliver) d = addDays(d, 1);
  return d;
}

function seasonFactor(item: Item, date: string): number {
  const month = Number(date.slice(5, 7));
  if (item.season === "winter") return month >= 6 && month <= 8 ? 0.15 : month === 5 || month === 9 ? 0.6 : 1;
  if (item.season === "summer") return date >= "2026-05-15" && date <= "2026-09-15" ? 1 : 0;
  return 1;
}

function quantity(base: number, rnd: () => number, date: string, sku: string): number {
  const p = bySku.get(sku)!;
  const summer = date >= "2026-06-15" && date <= "2026-08-31";
  let q = base;
  if (summer && (p.category === "juice" || p.category === "water")) q = Math.round(base * 1.4);
  if (q === 1) return rnd() < 0.12 ? 2 : 1;
  const r = rnd();
  return Math.max(1, q + (r < 0.2 ? -1 : r < 0.82 ? 0 : 1));
}

function basket(plan: Plan, date: string, rnd: () => number): Lines {
  const lines: Lines = [];
  for (const item of plan.items) {
    if ((item.from && date < item.from) || (item.to && date > item.to)) continue;
    if (rnd() < item.p * seasonFactor(item, date)) lines.push([item.sku, quantity(item.base, rnd, date, item.sku)]);
  }
  if (!lines.length) lines.push([plan.items[0]!.sku, plan.items[0]!.base]);
  return lines;
}

interface Draft { customerId: string; placedOn: string; deliveryDate: string; lines: Lines; anchor?: string }
const drafts: Draft[] = [];

for (const c of customers) {
  const plan = PLANS[c.id];
  if (!plan) throw new Error(`no buying plan for ${c.id}`);
  const rnd = mulberry32(SEED ^ hash(c.id));
  const until = plan.until ?? END;
  const isClosed = (d: string) => (plan.closed ?? []).some(([a, b]) => d >= a && d <= b);

  if (plan.irregularDays) {
    const [min, max] = plan.irregularDays;
    let d = addDays(START, Math.floor(rnd() * 4));
    while (d <= until) {
      if (weekdayOf(d) === "Sun") d = addDays(d, 1);
      if (!isClosed(d) && d <= until) {
        drafts.push({ customerId: c.id, placedOn: d, deliveryDate: nextDeliveryDate(placedAt(d), c.deliveryDays), lines: basket(plan, d, rnd) });
      }
      d = addDays(d, min + Math.floor(rnd() * (max - min + 1)));
    }
    continue;
  }

  for (let week = 0, monday = START; monday <= until; week++, monday = addDays(monday, 7)) {
    if (plan.everyOtherWeek && week % 2 === 1) continue;
    for (const [place, deliver] of plan.slots) {
      if (!c.deliveryDays.includes(deliver)) throw new Error(`${c.id}: ${deliver} is not a delivery day`);
      let placedOn = monday;
      while (weekdayOf(placedOn) !== place) placedOn = addDays(placedOn, 1);
      if (placedOn > until || isClosed(placedOn) || rnd() >= (plan.p ?? 0.92)) continue;
      drafts.push({ customerId: c.id, placedOn, deliveryDate: deliveryFor(placedOn, deliver), lines: basket(plan, placedOn, rnd) });
    }
  }
}

for (const a of ANCHORS) drafts.push({ ...a, anchor: a.why });

// --- checks, ids, output -----------------------------------------------------------------

const byCustomer = new Map(customers.map((c) => [c.id, c]));
for (const d of drafts) {
  const c = byCustomer.get(d.customerId)!;
  const check = checkDeliveryDate(d.deliveryDate, placedAt(d.placedOn), c.deliveryDays);
  if (!check.ok) throw new Error(`${d.customerId} ${d.placedOn}->${d.deliveryDate}: ${check.why}`);
  for (const [sku] of d.lines) if (!bySku.has(sku)) throw new Error(`unknown sku ${sku}`);
}

drafts.sort((a, b) => a.placedOn.localeCompare(b.placedOn) || a.deliveryDate.localeCompare(b.deliveryDate) || a.customerId.localeCompare(b.customerId));

const orders: PastOrder[] = drafts.map((d, n) => ({
  id: `SO-${10001 + n}`,
  customerId: d.customerId,
  placedOn: d.placedOn,
  deliveryDate: d.deliveryDate,
  lines: d.lines.map(([sku, qty]) => ({ sku, qty, unit: bySku.get(sku)!.unit })),
}));
z.array(PastOrder).parse(orders);
await writeFile("data/fixtures/orders.json", JSON.stringify(orders, null, 2) + "\n");

// Summary, so a change to a basket is easy to eyeball.
console.log(`${orders.length} orders, ${orders[0]!.id} .. ${orders.at(-1)!.id}, ${orders[0]!.placedOn} .. ${orders.at(-1)!.placedOn}`);
for (const c of customers) {
  const mine = orders.filter((o) => o.customerId === c.id);
  const avg = mine.reduce((s, o) => s + o.lines.reduce((t, l) => t + l.qty, 0), 0) / Math.max(1, mine.length);
  const last = mine.at(-1);
  console.log(`${c.id} ${c.name.padEnd(26)} orders ${String(mine.length).padStart(3)}  avg units ${avg.toFixed(1).padStart(5)} (usual ${c.usualCasesPerOrder})  last ${last?.id} ${last?.placedOn}->${last?.deliveryDate}`);
}
console.log("\nanchors:");
drafts.forEach((d, n) => d.anchor && console.log(`  SO-${10001 + n} ${d.customerId} ${d.placedOn} -> ${d.deliveryDate}  ${d.anchor}`));
