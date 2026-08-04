"use client"

import { useState } from "react"
import styles from "./scaling-control.module.css"

type ScalingControlProps = {
  defaultYield: number
  /** The recorded household size. Shown as the reason for the default. */
  householdSize: number
  min?: number
  max?: number
}

/** The only client component in the set. A control, not a block — it takes no
 *  treatment and the model never places it. */
export const ScalingControl = ({
  defaultYield,
  householdSize,
  min = 1,
  max = 12
}: ScalingControlProps) => {
  const [servings, setServings] = useState(defaultYield)
  const factor = (servings / defaultYield).toFixed(2).replace(/\.00$/, "")

  return (
    <div className={styles.control}>
      <div className={styles.labels}>
        <span className={styles.label}>Scale to</span>
        <span className={styles.note}>
          {servings === householdSize
            ? `Your household · ${householdSize}`
            : `Recipe as written · ${defaultYield}`}
        </span>
      </div>

      <div className={styles.stepper}>
        <button
          type="button"
          className={styles.step}
          onClick={() => setServings((n) => Math.max(min, n - 1))}
          disabled={servings <= min}
          aria-label="One fewer serving"
        >
          −
        </button>
        <output className={styles.value}>{servings}</output>
        <button
          type="button"
          className={styles.step}
          onClick={() => setServings((n) => Math.min(max, n + 1))}
          disabled={servings >= max}
          aria-label="One more serving"
        >
          +
        </button>
      </div>

      <div className={styles.factor}>×{factor} on every quantity</div>
    </div>
  )
}
