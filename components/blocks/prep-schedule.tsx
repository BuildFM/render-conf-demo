import type { ReactNode } from "react"
import type { Task } from "@/lib/types"
import { DisplayHeading } from "@/components/core/display-heading"
import { Eyebrow } from "@/components/core/eyebrow"
import { FigureWell } from "@/components/content/figure-well"
import styles from "./prep-schedule.module.css"

type Day = { day: string; tasks: Task[] }

type PrepScheduleProps = {
  title: ReactNode
  days: Day[]
  /** The shared base dish — the one the week is built on. Never any other. */
  image?: { src: string; alt: string; tag?: string }
  treatment: "hero" | "full" | "collapsed"
}

const hasSharedBase = (day: Day) => day.tasks.some((task) => task.sharedBase)

/** Work sequenced across days when several dishes share a base. Finding the
 *  shared item is the entire reason the block exists, so shared tasks are acid
 *  and their day is the only day with an acid rule. */
export const PrepSchedule = ({ title, days, image, treatment }: PrepScheduleProps) => {
  if (treatment === "collapsed") {
    const base = days.find(hasSharedBase)
    return (
      <section className={styles.collapsed}>
        <h2 className={styles.collapsedTitle}>{title}</h2>
        <p className={styles.collapsedBody}>
          {base ? (
            <>
              <span className={styles.signal}>{base.day}:</span>{" "}
              {base.tasks.find((task) => task.sharedBase)?.text}
            </>
          ) : (
            `${days.length} days of prep`
          )}
        </p>
      </section>
    )
  }

  return (
    <section>
      {/* The shared base, pictured. A schedule is an instrument and does not want
          decoration, but the one thing this block exists to find is the dish that
          feeds the rest of the week — so that is the dish that gets shown, and no
          other. Same header shape as ForkedRecipeCard: the twins' two lead blocks
          treat their photograph identically, which is the system showing rather
          than two separate decisions. */}
      <div className={image ? styles.head : undefined}>
        <DisplayHeading size={treatment === "hero" ? "l" : "m"} as="h2" className={styles.title}>
          {title}
        </DisplayHeading>
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

      {days.map((day, i) => (
        <div
          key={day.day}
          className={hasSharedBase(day) ? styles.dayShared : styles.day}
        >
          <div>
            <h3 className={styles.dayName}>{day.day}</h3>
            {hasSharedBase(day) ? (
              <Eyebrow track="sm" className={styles.dayNote}>
                Used again later this week
              </Eyebrow>
            ) : null}
          </div>
          <div className={styles.tasks}>
            {day.tasks.map((task) => (
              <div key={task.text} className={styles.task}>
                <span className={task.sharedBase ? styles.taskTextShared : styles.taskText}>
                  {task.text}
                </span>
                {task.recipeTitle ? (
                  <Eyebrow tone={task.sharedBase ? "signal" : "dim"} track="sm">
                    {task.recipeTitle}
                  </Eyebrow>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
