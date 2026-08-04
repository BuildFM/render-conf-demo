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
export const MakeAheadCallout = ({ step, recipeTitle, treatment }: MakeAheadCalloutProps) => {
  if (treatment === "oneline") {
    return (
      <p className={note.note}>
        <span className={note.glyph} aria-hidden="true">
          ·
        </span>
        <span>
          <span className={note.subject}>{recipeTitle}</span> — {step.toLowerCase()}, ahead of time.
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
