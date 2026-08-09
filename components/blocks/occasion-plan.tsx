import type { ReactNode } from "react"
import { DisplayHeading } from "@/components/core/display-heading"
import { Eyebrow } from "@/components/core/eyebrow"
import { FigureWell } from "@/components/content/figure-well"
import styles from "./occasion-plan.module.css"

export type OccasionStage = {
  /** "Saturday", "Two days before", "The morning" — pre-formatted upstream.
   *  Blocks never compute a date. */
  when: string
  tasks: { text: string; recipeTitle?: string; ahead?: boolean }[]
}

type OccasionPlanProps = {
  title: ReactNode
  /** "Eight people · Saturday 22 August". Resolved, never assembled here. */
  standfirst: string
  stages: OccasionStage[]
  /** Present only when the occasion is for more people than live here. The
   *  scaling stopped being a control the moment the system knew the number.
   *  One entry per dish: a menu is written for several different numbers, and a
   *  single factor across all of them under-scales everything but the largest. */
  scaledTo?: { servings: number; dishes: { title: string; from: number; factor: string }[] }
  /** One guest's constraint, in words. The AllergenNotice does the enforcing —
   *  this is why it is there. */
  guestNote?: string
  image?: { src: string; alt: string; tag?: string }
  treatment: "hero" | "full" | "collapsed"
}

/**
 * The occasion, sequenced.
 *
 * The no-template object for the fast pace layer: a set of dishes that work
 * together, ordered against a date, for a guest count nobody anticipated. There is
 * no page type for this — it exists for a fortnight and then it does not.
 *
 * The three moments in the demo are NOT three variants of this block. They are this
 * block holding fewer stages as the date closes, beside a different set of support
 * blocks, because the manifest's preconditions key on how many days are left. If
 * this component ever grows a `moment` prop, the argument has been lost.
 */
export const OccasionPlan = ({
  title,
  standfirst,
  stages,
  scaledTo,
  guestNote,
  image,
  treatment
}: OccasionPlanProps) => {
  if (treatment === "collapsed") {
    return (
      <section className={styles.collapsed}>
        <h2 className={styles.collapsedTitle}>{title}</h2>
        <p className={styles.collapsedBody}>
          <span className={styles.signal}>{standfirst}</span>
          {stages.length ? ` · ${stages.length} stages` : null}
        </p>
      </section>
    )
  }

  return (
    <section>
      <div className={image ? styles.head : undefined}>
        <div>
          <Eyebrow track="sm" tone="signal">
            Planned in Mise
          </Eyebrow>
          <DisplayHeading size={treatment === "hero" ? "l" : "m"} as="h2" className={styles.title}>
            {title}
          </DisplayHeading>
          <p className={styles.standfirst}>{standfirst}</p>
        </div>
        {image ? (
          <FigureWell
            src={image.src}
            alt={image.alt}
            tag={image.tag}
            shape="landscape"
            className={styles.well}
          />
        ) : null}
      </div>

      {/* Quantities, stated rather than offered. A stepper exists in this system for
          the case where the site does not know how many people are eating. It knows.
          So the number is an answer, not a question — which is the whole difference
          the occasion makes. */}
      {scaledTo ? (
        <div className={styles.scaled}>
          <span className={styles.scaledValue}>Scaled to {scaledTo.servings}</span>
          {/* Uniform menus keep the single sentence they always had. A mixed one
              states the factor beside each dish, because that is what differs —
              collapsing it to one number is how the cabbage came out half-size. */}
          {new Set(scaledTo.dishes.map((d) => d.factor)).size === 1 ? (
            <span className={styles.scaledNote}>
              ×{scaledTo.dishes[0].factor} on every quantity · written for{" "}
              {scaledTo.dishes[0].from}
            </span>
          ) : (
            <span className={styles.scaledNote}>
              {scaledTo.dishes.map((d) => `${d.title} ×${d.factor}`).join(" · ")}
            </span>
          )}
        </div>
      ) : null}

      {stages.map((stage, i) => (
        <div
          key={stage.when}
          className={styles.stage}
        >
          <div>
            <h3 className={styles.when}>{stage.when}</h3>
            {stage.tasks.some((t) => t.ahead) ? (
              <Eyebrow track="sm" className={styles.whenNote}>
                Can be done ahead
              </Eyebrow>
            ) : null}
          </div>
          <div className={styles.tasks}>
            {stage.tasks.map((task) => (
              <div key={task.text} className={styles.task}>
                <span className={task.ahead ? styles.taskTextAhead : styles.taskText}>
                  {task.text}
                </span>
                {task.recipeTitle ? (
                  <Eyebrow tone={task.ahead ? "signal" : "dim"} track="sm">
                    {task.recipeTitle}
                  </Eyebrow>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}

      {guestNote ? <p className={styles.guestNote}>{guestNote}</p> : null}
    </section>
  )
}
