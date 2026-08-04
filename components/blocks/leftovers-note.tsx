import note from "./note.module.css"

type LeftoversNoteProps = {
  /** What the remains become: "the base of Thursday's brothy beans". */
  text: string
  recipeTitle: string
}

/** What is left over and what it turns into. Oneline only — it is a footnote to
 *  a dish, and drawing it larger makes leftovers the subject of the page. */
export const LeftoversNote = ({ text, recipeTitle }: LeftoversNoteProps) => (
  <p className={note.note}>
    <span className={note.glyph} aria-hidden="true">
      ·
    </span>
    <span>
      What is left of <span className={note.subject}>{recipeTitle}</span> becomes {text}.
    </span>
  </p>
)
