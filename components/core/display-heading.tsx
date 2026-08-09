import type { ElementType, ReactNode } from "react"
import styles from "./display-heading.module.css"

type DisplayHeadingProps = {
  children: ReactNode
  /** xl is the hero. One per page, no more. */
  size?: "xl" | "l" | "m" | "s"
  /** "display" shouts — ultra-condensed uppercase, for a title that names a dish or
   *  an idea. "quiet" speaks — wide, sentence case, for a title that names the job
   *  the block is doing. Two registers in one slot, so a block changes volume
   *  without changing markup. */
  voice?: "display" | "quiet"
  as?: ElementType
  tone?: "primary" | "onSignal"
  balance?: boolean
  className?: string
}

const QUIET: Record<string, string> = { xl: "quietL", l: "quietL", m: "quietM", s: "quietS" }

/** Every heading in the system, in one of two voices. */
export const DisplayHeading = ({
  children,
  size = "l",
  voice = "display",
  as: Tag = "h2",
  tone = "primary",
  balance = false,
  className
}: DisplayHeadingProps) => (
  <Tag
    className={[
      voice === "quiet" ? styles[QUIET[size]] : styles[size],
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
