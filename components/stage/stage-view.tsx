"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { setRetired } from "@/lib/manifest/slice";
import styles from "./stage-view.module.css";

/**
 * The split screen. Manifest on the left, the two composed twins on the right.
 *
 * This is the spine of the demo, not its finale. Every other view in this app shows
 * an OUTPUT, and outputs are what personalization also produces — any single page
 * can be reverse-engineered into a rule. A cause cannot. So the manifest stays in
 * frame while the pages respond to it.
 *
 * Two client components exist in this repo and both are here. The composed pages
 * remain pure server components; this view reads their telemetry straight off the
 * same-origin iframes rather than making them report it.
 *
 * Laid out to a fixed 1920×1080 board and scaled to whatever window it is in, so
 * what I see while building is exactly what records.
 */

/**
 * The recording frame. 2560×1440 — a 27" Studio/Cinema Display at its default
 * logical resolution, and exactly 16:9 so it drops into the slides untouched.
 * On a 5K panel the capture is 5120×2880 and downscales to 4K cleanly.
 *
 * For a Pro Display XDR, set 3008×1692; nothing else needs to change. The board
 * scales to fit whatever window it is open in, so a smaller screen just letterboxes.
 */
const BOARD_W = 2560;
const BOARD_H = 1440;

/** How much bigger this frame is than the 1080p one it was laid out against.
 *  The stage's OWN type multiplies by this — same pixel size in a wider frame is
 *  relatively smaller in the hall, and the rail is the one thing that has to read
 *  from the back of the room. The composed pages need no such correction: they get
 *  relatively larger, which is the entire point of the bigger board. */
const K = BOARD_W / 1920;

const PAD = Math.round(32 * K);
const GAP = Math.round(24 * K);
const PANE_GAP = Math.round(20 * K);

/** Deliberately NOT multiplied by K. The manifest pane has a fixed legibility
 *  requirement and was already comfortable at 1920; holding it still is what hands
 *  the extra width to the panes.
 *
 *  Came down from 820 once the blocks list replaced the wall of JSON. The list is
 *  short lines and does not need the width, and every pixel taken off here is three
 *  pixels given to the composed pages — the panes go from ~530px to ~583px each. */
const DRAWER_OPEN_W = 660;
/** Collapsed to a rail rather than to zero: the beat needs the cause on screen at
 *  the moment the pages change. Set to 0 to record the alternative. */
const DRAWER_RAIL_W = 200;

/** The width the composed pages believe they are rendering at. Unchanged — 1280 is
 *  the design canvas, and rendering them at some other width to make them fit would
 *  be showing the room a page the product does not have. */
const PANE_VIEWPORT = 1280;
/** Ceiling, not a fixed height — a pane is only as tall as its page. Budgeted so
 *  the consolidated rail is never pushed out of the frame. Came down from 1120 to
 *  pay for the pages/data switch above the panes; the tallest page is well under
 *  this, so nothing actually clipped. */
const PANE_MAX_H = 1060;
/** The switch row above the panes. */
const PANES_BAR_H = 56;

type Household = { id: string; label: string };
type Telemetry = Record<string, string>;

/**
 * The drawer's tabs, declared rather than derived from the file's top-level keys.
 *
 * Deriving them was honest but it put the JSON's own names on a projector, and two
 * of them are words the talk never teaches. `invariants` in particular reads as
 * "variation" at a glance — I misread my own tab. Beat 3 spends five minutes
 * teaching `obligation` and `assembly`, so those two keep their names and the demo
 * pays the vocabulary off; the two nobody was taught get replaced.
 *
 * `version` is gone from the row. It is one line, it never changes on stage, and it
 * belongs beside the hash in the header where it reads as provenance.
 *
 * A tab is not one key. `limits` holds `density` and `invariants` — both are "what
 * the model may not do", and separating a ceiling from a rule was a distinction the
 * file made and the room does not.
 */
type Tab = { id: string; label: string; keys: string[]; view?: "blocks" };

const TABS: Tab[] = [
  { id: "blocks", label: "blocks", keys: ["components"], view: "blocks" },
  { id: "obligations", label: "obligations", keys: ["obligations"] },
  { id: "assemblies", label: "assemblies", keys: ["assemblies"] },
  { id: "limits", label: "limits", keys: ["density", "invariants"] }
];

const tabFor = (key: string) => TABS.find((t) => t.id === key || t.keys.includes(key)) ?? TABS[0];

/* --- reading a component out of the vocabulary ------------------------------
   `components` is 350 of the manifest's 470 lines. Selecting it dropped a wall of
   JSON into an 820px pane — unreadable at projection distance, and unreadable is
   the same as absent when the whole point is that the room can see the cause.
   The list below is rendered FROM that JSON, never instead of it: `raw` is one
   click away and the editor underneath is unchanged. */

type Require = { fact: string; op: string; value: unknown };
type Component = {
  name: string;
  role?: string;
  requires?: Require[];
  adjacency?: { neverWith?: string[]; mustFollow?: string[]; maxPerPage?: number };
  carriesPhoto?: boolean;
  /** Struck out of the vocabulary. Still in the file, still in this list — see the
   *  toggle on each row and the note on `retired` in lib/manifest/load.ts. */
  retired?: boolean;
};

/** `user.techniqueRepeats` → `technique repeats`. The namespace prefix is dropped:
 *  which side a fact comes from is an implementation detail of the resolver, not
 *  something the room is being asked to hold. */
const humanize = (fact: string) =>
  fact
    .replace(/^[a-z]+\./, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase();

const OPS: Record<string, string> = { ">=": "≥", "<=": "≤", ">": ">", "<": "<" };

const conditionOf = (r: Require): string => {
  const fact = humanize(r.fact);
  if (r.op === "==") {
    if (r.value === true) return fact;
    if (r.value === false) return fact.startsWith("has ") ? `no ${fact.slice(4)}` : `not ${fact}`;
    return `${fact} = ${String(r.value)}`;
  }
  return `${fact} ${OPS[r.op] ?? r.op} ${String(r.value)}`;
};

/** `maxPerPage` is deliberately not here. Every component declares one, so it adds
 *  a line to all fifteen rows and distinguishes none of them. `mustFollow` and
 *  `neverWith` appear on six, and those six are the ones where the vocabulary is
 *  saying something about how blocks sit together. */
const adjacencyOf = (c: Component): string => {
  const parts: string[] = [];
  if (c.adjacency?.mustFollow?.length) parts.push(`follows ${c.adjacency.mustFollow.join(" / ")}`);
  if (c.adjacency?.neverWith?.length) parts.push(`never with ${c.adjacency.neverWith.join(" / ")}`);
  return parts.join(" · ");
};

/* --- the other cause ---------------------------------------------------------
   The manifest is the cause all three pages SHARE. The person is the cause that
   DIFFERS, and it was off screen — so the room had to take on trust that the input
   varied at all, which is precisely what a sceptic in the audience would not do.
   ⌘D swaps the three panes from the pages to the data that made them: same three
   columns, input instead of output, manifest still in frame.

   The two halves are not decoration. `gates` are evaluated in code and never
   reach the model; they decide what it is ALLOWED to use. `sent` is the six lines
   it actually receives; they decide how the allowed blocks are ARRANGED. A
   personalization engine has one of these. */

type HouseholdContext = {
  id: string;
  label: string;
  declared: { key: string; value: string }[];
  gates: { label: string; value: string; test: string | null; pass: boolean | null }[];
  vocabulary: { allowed: number; total: number };
  sent: string;
};

/** The slice arrives as `"components": [ … ]` — an object body, not an object. */
const parseSection = <T,>(text: string, key: string): T | null => {
  try {
    return (JSON.parse(`{${text}}`) as Record<string, T>)[key] ?? null;
  } catch {
    return null;
  }
};

type PaneState = {
  status: "idle" | "composing" | "ready";
  elapsed: number;
  telemetry: Telemetry;
  previous: Telemetry;
  /** Natural height of the composed page, measured from the frame. */
  contentH: number;
};

const blank = (): PaneState => ({ status: "idle", elapsed: 0, telemetry: {}, previous: {}, contentH: 0 });

/** Which numbers earn a line on the consolidated rail. The per-page rails keep the
 *  rest; at projection distance five values is the ceiling, and this is now five.
 *  `density` is here because editing `maxBlocks` moved nothing in frame without it
 *  — the second number moves on save whether or not the cap changes the page. */
const RAIL_KEYS = ["blocks", "density", "obligations", "vocabulary", "compose"] as const;

export const StageView = ({
  households,
  initialRaw,
  initialHash,
  initialSection
}: {
  households: Household[];
  initialRaw: string;
  initialHash: string;
  initialSection: string;
}) => {
  const [raw, setRaw] = useState(initialRaw);
  const [hash, setHash] = useState(initialHash);
  const [tabId, setTabId] = useState(() => tabFor(initialSection).id);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [rawMode, setRawMode] = useState(false);
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [gen, setGen] = useState(0);
  const [showData, setShowData] = useState(false);
  const [contexts, setContexts] = useState<HouseholdContext[]>([]);
  const [panes, setPanes] = useState<Record<string, PaneState>>(
    () => Object.fromEntries(households.map((h) => [h.id, blank()]))
  );

  const frames = useRef<Record<string, HTMLIFrameElement | null>>({});
  /* The scroll containers, so a recompose can put every pane back to the top of its
     new page — see the note in `recompose`. */
  const viewports = useRef<Record<string, HTMLDivElement | null>>({});
  const started = useRef<Record<string, number>>({});

  /* The slices of the manifest this tab holds. Fetched rather than computed here so
     the scanner stays on the server, in one place. */
  const loadTab = useCallback(async (id: string) => {
    const tab = TABS.find((t) => t.id === id) ?? TABS[0];
    const loaded = await Promise.all(
      tab.keys.map(async (key) => {
        const res = await fetch(`/api/manifest/section?key=${encodeURIComponent(key)}`, { cache: "no-store" });
        const data = (await res.json()) as { text: string; raw: string; hash: string };
        return [key, data] as const;
      })
    );
    setTexts(Object.fromEntries(loaded.map(([key, d]) => [key, d.text])));
    setRaw(loaded[loaded.length - 1][1].raw);
    setHash(loaded[loaded.length - 1][1].hash);
    setDirty({});
    setError(null);
  }, []);

  useEffect(() => {
    void loadTab(tabId);
  }, [tabId, loadTab]);

  /* Elapsed-time counters. Real numbers, ticking in frame — §14 wants honest
     artifacts, and a live counter is the most honest one available. */
  useEffect(() => {
    const composing = Object.values(panes).some((p) => p.status === "composing");
    if (!composing) return;
    const t = setInterval(() => {
      setPanes((prev) => {
        const next = { ...prev };
        for (const id of Object.keys(next)) {
          if (next[id].status === "composing") {
            next[id] = { ...next[id], elapsed: Date.now() - (started.current[id] ?? Date.now()) };
          }
        }
        return next;
      });
    }, 47);
    return () => clearInterval(t);
  }, [panes]);

  const recompose = useCallback(() => {
    const now = Date.now();
    /* Back to the top of each pane. Two reasons: the page about to arrive is a new
       one and its opening is the thing to look at, and the "composing" veil is an
       absolutely positioned child of the scroll container — scrolled down, it sits
       above the visible area and the pane appears to do nothing for four seconds. */
    for (const v of Object.values(viewports.current)) if (v) v.scrollTop = 0;
    setPanes((prev) => {
      const next: Record<string, PaneState> = {};
      for (const [id, p] of Object.entries(prev)) {
        started.current[id] = now;
        /* Keep the last height: the pane holds its size through the recompose
           rather than collapsing to nothing and springing back. */
        next[id] = { status: "composing", elapsed: 0, telemetry: {}, previous: p.telemetry, contentH: p.contentH };
      }
      return next;
    });
    setGen((g) => g + 1);
  }, []);

  const save = useCallback(async () => {
    /* Nothing edited still writes and still recomposes. It is a no-op against the
       file — the same bytes go back, so the hash does not move — but it is the only
       way to re-trigger three compositions without touching the manifest, and on
       camera a take sometimes needs exactly that. */
    const edited = Object.keys(dirty).filter((k) => dirty[k]);
    const pending = edited.length ? edited : (TABS.find((t) => t.id === tabId) ?? TABS[0]).keys;

    setSaving(true);
    setError(null);

    /* Sequential, not parallel: each PUT reads the file, splices one section and
       writes the whole thing back. Two concurrent writes would race and the later
       one would land on top of a file it never read. */
    let hashOut = hash;
    let rawOut = raw;
    for (const key of pending) {
      const res = await fetch("/api/manifest/section", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, text: texts[key] })
      });
      const data = (await res.json()) as { ok: boolean; error?: string; hash?: string; raw?: string };
      if (!data.ok) {
        setSaving(false);
        setError(data.error ?? "rejected");
        return;
      }
      hashOut = data.hash!;
      rawOut = data.raw!;
    }

    setSaving(false);
    setError(null);
    setDirty({});
    setHash(hashOut);
    setRaw(rawOut);
    recompose();
  }, [dirty, texts, hash, raw, tabId, recompose]);

  /* Fetched once, on the first ⌘D. Doing it on mount would run three profile loads
     and a facts pass before the pages have composed, for a panel that may never be
     opened — and the composition is what the clock in frame is timing. */
  const loadContexts = useCallback(async () => {
    const res = await fetch("/api/context", { cache: "no-store" });
    const data = (await res.json()) as { households: HouseholdContext[] };
    setContexts(data.households);
  }, []);

  /* The fetch used to live inside the setShowData updater, which is a side effect in
     a place React is allowed to call twice. Out here it runs once, and the button
     and the shortcut go through the same path. */
  const toggleData = useCallback(() => {
    if (contexts.length === 0) void loadContexts();
    setShowData((d) => !d);
  }, [contexts.length, loadContexts]);

  /* ⌘S saves. ⌘\ collapses. ⌘D shows the data. All scripted before recording — no
     cursor hunting. Every one of them also has a button: a shortcut nobody can see
     is a feature nobody knows is there, which is how this one shipped invisible. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void save();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        toggleData();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, toggleData]);

  /* Scale the fixed board into whatever window it is being viewed in. Recording
     happens at 1:1; this only makes it workable on a laptop.
     *
     * The offset is computed here rather than left to `place-items: center`, and
     * that is not a preference. `transform` does not change layout, so the board's
     * layout box stays 2560×1440 however small it is drawn — and a centred item
     * that overflows its grid area gets clamped to the start edge, so the box ran
     * 0→2560 and scaling about its own centre parked it at 560px on a 1440 window.
     * Two fifths of the board was off-screen under `overflow: hidden` on every
     * display narrower than 2560 CSS px, which is every display except the one it
     * was built on. Origin at the top left and an explicit offset makes the maths
     * the same at every size. */
  const [fitted, setFitted] = useState({ scale: 1, left: 0, top: 0 });
  useEffect(() => {
    const measure = () => {
      const scale = Math.min(window.innerWidth / BOARD_W, window.innerHeight / BOARD_H, 1);
      setFitted({
        scale,
        left: Math.round((window.innerWidth - BOARD_W * scale) / 2),
        top: Math.round((window.innerHeight - BOARD_H * scale) / 2)
      });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const tab = TABS.find((t) => t.id === tabId) ?? TABS[0];
  const anyDirty = Object.values(dirty).some(Boolean);
  /* Provenance, in the header rather than on a tab of its own. */
  const version = (() => {
    try {
      return (JSON.parse(raw) as { version?: string }).version ?? "";
    } catch {
      return "";
    }
  })();
  const components = tab.view === "blocks" ? parseSection<Component[]>(texts.components ?? "", "components") : null;
  const showBlocks = tab.view === "blocks" && !rawMode && components !== null;

  const drawerW = open ? DRAWER_OPEN_W : DRAWER_RAIL_W;
  /* Divided by however many households are on the board, not by three. It was two
     panes' worth of hardcoding away from being a two-up, and two-up is what the
     finale wants — see the note on the stage route. */
  const paneW =
    (BOARD_W - PAD * 2 - GAP - drawerW - PANE_GAP * (households.length - 1)) / households.length;
  const scale = paneW / PANE_VIEWPORT;

  const onFrameLoad = (id: string) => {
    const el = frames.current[id];
    if (!el) return;
    const doc = el.contentDocument;
    const telemetry: Telemetry = {};
    doc?.querySelectorAll<HTMLElement>("[data-k]").forEach((n) => {
      const k = n.dataset.k;
      const v = n.dataset.v;
      if (k && v !== undefined) telemetry[k] = v;
    });
    /* Measured from the children, not from scrollHeight. The iframe is given a tall
       height so the page has room to lay out; anything inside it sized to the
       viewport then reports that tall height straight back, and the pane never
       shrinks. The bottom of the last real element is the only honest answer. */
    const kids = doc ? (Array.from(doc.body.children) as HTMLElement[]) : [];
    const contentH = kids.length
      ? Math.ceil(Math.max(...kids.map((n) => n.getBoundingClientRect().bottom)))
      : (doc?.documentElement?.scrollHeight ?? 0);
    setPanes((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        status: "ready",
        elapsed: Date.now() - (started.current[id] ?? Date.now()),
        telemetry,
        contentH
      }
    }));
  };

  return (
    <div className={styles.fitter}>
      <div
        className={styles.board}
        style={{
          width: BOARD_W,
          height: BOARD_H,
          left: fitted.left,
          top: fitted.top,
          transform: `scale(${fitted.scale})`,
          ["--stage-k" as string]: K
        }}
      >
        <div className={styles.split} style={{ padding: PAD, gap: GAP }}>
          {/* ---- the cause -------------------------------------------------- */}
          <aside className={styles.drawer} style={{ width: drawerW }} data-open={open}>
            <header className={styles.drawerHead}>
              <span className={styles.label}>manifest</span>
              {/* Open only. Collapsed, the head has a 200px rail to wrap in, and a
                  version that never changes was taking a whole line off the one
                  panel that has to be read from the back of the room. */}
              {open && version && <span className={styles.version}>v{version}</span>}
              <span className={styles.hash}>{hash}</span>
              <button className={styles.toggle} onClick={() => setOpen((o) => !o)} type="button">
                {open ? "hide ⌘\\" : "edit ⌘\\"}
              </button>
            </header>

            {open ? (
              <>
                {/* One row, never two. Four tabs is what the width holds at a size the
                    room can read; wrapping to a second line read as a layout accident
                    on camera and cost a line of vertical budget the editor wanted. */}
                <nav className={styles.sections}>
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={styles.sectionTab}
                      data-active={t.id === tabId}
                      onClick={() => {
                        setTabId(t.id);
                        setRawMode(false);
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                  {tab.view === "blocks" && (
                    <button
                      type="button"
                      className={styles.rawToggle}
                      data-active={rawMode}
                      onClick={() => setRawMode((r) => !r)}
                    >
                      {rawMode ? "list" : "raw"}
                    </button>
                  )}
                </nav>

                {showBlocks ? (
                  /* The vocabulary, read. Fifteen names, what each one is allowed to
                     be, and the condition that has to hold before the model may even
                     see it — which is the `permission` half of beat 3, on screen,
                     rather than four hundred lines of it. */
                  <div className={styles.blocks}>
                    {components!.map((c) => (
                      <div key={c.name} className={styles.block} data-retired={Boolean(c.retired)}>
                        <div className={styles.blockHead}>
                          {/* STRIKE A BLOCK OUT OF THE VOCABULARY, in one click.
                              The finale used to mean switching the drawer to raw,
                              finding one object in 350 lines of JSON, and deleting
                              it without breaking a comma — which is not a thing to
                              do live in front of six hundred people. This writes the
                              same edit the file would have got, and ⌘S still does the
                              saving, so the beat is unchanged: strike it, save, watch
                              three pages rebuild.

                              Filled means IN the vocabulary. Empty means struck, and
                              the row goes dim and strikes through — one click back if
                              the wrong one goes. */}
                          <button
                            type="button"
                            className={styles.blockToggle}
                            data-in={!c.retired}
                            aria-pressed={!c.retired}
                            title={c.retired ? `Put ${c.name} back in the vocabulary` : `Take ${c.name} out of the vocabulary`}
                            onClick={() => {
                              setTexts((prev) => ({
                                ...prev,
                                components: setRetired(prev.components ?? "", c.name, !c.retired)
                              }))
                              setDirty((prev) => ({ ...prev, components: true }))
                            }}
                          />
                          <span className={styles.blockName}>{c.name}</span>
                          <span className={styles.blockRole} data-lead={c.role === "lead"}>
                            {c.retired ? "removed" : c.role ?? ""}
                          </span>
                        </div>
                        <div className={styles.blockNeeds}>
                          {c.requires?.length
                            ? c.requires.map(conditionOf).join(" · ")
                            : "no conditions — always eligible"}
                        </div>
                        {adjacencyOf(c) && <div className={styles.blockAdjacency}>{adjacencyOf(c)}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Raw, and still the thing that gets typed into. A tab can hold more
                     than one section — `limits` holds two — so each gets its own
                     editor and its own splice. */
                  <div className={styles.editors}>
                    {tab.keys.map((key) => (
                      /* Sized by line count rather than split evenly. `density` is
                         four lines and `invariants` is eight; halving the pane gave
                         the short one a field of black and made the long one scroll. */
                      <div
                        key={key}
                        className={styles.editorGroup}
                        style={{ flexGrow: (texts[key] ?? "").split("\n").length }}
                      >
                        {tab.keys.length > 1 && <span className={styles.editorLabel}>{key}</span>}
                        <textarea
                          className={styles.editor}
                          spellCheck={false}
                          value={texts[key] ?? ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            setTexts((prev) => ({ ...prev, [key]: value }));
                            setDirty((prev) => ({ ...prev, [key]: true }));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <footer className={styles.drawerFoot}>
                  <button
                    className={styles.save}
                    type="button"
                    onClick={() => void save()}
                    disabled={saving}
                  >
                    {saving ? "writing…" : anyDirty ? "save ⌘S" : "saved"}
                  </button>
                  {error && <pre className={styles.error}>{error}</pre>}
                </footer>
              </>
            ) : (
              /* Collapsed, but never to nothing. The room has to be able to see what
                 caused the change while the change is happening. */
              <div className={styles.railed}>
                <span className={styles.railedKey}>section</span>
                <span className={styles.railedValue}>{tab.label}</span>
                <span className={styles.railedKey}>entries</span>
                <span className={styles.railedValue}>
                  {tab.keys.reduce((n, k) => n + ((texts[k] ?? "").match(/"name":/g) ?? []).length, 0) || "—"}
                </span>
                <span className={styles.railedKey}>bytes</span>
                <span className={styles.railedValue}>{raw.length}</span>
              </div>
            )}
          </aside>

          {/* ---- the effect --------------------------------------------------- */}
          <div className={styles.panesCol}>
            {/* What the three columns are showing. Two causes make these pages: the
                manifest, on the left, which all three share — and the person, which
                is what differs. This switches the columns between the second cause
                and its result. */}
            <div className={styles.panesBar} style={{ height: PANES_BAR_H }}>
              <span className={styles.label}>
                {showData ? "the people — what each page was made from" : "the pages"}
              </span>
              <div className={styles.switch}>
                <button
                  type="button"
                  className={styles.switchOption}
                  data-active={!showData}
                  onClick={() => showData && toggleData()}
                >
                  pages
                </button>
                <button
                  type="button"
                  className={styles.switchOption}
                  data-active={showData}
                  onClick={() => !showData && toggleData()}
                >
                  data ⌘D
                </button>
              </div>
            </div>

            <section className={styles.panes} style={{ gap: PANE_GAP }}>
            {households.map((h) => {
              const p = panes[h.id];
              /* A pane is as tall as its page, capped. Composed pages differ in
                 length by design — that difference is part of what the room is
                 looking at, and padding them all to a common height hides it. */
              const frameH = p.contentH || PANE_MAX_H / scale;
              /* What the page measures once it has been scaled down: the height it
                 actually OCCUPIES, as opposed to the height it lays out at. The two
                 are different because `transform` does not change layout, and that
                 difference is why the pane needed a box of its own to scroll — see
                 the note on `.frameBox`. */
              const drawnH = frameH * scale;
              const viewportH = Math.min(PANE_MAX_H, drawnH);
              return (
                <article key={h.id} className={styles.pane} style={{ width: paneW }}>
                  <header className={styles.paneHead}>
                    {/* New tab, deliberately: the stage view holds three live
                        compositions and navigating away throws them out. */}
                    <a
                      className={styles.paneLabel}
                      href={`/h/${h.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {h.label}
                    </a>
                    <span className={styles.paneTime} data-live={p.status === "composing"}>
                      {p.status === "idle" ? "—" : `${(p.elapsed / 1000).toFixed(1)}s`}
                    </span>
                  </header>
                  {showData ? (
                    /* Same column, same width, input instead of output. The iframes
                       are left mounted underneath — unmounting them would throw away
                       three live compositions and the next ⌘D would cost four
                       seconds and a model call each to get back. */
                    <div className={styles.data} style={{ width: paneW, height: PANE_MAX_H }}>
                      {(() => {
                        const c = contexts.find((x) => x.id === h.id);
                        if (!c) return <div className={styles.dataLoading}>reading…</div>;
                        return (
                          <>
                            <div className={styles.dataGroup}>
                              <div className={styles.dataHead}>
                                <span className={styles.dataTitle}>What they told us</span>
                                <span className={styles.dataNote}>at signup</span>
                              </div>
                              {c.declared.map((d) => (
                                <div key={d.key} className={styles.dataRow}>
                                  <span className={styles.dataKey}>{d.key}</span>
                                  <span className={styles.dataValue}>{d.value}</span>
                                </div>
                              ))}
                            </div>

                            <div className={styles.dataGroup}>
                              <div className={styles.dataHead}>
                                <span className={styles.dataTitle}>What they did</span>
                                {/* Where the number in the rail comes from. */}
                                <span className={styles.dataNote}>
                                  → vocabulary {c.vocabulary.allowed}/{c.vocabulary.total}
                                </span>
                              </div>
                              {c.gates.map((g) => (
                                <div key={g.label} className={styles.dataRow}>
                                  <span className={styles.dataKey}>{g.label}</span>
                                  <span className={styles.dataValue}>{g.value}</span>
                                  {g.test && (
                                    <span className={styles.dataTest} data-pass={g.pass}>
                                      {g.test}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>

                            <div className={styles.dataGroup}>
                              <div className={styles.dataHead}>
                                <span className={styles.dataTitle}>What the model is told</span>
                                <span className={styles.dataNote}>verbatim</span>
                              </div>
                              <pre className={styles.dataSent}>{c.sent}</pre>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ) : null}
                  <div
                    className={styles.viewport}
                    ref={(el) => {
                      viewports.current[h.id] = el;
                    }}
                    style={{ width: paneW, height: viewportH, display: showData ? "none" : undefined }}
                  >
                    {/* A BOX THE SIZE THE PAGE IS DRAWN AT, so the pane can scroll.
                        The iframe lays out at the page's full height and is then
                        scaled down by a transform — and `transform` does not change
                        layout, so the scroll container saw a 2,200px child while only
                        1,529px of it was on screen. Scrolling it ran a third of the
                        way past the end into black. This box takes the DRAWN height,
                        so the scroll range is exactly what is visible. */}
                    <div className={styles.frameBox} style={{ width: paneW, height: drawnH }}>
                    <iframe
                      ref={(el) => {
                        frames.current[h.id] = el;
                      }}
                      key={`${h.id}-${gen}`}
                      className={styles.frame}
                      /* `strip=0` — the vocabulary strip stays out of here.
                         Two reasons, and the second is mechanical. The stage is the
                         playground: three page SHAPES beside the manifest that
                         causes them, and a strip enumerating the vocabulary a third
                         time in a pane 578px wide is noise on the one screen that
                         cannot afford any. And the pane height is measured from the
                         bottom of the last child, so an 860px instrument under every
                         page silently triples the frame each one is drawn into. */
                      src={`/h/${h.id}?v=${gen}&strip=0`}
                      title={h.label}
                      style={{
                        width: PANE_VIEWPORT,
                        height: frameH,
                        transform: `scale(${scale})`
                      }}
                      onLoad={() => onFrameLoad(h.id)}
                    />
                    </div>
                    {p.status === "composing" && <div className={styles.composing}>composing</div>}
                  </div>
                </article>
              );
            })}
            </section>
          </div>
        </div>

        {/* ---- the consolidated rail ----------------------------------------
            The numeric half of the proof, and the only thing here that has to be
            legible from the back of the room. `obligations 2 → 3` on Twin A while
            Twin B holds still is the finale in one line. */}
        <footer className={styles.rail}>
          <div className={styles.railHead}>
            <span className={styles.label}>manifest</span>
            <span className={styles.hash}>{hash}</span>
          </div>
          {households.map((h) => {
            const p = panes[h.id];
            return (
              <div key={h.id} className={styles.railRow}>
                <span className={styles.railHousehold}>{h.label}</span>
                {RAIL_KEYS.map((k) => {
                  const now = p.telemetry[k];
                  const before = p.previous[k];
                  /* Latency changes on every run and means nothing as a delta —
                     showing it as one puts noise in acid next to the number that is
                     actually the proof. Diff the structural values only. */
                  const changed =
                    k !== "compose" && before !== undefined && now !== undefined && before !== now;
                  return (
                    <span key={k} className={styles.railPair}>
                      <span className={styles.railKey}>{k}</span>
                      {changed && <span className={styles.railWas}>{before} →</span>}
                      <span className={styles.railValue} data-changed={changed}>
                        {now ?? "—"}
                      </span>
                    </span>
                  );
                })}
              </div>
            );
          })}
        </footer>
      </div>
    </div>
  );
};
