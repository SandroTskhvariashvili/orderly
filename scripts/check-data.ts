// Consistency checks for the dataset. Run with `pnpm check:data`.
// Exits non-zero on any error, so it can gate CI.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { Customer, Label, PastOrder, Product } from "@orderly/core/schema";
import { InboxSource } from "@orderly/core/inbox-source";
import { checkDeliveryDate, nextDeliveryDate, weekdayOf } from "@orderly/core/calendar";

const errors: string[] = [];
const warn: string[] = [];
const fail = (msg: string) => errors.push(msg);

async function readJson<T>(file: string, schema: z.ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(JSON.parse(await readFile(file, "utf8")));
  if (!parsed.success) {
    fail(`${file}: ${z.prettifyError(parsed.error)}`);
    throw new Error("schema");
  }
  return parsed.data;
}

const catalog = await readJson("data/fixtures/catalog.json", z.array(Product));
const customers = await readJson("data/fixtures/customers.json", z.array(Customer));
const orders = await readJson("data/fixtures/orders.json", z.array(PastOrder));

const bySku = new Map(catalog.map((p) => [p.sku, p]));
const byCustomer = new Map(customers.map((c) => [c.id, c]));
const byOrder = new Map(orders.map((o) => [o.id, o]));

// --- master data -----------------------------------------------------------
if (bySku.size !== catalog.length) fail("catalog: duplicate SKUs");
if (byCustomer.size !== customers.length) fail("customers: duplicate ids");
const allEmails = customers.flatMap((c) => c.emails.map((e) => e.toLowerCase()));
if (new Set(allEmails).size !== allEmails.length) fail("customers: an email belongs to two customers");
if (byOrder.size !== orders.length) fail("orders: duplicate ids");

for (const o of orders) {
  const c = byCustomer.get(o.customerId);
  if (!c) fail(`${o.id}: unknown customer ${o.customerId}`);
  for (const l of o.lines) {
    const p = bySku.get(l.sku);
    if (!p) fail(`${o.id}: unknown sku ${l.sku}`);
    else if (p.unit !== l.unit) fail(`${o.id}: ${l.sku} sold per ${p.unit}, line says ${l.unit}`);
  }
  if (c && !c.deliveryDays.includes(weekdayOf(o.deliveryDate) as never)) {
    fail(`${o.id}: delivered on ${weekdayOf(o.deliveryDate)}, not a delivery day for ${c.id}`);
  }
  if (o.deliveryDate <= o.placedOn) fail(`${o.id}: delivery not after placement`);
}

// --- emails and labels -----------------------------------------------------
const srcFiles = (await readdir("data/inbox-src")).filter((f) => f.endsWith(".json")).sort();
const labelFiles = (await readdir("data/labels")).filter((f) => f.endsWith(".json")).sort();
if (srcFiles.join() !== labelFiles.join()) fail("inbox-src and labels do not contain the same ids");

const stats = { split: {} as Record<string, number>, intent: {} as Record<string, number>, route: {} as Record<string, number>, reason: {} as Record<string, number>, lang: {} as Record<string, number> };
const bump = (m: Record<string, number>, k: string) => (m[k] = (m[k] ?? 0) + 1);

for (const file of labelFiles) {
  let src, label;
  try {
    src = await readJson(path.join("data/inbox-src", file), InboxSource);
    label = await readJson(path.join("data/labels", file), Label);
  } catch {
    continue;
  }
  const id = label.emailId;
  if (`${id}.json` !== file || src.id !== id) fail(`${file}: id mismatch`);

  bump(stats.split, label.split);
  bump(stats.intent, label.intent);
  bump(stats.route, label.route);
  label.reasons.forEach((r) => bump(stats.reason, r));

  // Route policy (must match the pipeline's router).
  const isOrderish = label.intent === "new_order";
  if (["question", "complaint", "not_business"].includes(label.intent) && label.route !== "not_an_order")
    fail(`${id}: ${label.intent} must route to not_an_order`);
  if (["change_order", "cancel_order"].includes(label.intent)) {
    if (label.route !== "needs_review") fail(`${id}: ${label.intent} must route to needs_review`);
    if (!label.reasons.includes("change_or_cancel")) fail(`${id}: change/cancel needs reason change_or_cancel`);
    if (!label.refersToOrderId) warn.push(`${id}: change/cancel without refersToOrderId`);
  }
  if (label.route === "create_draft" && label.reasons.length) fail(`${id}: create_draft must have no reasons`);
  if (label.route === "needs_review" && !label.reasons.length) fail(`${id}: needs_review needs at least one reason`);
  if (label.route !== "not_an_order" && label.intent !== "new_order" && !["change_order", "cancel_order"].includes(label.intent))
    fail(`${id}: route ${label.route} with intent ${label.intent}`);

  if (label.refersToOrderId && !byOrder.has(label.refersToOrderId)) fail(`${id}: refers to unknown order ${label.refersToOrderId}`);

  // Customer and sender.
  const customer = label.customerId ? byCustomer.get(label.customerId) : undefined;
  if (label.customerId && !customer) fail(`${id}: unknown customer ${label.customerId}`);
  if (customer) {
    bump(stats.lang, customer.language);
    const sender = src.from.address.toLowerCase();
    if (!customer.emails.map((e) => e.toLowerCase()).includes(sender) && !label.reasons.includes("unknown_customer"))
      warn.push(`${id}: sender ${sender} is not on file for ${customer.id} (fine only if forwarded or a colleague)`);
  }
  if (isOrderish && !label.customerId && !label.reasons.includes("unknown_customer"))
    fail(`${id}: new order without customer must carry unknown_customer`);

  // Lines.
  for (const l of label.lines) {
    const p = bySku.get(l.sku);
    if (!p) fail(`${id}: label line uses unknown sku ${l.sku}`);
    else if (p.unit !== l.unit) fail(`${id}: ${l.sku} sold per ${p.unit}, label says ${l.unit}`);
  }
  if (label.route === "create_draft") {
    if (!label.lines.length) fail(`${id}: create_draft with no lines`);
    for (const l of label.lines) {
      const p = bySku.get(l.sku);
      if (p && !p.active) fail(`${id}: create_draft with inactive ${l.sku}`);
      if (p && l.qty > p.stock) fail(`${id}: create_draft but ${l.sku} qty ${l.qty} > stock ${p.stock}`);
    }
    if (customer?.creditHold) fail(`${id}: create_draft for a customer on credit hold`);
  }

  // Delivery date.
  if (label.route === "create_draft") {
    if (!label.deliveryDate) fail(`${id}: create_draft needs a deliveryDate`);
    else if (customer) {
      const check = checkDeliveryDate(label.deliveryDate, src.receivedAt, customer.deliveryDays);
      if (!check.ok) fail(`${id}: deliveryDate ${label.deliveryDate} is ${check.why} (earliest ${check.earliest})`);
    }
  }
  if (label.reasons.includes("invalid_delivery_date") && customer && label.deliveryDate) {
    const check = checkDeliveryDate(label.deliveryDate, src.receivedAt, customer.deliveryDays);
    if (check.ok) fail(`${id}: says invalid_delivery_date but ${label.deliveryDate} is valid`);
  }
  if (customer && label.route === "create_draft" && label.deliveryDate) {
    const next = nextDeliveryDate(src.receivedAt, customer.deliveryDays);
    if (label.deliveryDate < next) fail(`${id}: deliveryDate before the next possible one (${next})`);
  }
}

// --- coverage -----------------------------------------------------------------
const need = { dev: 20, test: 40 };
for (const [split, n] of Object.entries(need)) {
  if ((stats.split[split] ?? 0) !== n) fail(`split ${split}: expected ${n}, got ${stats.split[split] ?? 0}`);
}

console.log("splits ", stats.split);
console.log("intents", stats.intent);
console.log("routes ", stats.route);
console.log("reasons", stats.reason);
console.log("langs  ", stats.lang);
console.log(`catalog ${catalog.length} · customers ${customers.length} · orders ${orders.length} · emails ${labelFiles.length}`);
for (const w of warn) console.log(`warn  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
if (errors.length) {
  console.log(`\n${errors.length} error(s)`);
  process.exit(1);
}
console.log("\ndata ok");
