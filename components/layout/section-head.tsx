import type { ElementType, ReactNode } from "react"
import styles from "./section-head.module.css"

type SectionHeadProps = {
  title: ReactNode
  meta?: ReactNode
  /** "signal" is the 2px acid rule. "default" is the quiet 1px one. */
  rule?: "signal" | "default"
  /** Tone of the meta text. Acid when the meta is the personalisation note. */
  metaTone?: "dim" | "signal"
  as?: ElementType
  className?: string
}

/** Section title with a heavy acid rule under it, meta right-aligned. */
export const SectionHead = ({
  title,
  meta,
  rule = "signal",
  metaTone = "dim",
  as: Tag = "h2",
  className
}: SectionHeadProps) => (
  <div
    className={[styles.head, rule === "signal" ? styles.ruleSignal : styles.ruleDefault, className]
      .filter(Boolean)
      .join(" ")}
  >
    <Tag className={styles.title}>{title}</Tag>
    {meta ? (
      <div className={metaTone === "signal" ? styles.metaSignal : styles.meta}>{meta}</div>
    ) : null}
  </div>
)
