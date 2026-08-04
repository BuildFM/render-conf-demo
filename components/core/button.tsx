import type { ReactNode } from "react"
import styles from "./button.module.css"

type ButtonProps = {
  children: ReactNode
  variant?: "signal" | "outline"
  size?: "md" | "sm"
  /** Renders an anchor. Omit for a submit/button element. */
  href?: string
  type?: "button" | "submit"
  disabled?: boolean
  className?: string
}

/** Uppercase condensed action. Square, flat, hover is a colour change only. */
export const Button = ({
  children,
  variant = "signal",
  size = "md",
  href,
  type = "button",
  disabled = false,
  className
}: ButtonProps) => {
  const cls = [styles.base, styles[variant], styles[size], className].filter(Boolean).join(" ")
  if (href && !disabled) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    )
  }
  return (
    <button type={type} disabled={disabled} className={cls}>
      {children}
    </button>
  )
}
