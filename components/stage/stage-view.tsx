"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./stage-view.module.css";

/**
 * The split screen. Manifest on the left, three composed households on the right.
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
 *  requirement — a column of 17px mono — and it was already comfortable at 1920.
 *  Holding it still is what hands the extra width to the panes: they go from 344px
 *  to ~530px open, and from 544px to ~730px collapsed. */
const DRAWER_OPEN_W = 820;
/** Collapsed to a rail rather than to zero: the beat needs the cause on screen at
 *  the moment the pages change. Set to 0 to record the alternative. */
const DRAWER_RAIL_W = 200;

/** The width the composed pages believe they are rendering at. Unchanged — 1280 is
 *  the design canvas, and rendering them at some other width to make them fit would
 *  be showing the room a page the product does not have. */
const PANE_VIEWPORT = 1280;
/** Ceiling, not a fixed height — a pane is only as tall as its page. Budgeted so
 *  the consolidated rail is never pushed out of the frame. */
const PANE_MAX_H = 1120;

type Household = { id: string; label: string };
type Telemetry = Record<string, string>;

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
 *  rest; at projection distance five values is the ceiling. */
const RAIL_KEYS = ["blocks", "obligations", "vocabulary", "compose"] as const;

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
  const [section, setSection] = useState(initialSection);
  const [text, setText] = useState("");
  const [sectionKeys, setSectionKeys] = useState<string[]>([]);
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [gen, setGen] = useState(0);
  const [panes, setPanes] = useState<Record<string, PaneState>>(
    () => Object.fromEntries(households.map((h) => [h.id, blank()]))
  );

  const frames = useRef<Record<string, HTMLIFrameElement | null>>({});
  const started = useRef<Record<string, number>>({});

  /* The slice of the manifest currently in the textarea. Fetched rather than
     computed here so the scanner stays on the server, in one place. */
  const loadSection = useCallback(async (key: string) => {
    const res = await fetch(`/api/manifest/section?key=${encodeURIComponent(key)}`, { cache: "no-store" });
    const data = (await res.json()) as { text: string; keys: string[]; raw: string; hash: string };
    setText(data.text);
    setSectionKeys(data.keys);
    setRaw(data.raw);
    setHash(data.hash);
    setDirty(false);
  }, []);

  useEffect(() => {
    void loadSection(section);
  }, [section, loadSection]);

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
    setSaving(true);
    setError(null);
    const res = await fetch("/api/manifest/section", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: section, text })
    });
    const data = (await res.json()) as { ok: boolean; error?: string; hash?: string; raw?: string };
    setSaving(false);

    if (!data.ok) {
      setError(data.error ?? "rejected");
      return;
    }
    setError(null);
    setDirty(false);
    setHash(data.hash!);
    setRaw(data.raw!);
    recompose();
  }, [section, text, recompose]);

  /* ⌘S saves. ⌘\ collapses. Both scripted before recording — no cursor hunting. */
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
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  /* Scale the fixed board into whatever window it is being viewed in. Recording
     happens at 1:1; this only makes it workable on a laptop. */
  const [fit, setFit] = useState(1);
  useEffect(() => {
    const measure = () => setFit(Math.min(window.innerWidth / BOARD_W, window.innerHeight / BOARD_H, 1));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const drawerW = open ? DRAWER_OPEN_W : DRAWER_RAIL_W;
  const paneW = (BOARD_W - PAD * 2 - GAP - drawerW - PANE_GAP * 2) / 3;
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
        style={{ width: BOARD_W, height: BOARD_H, transform: `scale(${fit})`, ["--stage-k" as string]: K }}
      >
        <div className={styles.split} style={{ padding: PAD, gap: GAP }}>
          {/* ---- the cause -------------------------------------------------- */}
          <aside className={styles.drawer} style={{ width: drawerW }} data-open={open}>
            <header className={styles.drawerHead}>
              <span className={styles.label}>manifest</span>
              <span className={styles.hash}>{hash}</span>
              <button className={styles.toggle} onClick={() => setOpen((o) => !o)} type="button">
                {open ? "hide ⌘\\" : "edit ⌘\\"}
              </button>
            </header>

            {open ? (
              <>
                <nav className={styles.sections}>
                  {sectionKeys
                    .filter((k) => !k.startsWith("_"))
                    .map((k) => (
                      <button
                        key={k}
                        type="button"
                        className={styles.sectionTab}
                        data-active={k === section}
                        onClick={() => setSection(k)}
                      >
                        {k}
                      </button>
                    ))}
                </nav>

                <textarea
                  className={styles.editor}
                  spellCheck={false}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setDirty(true);
                  }}
                />

                <footer className={styles.drawerFoot}>
                  <button className={styles.save} type="button" onClick={() => void save()} disabled={saving}>
                    {saving ? "writing…" : dirty ? "save ⌘S" : "saved"}
                  </button>
                  {error && <pre className={styles.error}>{error}</pre>}
                </footer>
              </>
            ) : (
              /* Collapsed, but never to nothing. The room has to be able to see what
                 caused the change while the change is happening. */
              <div className={styles.railed}>
                <span className={styles.railedKey}>section</span>
                <span className={styles.railedValue}>{section}</span>
                <span className={styles.railedKey}>entries</span>
                <span className={styles.railedValue}>{(text.match(/"name":/g) ?? []).length || "—"}</span>
                <span className={styles.railedKey}>bytes</span>
                <span className={styles.railedValue}>{raw.length}</span>
              </div>
            )}
          </aside>

          {/* ---- the effect --------------------------------------------------- */}
          <section className={styles.panes} style={{ gap: PANE_GAP }}>
            {households.map((h) => {
              const p = panes[h.id];
              /* A pane is as tall as its page, capped. Composed pages differ in
                 length by design — that difference is part of what the room is
                 looking at, and padding them all to a common height hides it. */
              const frameH = p.contentH || PANE_MAX_H / scale;
              const viewportH = Math.min(PANE_MAX_H, frameH * scale);
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
                  <div className={styles.viewport} style={{ width: paneW, height: viewportH }}>
                    <iframe
                      ref={(el) => {
                        frames.current[h.id] = el;
                      }}
                      key={`${h.id}-${gen}`}
                      className={styles.frame}
                      src={`/h/${h.id}?v=${gen}`}
                      title={h.label}
                      style={{
                        width: PANE_VIEWPORT,
                        height: frameH,
                        transform: `scale(${scale})`
                      }}
                      onLoad={() => onFrameLoad(h.id)}
                    />
                    {p.status === "composing" && <div className={styles.composing}>composing</div>}
                  </div>
                </article>
              );
            })}
          </section>
        </div>

        {/* ---- the consolidated rail ----------------------------------------
            The numeric half of the proof, and the only thing here that has to be
            legible from the back of the room. `obligations 0 → 1` on two
            households and `0 → 0` on the third is beat 6 in one line. */}
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
