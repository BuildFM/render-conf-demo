import { notFound } from "next/navigation";

import { runPipeline } from "@/lib/compose/pipeline";
import { SectionHead } from "@/components/layout/section-head";
import { SiteChrome } from "@/components/blocks/site-chrome";
import { VocabularyStrip } from "@/components/stage/vocabulary-strip";
import styles from "./page.module.css";

/**
 * TWO PAGES, SIDE BY SIDE. The diagnostics are the footnote.
 *
 * This view was the other way round — two vocabulary strips and no pages at all —
 * and it was the wrong shape for the room. It is the beat carrying the sharpest
 * claim in the talk (two people filled in the same form and got different products),
 * and it was the only move with no interface on screen. The strip explains WHY two
 * pages differ; it cannot stand in for the difference. To an audience of designers
 * that reads as a debugging session, and by the time you are three moves deep in
 * instruments the argument has stopped being about design.
 *
 * So: the pages carry it, and the evidence sits underneath in six numbers and five
 * facts. Moves 1 and 2 have already taught what the three states mean, so this view
 * can spend them rather than teach them again.
 *
 * The pages render UNSCALED in half-width windows, not shrunk-to-fit. A page scaled
 * to 0.5 puts 15px type at 7px and the room sees a texture; rendered natively at
 * ~690px it is a real responsive render of the real page and the type stays 15px.
 * What is being compared here is SHAPE, and shape survives the narrower measure.
 *
 * A fixed-height window with the overflow hidden, deliberately: it shows the top of
 * each page, which is where the difference is loudest, and it needs no client
 * JavaScript to measure anything. The alternative was a third client component and a
 * measurement race in the middle of a live demo.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TWINS = ["h-twin-a", "h-twin-b"];

const TwinsPage = async ({
  searchParams
}: {
  searchParams?: Promise<{ today?: string }>;
}) => {
  const { today } = (await searchParams) ?? {};

  /* Sequential, not Promise.all. Both households hit the same compose path and the
     second usually wants the first's manifest read and profile load already warm. */
  const runs: NonNullable<Awaited<ReturnType<typeof runPipeline>>>[] = [];
  for (const id of TWINS) {
    const r = await runPipeline({ householdId: id, today });
    if (r) runs.push(r);
  }
  if (runs.length !== TWINS.length) notFound();

  const [a, b] = runs;
  const declared = a.household.declared;
  const q = today ? `&today=${today}` : "";

  /**
   * HOW MANY BLOCKS ACTUALLY DIFFER — and it is the number this view was missing.
   *
   * The two households qualify for the same NUMBER of blocks, which means the three
   * counts underneath each page read identically and the evidence appears to show
   * nothing. It is not nothing: they qualify for a different nine. Counting the
   * blocks whose state differs is the one figure that says so, and it is a better
   * sentence than any of the six numbers above it.
   */
  const stateIn = (r: (typeof runs)[number]) => {
    const eligible = new Set(r.allowed.map((c) => c.name));
    const chosen = new Set(r.chosen.map((c) => c.component));
    return (name: string) => (chosen.has(name) ? "chosen" : eligible.has(name) ? "offered" : "off");
  };
  const [inA, inB] = [stateIn(a), stateIn(b)];
  const differing = a.manifest.components.filter((c) => inA(c.name) !== inB(c.name)).length;
  const eligibleEach = a.allowed.length === b.allowed.length ? a.allowed.length : null;

  return (
    <>
      <SiteChrome />

      <main className={styles.sheet}>
        <div className={styles.head}>
          <h1 className={styles.title}>Two households, one form</h1>
          <p className={styles.lede}>
            Twin A and Twin B declared the same thing at signup — the same size, the
            same diet, the same stated skill, down to the same nine things in the
            pantry. These are the pages they get.
          </p>
        </div>

        {/* Printed once, and flat. It is the thing that turns out NOT to decide
            anything, and a panel that looked important would argue the opposite of
            what it is here to argue. */}
        <section className={styles.section}>
          <SectionHead title="What they told us" rule="default" />
          <p className={styles.aside}>
            Identical for both households, byte for byte. On its own it decides nothing.
          </p>
          <dl className={styles.declared}>
            <div className={styles.pair}>
              <dt>size</dt>
              <dd>{declared.size}</dd>
            </div>
            <div className={styles.pair}>
              <dt>weeknight minutes</dt>
              <dd>{declared.weeknightMinutes}</dd>
            </div>
            <div className={styles.pair}>
              <dt>planning style</dt>
              <dd>{declared.planningStyle}</dd>
            </div>
            <div className={styles.pair}>
              <dt>stated skill</dt>
              <dd>{declared.statedSkill}</dd>
            </div>
            <div className={styles.pair}>
              <dt>dietary</dt>
              <dd>{declared.dietary.join(", ") || "none"}</dd>
            </div>
            <div className={styles.pair}>
              <dt>pantry</dt>
              <dd>{a.household.pantry.length} items, the same {a.household.pantry.length}</dd>
            </div>
          </dl>
        </section>

        {/* The sentence the six numbers underneath cannot say on their own. */}
        <p className={styles.verdict}>
          {eligibleEach !== null ? (
            <>
              Both qualify for <strong>{eligibleEach}</strong> of the {a.manifest.components.length}{" "}
              blocks. Not the same {eligibleEach} — <strong>{differing}</strong> differ.
            </>
          ) : (
            <>
              <strong>{differing}</strong> of {a.manifest.components.length} blocks land differently
              for these two households.
            </>
          )}
        </p>

        <div className={styles.columns}>
          {runs.map((r) => {
            /* What the page OPENED with. blocks[0] is the lead by construction — the
               validator enforces it — and naming it is the one caption that says out
               loud what the two shapes differ by. */
            const lead = r.chosen[0];
            const leadLabel =
              r.manifest.components.find((c) => c.name === lead?.component)?.label ?? lead?.component;
            return (
              <section key={r.household.id} className={styles.column}>
                <header className={styles.columnHead}>
                  <h2 className={styles.columnTitle}>{r.household.label}</h2>
                  <p className={styles.opened}>
                    <span className={styles.openedLabel}>opens with</span>
                    <span className={styles.openedValue}>{leadLabel}</span>
                  </p>
                </header>

                <div className={styles.window}>
                  <iframe
                    className={styles.frame}
                    /* `strip=0` — the page's own vocabulary strip would be a third
                       copy of the diagnostics on a view that exists to have fewer. */
                    src={`/h/${r.household.id}?strip=0${q}`}
                    title={`${r.household.label}'s home page`}
                    loading="eager"
                    scrolling="no"
                  />
                </div>

                <a className={styles.openFull} href={`/h/${r.household.id}${today ? `?today=${today}` : ""}`}>
                  Open {r.household.label} full size →
                </a>

                <VocabularyStrip
                  layout="counts"
                  switches="readonly"
                  showLegend={false}
                  components={r.manifest.components}
                  obligations={r.manifest.obligations}
                  firedObligations={[...new Set(r.fired.map((f) => f.name))]}
                  facts={r.facts}
                  eligible={r.allowed.map((c) => c.name)}
                  chosen={r.chosen}
                  overrides={r.overrides}
                  basePath={`/h/${r.household.id}`}
                  today={today}
                />
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
};

export default TwinsPage;
