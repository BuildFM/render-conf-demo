import { DisplayHeading } from "@/components/core/display-heading"
import { Eyebrow } from "@/components/core/eyebrow"
import styles from "./allergen-notice.module.css"

type AllergenNoticeProps = {
  allergen: string
  recipeTitle: string
  /** Optional second sentence. The first is generated from the two names. */
  detail?: string
}

/** Different in kind from every other block. Placed by the application before
 *  the model is consulted, whenever a dish on the page contains a recorded
 *  allergen. No treatment prop: nothing about the reader can shrink it, and it
 *  never becomes a chip or turns red.
 *
 *  It is marked out by STRUCTURE alone — acid rules above and below, an acid
 *  kicker, and the statement at Display L. It carried an acid "!" until it did
 *  not: the design brief sanctions three glyphs (→ · ©) and that was a fourth,
 *  doing the job of a warning icon in a system that bans icon sets. It was also
 *  adding emphasis to the most emphatic thing on the page. */
export const AllergenNotice = ({ allergen, recipeTitle, detail }: AllergenNoticeProps) => (
  <section className={styles.notice} aria-label={`Allergen notice: ${allergen}`}>
    <div className={styles.band}>
      <Eyebrow track="lg" className={styles.kicker}>
        Recorded for this household · {allergen}
      </Eyebrow>
      <DisplayHeading size="l" as="h2" className={styles.statement}>
        {recipeTitle} contains {allergen.toLowerCase()}
      </DisplayHeading>
      {detail ? <p className={styles.detail}>{detail}</p> : null}
    </div>
  </section>
)
