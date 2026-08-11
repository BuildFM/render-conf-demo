import { notFound } from "next/navigation";

import { runPipeline } from "@/lib/compose/pipeline";
import { SectionHead } from "@/components/layout/section-head";
import { SiteChrome } from "@/components/blocks/site-chrome";
import { VocabularyStrip } from "@/components/stage/vocabulary-strip";
import styles from "./page.module.css";

/**
 * TWO STRIPS, STACKED. No pages.
 *
 * The twins are the sharpest thing in the demo — two households that filled in the
 * same form, byte for byte, and get different interfaces — and it was the hardest
 * thing to SHOW, because the proof lived in two page layouts that had to be compared
 * from memory, ninety seconds apart, at a size where nothing was legible.
 *
 * The claim is about ELIGIBILITY, which is not a visual property of either page. So
 * this view drops the pages entirely. Same sixteen chips, in the same order, one row
 * above the other: a block that differs is a colour change you find by looking
 * straight down the column, and the room does not have to hold anything in its head.
 *
 * Stacked rather than side by side for exactly that reason. Two columns would put
 * the same block at two different heights and turn a glance into a search.
 *
 * The declared data is printed ONCE, above both. It is identical — that is the whole
 * setup — and printing it twice would invite the room to compare two things that do
 * not differ, which is thirty seconds spent proving nothing.
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
     second one usually wants the first one's manifest read and profile load already
     warm; more to the point, two live model calls racing produce two spinners and
     one of them finishes into a page that is still laying out. */
  const runs = [];
  for (const id of TWINS) {
    const r = await runPipeline({ householdId: id, today });
    if (r) runs.push(r);
  }
  if (runs.length !== TWINS.length) notFound();

  const [a] = runs;
  const declared = a.household.declared;

  return (
    <>
      <SiteChrome />

      <main className={styles.sheet}>
        <div className={styles.head}>
          <h1 className={styles.title}>Two households, one form</h1>
          <p className={styles.lede}>
            Twin A and Twin B declared the same thing at signup — the same size, the
            same diet, the same stated skill, down to the same pantry. What they have
            done since is not the same, and the vocabulary each one qualifies for is
            decided by that, in code, before a model is asked anything.
          </p>
        </div>

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

        {/* Printed once, above both strips — see the note at the top of this file. */}
        <ul className={styles.legend}>
          <li className={`${styles.legendItem} ${styles.isOff}`}>not eligible — a gate said no, in code</li>
          <li className={`${styles.legendItem} ${styles.isOffered}`}>offered — the model could have, and didn&rsquo;t</li>
          <li className={`${styles.legendItem} ${styles.isChosen}`}>chosen — the model put it on the page</li>
        </ul>
      </main>

      {runs.map((r) => (
        <VocabularyStrip
          key={r.household.id}
          heading={r.household.label}
          showLegend={false}
          switches="readonly"
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
      ))}
    </>
  );
};

export default TwinsPage;
