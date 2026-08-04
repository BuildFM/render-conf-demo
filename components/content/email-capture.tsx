import styles from "./email-capture.module.css"

type EmailCaptureProps = {
  eyebrow?: string
  title: string
  body?: string
  placeholder?: string
  buttonLabel?: string
  /** Server action or form endpoint. No client state — the form posts. */
  action?: string
  status?: "idle" | "success" | "error"
  className?: string
}

/** Newsletter block: bordered panel, flush input + acid button, no illustration. */
export const EmailCapture = ({
  eyebrow,
  title,
  body,
  placeholder = "you@kitchen.com",
  buttonLabel = "Subscribe",
  action,
  status = "idle",
  className
}: EmailCaptureProps) => (
  <section className={[styles.panel, className].filter(Boolean).join(" ")}>
    {eyebrow ? <div className={styles.eyebrow}>{eyebrow}</div> : null}
    <h2 className={styles.title}>{title}</h2>
    {body ? <p className={styles.body}>{body}</p> : null}

    {status === "success" ? (
      <p className={styles.success}>Filed. First list lands Sunday.</p>
    ) : (
      <form action={action} className={styles.form}>
        <input
          type="email"
          name="email"
          required
          placeholder={placeholder}
          aria-label="Email address"
          className={styles.input}
        />
        <button type="submit" className={styles.button}>
          {buttonLabel}
        </button>
      </form>
    )}

    {status === "error" ? (
      <p className={styles.error}>That address did not take. Check it and try again.</p>
    ) : null}
  </section>
)
