import styles from "./figure-well.module.css"

type FigureWellProps = {
  src?: string
  alt: string
  /** Acid tab, bottom left: "Fig. 041". */
  tag?: string
  /** portrait 440x520 · landscape fills its cell at 4:3 · fill takes the cell. */
  shape?: "portrait" | "landscape" | "fill"
  className?: string
}

/** Bordered image well with an acid figure tab. The only place photography appears.
 *  Plain <img> on purpose — local files, fixed wells, a recorded demo. */
export const FigureWell = ({ src, alt, tag, shape = "portrait", className }: FigureWellProps) => (
  <figure className={[styles.well, styles[shape], className].filter(Boolean).join(" ")}>
    {src ? (
      <img src={src} alt={alt} className={styles.image} />
    ) : (
      <div className={styles.empty}>{alt}</div>
    )}
    {tag ? <figcaption className={styles.tag}>{tag}</figcaption> : null}
  </figure>
)
