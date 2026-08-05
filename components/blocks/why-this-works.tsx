import type { Recipe } from "@/lib/types"
import { DisplayHeading } from "@/components/core/display-heading"
import { Eyebrow } from "@/components/core/eyebrow"
import styles from "./why-this-works.module.css"

type WhyThisWorksProps = {
  /** Set uppercase at Display L. Keep it inside 26 characters a line. */
  principle: string
  body: string
  recipes: Recipe[]
  /** One line of evidence per recipe: the tool it uses. Same order as recipes. */
  evidence?: string[]
  treatment: "full" | "collapsed"
}

/** The principle several dishes share. Same register as the signal band, but it
 *  stays on ink — a composition gets one acid band and SignalBand spent it. */
export const WhyThisWorks = ({
  principle,
  body,
  recipes,
  evidence = [],
  treatment
}: WhyThisWorksProps) => {
  if (treatment === "collapsed") {
    return (
      <section className={styles.collapsed}>
        <Eyebrow track="md">What these dishes have in common</Eyebrow>
        <h2 className={styles.collapsedPrinciple}>{principle}</h2>
        <p className={styles.collapsedList}>{recipes.map((r) => r.title).join(" · ")}</p>
      </section>
    )
  }

  return (
    <section className={styles.full}>
      <div>
        <Eyebrow track="lg" className={styles.kicker}>
          What these {recipes.length} dishes have in common
        </Eyebrow>
        <DisplayHeading size="l" as="h2" balance className={styles.principle}>
          {principle}
        </DisplayHeading>
      </div>
      <div>
        <p className={styles.body}>{body}</p>
        <div className={styles.evidence}>
          {recipes.map((recipe, i) => (
            <div key={recipe.id} className={styles.evidenceRow}>
              <h3 className={styles.evidenceTitle}>{recipe.title}</h3>
              <div className={styles.evidenceValue}>{evidence[i] ?? recipe.technique[0]}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
