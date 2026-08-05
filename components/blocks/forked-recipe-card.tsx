import type { Recipe } from "@/lib/types"
import { DisplayHeading } from "@/components/core/display-heading"
import { Eyebrow } from "@/components/core/eyebrow"
import { FigureWell } from "@/components/content/figure-well"
import { formatYield } from "@/lib/format"
import styles from "./forked-recipe-card.module.css"

type Branch = { label: string; title: string; body: string }

type ForkedRecipeCardProps = {
  recipe: Recipe
  /** Where the method divides: "Step 6 of 9". */
  forkPoint: string
  branches: [Branch, Branch]
  treatment: "full" | "collapsed"
}

/** A dish that splits partway to serve two constraints at one table. The fork is
 *  drawn, not described — if you can describe the split but not see it, the
 *  block has failed. */
export const ForkedRecipeCard = ({
  recipe,
  forkPoint,
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
              Forks at {forkPoint.toLowerCase()}
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

      <div className={styles.forkRule}>
        <Eyebrow track="lg" className={styles.forkLabel}>
          Fork · {forkPoint}
        </Eyebrow>
        <div className={styles.rule} aria-hidden="true" />
      </div>

      <div className={styles.branches}>
        {branches.map((branch, i) => (
          <div key={branch.label} className={i === 0 ? styles.branchLeft : styles.branch}>
            <Eyebrow track="md" className={styles.branchLabel}>
              Branch {i === 0 ? "A" : "B"} · {branch.label}
            </Eyebrow>
            <h4 className={styles.branchTitle}>{branch.title}</h4>
            <p className={styles.branchBody}>{branch.body}</p>
          </div>
        ))}
      </div>
    </article>
  )
}
