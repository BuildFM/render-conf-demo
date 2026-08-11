import type { Item } from "@/lib/types"
import { DisplayHeading } from "@/components/core/display-heading"
import { Eyebrow } from "@/components/core/eyebrow"
import styles from "./shopping-list.module.css"

type Section = { name: string; items: Item[] }

/**
 * SECTIONS PACKED INTO COLUMNS OF ROUGHLY EQUAL HEIGHT.
 *
 * This was `grid-template-columns: repeat(3, 1fr)` with the sections flowing
 * row-wise, which is correct only while the sections are about the same size. They
 * are not, and they cannot be made to be: the model chooses which recipes go in the
 * list, so the shape of the list is different on every composition. Four dishes
 * produced Produce 4, Butcher 1, Dairy 1, Dry goods 12 — so row one was as tall as
 * Produce with two nearly empty cells beside it, row two was as tall as Dry goods
 * with two entirely empty cells beside it, and two thirds of the block was a hole.
 *
 * So the column count is derived from the content rather than declared, and the
 * sections are split into CONTIGUOUS groups — contiguous because the section order
 * is the order you walk a shop, and a list that reads Produce, Dairy, Butcher down
 * one column has thrown away the only thing its grouping was for.
 *
 * Balance is measured, not assumed: with one section three times the height of the
 * rest there is no three-column arrangement that is not mostly hole, so it drops to
 * two. The test is the shortest column over the tallest, and the line is **half** —
 * a column half the height of its neighbour reads as a ragged bottom, which is what
 * a list of things is supposed to look like; a column a fifth of its neighbour reads
 * as a bug. The old layout scored 0.15 on the four dishes that prompted this.
 */
const BALANCE = 0.5
const weigh = (s: Section) => s.items.length + 1 // the caption costs about a row

/** Every way to cut `k` items into `n` contiguous groups. k is at most five. */
const cutPoints = (n: number, k: number): number[][] => {
  const out: number[][] = []
  const walk = (start: number, acc: number[]) => {
    if (acc.length === n - 1) return void out.push([...acc])
    for (let i = start; i <= k - 1; i++) {
      acc.push(i)
      walk(i + 1, acc)
      acc.pop()
    }
  }
  walk(1, [])
  return out
}

/** The most even contiguous split into exactly `n` groups. */
const split = (sections: Section[], n: number): Section[][] => {
  const k = sections.length
  if (n >= k) return sections.map((s) => [s])
  let best: Section[][] = [sections]
  let bestMax = Infinity
  for (const cuts of cutPoints(n, k)) {
    const bounds = [0, ...cuts, k]
    const groups = bounds.slice(0, -1).map((from, i) => sections.slice(from, bounds[i + 1]))
    const max = Math.max(...groups.map((g) => g.reduce((t, s) => t + weigh(s), 0)))
    if (max < bestMax) {
      bestMax = max
      best = groups
    }
  }
  return best
}

const packColumns = (sections: Section[], maxColumns: number): Section[][] => {
  for (let n = Math.min(maxColumns, sections.length); n > 1; n--) {
    const groups = split(sections, n)
    const weights = groups.map((g) => g.reduce((t, s) => t + weigh(s), 0))
    if (Math.min(...weights) / Math.max(...weights) >= BALANCE) return groups
  }
  return [sections]
}

/** The packed columns, as elements. Shared by `hero` and `full`, which differ only
 *  in how many columns they will accept and how loud the captions are. */
const Columns = ({
  sections,
  maxColumns,
  captionClass
}: {
  sections: Section[]
  maxColumns: number
  captionClass: string
}) => {
  const columns = packColumns(sections, maxColumns)
  return (
    /* data-cols rather than an inline grid-template, so the container query below
       700px can still collapse it to one column — an inline style would outrank the
       stylesheet and the half-width case would keep its columns and break the item
       names across lines, which is the one thing a list read in a shop must not do. */
    <div className={styles.columns} data-cols={columns.length}>
      {columns.map((group, i) => (
        <div key={i} className={styles.column}>
          {group.map((section) => (
            <table key={section.name} className={styles.table}>
              <caption className={captionClass}>{section.name}</caption>
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
      ))}
    </div>
  )
}

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
        {/* Two at most: at hero the list has the whole measure, and a wider column
            is what keeps an item and its quantity on one line. */}
        <Columns sections={sections} maxColumns={2} captionClass={styles.captionHero} />
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

  return <Columns sections={sections} maxColumns={3} captionClass={styles.caption} />
}
