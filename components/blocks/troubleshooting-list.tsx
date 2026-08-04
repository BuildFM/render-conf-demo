import type { TroubleshootingItem } from "@/lib/types"
import styles from "./troubleshooting-list.module.css"

type TroubleshootingListProps = {
  items: TroubleshootingItem[]
  treatment: "full" | "collapsed"
}

/** The ways this dish goes wrong. The symptom is what the reader recognises, so
 *  it takes row-title scale; the fix is the column that matters and is never dim.
 *  Never phrased as a warning — it describes a pan, not an alert. */
export const TroubleshootingList = ({ items, treatment }: TroubleshootingListProps) => {
  const collapsed = treatment === "collapsed"
  return (
    <table className={styles.table}>
      <colgroup>
        <col className={collapsed ? styles.colSymptomCollapsed : styles.colSymptom} />
        {collapsed ? null : <col className={styles.colCause} />}
        <col />
      </colgroup>
      <thead>
        <tr>
          <th scope="col" className={styles.th}>
            Symptom
          </th>
          {collapsed ? null : (
            <th scope="col" className={styles.th}>
              Cause
            </th>
          )}
          <th scope="col" className={styles.th}>
            Fix
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.symptom} className={styles.row}>
            <th scope="row" className={styles.symptom}>
              {item.symptom}
            </th>
            {collapsed ? null : <td className={styles.cause}>{item.cause}</td>}
            <td className={styles.fix}>{item.fix}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
