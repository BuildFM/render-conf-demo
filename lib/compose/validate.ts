import type { ComponentSpec, Manifest } from "@/lib/manifest/load";
import type { LayoutSpec } from "./compose";
import type { Facts, FiredObligation } from "./gates";
import { canLead, satisfiesMustFollow } from "./gates";

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
  knownRecipeIds: Set<string>,
  /* Which components this household actually qualified for. Needed for one rule
     only — see the lead check — and optional so the hand-authored default page,
     which has no household and therefore no eligibility, validates unchanged. */
  eligible?: ComponentSpec[],
  /** Needed to evaluate a conditional lead permission. Absent for the default page. */
  facts?: Facts
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
    /* Adjacency is against units, not members — see satisfiesMustFollow. The
       validator and the enforcer share the predicate deliberately: when they held
       separate copies of the rule they disagreed, and the enforcer spent four
       passes moving a block the validator kept rejecting. */
    if (c.adjacency.mustFollow?.length && !satisfiesMustFollow(spec.blocks, i, manifest)) {
      errors.push(`${b.component} must directly follow ${c.adjacency.mustFollow.join(" or ")}.`);
    }
  });

  for (const [name, n] of counts) {
    const max = specs.get(name)?.adjacency.maxPerPage ?? Infinity;
    if (n > max) errors.push(`${name} appears ${n} times; max is ${max}.`);
  }

  /* The band at the foot of the page is the page explaining itself, and it is the
     one sentence the model writes. The schema stopped requiring it — a required
     field the model drops throws the request instead of producing the field — so
     the requirement lives here, where a miss costs a repair rather than the page. */
  if (!spec.rationale?.trim()) {
    errors.push("No rationale. The page has to say, in one sentence, what it inferred about this household.");
  }

  // The dominant block has to actually be dominant, or naming it is theatre.
  if (spec.dominant && spec.blocks[0]?.component !== spec.dominant) {
    errors.push(
      `Page is about ${spec.dominant} but blocks[0] is ${spec.blocks[0]?.component ?? "nothing"}. The dominant block comes first.`
    );
  }

  /* A support block may open a page only at "hero" — the treatment that makes it the
     subject rather than an item — AND only when no lead was eligible.

     The hero exception exists so the hand-authored default page can lead with a
     dish: it has no household, so nothing qualifies as a lead and something has to
     go first. It was never meant to outrank an eligible lead, and it was doing
     exactly that. Twin B's only eligible lead was PrepSchedule, the prompt says "if
     only one lead is listed, that is the answer", and the model returned
     RecipeCard @ hero — which validated. The page then opened the way the DEFAULT
     page opens, the twins stopped contrasting, and "the filtering already decided"
     was undercut by the one case where the model overrode the filtering. */
  const first = spec.blocks[0];
  const firstSpec = specs.get(first?.component ?? "");
  /* `canLead`, not `role` — leading is a conditional permission now. A shopping list
     may open the page on the Tuesday before eight people come and not on any other
     day, and the check has to ask the same question the prompt asked. */
  const mayLead = (c: ComponentSpec) => (facts ? canLead(c, facts) : c.role === "lead");
  const leadWasAvailable = eligible ? eligible.some(mayLead) : false;
  if (firstSpec && !mayLead(firstSpec)) {
    if (leadWasAvailable) {
      errors.push(
        `${firstSpec.name} may not lead this page today: ` +
          `${eligible!.filter(mayLead).map((c) => c.name).join(", ")} qualified as a lead.`
      );
    } else if (first?.treatment !== "hero") {
      errors.push(`${firstSpec.name} is a support block and cannot lead a page unless at "hero".`);
    }
  }

  // Density.
  if (spec.blocks.length > manifest.density.maxBlocks) {
    errors.push(`${spec.blocks.length} blocks; max is ${manifest.density.maxBlocks}.`);
  }
  /* Counted from the manifest rather than from treatment alone. Before three
     components could carry an image, "large" was a usable proxy for "photographic";
     it is not one now, and it never was for TechniqueThread. */
  const withPhotos = spec.blocks.filter(
    (b) => specs.get(b.component)?.carriesPhoto && (b.treatment === "full" || b.treatment === "hero")
  ).length;
  if (withPhotos > manifest.density.maxFullImages) {
    errors.push(`${withPhotos} blocks carrying a photograph; max is ${manifest.density.maxFullImages}.`);
  }

  // One Display XL per page. RecipeCard at "hero" and TechniqueThread at "full"
  // both claim it, and two giant headlines on one page is not a composition, it is
  // two pages stacked.
  const xl = spec.blocks.filter(
    (b) =>
      (b.component === "RecipeCard" && b.treatment === "hero") ||
      (b.component === "TechniqueThread" && b.treatment === "full")
  );
  if (xl.length > manifest.density.maxDisplayXL) {
    errors.push(
      `${xl.map((b) => `${b.component}@${b.treatment}`).join(" and ")} both claim the page's Display XL; only ${manifest.density.maxDisplayXL} may.`
    );
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
