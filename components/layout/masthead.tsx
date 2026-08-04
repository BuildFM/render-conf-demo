import styles from "./masthead.module.css"

type NavItem = { label: string; href: string; active?: boolean }

type MastheadProps = {
  wordmark?: string
  items?: NavItem[]
  /** Right-hand stamp: "Week 30 · Tue". */
  stamp?: string
  /** Optional search field. Added for SiteChrome — the primitive was extended,
   *  not forked. Omit and the masthead is exactly as it was. */
  search?: { placeholder: string; action?: string; buttonLabel?: string }
  className?: string
}

/** Top bar: wordmark, mono nav, optional search, issue stamp. One rule beneath. */
export const Masthead = ({
  wordmark = "Mise",
  items = [],
  stamp,
  search,
  className
}: MastheadProps) => (
  <header className={[styles.bar, className].filter(Boolean).join(" ")}>
    <a href="/" className={styles.wordmark}>
      {wordmark}
    </a>

    <nav className={styles.nav}>
      {items.map((item) => (
        <a
          key={item.label}
          href={item.href}
          className={item.active ? styles.navItemActive : styles.navItem}
          aria-current={item.active ? "page" : undefined}
        >
          {item.label}
        </a>
      ))}
    </nav>

    {search ? (
      <form className={styles.search} action={search.action} role="search">
        <input
          type="search"
          name="q"
          className={styles.searchInput}
          placeholder={search.placeholder}
          aria-label="Search recipes"
        />
        <button type="submit" className={styles.searchButton}>
          {search.buttonLabel ?? "Find"}
        </button>
      </form>
    ) : null}

    {stamp ? <div className={styles.stamp}>{stamp}</div> : null}
  </header>
)
