import { createHash } from "node:crypto";
import type { Manifest, ComponentSpec } from "@/lib/manifest/load";
import type { Recipe } from "@/lib/types";
import type { Household, Profile } from "@/lib/signals/types";
import type { FiredObligation } from "./gates";
import type { LayoutSpec } from "./compose";

/**
 * An in-memory Map, and deliberately not Next's data cache.
 *
 * Next's cache would fight `force-dynamic` on the composed route and add a concept
 * to explain on stage. A Map is legible, it invalidates everything the instant the
 * manifest changes, and there is no cache-clearing step to narrate — build spec
 * §3.5, which specified this and then went unbuilt for three days.
 *
 * The cost of not having it: every page load was a live model call, and the stage
 * view fires three per save AND three per reload. An afternoon of screenshots is
 * hundreds of compositions for maybe a dozen distinct inputs.
 *
 * What the key must contain is everything a composition could legitimately depend
 * on. Get that wrong in the cheap direction and the demo shows a stale page after a
 * manifest edit, which is the one thing this whole build exists to demonstrate.
 */

type Entry = { spec: LayoutSpec; ms: number; model: string };

const store = new Map<string, Entry>();

/** Bounded so a long session cannot grow without limit. Three households across a
 *  handful of manifest revisions never approaches this. */
const MAX = 200;

const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 12);

export const key = (args: {
  manifest: Manifest;
  eligible: ComponentSpec[];
  recipes: Recipe[];
  profile: Profile;
  household: Household;
  fired: FiredObligation[];
  model: string;
}): string =>
  digest([
    /* The manifest edit is the finale. Its hash leads the key so that saving the
       file invalidates every household at once. */
    args.manifest.hash,
    args.household.id,
    /* Profiles are frozen on disk, but a regenerated one must not be served an old
       layout — it is the single largest input to the decision. */
    digest(args.profile),
    digest(args.recipes),
    /* State-derived, and the reason there is no separate "state bucket": what the
       household is eligible for, and what fired, IS the state as far as this call
       is concerned. */
    args.eligible.map((c) => c.name),
    args.fired.map((f) => [f.name, f.props.recipeId]),
    /* Or a Sonnet composition gets served to an Ollama run and the bake-off
       measures nothing. */
    args.model
  ]);

export const get = (k: string): Entry | undefined => store.get(k);

export const set = (k: string, entry: Entry): void => {
  if (store.size >= MAX) store.delete(store.keys().next().value!);
  store.set(k, entry);
};

/** Escape hatch for a recording take that must show a real model call every time:
 *  MISE_NO_CACHE=1. The manifest edit invalidates anyway, so this is rarely wanted. */
export const enabled = () => process.env.MISE_NO_CACHE !== "1";

export const size = () => store.size;
