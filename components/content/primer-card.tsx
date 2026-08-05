import type { ReactNode } from "react"
import { MethodList } from "./method-list"
import styles from "./primer-card.module.css"

type PrimerCardProps = {
  numeral: string
  kicker?: string
  eyebrow?: string
  title: ReactNode
  body?: string
  meta?: string
  /** Numbered steps under a rule. Added for SkillPrimer — the primitive was
   *  extended, not forked. Omit and the card is exactly as it was. */
  steps?: string[]
  href?: string
  className?: string
}

/** Bordered teaser for a technique primer. Big acid numeral, no image. */
export const PrimerCard = ({
  numeral,
  kicker = "Primer",
  eyebrow,
  title,
  body,
  meta,
  steps,
  href,
  className
}: PrimerCardProps) => {
  const inner = (
    <>
      <div className={styles.top}>
        <span className={styles.numeral}>{numeral}</span>
        <span className={styles.kicker}>{kicker}</span>
      </div>

      <div className={styles.main}>
        {eyebrow ? <div className={styles.eyebrow}>{eyebrow}</div> : null}
        <h3 className={styles.title}>{title}</h3>
        {body ? <p className={styles.body}>{body}</p> : null}

        {steps?.length ? <MethodList steps={steps} /> : null}

        {meta ? <div className={styles.meta}>{meta}</div> : null}
      </div>
    </>
  )

  const cls = [styles.card, className].filter(Boolean).join(" ")
  return href ? (
    <a href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <article className={cls}>{inner}</article>
  )
}
