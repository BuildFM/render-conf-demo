import type { Recipe } from "@/lib/types"
import { Button } from "@/components/core/button"
import { DisplayHeading } from "@/components/core/display-heading"
import { Eyebrow } from "@/components/core/eyebrow"
import { FigureWell } from "@/components/content/figure-well"
import { MethodList } from "@/components/content/method-list"
import { StatRow } from "@/components/content/stat-row"
import { formatMinutes } from "@/lib/format"
import styles from "./recipe-card.module.css"

type RecipeCardProps = {
  recipe: Recipe
  /** "hero" is the front-page treatment: Display XL, the dish given the whole top
   *  of the page. It claims the page's single XL, so a composition may not also
   *  run TechniqueThread at "full" — the manifest's maxDisplayXL rule enforces it. */
  treatment: "hero" | "full" | "collapsed" | "oneline"
}

/** One dish, presented for selection. Excellent at every treatment because it
 *  appears at several on the same page. Hero and full are the only treatments with
 *  a photograph, and only two of those are allowed per composition. */
export const RecipeCard = ({ recipe, treatment }: RecipeCardProps) => {
  const active = formatMinutes(recipe.activeTime)
  const total = formatMinutes(recipe.totalTime)

  if (treatment === "hero") {
    // The last word of the title carries the acid, the way the design's own hero
    // does. Splitting on the last space rather than hard-coding a break keeps it
    // working for any dish the composer picks.
    const words = recipe.title.split(" ")
    const lead = words.slice(0, -1).join(" ")
    const last = words[words.length - 1]

    return (
      <article className={styles.hero}>
        <div className={styles.heroBody}>
          <Eyebrow tone="signal" className={styles.heroKicker}>
            This week · No. {recipe.id}
          </Eyebrow>
          <DisplayHeading size="xl" as="h1">
            {lead} <span className={styles.heroAccent}>{last}</span>
          </DisplayHeading>
          {recipe.summary ? <p className={styles.heroSummary}>{recipe.summary}</p> : null}
          <StatRow
            className={styles.heroStats}
            stats={[
              { label: "Serves", value: String(recipe.yield) },
              { label: "Active", value: active },
              { label: "Total", value: total }
            ]}
          />
          <Button href={`/recipes/${recipe.id}`} className={styles.heroCta}>
            Read the recipe →
          </Button>
        </div>
        {recipe.image ? (
          <FigureWell src={recipe.image.src} alt={recipe.image.alt} tag={`Fig. ${recipe.id}`} shape="portrait" />
        ) : null}
      </article>
    )
  }

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
        {/* The method, at "full" only.
            "full" is the treatment that means depth, and until now nothing on any
            composed page showed a method — which left the site's whole premise
            unbacked. Mise's product is teaching people to cook: it walks you
            through one numbered step at a time. A demo that says so and never
            shows a single step is asking to be taken on trust.
            Not at "hero": that is the front-page statement and it already ends on
            "Read the recipe →", so the method belongs on the other side of that
            link. Not at "collapsed" or "oneline", which are a row and a line. */}
        {recipe.steps?.length ? (
          <>
            <Eyebrow track="md" className={styles.methodLabel}>
              Method
            </Eyebrow>
            <MethodList steps={recipe.steps} />
            {/* Says the premise out loud, on the page, where the room can see the
                feature the whole event log is a record of. */}
            <p className={styles.methodNote}>
              {recipe.steps.length} steps · guided mode takes them one at a time
            </p>
          </>
        ) : null}
      </div>
    </article>
  )
}
