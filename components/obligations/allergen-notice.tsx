import { DisplayHeading } from "@/components/core/display-heading"
import { Eyebrow } from "@/components/core/eyebrow"
import styles from "./allergen-notice.module.css"

type AllergenNoticeProps = {
  allergen: string
  recipeTitle: string
  /** WHOSE constraint this is. A household that declares an allergy needs no
   *  explanation; a guest's does — without it, the learner, who records no allergy
   *  at all, got a warning that read as a claim about them. */
  source?: "household" | "guest"
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
export const AllergenNotice = ({ allergen, recipeTitle, source, detail }: AllergenNoticeProps) => (
  <section
    className={styles.notice}
    aria-label={`Allergen notice: ${allergen}${source === "guest" ? ", for a guest" : ""}`}
  >
    <div className={styles.band}>
      {/* "Recorded for this household" until 5 Aug. It described the provenance of
          the fact and never named the thing it was warning about — on a block whose
          whole job is to be understood in one glance, from the back of a room, by
          someone who has been looking at it for two seconds. The word is "allergy". */}
      <Eyebrow track="lg" className={styles.kicker}>
        Allergy warning · {allergen}
        {source === "guest" ? " · for a guest" : null}
      </Eyebrow>
      <DisplayHeading size="l" as="h2" className={styles.statement}>
        {recipeTitle} contains {allergen.toLowerCase()}
      </DisplayHeading>
      {detail ? <p className={styles.detail}>{detail}</p> : null}
    </div>
  </section>
)
