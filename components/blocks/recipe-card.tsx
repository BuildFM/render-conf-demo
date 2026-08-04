import type { Recipe, Treatment } from "@/lib/types"
import { DisplayHeading } from "@/components/core/display-heading"
import { Eyebrow } from "@/components/core/eyebrow"
import { FigureWell } from "@/components/content/figure-well"
import { StatRow } from "@/components/content/stat-row"
import { formatMinutes } from "@/lib/format"
import styles from "./recipe-card.module.css"

type RecipeCardProps = {
  recipe: Recipe
  treatment: Treatment
}

/** One dish, presented for selection. Excellent at all three treatments because
 *  it appears at all three on the same page. Full is the only treatment with a
 *  photograph, and only two full blocks are allowed per composition. */
export const RecipeCard = ({ recipe, treatment }: RecipeCardProps) => {
  const active = formatMinutes(recipe.activeTime)
  const total = formatMinutes(recipe.totalTime)

  if (treatment === "oneline") {
    return (
      <p className={styles.oneline}>
        <span className={styles.arrow} aria-hidden="true">
          →
        </span>
        <span>
          {recipe.title} — {active} hands-on, {total} start to finish.
        </span>
      </p>
    )
  }

  if (treatment === "collapsed") {
    return (
      <article className={styles.row}>
        <div className={styles.no}>{recipe.id}</div>
        <h3 className={styles.rowTitle}>{recipe.title}</h3>
        <div className={styles.rowValue}>{recipe.technique[0]}</div>
        <div className={styles.rowValue}>{active}</div>
        <div className={styles.rowValueRight}>{total}</div>
      </article>
    )
  }

  return (
    <article className={recipe.image ? styles.full : styles.fullNoImage}>
      {recipe.image ? (
        <FigureWell
          src={recipe.image.src}
          alt={recipe.image.alt}
          tag={`Fig. ${recipe.id}`}
          shape="fill"
          className={styles.well}
        />
      ) : null}
      <div className={styles.body}>
        <Eyebrow track="md" className={styles.kicker}>
          {recipe.technique.join(" · ")}
        </Eyebrow>
        <DisplayHeading size="m" as="h3">
          {recipe.title}
        </DisplayHeading>
        {recipe.summary ? <p className={styles.summary}>{recipe.summary}</p> : null}
        <StatRow
          className={styles.stats}
          stats={[
            { label: "Serves", value: String(recipe.yield) },
            { label: "Active", value: active },
            { label: "Total", value: total }
          ]}
        />
      </div>
    </article>
  )
}
