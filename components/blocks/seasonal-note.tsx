import note from "./note.module.css"

type SeasonalNoteProps = {
  /** "Cabbage is at its best for three more weeks." */
  text: string
}

/** What the month is doing. Oneline only, and never a badge on a card. */
export const SeasonalNote = ({ text }: SeasonalNoteProps) => (
  <p className={note.note}>
    <span className={note.glyph} aria-hidden="true">
      ·
    </span>
    <span>{text}</span>
  </p>
)
