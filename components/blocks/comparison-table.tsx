import type { ComparisonRow } from "@/lib/types"
import { SectionHead } from "@/components/layout/section-head"
import { Eyebrow } from "@/components/core/eyebrow"
import styles from "./comparison-table.module.css"

type ComparisonTableProps = {
  title: string
  /** 2–4 axes. They are the personalisation — say so above the table. */
  axes: string[]
  rows: ComparisonRow[]
  treatment: "full" | "collapsed"
}

const axisNote = (axes: string[]) =>
  `Compared on ${axes.map((a) => a.toLowerCase()).join(" and ")}`

/** Three to five dishes compared on axes chosen for this household. Column one
 *  is always the recipe at row scale; the last column is right-aligned. */
export const ComparisonTable = ({ title, axes, rows, treatment }: ComparisonTableProps) => {
  const collapsed = treatment === "collapsed"
  const shownAxes = collapsed ? axes.slice(0, 2) : axes

  return (
    <section>
      {collapsed ? (
        <Eyebrow track="md" className={styles.axisNote}>
          {axisNote(shownAxes)}
        </Eyebrow>
      ) : (
        <SectionHead title={title} meta="Columns chosen for you" metaTone="signal" />
      )}

      <table className={collapsed ? styles.tableCollapsed : styles.table}>
        <colgroup>
          <col className={styles.colDish} />
          {shownAxes.map((axis) => (
            <col key={axis} />
          ))}
        </colgroup>
        {collapsed ? null : (
          <thead>
            <tr>
              <th scope="col" className={styles.th}>
                Dish
              </th>
              {shownAxes.map((axis, i) => (
                <th
                  key={axis}
                  scope="col"
                  className={i === shownAxes.length - 1 ? styles.thRight : styles.th}
                >
                  {axis}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row) => (
            <tr key={row.recipe.id} className={styles.row}>
              <th scope="row" className={styles.dish}>
                {row.recipe.title}
              </th>
              {shownAxes.map((axis, i) => {
                const emphasised = row.emphasis?.includes(i)
                const last = i === shownAxes.length - 1
                return (
                  <td
                    key={axis}
                    className={[
                      emphasised ? styles.valueSignal : styles.value,
                      last ? styles.right : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {row.values[i]}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
