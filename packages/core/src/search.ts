import { distance } from "fastest-levenshtein";
import type { Customer, Product } from "./schema.ts";

// Plain lexical search over the catalog. The model decides what to search for
// ("barista oat", "hafermilch"); this code decides what exists. Deterministic,
// fast, and the same answer every time, which keeps evals stable.

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/(\d+(?:[.,]\d+)?)\s*(l|ml|cl|kg|g|oz|pcs|pc|x)\b/g, (_, n: string, u: string) => `${n.replace(",", ".")}${u}`)
    .replace(/[^a-z0-9.]+/g, " ")
    .trim();
}

const STOP = new Set(["the", "a", "of", "and", "de", "der", "die", "das", "la", "el", "los", "las", "en", "for", "x", "pack"]);

function tokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function tokenScore(q: string, candidates: string[]): number {
  let best = 0;
  for (const c of candidates) {
    if (c === q) return 1;
    if (q.length >= 4 && (c.startsWith(q) || q.startsWith(c)) && Math.min(c.length, q.length) >= 4) best = Math.max(best, 0.8);
    if (q.length >= 5 && c.length >= 5) {
      const ratio = 1 - distance(q, c) / Math.max(q.length, c.length);
      if (ratio >= 0.8) best = Math.max(best, 0.7);
    }
  }
  return best;
}

export interface SearchHit<T> {
  item: T;
  score: number;
}

export function searchCatalog(catalog: Product[], query: string, limit = 8): SearchHit<Product>[] {
  const q = tokens(query);
  const qNorm = normalize(query);
  if (!q.length) return [];
  const hits: SearchHit<Product>[] = [];
  for (const p of catalog) {
    if (normalize(p.sku) === qNorm) {
      hits.push({ item: p, score: 10 });
      continue;
    }
    const fieldTokens = tokens([p.name, p.brand, p.category, p.packSize, ...p.aliases].join(" "));
    let score = q.reduce((sum, t) => sum + tokenScore(t, fieldTokens), 0) / q.length;
    for (const alias of p.aliases) {
      const a = normalize(alias);
      if (a && (qNorm === a || qNorm.includes(a))) score += 0.5;
    }
    if (score >= 0.45) hits.push({ item: p, score: Math.round(score * 100) / 100 });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function searchCustomers(customers: Customer[], query: string, limit = 5): SearchHit<Customer>[] {
  const q = tokens(query);
  if (!q.length) return [];
  return customers
    .map((c) => {
      const fieldTokens = tokens(`${c.name} ${c.city}`);
      return { item: c, score: q.reduce((s, t) => s + tokenScore(t, fieldTokens), 0) / q.length };
    })
    .filter((h) => h.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
