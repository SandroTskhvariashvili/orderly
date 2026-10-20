// Personal data never reaches the model. Contact details are replaced with
// stable tokens ([EMAIL_1], [PHONE_2], ...) before any API call. Names stay,
// because a reply has to greet someone.
//
// This is pattern-based on purpose: it is predictable and testable. A
// production deployment would add a named-entity model for free-text addresses.

export type PiiKind = "EMAIL" | "PHONE" | "IBAN" | "ADDRESS" | "POSTCODE";

export interface MaskSpan {
  /** Offsets in the original text. */
  start: number;
  end: number;
  token: string;
  kind: PiiKind;
}

export interface Masked {
  text: string;
  spans: MaskSpan[];
}

const PATTERNS: Array<{ kind: PiiKind; re: RegExp }> = [
  { kind: "EMAIL", re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  { kind: "IBAN", re: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,3})?\b/g },
  {
    kind: "PHONE",
    re: /(?:\+|\b00)\d{2,3}[ .-]?(?:\(0\)[ .-]?)?\d{1,4}(?:[ .-]?\d{2,4}){2,4}\b|\b0\d{1,4}[ .-]\d{3,4}[ .-]?\d{3,4}\b/g,
  },
  {
    kind: "ADDRESS",
    re: /\b[A-ZÄÖÜ][\p{L}'-]*(?:straat|gracht|weg|laan|plein|kade|markt|dijk|straße|strasse|str\.|gasse|allee|platz|ring|damm|road|street|lane|avenue|quay)\s+\d{1,4}[a-zA-Z]?(?:[-/]\d{1,4})?\b|\b(?:Calle|Carrer|Avenida|Avinguda|Plaza|Plaça|Paseo|Passeig|Rue|Via)\s+(?:de(?:l| la| les)?\s+)?[\p{L}' ]{2,40}?,?\s*\d{1,4}\b/gu,
  },
  { kind: "POSTCODE", re: /\b\d{4} ?[A-Z]{2}\b(?= [A-Z][a-z])|\b\d{5}(?= [A-ZÄÖÜ][\p{L}]+)/gu },
];

export function mask(text: string): Masked {
  const found: Array<Omit<MaskSpan, "token">> = [];
  for (const { kind, re } of PATTERNS) {
    for (const m of text.matchAll(re)) {
      const start = m.index!;
      const end = start + m[0].length;
      // Earlier patterns win on overlap (an email address contains no phone, etc.).
      if (found.some((f) => start < f.end && end > f.start)) continue;
      found.push({ start, end, kind });
    }
  }
  found.sort((a, b) => a.start - b.start);

  const tokenFor = new Map<string, string>();
  const counters: Partial<Record<PiiKind, number>> = {};
  const spans: MaskSpan[] = found.map((f) => {
    const value = `${f.kind}:${text.slice(f.start, f.end).replace(/\s+/g, "").toLowerCase()}`;
    let token = tokenFor.get(value);
    if (!token) {
      counters[f.kind] = (counters[f.kind] ?? 0) + 1;
      token = `[${f.kind}_${counters[f.kind]}]`;
      tokenFor.set(value, token);
    }
    return { ...f, token };
  });

  let out = "";
  let cursor = 0;
  for (const s of spans) {
    out += text.slice(cursor, s.start) + s.token;
    cursor = s.end;
  }
  out += text.slice(cursor);
  return { text: out, spans };
}

/** Maps an offset in the masked text back to the original text. */
export function toOriginalOffset(masked: Masked, offset: number): number {
  let delta = 0;
  let maskedPos = 0;
  let originalPos = 0;
  for (const s of masked.spans) {
    const plainLen = s.start - originalPos;
    if (offset <= maskedPos + plainLen) return offset + delta;
    maskedPos += plainLen + s.token.length;
    originalPos = s.end;
    delta = originalPos - maskedPos;
    if (offset < maskedPos) return s.start; // inside a token: snap to its start
  }
  return offset + delta;
}
