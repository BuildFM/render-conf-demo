import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * The manifest is DATA, read from disk on every request — never a bundled import.
 *
 * This is load-bearing for the demo's final beat: editing the manifest has to change
 * what the pages compose without a rebuild. A TS constant or a bundled JSON import
 * would need a redeploy to demonstrate the whole argument of the talk.
 */

const MANIFEST_PATH = path.join(process.cwd(), "lib/manifest/manifest.json");

export type Treatment = "full" | "collapsed" | "oneline";

export type ComponentSpec = {
  name: string;
  intent: string;
  /** PERMISSION — a gate on a choice the model makes. */
  requires: string[];
  adjacency: {
    mustFollow?: string[];
    neverWith?: string[];
    maxPerPage: number;
  };
  treatments: Treatment[];
};

export type ObligationSpec = {
  name: string;
  intent: string;
  /** OBLIGATION — not a choice. Evaluated in code, placed before the model is called. */
  requiredWhen: string;
  locked: {
    treatment: "full";
    placement: string;
    exemptFromDensity: boolean;
  };
};

/** ASSEMBLY — placed as one block, never reordered internally. */
export type Assembly = { name: string; members: string[] };

export type Manifest = {
  version: string;
  components: ComponentSpec[];
  obligations: ObligationSpec[];
  assemblies: Assembly[];
  /** Content hash of the file as read. Goes in the composition cache key. */
  hash: string;
};

export const loadManifest = async (): Promise<Manifest> => {
  const raw = await readFile(MANIFEST_PATH, "utf8");
  const hash = createHash("sha256").update(raw).digest("hex").slice(0, 7);
  const parsed = JSON.parse(raw) as Omit<Manifest, "hash">;

  return { ...parsed, hash };
};
