import type { Manifest } from "@/lib/manifest/load";
import type { LayoutSpec } from "./compose";
import type { FiredObligation } from "./gates";

/**
 * The semantic pass. Schema validity is free from generateObject; this is
 * everything a well-formed spec can still get wrong.
 *
 * A failure here is not a worse layout, it is an invalid one. Nothing half-valid
 * reaches a person — the caller repairs once, then falls back to the default page.
 */
export const validate = (
  spec: LayoutSpec,
  manifest: Manifest,
  fired: FiredObligation[],
  knownRecipeIds: Set<string>
): string[] => {
  const errors: string[] = [];
  const specs = new Map(manifest.components.map((c) => [c.name, c]));
  const counts = new Map<string, number>();
  const present = new Set(spec.blocks.map((b) => b.component));

  spec.blocks.forEach((b, i) => {
    const c = specs.get(b.component);
    if (!c) {
      errors.push(`Block ${i}: "${b.component}" is not in the manifest.`);
      return;
    }
    if (!c.treatments.includes(b.treatment)) {
      errors.push(`Block ${i}: ${b.component} does not support treatment "${b.treatment}" (has ${c.treatments.join("/")}).`);
    }
    for (const id of b.recipeIds) {
      if (!knownRecipeIds.has(id)) errors.push(`Block ${i}: recipe "${id}" does not exist.`);
    }
    counts.set(b.component, (counts.get(b.component) ?? 0) + 1);

    for (const n of c.adjacency.neverWith ?? []) {
      if (present.has(n)) errors.push(`${b.component} may never appear with ${n}.`);
    }
    if (c.adjacency.mustFollow?.length) {
      const prev = spec.blocks[i - 1]?.component;
      if (!prev || !c.adjacency.mustFollow.includes(prev)) {
        errors.push(`${b.component} must directly follow ${c.adjacency.mustFollow.join(" or ")}.`);
      }
    }
  });

  for (const [name, n] of counts) {
    const max = specs.get(name)?.adjacency.maxPerPage ?? Infinity;
    if (n > max) errors.push(`${name} appears ${n} times; max is ${max}.`);
  }

  // Density.
  if (spec.blocks.length > manifest.density.maxBlocks) {
    errors.push(`${spec.blocks.length} blocks; max is ${manifest.density.maxBlocks}.`);
  }
  const fulls = spec.blocks.filter((b) => b.treatment === "full").length;
  if (fulls > manifest.density.maxFullImages) {
    errors.push(`${fulls} blocks at "full"; max is ${manifest.density.maxFullImages}.`);
  }

  // OBLIGATIONS — the model must not place one. They are instantiated by the app
  // after composition, against the recipes the composition actually included, so a
  // notice in the spec means the model tried to take a decision it does not have.
  // Hard failure, same class as a hallucinated component name.
  const obligationNames = new Set(manifest.obligations.map((o) => o.name));
  for (const b of spec.blocks) {
    if (obligationNames.has(b.component)) {
      errors.push(`${b.component} is an obligation and is placed by the application. The model may not include it.`);
    }
  }
  void fired;

  // ASSEMBLIES — placed as one block, never reordered internally.
  for (const a of manifest.assemblies) {
    const idx = a.members.map((m) => spec.blocks.findIndex((b) => b.component === m));
    if (idx.every((i) => i === -1)) continue;
    if (idx.some((i) => i === -1)) {
      errors.push(`Assembly ${a.name} is split: include ${a.members.join(" and ")} together, or neither.`);
      continue;
    }
    const contiguousInOrder = idx.every((v, k) => k === 0 || v === idx[k - 1] + 1);
    if (!contiguousInOrder) errors.push(`Assembly ${a.name} must be adjacent and in order: ${a.members.join(" then ")}.`);
  }

  // The design rule: a page that is only components-in-a-different-order is a
  // layout, and layouts are what rules engines do.
  if (spec.blocks.length === 0) errors.push("Empty composition.");

  return errors;
};
