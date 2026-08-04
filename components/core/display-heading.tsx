import type { ElementType, ReactNode } from "react"
import styles from "./display-heading.module.css"

type DisplayHeadingProps = {
  children: ReactNode
  /** xl is the hero. One per page, no more. */
  size?: "xl" | "l" | "m" | "s"
  as?: ElementType
  tone?: "primary" | "onSignal"
  balance?: boolean
  className?: string
}

/** Ultra-condensed uppercase display type. Every heading in the system. */
export const DisplayHeading = ({
  children,
  size = "l",
  as: Tag = "h2",
  tone = "primary",
  balance = false,
  className
}: DisplayHeadingProps) => (
  <Tag
    className={[
      styles[size],
      tone === "onSignal" ? styles.onSignal : styles.primary,
      balance ? styles.balance : "",
      className
    ]
      .filter(Boolean)
      .join(" ")}
  >
    {children}
  </Tag>
)
