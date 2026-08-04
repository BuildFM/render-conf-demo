import type { Item } from "@/lib/types"
import styles from "./shopping-list.module.css"

type Section = { name: string; items: Item[] }

type ShoppingListProps = {
  sections: Section[]
  treatment: "full" | "collapsed"
}

/** Buying, grouped by store section, because that is the order you walk.
 *  Purely utilitarian: no display type inside the list, quantities right-aligned
 *  so the column reads as a column. The block that proves the mono was functional. */
export const ShoppingList = ({ sections, treatment }: ShoppingListProps) => {
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
