import type { ReactNode } from "react"
import styles from "./signal-band.module.css"

type SignalBandProps = {
  children: ReactNode
  /** Right-hand mono lines. Three or fewer. */
  lines?: string[]
  className?: string
}

/** Full-bleed acid band carrying one editorial statement. Max one per page. */
export const SignalBand = ({ children, lines = [], className }: SignalBandProps) => (
  <section
    className={[styles.band, lines.length ? styles.withLines : "", className]
      .filter(Boolean)
      .join(" ")}
  >
    <p className={styles.statement}>{children}</p>
    {lines.length ? (
      <div className={styles.lines}>
        {lines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    ) : null}
  </section>
)
