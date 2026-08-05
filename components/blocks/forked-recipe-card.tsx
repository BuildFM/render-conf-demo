import type { Recipe } from "@/lib/types"
import { DisplayHeading } from "@/components/core/display-heading"
import { Eyebrow } from "@/components/core/eyebrow"
import { FigureWell } from "@/components/content/figure-well"
import { MethodList } from "@/components/content/method-list"
import { formatYield } from "@/lib/format"
import styles from "./forked-recipe-card.module.css"

type Branch = { label: string; title: string; body: string; steps?: string[] }

type ForkedRecipeCardProps = {
  recipe: Recipe
  /** Where the method divides: "Step 6 of 9". */
  forkPoint: string
  /** The steps before the divide. Without these the block asserted a fork and
   *  showed nothing to fork — an intro paragraph and two blurbs. The shared method
   *  is what makes both branches visibly the same dish up to a point. */
  sharedSteps?: string[]
  /** Which step is the first divergent one, so both branches number from it. */
  forkStep?: number
  /** Steps after the branches, when the method REJOINS. `031` diverges for exactly
   *  one step and is identical afterwards, which is the sharpest version of the
   *  point this block exists to make — and it could not be said at all while the
   *  branches were loose prose. */
  tailSteps?: string[]
  branches: [Branch, Branch]
  treatment: "full" | "collapsed"
}

/** A dish that splits partway to serve two constraints at one table. The fork is
 *  drawn, not described — if you can describe the split but not see it, the
 *  block has failed. */
export const ForkedRecipeCard = ({
  recipe,
  forkPoint,
  sharedSteps,
  forkStep,
  tailSteps,
  branches,
  treatment
}: ForkedRecipeCardProps) => {
  if (treatment === "collapsed") {
    return (
      <article className={styles.collapsed}>
        <h3 className={styles.collapsedTitle}>{recipe.title}</h3>
        <div className={styles.collapsedSplit}>
          <p className={styles.collapsedBranch}>
            <span className={styles.branchMark}>A ·</span> {branches[0].title}
          </p>
          <div className={styles.divider} aria-hidden="true" />
          <p className={styles.collapsedBranch}>
            <span className={styles.branchMark}>B ·</span> {branches[1].title}
          </p>
        </div>
      </article>
    )
  }

  return (
    <article className={styles.card}>
      {/* The dish, before it divides. The photograph belongs above the fork rule,
          never beside a branch — one image next to Branch A would read as Branch A's
          outcome, and the whole point is that both branches are the same dish. */}
      <div className={styles.head}>
        <div>
          <div className={styles.headRow}>
            <Eyebrow track="md">
              {recipe.technique[0]} · {formatYield(recipe.yield)} · One pot
            </Eyebrow>
            <Eyebrow tone="dim" track="sm">
              Splits at {forkPoint.toLowerCase()}
            </Eyebrow>
          </div>
          <DisplayHeading size="m" as="h3" className={styles.title}>
            {recipe.title}
          </DisplayHeading>
          {recipe.summary ? <p className={styles.shared}>{recipe.summary}</p> : null}
        </div>
        {recipe.image ? (
          <FigureWell
            src={recipe.image.src}
            alt={recipe.image.alt}
            tag={`Fig. ${recipe.id}`}
            shape="landscape"
            className={styles.well}
          />
        ) : null}
      </div>

      {sharedSteps?.length ? (
        <div className={styles.method}>
          <Eyebrow track="md" className={styles.methodLabel}>
            Method, up to the split
          </Eyebrow>
          <MethodList steps={sharedSteps} />
        </div>
      ) : null}

      <div className={styles.forkRule}>
        <Eyebrow track="lg" className={styles.forkLabel}>
          {/* The step number is already on the dim eyebrow above. This label sits ON
              the divider, so it says where you are, not what you were told. */}
          Splits here
        </Eyebrow>
        <div className={styles.rule} aria-hidden="true" />
      </div>

      <div className={styles.branches}>
        {branches.map((branch, i) => (
          <div key={branch.label} className={i === 0 ? styles.branchLeft : styles.branch}>
            <Eyebrow track="md" className={styles.branchLabel}>
              Option {i === 0 ? "A" : "B"} · {branch.label}
            </Eyebrow>
            <h4 className={styles.branchTitle}>{branch.title}</h4>
            {/* Steps replace the prose rather than joining it: the branch bodies
                are where these steps came from, so printing both says everything
                twice. Prose remains the fallback for a branch nobody has broken
                into steps yet. */}
            {branch.steps?.length ? (
              <MethodList steps={branch.steps} start={forkStep ?? 1} />
            ) : (
              <p className={styles.branchBody}>{branch.body}</p>
            )}
          </div>
        ))}
      </div>

      {/* Where the two paths become one dish again. Only `031` has this, and it is
          the strongest thing on the card when it does: one step differs and the
          other four are identical, which is the argument in miniature. */}
      {tailSteps?.length ? (
        <>
          <div className={styles.forkRule}>
            <Eyebrow track="lg" className={styles.forkLabel}>
              Rejoins here
            </Eyebrow>
            <div className={styles.rule} aria-hidden="true" />
          </div>
          <div className={styles.method}>
            <MethodList steps={tailSteps} start={(forkStep ?? 1) + (branches[0].steps?.length ?? 0)} />
          </div>
        </>
      ) : null}
    </article>
  )
}
