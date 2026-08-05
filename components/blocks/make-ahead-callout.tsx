import { Eyebrow } from "@/components/core/eyebrow"
import styles from "./make-ahead-callout.module.css"
import note from "./note.module.css"

type MakeAheadCalloutProps = {
  /** What can be done in advance, as an instruction: "Dough, up to 24 hr ahead". */
  step: string
  recipeTitle: string
  treatment: "full" | "oneline"
}

/** The part of a dish that can happen on a different day. Full is a bordered
 *  panel with an acid rule; oneline is a sentence. There is no collapsed — a
 *  panel this small has nothing left to drop. */
/**
 * The one-line form takes the FIRST SENTENCE of the step and lowercases only its
 * first letter.
 *
 * It used to be `${step.toLowerCase()}, ahead of time.`, which assumed `step` was
 * a fragment — the prop is even documented as `"Dough, up to 24 hr ahead"`. Every
 * make-ahead string in `recipes.json` is actually two sentences ending in a full
 * stop, so the line came out as "…up to four days ahead. it is better on day two
 * and best on day three., ahead of time." — a lowercased second sentence, a `.,`
 * collision, and a redundant suffix on a step that already said "ahead".
 *
 * The full treatment prints `step` untouched; only this one has to fit a line.
 */
const oneLine = (step: string) => {
  const first = step.match(/^[^.]*\./)?.[0] ?? step;
  return first.charAt(0).toLowerCase() + first.slice(1);
};

export const MakeAheadCallout = ({ step, recipeTitle, treatment }: MakeAheadCalloutProps) => {
  if (treatment === "oneline") {
    return (
      <p className={note.note}>
        <span className={note.glyph} aria-hidden="true">
          ·
        </span>
        <span>
          <span className={note.subject}>{recipeTitle}</span> — {oneLine(step)}
        </span>
      </p>
    )
  }

  return (
    <aside className={styles.panel}>
      <Eyebrow track="md" className={styles.label}>
        Make ahead
      </Eyebrow>
      <p className={styles.step}>{step}</p>
      <div className={styles.recipe}>{recipeTitle}</div>
    </aside>
  )
}
