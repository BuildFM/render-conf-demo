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
  switches = "links"
}: Props) => {
  const eligibleSet = new Set(eligible);
  const chosenMap = new Map(chosen.map((c) => [c.component, c.treatment]));

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
    <aside className={styles.strip} aria-label="The vocabulary this page was composed from">
      <div className={styles.head}>
        <h2 className={styles.title}>{heading}</h2>
        <p className={styles.counts}>
          <span>{components.length} blocks</span>
          <span className={styles.sep}>·</span>
          <span>{eligibleSet.size} offered to the model</span>
          <span className={styles.sep}>·</span>
          <span>{chosenMap.size} on the page</span>
        </p>
      </div>

      {/* Taught once, then the chips carry it. Without this the three states are
          three shades of nothing — the room has no reason to read a dim chip as
          "the application refused" rather than as "unimportant".

          The legend items ARE chips, in their own state, rather than a swatch beside
          a caption. A swatch cannot show the "not eligible" state at all: that state
          is the absence of a box, so a 22×12 sample of it is an empty rectangle the
          room reads as a rendering bug. Showing the state on the words that name it
          has nothing to draw and nothing to get wrong. */}
      {showLegend && (
        <ul className={styles.legend}>
          <li className={`${styles.legendItem} ${styles.isOff}`}>
            not eligible — a gate said no, in code
          </li>
          <li className={`${styles.legendItem} ${styles.isOffered}`}>
            offered — the model could have, and didn&rsquo;t
          </li>
          <li className={`${styles.legendItem} ${styles.isChosen}`}>
            chosen — the model put it on the page
          </li>
        </ul>
      )}

      <ul className={styles.chips}>
        {components.map((c) => {
          const isEligible = eligibleSet.has(c.name);
          const treatment = chosenMap.get(c.name);
          const state = treatment ? "isChosen" : isEligible ? "isOffered" : "isOff";
          /* The FIRST failing predicate, not all of them. A chip that lists three
             reasons is a chip nobody reads at distance, and one reason is enough to
             answer the only question being asked of it — why is this one out. */
          const failed = isEligible ? null : c.requires.find((p) => !test(p, facts));
          return (
            <li key={c.name} className={`${styles.chip} ${styles[state]}`}>
              <span className={styles.chipName}>{c.label || c.name}</span>
              <span className={styles.chipNote}>
                {treatment ? treatment : failed ? `needs ${say(failed)}` : " "}
              </span>
            </li>
          );
        })}
      </ul>

      <div className={styles.obligations}>
        <span className={styles.obligationsLabel}>Not a choice</span>
        <ul className={styles.chips}>
          {obligations.map((o) => {
            const fired = firedObligations.includes(o.name);
            return (
              <li key={o.name} className={`${styles.chip} ${fired ? styles.isForced : styles.isOff}`}>
                <span className={styles.chipName}>{o.label || o.name}</span>
                <span className={styles.chipNote}>
                  {fired ? "placed by the application" : `dormant — needs ${say(o.requiredWhen)}`}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

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
