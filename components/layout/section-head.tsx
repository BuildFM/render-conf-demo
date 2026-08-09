import type { ElementType, ReactNode } from "react"
import styles from "./section-head.module.css"

type SectionHeadProps = {
  title: ReactNode
  meta?: ReactNode
  /** "signal" is the 2px rule under a page-level division. "default" is the 1px one.
   *  Neither is acid — see the note in the stylesheet. */
  rule?: "signal" | "default"
  /** Tone of the meta text. Acid when the meta is the personalisation note. */
  metaTone?: "dim" | "signal"
  /** "display" is a page section — tracked uppercase. "quiet" is a head INSIDE a
   *  block, where the block stamp is already carrying the uppercase label. */
  voice?: "display" | "quiet"
  as?: ElementType
  className?: string
}

/** Section title with a heavy acid rule under it, meta right-aligned. */
export const SectionHead = ({
  title,
  meta,
  rule = "signal",
  metaTone = "dim",
  voice = "display",
  as: Tag = "h2",
  className
}: SectionHeadProps) => (
  <div
    className={[styles.head, rule === "signal" ? styles.ruleSignal : styles.ruleDefault, className]
      .filter(Boolean)
      .join(" ")}
  >
    <Tag className={voice === "quiet" ? styles.titleQuiet : styles.title}>{title}</Tag>
    {meta ? (
      <div className={metaTone === "signal" ? styles.metaSignal : styles.meta}>{meta}</div>
    ) : null}
  </div>
)
