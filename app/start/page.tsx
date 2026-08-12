import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";

import { SiteChrome } from "@/components/blocks/site-chrome";
import { SectionHead } from "@/components/layout/section-head";
import { occasionPhase } from "@/lib/compose/gates";
import { daysUntil } from "@/lib/occasion";
import type { Household, Occasion } from "@/lib/signals/types";
import styles from "./page.module.css";

/**
 * The index of the demo. Not part of the argument — a way in.
 *
 * Every other route here is a claim about composition; this one is a list of
 * doors, hand-written the way a run sheet is. The one thing it does compute is
 * the occasion's moments, from the fixture rather than from a hardcoded table of
 * dates, so that moving the dinner in `occasions.json` moves the links with it.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const read = async <T,>(p: string): Promise<T> =>
  JSON.parse(await readFile(path.join(process.cwd(), p), "utf8")) as T;

const shift = (iso: string, days: number): string => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const pretty = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short"
  });

type Row = { href: string; name: string; note: string; tag?: string };

const WORD = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"];
const count = (n: number) => WORD[n] ?? String(n);

const Rows = ({ rows }: { rows: Row[] }) => (
  <div className={styles.rows}>
    {rows.map((row) => (
      <Link key={row.href} href={row.href} className={styles.row}>
        <span className={styles.name}>{row.name}</span>
        <span className={styles.note}>{row.note}</span>
        {/* Always rendered, empty or not: a skipped cell collapses the grid and the
            URL column jumps left on the rows that have no tag. */}
        <span className={styles.tag}>{row.tag ?? ""}</span>
        <span className={styles.href}>{row.href}</span>
      </Link>
    ))}
  </div>
);

const StartPage = async () => {
  const { households } = await read<{ households: Household[] }>("lib/content/households.json");
  const { occasions } = await read<{ occasions: Occasion[] }>("lib/content/occasions.json");

  const HOUSEHOLD_NOTE: Record<string, string> = {
    "h-learner": "One person, learning. Repeats nothing, abandons long lists — and has eight people coming.",
    "h-twin-a": "Six people, confident, dairy-free. Identical declared data to Twin B.",
    "h-twin-b": "Six people, confident, dairy-free. Identical declared data to Twin A — the pages are not."
  };

  /* The moments, derived. `scheduledOn` is the earliest day the occasion exists at
     all, so it sets the far end; the rest are the phase thresholds in gates.ts,
     picked one day inside each band. */
  const occasion = occasions[0];
  const planned = occasion ? daysUntil(occasion, new Date(`${occasion.scheduledOn}T12:00:00`)) : 0;
  const offsets = [...new Set([planned, 9, 2, 0])].filter((n) => n >= 0 && n <= planned).sort((a, b) => b - a);

  const moments: Row[] = occasion
    ? [
        {
          href: `/h/${occasion.householdId}?today=${shift(occasion.scheduledOn, -1)}`,
          name: pretty(shift(occasion.scheduledOn, -1)),
          note: "Before anyone filled the form. The household's ordinary page.",
          tag: "no occasion"
        },
        ...offsets.map((n) => ({
          href: `/h/${occasion.householdId}?today=${shift(occasion.date, -n)}`,
          name: pretty(shift(occasion.date, -n)),
          note:
            {
              choosing: "Deciding what to cook. The menu is the question.",
              shopping: "Buying it. The list is what the page is about.",
              prep: "Getting ahead of it, sequenced against the date.",
              cooking: "The day itself. No stage that says order the pork.",
              none: ""
            }[occasionPhase(n)],
          tag: `${occasionPhase(n)} · ${n === 0 ? "the day" : `T−${n}`}`
        })),
        {
          href: `/h/${occasion.householdId}?today=${shift(occasion.date, 1)}`,
          name: pretty(shift(occasion.date, 1)),
          note: "It expired. Nothing was deleted; it simply stopped being true.",
          tag: "no occasion"
        }
      ]
    : [];

  return (
    <>
      <SiteChrome />

      <main className={styles.sheet}>
        <div className={styles.head}>
          <h1 className={styles.title}>Mise, from the top</h1>
          <p className={styles.lede}>
            Every route in the demo. The pages are composed at request time from one
            vocabulary; this index is not — it is a hand-written list of doors, which is
            the difference the whole thing is about.
          </p>
        </div>

        {/* THE RUN SHEET, IN THE ORDER IT IS PERFORMED.
            Everything below this section is available and none of it is in the five
            minutes. The list used to be organised by what a route IS, which is how
            thirteen equally-weighted doors ended up on one screen — a tour rather
            than an argument, and no way to tell from the page which four mattered. */}
        <section className={styles.section}>
          <SectionHead title="The demo, in order" rule="signal" />
          <p className={styles.aside}>
            Four moves. Each one is a different instrument: a page, the same page
            re-gated, the comparison with no pages at all, and the playground.
          </p>
          <Rows
            rows={[
              {
                href: "/",
                name: "The home page",
                note: "Hand-authored, in advance. No household, no model, no signal.",
                tag: "0 · the ground"
              },
              {
                href: "/h/h-learner",
                name: "The learner",
                note: "One page, full size, with the vocabulary strip under it. A recipe site with no recipe on it.",
                tag: "1 · the page"
              },
              {
                href: "/h/h-learner?facts=technique:0",
                name: "…with one fact forced",
                note: "Six chips move and no model is called. Eligibility is code. Then compose from what is left.",
                tag: "2 · the gate"
              },
              {
                href: "/twins",
                name: "The twins",
                note: "Same form at signup, byte for byte. The two pages side by side, and six numbers underneath saying why.",
                tag: "3 · the proof"
              },
              {
                href: "/stage",
                name: "The split screen",
                note: "The manifest beside the same two pages. Strike a block out of the vocabulary and both rebuild.",
                tag: "4 · the ending"
              }
            ]}
          />
        </section>

        <section className={styles.section}>
          <SectionHead title="The three households" rule="default" />
          <Rows
            rows={households.map((h) => ({
              href: `/h/${h.id}`,
              name: h.label,
              note: HOUSEHOLD_NOTE[h.id] ?? `${h.declared.size} people`,
              tag: `${h.declared.size} · ${h.declared.statedSkill}`
            }))}
          />
        </section>

        {occasion ? (
          <section className={styles.section}>
            <SectionHead title={`Cut from the demo — the occasion, from ${count(moments.length)} distances`} rule="default" />
            <p className={styles.aside}>
              Built and working, and out of the five minutes: it is a second proof of
              the same thesis and it needs its own setup. One fixture —{" "}
              {occasion.label.toLowerCase()} on {pretty(occasion.date)} — seen from{" "}
              {count(moments.length)} days, no page written per moment.{" "}
              <span className={styles.code}>?today=</span> moves the clock and nothing else.
            </p>
            <Rows rows={moments} />
          </section>
        ) : null}

        <section className={styles.section}>
          <SectionHead title="Reference" rule="default" />
          <Rows
            rows={[
              {
                href: "/kit",
                name: "The specimen sheet",
                note: "Every block in the vocabulary, at every treatment, with no model involved."
              }
            ]}
          />
        </section>

        <section className={styles.section}>
          <SectionHead title="The endpoints" rule="default" />
          <Rows
            rows={[
              {
                href: "/api/context",
                name: "Household context",
                note: "What each household's data is, split into what gates in code and what the model is sent."
              },
              {
                href: "/api/manifest",
                name: "The manifest",
                note: "Re-read from disk on every request, which is what makes editing it change pages with no rebuild."
              }
            ]}
          />
        </section>
      </main>
    </>
  );
};

export default StartPage;
