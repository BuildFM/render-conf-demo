import type { Treatment } from "./types"

/* What the model is allowed to ask for. Keep this in step with the treatment
   unions on the components: if a block's prop type says "full" | "collapsed",
   this file must not advertise "oneline". Nothing here is drawn that was not
   designed — that is the whole point of the file. */

export type BlockName = keyof typeof BLOCK_MANIFEST

export const BLOCK_MANIFEST = {
  // P0
  TechniqueThread: ["full", "collapsed"],
  ComparisonTable: ["full", "collapsed"],
  RecipeCard: ["hero", "full", "collapsed", "oneline"],
  ForkedRecipeCard: ["full", "collapsed"],
  WhyThisWorks: ["full", "collapsed"],
  SkillPrimer: ["full", "collapsed"],
  TroubleshootingList: ["full", "collapsed"],
  PrepSchedule: ["full", "collapsed"],
  ShoppingList: ["full", "collapsed"],
  PantryMatch: ["full", "collapsed"],
  // P1
  TonightShortlist: ["full", "collapsed"],
  MakeAheadCallout: ["full", "oneline"],
  LeftoversNote: ["oneline"],
  FromYourHistory: ["oneline"],
  SeasonalNote: ["oneline"],
  StoryIntro: ["full", "collapsed"],
  TechniqueNote: ["full", "oneline"],
  SubstitutionTable: ["full", "collapsed"]
} as const satisfies Record<string, readonly Treatment[]>

/* Never offered to the model:
     AllergenNotice — placed by the application, before the model is consulted
     SiteChrome     — invariant
     ScalingControl — a control, not a block */
