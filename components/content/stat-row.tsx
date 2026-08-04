import { Fragment } from "react"
import styles from "./stat-row.module.css"

type Stat = { label: string; value: string }

type StatRowProps = {
  stats: Stat[]
  separator?: string
  className?: string
}

/** Inline label/value run separated by slashes. Recipe particulars. */
export const StatRow = ({ stats, separator = "/", className }: StatRowProps) => (
  <div className={[styles.row, className].filter(Boolean).join(" ")}>
    {stats.map((stat, i) => (
      <Fragment key={stat.label}>
        <span>
          {stat.label} <span className={styles.value}>{stat.value}</span>
        </span>
        {i < stats.length - 1 ? <span aria-hidden="true">{separator}</span> : null}
      </Fragment>
    ))}
  </div>
)
