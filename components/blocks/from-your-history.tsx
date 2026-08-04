import type { Recipe } from "@/lib/types"
import note from "./note.module.css"

type FromYourHistoryProps = {
  /** The fact from the record: "you have cooked this four times since May". */
  text: string
  recipe: Recipe
}

/** One fact from what this household has actually cooked. Oneline only: it is
 *  evidence, and evidence set large reads as a boast. */
export const FromYourHistory = ({ text, recipe }: FromYourHistoryProps) => (
  <p className={note.note}>
    <span className={note.label}>From your history</span>
    <span>
      <span className={note.subject}>{recipe.title}</span> — {text}.
    </span>
  </p>
)
