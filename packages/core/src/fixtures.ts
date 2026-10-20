import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { Customer, PastOrder, Product } from "./schema.ts";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const DATA_DIR = path.join(REPO_ROOT, "data");

/** Everything the business already knows: catalog, customers, order history. */
export interface MasterData {
  catalog: Product[];
  customers: Customer[];
  orders: PastOrder[];
  productBySku: Map<string, Product>;
  customerById: Map<string, Customer>;
  customerByEmail: Map<string, Customer>;
}

async function load<T>(file: string, schema: z.ZodType<T>): Promise<T> {
  return schema.parse(JSON.parse(await readFile(path.join(DATA_DIR, "fixtures", file), "utf8")));
}

export async function loadMasterData(): Promise<MasterData> {
  const [catalog, customers, orders] = await Promise.all([
    load("catalog.json", z.array(Product)),
    load("customers.json", z.array(Customer)),
    load("orders.json", z.array(PastOrder)),
  ]);
  const customerByEmail = new Map<string, Customer>();
  for (const c of customers) for (const e of c.emails) customerByEmail.set(e.toLowerCase(), c);
  return {
    catalog,
    customers,
    orders,
    productBySku: new Map(catalog.map((p) => [p.sku, p])),
    customerById: new Map(customers.map((c) => [c.id, c])),
    customerByEmail,
  };
}

export function ordersFor(data: MasterData, customerId: string): PastOrder[] {
  return data.orders
    .filter((o) => o.customerId === customerId)
    .sort((a, b) => b.placedOn.localeCompare(a.placedOn) || b.id.localeCompare(a.id));
}

/** This customer's usual (median) quantity of a SKU, or null if they never ordered it. */
export function usualQty(data: MasterData, customerId: string, sku: string): number | null {
  const qs: number[] = [];
  for (const o of data.orders) {
    if (o.customerId !== customerId) continue;
    for (const l of o.lines) if (l.sku === sku) qs.push(l.qty);
  }
  if (!qs.length) return null;
  qs.sort((a, b) => a - b);
  const mid = Math.floor(qs.length / 2);
  return qs.length % 2 ? qs[mid]! : (qs[mid - 1]! + qs[mid]!) / 2;
}
