import type { Item } from "@/lib/types"
import { DisplayHeading } from "@/components/core/display-heading"
import { Eyebrow } from "@/components/core/eyebrow"
import styles from "./shopping-list.module.css"

type Section = { name: string; items: Item[] }

type ShoppingListProps = {
  sections: Section[]
  /** Hero only. What this shop is FOR — set by the occasion, never by the model. */
  standfirst?: string
  treatment: "hero" | "full" | "collapsed"
}

/** Buying, grouped by store section, because that is the order you walk.
 *  Purely utilitarian: no display type inside the list, quantities right-aligned
 *  so the column reads as a column. The block that proves the mono was functional. */
export const ShoppingList = ({ sections, standfirst, treatment }: ShoppingListProps) => {
  /* HERO. The block opens the page, so the list stops being a reference table at the
     bottom and becomes the thing you came for: a headline, the count, and the
     sections at full measure in two wide columns instead of three narrow ones. The
     same data — a different job, because on the Tuesday before eight people arrive
     the shop IS the page. */
  if (treatment === "hero") {
    const count = sections.reduce((n, section) => n + section.items.length, 0)
    return (
      <section>
        <Eyebrow track="sm" tone="signal">
          {count} items · {sections.length} sections
        </Eyebrow>
        <DisplayHeading size="l" as="h2" className={styles.heroTitle}>
          The shop
        </DisplayHeading>
        {standfirst ? <p className={styles.heroStandfirst}>{standfirst}</p> : null}
        <div className={styles.heroColumns}>
          {sections.map((section) => (
            <table key={section.name} className={styles.table}>
              <caption className={styles.captionHero}>{section.name}</caption>
              <colgroup>
                <col />
                <col className={styles.colQty} />
              </colgroup>
              <tbody>
                {section.items.map((item) => (
                  <tr key={item.name} className={styles.row}>
                    <th scope="row" className={styles.name}>{item.name}</th>
                    <td className={styles.qty}>{item.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      </section>
    )
  }

  if (treatment === "collapsed") {
    const count = sections.reduce((n, section) => n + section.items.length, 0)
    return (
      <section className={styles.collapsed}>
        <div className={styles.collapsedHead}>
          {count} items · {sections.map((section) => section.name).join(" · ")}
        </div>
        <p className={styles.collapsedList}>
          {sections
            .flatMap((section) => section.items.map((item) => item.name))
            .join(" · ")}
        </p>
      </section>
    )
  }

  return (
    <div className={styles.columns}>
      {sections.map((section) => (
        <table key={section.name} className={styles.table}>
          <caption className={styles.caption}>{section.name}</caption>
          <colgroup>
            <col />
            <col className={styles.colQty} />
          </colgroup>
          <tbody>
            {section.items.map((item) => (
              <tr key={item.name} className={styles.row}>
                <th scope="row" className={styles.name}>
                  {item.name}
                </th>
                <td className={styles.qty}>{item.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  )
}
