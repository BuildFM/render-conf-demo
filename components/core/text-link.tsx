import type { ReactNode } from "react"
import styles from "./text-link.module.css"

type TextLinkProps = {
  children: ReactNode
  href: string
  tone?: "signal" | "dim"
  className?: string
}

/** Mono uppercase link with a thin rule under it. Hover goes to paper. */
export const TextLink = ({ children, href, tone = "signal", className }: TextLinkProps) => (
  <a href={href} className={[styles.link, styles[tone], className].filter(Boolean).join(" ")}>
    {children}
  </a>
)
