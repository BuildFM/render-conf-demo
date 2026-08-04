import type { ReactNode } from "react"
import type { ThreadEntry } from "@/lib/types"
import { DisplayHeading } from "@/components/core/display-heading"
import { Eyebrow } from "@/components/core/eyebrow"
import styles from "./technique-thread.module.css"

type TechniqueThreadProps = {
  /** The page's one Display XL. Pass a fragment with a <br /> to control the
   *  line break — the headline is set at 104px and the break is a design choice. */
  title: ReactNode
  entries: ThreadEntry[]
  untried: string
  treatment: "full" | "collapsed"
}

/** Every attempt at one technique, in order, with the one variable not yet tried.
 *  The sequence is the subject, so this block gets the page's single Display XL
 *  and no photograph. */
export const TechniqueThread = ({ title, entries, untried, treatment }: TechniqueThreadProps) => {
  const technique = entries[0]?.recipe.technique[0]
  const latest = entries[0]?.date

  if (treatment === "collapsed") {
    return (
      <section className={styles.collapsed}>
        <div className={styles.collapsedHead}>
          <h2 className={styles.collapsedTitle}>
            {technique ? `${technique} · ` : ""}
            {entries.length} attempts
          </h2>
          {latest ? <div className={styles.collapsedLatest}>Latest {latest}</div> : null}
        </div>
        <p className={styles.inlineUntried}>
          <span className={styles.arrow} aria-hidden="true">
            →
          </span>
          <span>Not yet tried: {untried}</span>
        </p>
      </section>
    )
  }

  return (
    <section className={styles.full}>
      <Eyebrow track="lg" className={styles.kicker}>
        Your thread{technique ? ` · ${technique}` : ""} · {entries.length} attempts
      </Eyebrow>

      <DisplayHeading size="xl" as="h2">
        {title}
      </DisplayHeading>

      <div className={styles.log}>
        <div className={styles.logHead}>
          <div>Date</div>
          <div>Attempt</div>
          <div>What changed</div>
        </div>
        {entries.map((entry) => (
          <div key={`${entry.date}-${entry.recipe.id}`} className={styles.logRow}>
            <div className={styles.date}>{entry.date}</div>
            <h3 className={styles.attempt}>{entry.recipe.title}</h3>
            <p className={styles.changed}>{entry.changed}</p>
          </div>
        ))}
      </div>

      <div className={styles.untried}>
        <Eyebrow track="md">Not yet tried</Eyebrow>
        <DisplayHeading size="l" as="p">
          {untried}
        </DisplayHeading>
      </div>
    </section>
  )
}
