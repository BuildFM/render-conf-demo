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
  /** WHAT THIS BLOCK IS, in a reader's words — "Comparison", "Prep schedule".
   *
   *  The page says it out loud above every block. Before this, a block announced
   *  its CONTENT ("Four ways to feed six people") and never its kind, so a page of
   *  five blocks read as five headlines in one voice and several blocks — the
   *  tables, the notes — arrived with no name at all.
   *
   *  It lives here rather than in the components because the manifest IS the
   *  vocabulary: renaming a block on stage renames it on all three pages with no
   *  rebuild, which is the same argument the density edit makes and cheaper to see.
   *  Defaulted rather than required so a mistyped edit during the demo drops the
   *  label instead of throwing the page — `checkDrift` reports it in the rail. */
  label: z.string().default(""),
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
  /** …and if not always, then WHEN. A shopping list is what the page is about on the
   *  Tuesday before eight people come, and a supporting detail every other day. That
   *  is one component with a conditional permission, not two templates. */
  leadWhen: z.array(predicate).default([]),
  /** WIDTHS this block may occupy. The layout half of the vocabulary: treatments say
   *  how deep a block goes, spans say how wide. Without this the model can only
   *  change what is on a page and never what the page is shaped like — which makes
   *  every composition a stack, however different the content. */
  spans: z.array(z.enum(["full", "half"])).default(["full"]),
  /** Does this block put a photograph on the page at "hero" or "full"? The density
   *  budget is spent in photographs, and counting every large block as one was a
   *  proxy that over-counted: TechniqueThread at full is large and carries none. */
  carriesPhoto: z.boolean().default(false),
  treatments: z.array(z.enum(["hero", "full", "collapsed", "oneline"])),
  slots: z.record(z.string(), z.string()).default({})
});

const obligationSpec = z.object({
  name: z.string(),
  /** As above — what this is in a reader's words. An obligation names itself on the
   *  page already ("Allergy warning · dairy"), so this is for the catalogue and for
   *  anywhere else the vocabulary is listed rather than rendered. */
  label: z.string().default(""),
  intent: z.string(),
  /** OBLIGATION — not a choice. Evaluated in code, placed before the model runs. */
  requiredWhen: predicate,
  locked: z.object({
    treatment: z.literal("full"),
    placement: z.string(),
    exemptFromDensity: z.boolean()
  })
});

export const manifestSchema = z.object({
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
  /* Anything in the vocabulary the page cannot name. Silent otherwise — the block
     still renders, just anonymously, which is the state this existed to end. */
  const missingLabel = [...manifest.components, ...manifest.obligations]
    .filter((c) => !c.label)
    .map((c) => c.name);

  return {
    missingComponent,
    missingEntry,
    missingLabel,
    ok: !missingComponent.length && !missingEntry.length && !missingLabel.length
  };
};
