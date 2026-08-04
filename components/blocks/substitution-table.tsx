import type { SubstitutionRow } from "@/lib/types"
import styles from "./substitution-table.module.css"

type SubstitutionTableProps = {
  rows: SubstitutionRow[]
  treatment: "full" | "collapsed"
}

/** What to use instead. The swap is the row title; the note is why it works or
 *  where it falls short. Never presented as a fix for an allergy — that is
 *  AllergenNotice's job and this block must not look like it. */
export const SubstitutionTable = ({ rows, treatment }: SubstitutionTableProps) => {
  const collapsed = treatment === "collapsed"
  return (
    <table className={styles.table}>
      <colgroup>
        <col className={styles.colWants} />
        <col className={styles.colHave} />
        {collapsed ? null : <col />}
      </colgroup>
      <thead>
        <tr>
          <th scope="col" className={styles.th}>
            Calls for
          </th>
          <th scope="col" className={styles.th}>
            Use instead
          </th>
          {collapsed ? null : (
            <th scope="col" className={styles.th}>
              What changes
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.wants} className={styles.row}>
            <th scope="row" className={styles.wants}>
              {row.wants}
            </th>
            <td className={styles.have}>{row.have}</td>
            {collapsed ? null : <td className={styles.note}>{row.note}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
