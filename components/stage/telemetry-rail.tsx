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
  <aside className={styles.rail} aria-label="Composition telemetry">
    <dl className={styles.row}>
      {items.map(([k, v]) => (
        <div key={k} className={styles.pair}>
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
