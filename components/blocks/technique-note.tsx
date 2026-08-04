import { Eyebrow } from "@/components/core/eyebrow"
import styles from "./technique-note.module.css"
import note from "./note.module.css"

type TechniqueNoteProps = {
  technique: string
  body: string
  treatment: "full" | "oneline"
}

/** One paragraph on a technique, with no steps and no card. Sits between the
 *  primer and the note: too small for SkillPrimer, too specific for prose. */
export const TechniqueNote = ({ technique, body, treatment }: TechniqueNoteProps) => {
  if (treatment === "oneline") {
    return (
      <p className={note.note}>
        <span className={note.label}>{technique}</span>
        <span>{body}</span>
      </p>
    )
  }

  return (
    <aside className={styles.panel}>
      <Eyebrow track="md" className={styles.label}>
        {technique}
      </Eyebrow>
      <p className={styles.body}>{body}</p>
    </aside>
  )
}
