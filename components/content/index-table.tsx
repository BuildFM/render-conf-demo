import styles from "./index-table.module.css"

export type IndexRow = {
  no: string
  recipe: string
  technique: string
  active: string
  total: string
  href?: string
}

type IndexTableProps = {
  rows: IndexRow[]
  headers?: [string, string, string, string, string]
  className?: string
}

/** Dense recipe index. A real table: rules between rows, no zebra fill, hover
 *  raises the row in CSS. No client component and no row click handler — the
 *  title is a link when the row has an href. */
export const IndexTable = ({
  rows,
  headers = ["No.", "Recipe", "Technique", "Active", "Total"],
  className
}: IndexTableProps) => (
  <table className={[styles.table, className].filter(Boolean).join(" ")}>
    <colgroup>
      <col className={styles.colNo} />
      <col />
      <col className={styles.colTechnique} />
      <col className={styles.colTime} />
      <col className={styles.colTime} />
    </colgroup>
    <thead>
      <tr>
        {headers.map((header, i) => (
          <th
            key={header}
            scope="col"
            className={i === headers.length - 1 ? styles.thRight : styles.th}
          >
            {header}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <tr key={row.no} className={styles.row}>
          <td className={styles.no}>{row.no}</td>
          <th scope="row" className={styles.title}>
            {row.href ? (
              <a href={row.href} className={styles.titleLink}>
                {row.recipe}
              </a>
            ) : (
              row.recipe
            )}
          </th>
          <td className={styles.technique}>{row.technique}</td>
          <td className={styles.value}>{row.active}</td>
          <td className={styles.valueRight}>{row.total}</td>
        </tr>
      ))}
    </tbody>
  </table>
)
