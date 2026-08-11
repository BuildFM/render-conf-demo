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

/**
 * Retire a component, or put it back, by editing the RAW text of the components
 * section — one line in, or one line out.
 *
 * Not `JSON.parse` → mutate → `JSON.stringify`, for the reason at the top of this
 * file and one more besides. The manifest is a committed artifact with deliberate
 * formatting and `_` comment keys, and re-serialising reflows all 350 lines of
 * `components` — so the drawer's raw view, which is one click away and may well be
 * on screen at the time, would visibly rewrite itself when a checkbox was ticked.
 * Every byte that was not this flag comes back identical.
 *
 * The flag is written IMMEDIATELY BEFORE the component's `"name"` line, at the same
 * indentation. Before rather than after because a key inserted before a key is
 * always followed by a comma-separated sibling and therefore always valid, whereas
 * inserting after a line requires knowing whether that line was the object's last.
 *
 * The whole manifest is schema-validated server-side before anything is written, so
 * a malformed result is refused and surfaced in the drawer rather than reaching disk.
 */
export const setRetired = (componentsText: string, name: string, retired: boolean): string => {
  /* The component's own object, found from its name line and bounded by braces — a
     `"retired"` elsewhere in the file, or in the next component along, must not be
     the one that gets edited. */
  const nameLine = new RegExp(`^([ \\t]*)"name"\\s*:\\s*"${name}"\\s*,?\\s*$`, "m");
  const m = nameLine.exec(componentsText);
  if (!m) throw new Error(`no component named "${name}"`);

  const open = componentsText.lastIndexOf("{", m.index);
  if (open < 0) throw new Error(`could not find the object for "${name}"`);
  const close = matchBracket(componentsText, open);
  const body = componentsText.slice(open, close);

  const existing = /^[ \t]*"retired"\s*:\s*(?:true|false)\s*,?[ \t]*\r?\n/m.exec(body);
  const indent = m[1];

  if (existing) {
    const at = open + existing.index;
    const next = retired
      ? `${indent}"retired": true,\n`
      : "" /* dropped entirely: an explicit `false` is the schema default and saying
              it out loud would leave the file dirtier after a restore than before */
    return componentsText.slice(0, at) + next + componentsText.slice(at + existing[0].length);
  }

  if (!retired) return componentsText // already absent, and absent means in use
  return componentsText.slice(0, m.index) + `${indent}"retired": true,\n` + componentsText.slice(m.index);
};
