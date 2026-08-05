import styles from "./method-list.module.css"

type MethodListProps = {
  steps: string[]
  className?: string
}

/**
 * The numbered method. THE ordered list in the system — there is exactly one, and
 * it is drawn the same way wherever it appears.
 *
 * It lived inside PrimerCard until RecipeCard needed it too. Copying the markup
 * would have given the system two ordered lists that agreed by luck until someone
 * changed one; extracting it keeps the claim in the design brief literally true.
 *
 * The numbers matter beyond decoration: they are the same numbers the event log
 * reports. When a log row says someone stopped at step 3, this is the step 3 it
 * means.
 */
export const MethodList = ({ steps, className }: MethodListProps) => (
  <ol className={[styles.steps, className].filter(Boolean).join(" ")}>
    {steps.map((step, i) => (
      <li key={step} className={styles.step}>
        <span className={styles.stepNo} aria-hidden="true">
          {i + 1}
        </span>
        <span className={styles.stepText}>{step}</span>
      </li>
    ))}
  </ol>
)
