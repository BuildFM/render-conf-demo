import type { Recipe } from "@/lib/types"
import { SectionHead } from "@/components/layout/section-head"
import { RecipeCard } from "./recipe-card"
import { formatMinutes } from "@/lib/format"
import styles from "./tonight-shortlist.module.css"

type TonightShortlistProps = {
  recipes: Recipe[]
  /** "Three for tonight" */
  title?: string
  treatment: "full" | "collapsed"
}

/** Two to four dishes for this evening, as collapsed rows under a section head.
 *  A shortlist is a list — it never promotes a member to a photograph. */
export const TonightShortlist = ({
  recipes,
  title = "Tonight",
  treatment
}: TonightShortlistProps) => {
  if (treatment === "collapsed") {
    /* No head. It rendered the title — "Tonight" — directly under a block stamp
       reading "Tonight's shortlist", in the same tracked uppercase: the same word
       twice, once as chrome and once as content. The stamp names the block, so the
       collapsed variant is the list and nothing else. */
    return (
      <section className={styles.collapsed}>
        <ul className={styles.list}>
          {recipes.map((recipe) => (
            <li key={recipe.id} className={styles.listItem}>
              <span className={styles.listTitle}>{recipe.title}</span>
              <span className={styles.listTime}>{formatMinutes(recipe.activeTime)}</span>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <section>
      <SectionHead
        title={title}
        meta={`${recipes.length} to choose from`}
        voice="quiet"
        className={styles.head}
      />
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} treatment="collapsed" />
      ))}
    </section>
  )
}
