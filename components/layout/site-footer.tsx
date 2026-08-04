import styles from "./site-footer.module.css"

type SiteFooterProps = {
  items?: string[]
  className?: string
}

/** Acid footer strip. Mono caps, evenly distributed, no columns of links. */
export const SiteFooter = ({ items = [], className }: SiteFooterProps) => (
  <footer className={[styles.footer, className].filter(Boolean).join(" ")}>
    {items.map((item) => (
      <span key={item}>{item}</span>
    ))}
  </footer>
)
