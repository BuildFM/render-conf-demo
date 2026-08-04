# The content layer that is not authored yet

Five blocks resolve to `null` and are dropped with a note rather than rendering
half-populated. All five need authored content that does not exist, and none of it
may be generated — the composer selects members and axes, the app supplies values,
and that is the entire safety property.

| Block | Needs | Shape |
|---|---|---|
| `ShoppingList` | Per-recipe ingredients with a store section | `{ name, qty, section }[]` on each recipe |
| `PantryMatch` | The same, to diff against `household.pantry` | as above |
| `SubstitutionTable` | What each gap can be replaced with | `{ wants, have, note }` per plausible gap |
| `PrepSchedule` | Task text per day, shared base marked | authored per household rhythm, or derived from `makeAhead` |
| `ForkedRecipeCard` | Both branches of each fork | `{ label, title, body }` ×2 for the four forked recipes |

## The one that matters most

**`ForkedRecipeCard` is Twin A's page.** The whole beat rests on a household that
does not avoid dairy but avoids dairy that cannot be separated — and the block that
shows separation happening is this one. Four recipes have fork points; each needs two
branches written. That is eight short paragraphs and it is the highest-value
authoring left.

## Ingredients unlock three of the five

Adding `ingredients: { name, qty, section }[]` to `recipes.json` gives
`ShoppingList`, `PantryMatch` and `SubstitutionTable` at once, and makes
`ingredientCount` derivable rather than asserted. Roughly seventy lines of content
across twelve recipes.

`state.pantryGaps` in `lib/compose/gates.ts` is hard-coded to `0` until this
exists, which is why `SubstitutionTable` is currently never eligible.

## What is done

`TechniqueThread`, `WhyThisWorks`, `SkillPrimer`, `TroubleshootingList`,
`TechniqueNote`, `RecipeCard`, `TonightShortlist`, `MakeAheadCallout`,
`FromYourHistory`, `LeftoversNote` and `ComparisonTable` all resolve from
`lib/content/editorial.json` and `recipes.json`. That is the learner's whole page.
