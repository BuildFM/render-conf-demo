import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

/**
 * The manifest is DATA, read from disk on every request — never a bundled import.
 *
 * Load-bearing for the demo's final beat: editing the manifest has to change what
 * the pages compose, with no rebuild. A TS constant or a bundled JSON import would
 * need a redeploy to demonstrate the argument the whole talk is making.
 */

const MANIFEST_PATH = path.join(process.cwd(), "lib/manifest/manifest.json");

/** A predicate the app evaluates against content, profile and state. Structured
 *  rather than a string DSL so it is both readable on a slide and executable. */
const predicate = z.object({
  fact: z.string(),
  op: z.enum([">=", ">", "==", "<=", "<"]),
  value: z.union([z.number(), z.string(), z.boolean()])
});

const componentSpec = z.object({
  name: z.string(),
  intent: z.string(),
  /** PERMISSION — a gate on a choice the model makes. */
  requires: z.array(predicate).default([]),
  adjacency: z.object({
    mustFollow: z.array(z.string()).optional(),
    neverWith: z.array(z.string()).optional(),
    maxPerPage: z.number()
  }),
  /** Can this block be what a page is ABOUT, or only support one? */
  role: z.enum(["lead", "support"]).default("support"),
  treatments: z.array(z.enum(["hero", "full", "collapsed", "oneline"])),
  slots: z.record(z.string(), z.string()).default({})
});

const obligationSpec = z.object({
  name: z.string(),
  intent: z.string(),
  /** OBLIGATION — not a choice. Evaluated in code, placed before the model runs. */
  requiredWhen: predicate,
  locked: z.object({
    treatment: z.literal("full"),
    placement: z.string(),
    exemptFromDensity: z.boolean()
  })
});

const manifestSchema = z.object({
  version: z.string(),
  invariants: z.array(z.string()),
  density: z.object({ maxBlocks: z.number(), maxFullImages: z.number(), maxDisplayXL: z.number().default(1) }),
  components: z.array(componentSpec),
  obligations: z.array(obligationSpec),
  /** ASSEMBLY — placed as one block, never reordered internally. */
  assemblies: z.array(z.object({ name: z.string(), members: z.array(z.string()) }))
});

export type Predicate = z.infer<typeof predicate>;
export type ComponentSpec = z.infer<typeof componentSpec>;
export type ObligationSpec = z.infer<typeof obligationSpec>;
export type Manifest = z.infer<typeof manifestSchema> & { hash: string };

export const loadManifest = async (): Promise<Manifest> => {
  const raw = await readFile(MANIFEST_PATH, "utf8");
  const hash = createHash("sha256").update(raw).digest("hex").slice(0, 7);
  const parsed = manifestSchema.parse(JSON.parse(raw));
  return { ...parsed, hash };
};

/**
 * The drift check. A component now has two artifacts — the code and its manifest
 * entry — and they can disagree in both directions. A name in the manifest with no
 * component is a composition that crashes; a component with no manifest entry is
 * invisible to the model. Both are silent without this.
 */
export const checkDrift = (manifest: Manifest, registryNames: string[]) => {
  const declared = new Set([
    ...manifest.components.map((c) => c.name),
    ...manifest.obligations.map((o) => o.name)
  ]);
  const built = new Set(registryNames);

  const missingComponent = [...declared].filter((n) => !built.has(n));
  const missingEntry = [...built].filter((n) => !declared.has(n));

  return { missingComponent, missingEntry, ok: !missingComponent.length && !missingEntry.length };
};
