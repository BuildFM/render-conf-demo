import { Eyebrow } from "@/components/core/eyebrow"
import styles from "./block-stamp.module.css"

type BlockStampProps = {
  /** The component's `label` from the manifest. Never written here. */
  label: string
  /** The lead is the one thing the page is about, and its stamp is the one acid
   *  stamp on the page — so the naming also carries the hierarchy instead of
   *  repeating itself sixteen times in the same colour. */
  lead?: boolean
}

/**
 * WHAT THIS BLOCK IS, said out loud.
 *
 * An invariant position, like the masthead: top-left of every block, before its own
 * headline, always the same size and tracking. It is the only chrome in the system
 * that names the system, and it comes from the manifest — the page never invents a
 * word for a block, the same rule the model already lives under.
 *
 * Renders nothing for an unlabelled component rather than falling back to the class
 * name. "COMPARISONTABLE" over a table is a developer's word on a reader's page,
 * and a blank is a question someone will ask; the drift check answers it in the rail.
 */
export const BlockStamp = ({ label, lead = false }: BlockStampProps) =>
  label ? (
    <Eyebrow tone={lead ? "signal" : "dim"} track="md" className={styles.stamp}>
      {label}
    </Eyebrow>
  ) : null
