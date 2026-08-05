/**
 * Slice one top-level section out of the manifest's RAW TEXT, and splice an edited
 * one back in.
 *
 * Why not parse, edit the object, and re-serialise: the manifest is a committed
 * artifact with deliberate formatting and `_` comment keys, and it goes on a
 * projector. Round-tripping through JSON.stringify reflows the whole file, changes
 * every byte, and quietly reformats the parts nobody touched. Working on offsets
 * means the 460 lines you did not edit are identical afterwards.
 *
 * The other reason is the frame. 482 lines cannot be read at projection distance;
 * twenty can. The drawer shows one section, which is also exactly the unit the beat
 * needs — `obligations`, open, with room to type six lines into it.
 */

export type Slice = { key: string; start: number; end: number; text: string };

/** Scan the top level of a JSON object and record where each key's entry begins
 *  and where its value ends. String-aware and escape-aware; it is a scanner rather
 *  than a parser because it only ever needs to match brackets. */
const topLevelSpans = (raw: string): Slice[] => {
  const spans: Slice[] = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let keyStart = -1;
  let pendingKey: { key: string; start: number } | null = null;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') {
        inString = false;
        /* A string that closed at depth 1 is a candidate key — confirmed only when
           the next non-space character is a colon. */
        if (depth === 1 && keyStart >= 0) {
          const key = raw.slice(keyStart + 1, i);
          let j = i + 1;
          while (j < raw.length && /\s/.test(raw[j])) j++;
          if (raw[j] === ":") pendingKey = { key, start: keyStart };
        }
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      escaped = false;
      keyStart = i;
      continue;
    }

    if (ch === "{" || ch === "[") {
      depth++;
      /* Entering the value of a top-level key: match to its close. */
      if (depth === 2 && pendingKey) {
        const end = matchBracket(raw, i);
        spans.push({ key: pendingKey.key, start: pendingKey.start, end, text: raw.slice(pendingKey.start, end) });
        pendingKey = null;
      }
      continue;
    }

    if (ch === "}" || ch === "]") {
      depth--;
      continue;
    }

    /* A scalar value on a top-level key — runs to the comma or the closing brace
       that ends the entry. */
    if (depth === 1 && pendingKey && ch === ":") {
      let j = i + 1;
      while (j < raw.length && /\s/.test(raw[j])) j++;
      if (raw[j] !== "{" && raw[j] !== "[") {
        const end = scalarEnd(raw, j);
        spans.push({ key: pendingKey.key, start: pendingKey.start, end, text: raw.slice(pendingKey.start, end) });
        pendingKey = null;
      }
    }
  }

  return spans;
};

/** Offset just past the bracket matching the one at `open`. */
const matchBracket = (raw: string, open: number): number => {
  const close = raw[open] === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = open; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) return raw[i] === close ? i + 1 : i + 1;
    }
  }
  return raw.length;
};

const scalarEnd = (raw: string, from: number): number => {
  let inString = false;
  let escaped = false;
  for (let i = from; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "," || ch === "}" || ch === "\n") return i;
  }
  return raw.length;
};

export const sections = (raw: string): Slice[] => topLevelSpans(raw);

export const sliceSection = (raw: string, key: string): Slice | null =>
  topLevelSpans(raw).find((s) => s.key === key) ?? null;

/** Put an edited section back, leaving every other byte of the file alone. */
export const spliceSection = (raw: string, key: string, text: string): string => {
  const s = sliceSection(raw, key);
  if (!s) throw new Error(`no top-level section "${key}" in the manifest`);
  return raw.slice(0, s.start) + text.trimEnd() + raw.slice(s.end);
};
