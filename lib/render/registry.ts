import { TechniqueThread } from "@/components/blocks/technique-thread";
import { ComparisonTable } from "@/components/blocks/comparison-table";
import { RecipeCard } from "@/components/blocks/recipe-card";
import { ForkedRecipeCard } from "@/components/blocks/forked-recipe-card";
import { WhyThisWorks } from "@/components/blocks/why-this-works";
import { SkillPrimer } from "@/components/blocks/skill-primer";
import { TroubleshootingList } from "@/components/blocks/troubleshooting-list";
import { PrepSchedule } from "@/components/blocks/prep-schedule";
import { ShoppingList } from "@/components/blocks/shopping-list";
import { PantryMatch } from "@/components/blocks/pantry-match";
import { TonightShortlist } from "@/components/blocks/tonight-shortlist";
import { MakeAheadCallout } from "@/components/blocks/make-ahead-callout";
import { SubstitutionTable } from "@/components/blocks/substitution-table";
import { StoryIntro } from "@/components/blocks/story-intro";
import { TechniqueNote } from "@/components/blocks/technique-note";
import { LeftoversNote } from "@/components/blocks/leftovers-note";
import { FromYourHistory } from "@/components/blocks/from-your-history";
import { SeasonalNote } from "@/components/blocks/seasonal-note";
import { AllergenNotice } from "@/components/obligations/allergen-notice";

/**
 * The only place a manifest name meets a component. Both directions are checked at
 * load — see checkDrift in lib/manifest/load.ts. A name here that is not in the
 * manifest is invisible to the model; a name in the manifest that is not here is a
 * composition that crashes.
 *
 * Not registered on purpose: SiteChrome (invariant, rendered by the layout, never
 * composed) and ScalingControl (a control, not a block).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const registry: Record<string, any> = {
  TechniqueThread,
  ComparisonTable,
  RecipeCard,
  ForkedRecipeCard,
  WhyThisWorks,
  SkillPrimer,
  TroubleshootingList,
  PrepSchedule,
  ShoppingList,
  PantryMatch,
  TonightShortlist,
  MakeAheadCallout,
  SubstitutionTable,
  StoryIntro,
  TechniqueNote,
  LeftoversNote,
  FromYourHistory,
  SeasonalNote,
  AllergenNotice
};

export const registryNames = Object.keys(registry);
