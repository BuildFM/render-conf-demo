import { Eyebrow } from "@/components/core/eyebrow"
import styles from "./story-intro.module.css"

type StoryIntroProps = {
  body: string
  /** "From the kitchen" */
  label?: string
  treatment: "full" | "collapsed"
}

/** Editorial preamble in the writer's voice. Set at body scale on a measure —
 *  it is prose, so it never takes display type and never gets a border. */
export const StoryIntro = ({ body, label = "From the kitchen", treatment }: StoryIntroProps) => (
  <section className={treatment === "collapsed" ? styles.collapsed : styles.full}>
    <Eyebrow track="md" className={styles.label}>
      {label}
    </Eyebrow>
    <p className={treatment === "collapsed" ? styles.bodyCollapsed : styles.body}>{body}</p>
  </section>
)
