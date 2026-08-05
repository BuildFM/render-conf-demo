/* The only place these shapes are declared. Import from here — a component that
   restates `Recipe` is the single most likely source of drift in this codebase. */

export type Treatment = "hero" | "full" | "collapsed" | "oneline"

export type Recipe = {
  /** Zero-padded numeral, as in the catalogue: "041". Used as the figure tab
   *  and the index number, so it is a display value as well as a key. */
  id: string
  title: string
  technique: string[]
  allergens: string[]
  yield: number
  activeTime: number      // minutes
  totalTime: number       // minutes
  /** How long the shopping list is. Not shown by any block — it exists because
   *  one household abandons on list length, and the profile pass has to be able
   *  to find that. Content facts the model reasons over need not be rendered. */
  ingredientCount: number
  image?: { src: string; alt: string }
  /** One or two sentences. RecipeCard "full" sets it at body scale. Added to the
   *  handoff type — see README §Deviations. */
  summary?: string
  /** The numbered method, as the guided cook mode shows it — one step on screen at
   *  a time. Not rendered by any block; it exists because the site's product IS the
   *  guided walk-through, which is what makes `abandoned atStep 3` an ordinary thing
   *  to know rather than surveillance. Before this existed the profile pass was told
   *  someone quit at step three with no way to learn what step three was, and it
   *  filled the gap in — "in the middle of the sear itself" was invented. */
  steps?: string[]
  /** Names a step number — "At the flip, step 3 of 5" — so it must agree with
   *  `steps.length`. Asserted when the steps were authored. */
  forkPoint?: string
  makeAhead?: string
  season?: string
}

export type ThreadEntry = {
  recipe: Recipe
  /** Pre-formatted for display: "12 Jul". Blocks never format dates. */
  date: string
  changed: string
}

export type ComparisonRow = {
  recipe: Recipe
  /** One per axis, same order as `axes`. Pre-resolved strings, never numbers. */
  values: string[]
  /** Indices of the values that carry the answer for this household — set in
   *  acid. Emphasis is data, not a rendering guess. See README §Deviations. */
  emphasis?: number[]
}

export type Task = {
  text: string
  recipeTitle?: string
  /** True marks the shared base — the reason PrepSchedule exists. */
  sharedBase?: boolean
}

export type Item = { name: string; qty: string }

export type TroubleshootingItem = { symptom: string; cause: string; fix: string }

export type SubstitutionRow = { wants: string; have: string; note: string }

export type PantryCandidate = {
  recipe: Recipe
  /** The names, not a count. The count is `missing.length` — see README §Deviations. */
  missing: string[]
}
