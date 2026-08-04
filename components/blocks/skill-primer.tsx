import { PrimerCard } from "@/components/content/primer-card"
import { Eyebrow } from "@/components/core/eyebrow"
import styles from "./skill-primer.module.css"

type SkillPrimerProps = {
  technique: string
  title: string
  body: string
  /** 3–5. The only ordered list in the system. */
  steps: string[]
  numeral: string
  /** "Read · 6 min" */
  readingTime?: string
  treatment: "full" | "collapsed"
}

/** A fundamentals explainer on one technique. The PrimerCard shell is unchanged;
 *  the steps are added below a rule via the primitive's optional `steps` prop. */
export const SkillPrimer = ({
  technique,
  title,
  body,
  steps,
  numeral,
  readingTime,
  treatment
}: SkillPrimerProps) => {
  if (treatment === "collapsed") {
    return (
      <article className={styles.collapsed}>
        <div className={styles.collapsedHead}>
          <Eyebrow track="md">{technique}</Eyebrow>
          {readingTime ? (
            <Eyebrow tone="dim" track="sm">
              {readingTime}
            </Eyebrow>
          ) : null}
        </div>
        <h3 className={styles.collapsedTitle}>{title}</h3>
        <p className={styles.collapsedBody}>
          {body} {steps.length} steps.
        </p>
      </article>
    )
  }

  return (
    <PrimerCard
      numeral={numeral}
      kicker="Primer"
      eyebrow={technique}
      title={title}
      body={body}
      steps={steps}
      meta={readingTime}
    />
  )
}
