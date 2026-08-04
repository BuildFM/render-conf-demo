import type { ElementType, ReactNode } from "react"
import styles from "./eyebrow.module.css"

type EyebrowProps = {
  children: ReactNode
  tone?: "signal" | "dim" | "primary" | "onSignal"
  track?: "sm" | "md" | "lg"
  as?: ElementType
  className?: string
}

/** Small mono all-caps label. The system's only chrome. Never below the floor. */
export const Eyebrow = ({
  children,
  tone = "signal",
  track = "md",
  as: Tag = "div",
  className
}: EyebrowProps) => (
  <Tag className={[styles[track], styles[tone], className].filter(Boolean).join(" ")}>
    {children}
  </Tag>
)
