import note from "./note.module.css"

type LeftoversNoteProps = {
  recipeTitle: string
  /** What the dish yields. */
  serves: number
  /** How much of that yield is more than the household eats tonight. Always at
   *  least one — the block is not eligible otherwise. */
  surplus: number
}

/**
 * There is more of this than tonight needs. Oneline only — it is a footnote to a
 * dish, and drawing it larger makes leftovers the subject of the page.
 *
 * THE SENTENCE IS BUILT HERE, from values, and that is the fix rather than the
 * style. It used to take a `text` prop and read "What is left of X becomes {text}"
 * — a slot built for authored prose about what the remains turn into ("Thursday's
 * brothy beans, once the carcass has been in the pot an hour"). That editorial was
 * never written, so the resolver filled the slot with the only thing it had, a
 * quantity clause, and the page said:
 *
 *   "What is left of Pressed pork belly becomes serves 6, which is 5 more than
 *    tonight needs."
 *
 * Neither end owned the grammar: the resolver wrote half a sentence and this file
 * wrote the other half, and nobody was in a position to check that the two fitted.
 * So the resolver emits values now, the way it does everywhere else, and the
 * sentence lives in one place.
 */
export const LeftoversNote = ({ recipeTitle, serves, surplus }: LeftoversNoteProps) => (
  <p className={note.note}>
    <span className={note.glyph} aria-hidden="true">
      ·
    </span>
    <span>
      <span className={note.subject}>{recipeTitle}</span> serves {serves} — {surplus} more than
      tonight needs.
    </span>
  </p>
)
