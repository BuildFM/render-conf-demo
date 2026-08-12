import Link from "next/link";

import type { ComponentSpec, ObligationSpec, Predicate } from "@/lib/manifest/load";
import type { Facts } from "@/lib/compose/gates";
import { test } from "@/lib/compose/gates";
import {
  TOGGLES,
  flipped,
  serializeOverrides,
  toggleState,
  type Overrides
} from "@/lib/compose/overrides";
import styles from "./vocabulary-strip.module.css";

/**
 * THE WHOLE ARGUMENT, IN ONE ROW OF CHIPS.
 *
 * Every block in the vocabulary, in one of three states:
 *
 *   greyed   — not eligible. A gate said no, in code, before any model ran.
 *   offered  — eligible. The model was shown it and did not choose it.
 *   chosen   — on the page.
 *
 * The states are the point, not the chips. Grey is the application; the gap between
 * offered and chosen is the model's ENTIRE authority, and since roughly half the
 * vocabulary drops out per household, that authority is visibly small and visibly
 * bounded. Two states — used and unused — would only have said "this page has these
 * blocks on it", which is a thing you can see by looking at the page.
 *
 * It exists because the pages read as different and did not read as LEGIBLE: three
 * layouts side by side prove something changed and never say what, so the room has
 * to take the cause on trust. This is the cause, enumerated, at a size that survives
 * a projector.
 *
 * The obligation is shown apart and last, as a fourth position on the same axis
 * rather than a fourth kind of thing: code said no, model chose, model declined,
 * and then code said YES and the model had no vote at all.
 */

const OP: Record<Predicate["op"], string> = { "==": "=", ">=": "≥", ">": ">", "<=": "≤", "<": "<" };

const say = (p: Predicate) => `${p.fact} ${OP[p.op]} ${String(p.value)}`;

type Props = {
  components: ComponentSpec[];
  obligations: ObligationSpec[];
  /** Obligation names that actually attached to a dish on this page. */
  firedObligations: string[];
  /** The facts AFTER any overrides — the ones the gates actually ran against. */
  facts: Facts;
  eligible: string[];
  /** Component names that rendered, with the depth they rendered at. */
  chosen: { component: string; treatment: string }[];
  overrides: Overrides;
  /** `/h/h-twin-a` — hrefs for the switches are built from this. */
  basePath: string;
  /** Carried through every switch, or flipping one drops you back to today. */
  today?: string;
  /** Names the strip. The household's label when more than one is on screen. */
  heading?: string;
  /**
   * `grouped` — three labelled columns, one per state. What a single page wants: the
   *   question there is "how much of this did the model decide", and the answer is a
   *   count and a column height rather than sixteen boxes to classify one at a time.
   * `counts` — the three headings and nothing else. What the twins view wants under
   *   a page: the eligibility difference as two numbers rather than as a wall of
   *   thirty-two chips, on a view whose payload is the pages themselves.
   * `sequence` — every block in manifest order, states shown as colour. What the
   *   twins view wants: there the question is "which block differs", and that is
   *   answered by two rows in the same order and looking straight down. Grouping
   *   would move a block between columns and turn a glance into a search.
   */
  layout?: "grouped" | "sequence" | "counts";
  /** Off when something above has already taught the three states — the twins view
   *  shows two strips and a legend printed twice is a legend nobody reads once. */
  showLegend?: boolean;
  /**
   * `links` — the switches navigate, which is the toggle beat.
   * `readonly` — the same six facts, stated rather than offered. What the twins view
   *   wants: there the facts are the EVIDENCE, and a switch you can press invites
   *   the room to watch you press it instead of reading the two rows.
   * `none` — no fact panel at all.
   */
  switches?: "links" | "readonly" | "none";
};

export const VocabularyStrip = ({
  components,
  obligations,
  firedObligations,
  facts,
  eligible,
  chosen,
  overrides,
  basePath,
  today,
  heading = "The vocabulary",
  showLegend = true,
  switches = "links",
  layout = "grouped"
}: Props) => {
  const eligibleSet = new Set(eligible);
  const chosenMap = new Map(chosen.map((c) => [c.component, c.treatment]));

  const stateOf = (c: ComponentSpec) =>
    chosenMap.has(c.name) ? "chosen" : eligibleSet.has(c.name) ? "offered" : "off";

  /** The first failing predicate, not all of them. A chip listing three reasons is a
   *  chip nobody reads at distance, and one is enough to answer the only question
   *  being asked of it — why is this one out. */
  const firstFailure = (c: ComponentSpec) => c.requires.find((p) => !test(p, facts));

  const Chip = ({ c }: { c: ComponentSpec }) => {
    const state = stateOf(c);
    const treatment = chosenMap.get(c.name);
    const failed = state === "off" ? firstFailure(c) : null;
    return (
      <li className={`${styles.chip} ${styles[state === "chosen" ? "isChosen" : state === "offered" ? "isOffered" : "isOff"]}`}>
        <span className={styles.chipName}>{c.label || c.name}</span>
        <span className={styles.chipNote}>{treatment ? treatment : failed ? `needs ${say(failed)}` : " "}</span>
      </li>
    );
  };

  /* The three groups, each keeping manifest order inside itself. */
  const groups = [
    { key: "off", title: "Not eligible", note: "a gate said no, in code" },
    { key: "offered", title: "Passed over", note: "the model was shown these and didn’t use them" },
    { key: "chosen", title: "On the page", note: "the model chose these" }
  ].map((g) => ({ ...g, items: components.filter((c) => stateOf(c) === g.key) }));

  /* Assembled by hand rather than through URLSearchParams, which percent-encodes the
     colons into `%3A` — correct, and unreadable in a URL bar that is on a projector
     at the time. Colons and commas are legal unencoded in a query string, and the
     only values here are slugs from a fixed list and a date. */
  const href = (o: Overrides) => {
    const parts = [
      ...(today ? [`today=${today}`] : []),
      ...(o.size ? [`facts=${serializeOverrides(o)}`] : [])
    ];
    return parts.length ? `${basePath}?${parts.join("&")}` : basePath;
  };

  return (
    <aside className={styles.strip} data-layout={layout} aria-label="The vocabulary this page was composed from">
      {layout !== "counts" && (
      <div className={styles.head}>
        <h2 className={styles.title}>{heading}</h2>
        <p className={styles.counts}>
          {layout === "grouped" ? (
            <span>{components.length} blocks, and what became of each</span>
          ) : (
            <>
              <span>{components.length} blocks</span>
              <span className={styles.sep}>·</span>
              <span>{eligibleSet.size} offered</span>
              <span className={styles.sep}>·</span>
              <span>{chosenMap.size} on the page</span>
            </>
          )}
        </p>
      </div>
      )}

      {/* THE STATES ARE THE ARGUMENT, SO THEY ARE THE LAYOUT.
          Sixteen chips in manifest order meant the three states were shuffled
          together, and the room had to classify each box in turn to see the shape of
          it — which is the one thing this exists to make instant. Grouped, the count
          in each heading is the whole story and nobody has to read a single chip.
          The headings also retire the legend: a column headed "not eligible — a gate
          said no, in code" does not need a swatch above it saying the same. */}
      {layout === "counts" ? (
        /* Headings only. Two of these side by side is the whole eligibility argument
           in six numbers, sitting under two pages that have already made it
           visually — which is the order a room of designers wants it in. */
        <div className={styles.countRow}>
          {groups.map((g) => (
            <div key={g.key} className={styles.countUnit} data-state={g.key}>
              <span className={styles.groupCount}>{g.items.length}</span>
              <span className={styles.groupTitle}>{g.title}</span>
            </div>
          ))}
        </div>
      ) : layout === "grouped" ? (
        <div className={styles.groups}>
          {groups.map((g) => (
            <section key={g.key} className={styles.group} data-state={g.key}>
              <header className={styles.groupHead}>
                <span className={styles.groupCount}>{g.items.length}</span>
                <span className={styles.groupTitle}>{g.title}</span>
                <span className={styles.groupNote}>{g.note}</span>
              </header>
              <ul className={styles.column}>
                {g.items.map((c) => (
                  <Chip key={c.name} c={c} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <>
          {/* Manifest order, states as colour. The legend has to stay here — nothing
              in this layout names the three states. */}
          {showLegend && (
            <ul className={styles.legend}>
              <li className={`${styles.legendItem} ${styles.isOff}`}>
                not eligible — a gate said no, in code
              </li>
              <li className={`${styles.legendItem} ${styles.isOffered}`}>
                passed over — the model was shown it and didn&rsquo;t use it
              </li>
              <li className={`${styles.legendItem} ${styles.isChosen}`}>
                chosen — the model put it on the page
              </li>
            </ul>
          )}
          <ul className={styles.chips}>
            {components.map((c) => (
              <Chip key={c.name} c={c} />
            ))}
          </ul>
        </>
      )}

      {/* The obligation, apart and last — a fourth position on the same axis rather
          than a fourth kind of thing: code said no, model chose, model declined, and
          then code said YES and the model had no vote at all. It was headed "not a
          choice", which named the mechanism rather than the fact.

          One line in `counts`, because on the twins view the interesting fact is
          simply that it fired for one household and not the other. */}
      {layout === "counts" ? (
        <ul className={styles.countObligations}>
          {obligations.map((o) => {
            const fired = firedObligations.includes(o.name);
            return (
              <li key={o.name} className={styles.countObligation} data-fired={fired}>
                <span>{o.label || o.name}</span>
                <span className={styles.countObligationState}>
                  {fired ? "on the page" : "dormant"}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
      <div className={styles.obligations}>
        <div className={styles.obligationsHead}>
          <span className={styles.obligationsLabel}>Placed by the application</span>
          <span className={styles.obligationsNote}>
            an obligation — the model can neither choose it nor suppress it
          </span>
        </div>
        <ul className={styles.obligationList}>
          {obligations.map((o) => {
            const fired = firedObligations.includes(o.name);
            return (
              <li key={o.name} className={`${styles.chip} ${fired ? styles.isForced : styles.isOff}`}>
                <span className={styles.chipName}>{o.label || o.name}</span>
                <span className={styles.chipNote}>
                  {fired ? "on the page" : `dormant — needs ${say(o.requiredWhen)}`}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      )}

      {/* WHAT IF THEY HAD DONE SOMETHING ELSE.
          Links, not client state: the composed page stays free of client JS and
          every combination is a URL you can type. Flipping one of these changes
          which chips are grey and nothing else — no model is called until the page
          is composed again, which is the sequence the pipeline actually runs in. */}
      {switches !== "none" && (
        <div className={styles.what}>
          <div className={styles.whatHead}>
            <span className={styles.whatLabel}>What this household did</span>
            <span className={styles.whatNote}>
              {switches === "links"
                ? "evaluated in code · changing one re-gates the vocabulary without asking a model"
                : "evaluated in code, from ninety days of behaviour"}
            </span>
          </div>
          <ul className={styles.switches}>
            {TOGGLES.map((t) => {
              const on = toggleState(t, facts, overrides);
              const forced = overrides.has(t.slug);
              const cls = `${styles.switch} ${on ? styles.switchOn : ""} ${forced ? styles.switchForced : ""}`;
              const inner = (
                <>
                  <span className={styles.switchMark} aria-hidden>
                    {on ? "on" : "off"}
                  </span>
                  <span>{t.label}</span>
                </>
              );
              return (
                <li key={t.slug}>
                  {switches === "links" ? (
                    <Link href={href(flipped(t, facts, overrides))} className={cls}>
                      {inner}
                    </Link>
                  ) : (
                    <span className={`${cls} ${styles.switchStatic}`}>{inner}</span>
                  )}
                </li>
              );
            })}
          </ul>
          {switches === "links" && overrides.size > 0 && (
            <p className={styles.reset}>
              <Link href={href(new Map())}>Back to what actually happened</Link>
            </p>
          )}
        </div>
      )}
    </aside>
  );
};
