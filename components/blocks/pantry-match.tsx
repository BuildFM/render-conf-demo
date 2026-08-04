import type { PantryCandidate } from "@/lib/types"
import { formatShortfall } from "@/lib/format"
import styles from "./pantry-match.module.css"

type PantryMatchProps = {
  have: string[]
  missing: string[]
  matches: PantryCandidate[]
  treatment: "full" | "collapsed"
}

/** Starts from what is in the house rather than from a dish. The missing column
 *  is as informative as the present one and gets equal width — a reader deciding
 *  whether to go out needs the gap, not a score. */
export const PantryMatch = ({ have, missing, matches, treatment }: PantryMatchProps) => {
  if (treatment === "collapsed") {
    const ready = matches.filter((match) => match.missing.length === 0)
    return (
      <section className={styles.collapsed}>
        <div className={styles.collapsedHead}>
          {have.length} in the house · {missing.length} missing
        </div>
        <p className={styles.collapsedBody}>
          {ready.length
            ? `${ready.map((m) => m.recipe.title).join(" · ")} — cook now, nothing needed.`
            : `Nothing complete. Nearest is ${matches[0]?.recipe.title} — ${formatShortfall(
                matches[0]?.missing.length ?? 0
              ).toLowerCase()} short.`}
        </p>
      </section>
    )
  }

  return (
    <section>
      <div className={styles.pantry}>
        <div>
          <div className={styles.haveHead}>In the house · {have.length}</div>
          <p className={styles.haveList}>{have.join(" · ")}</p>
        </div>
        <div>
          <div className={styles.missingHead}>
            Missing for the near misses · {missing.length}
          </div>
          <p className={styles.missingList}>{missing.join(" · ")}</p>
        </div>
      </div>

      <table className={styles.table}>
        <colgroup>
          <col />
          <col className={styles.colMissing} />
          <col className={styles.colShortfall} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className={styles.th}>
              Dish
            </th>
            <th scope="col" className={styles.th}>
              Missing
            </th>
            <th scope="col" className={styles.thRight}>
              Shortfall
            </th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => {
            const short = match.missing.length
            return (
              <tr key={match.recipe.id} className={styles.row}>
                <th scope="row" className={styles.dish}>
                  {match.recipe.title}
                </th>
                <td className={short ? styles.missingCell : styles.value}>
                  {short ? match.missing.join(", ") : "Nothing"}
                </td>
                <td className={short ? styles.shortfall : styles.shortfallReady}>
                  {short ? formatShortfall(short) : "Cook it now"}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
