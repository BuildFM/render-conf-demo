import styles from "./telemetry-rail.module.css";

type TelemetryRailProps = {
  items: [string, string][];
  warnings?: string[];
};

/**
 * Not decoration. The demo is shown as recorded video, and honest artifacts —
 * a real manifest hash, real latency — are what make a recording read as a system
 * rather than a mockup. It also says "this is fast and cheap" without a slide.
 *
 * Allowed to look like an instrument, because it is one.
 */
export const TelemetryRail = ({ items, warnings = [] }: TelemetryRailProps) => (
  <aside className={styles.rail} aria-label="Composition telemetry" data-telemetry>
    <dl className={styles.row}>
      {items.map(([k, v]) => (
        /* data-* so the stage view can read these straight off the same-origin
           iframe rather than running the pipeline a second time to learn what it
           already rendered. Keeps the composed pages free of client JS. */
        <div key={k} className={styles.pair} data-k={k} data-v={v}>
          <dt className={styles.key}>{k}</dt>
          <dd className={styles.value}>{v}</dd>
        </div>
      ))}
    </dl>
    {warnings.length > 0 && (
      <ul className={styles.warnings}>
        {warnings.map((w, i) => (
          <li key={i} className={styles.warning}>{w}</li>
        ))}
      </ul>
    )}
  </aside>
);
