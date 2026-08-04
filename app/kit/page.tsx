import type { ReactNode } from "react"
import { AllergenNotice } from "@/components/obligations/allergen-notice"
import { ComparisonTable } from "@/components/blocks/comparison-table"
import { ForkedRecipeCard } from "@/components/blocks/forked-recipe-card"
import { FromYourHistory } from "@/components/blocks/from-your-history"
import { LeftoversNote } from "@/components/blocks/leftovers-note"
import { MakeAheadCallout } from "@/components/blocks/make-ahead-callout"
import { PantryMatch } from "@/components/blocks/pantry-match"
import { PrepSchedule } from "@/components/blocks/prep-schedule"
import { RecipeCard } from "@/components/blocks/recipe-card"
import { ScalingControl } from "@/components/blocks/scaling-control"
import { SeasonalNote } from "@/components/blocks/seasonal-note"
import { ShoppingList } from "@/components/blocks/shopping-list"
import { SiteChrome } from "@/components/blocks/site-chrome"
import { SkillPrimer } from "@/components/blocks/skill-primer"
import { StoryIntro } from "@/components/blocks/story-intro"
import { SubstitutionTable } from "@/components/blocks/substitution-table"
import { TechniqueNote } from "@/components/blocks/technique-note"
import { TechniqueThread } from "@/components/blocks/technique-thread"
import { TonightShortlist } from "@/components/blocks/tonight-shortlist"
import { TroubleshootingList } from "@/components/blocks/troubleshooting-list"
import { WhyThisWorks } from "@/components/blocks/why-this-works"
import { SiteFooter } from "@/components/layout/site-footer"
import { beans, brick, cabbage, cacio, focaccia } from "@/lib/sample-data"
import styles from "./page.module.css"

/* A contact sheet. Every block at every treatment it supports, with sample data,
   under a labelled heading. It is the check that the code and the catalogue have
   not drifted, and that nothing crashes on absent optional fields. */

const Specimen = ({
  name,
  treatment,
  note,
  children
}: {
  name: string
  treatment: string
  note?: string
  children: ReactNode
}) => (
  <section className={styles.specimen}>
    <div className={styles.label}>
      <span className={styles.name}>{name}</span>
      <span className={styles.treatment}>{treatment}</span>
      {note ? <span className={styles.note}>{note}</span> : null}
    </div>
    <div className={styles.stage}>{children}</div>
  </section>
)

const thread = [
  { recipe: brick, date: "12 Jul", changed: "Dry-brined 24 hr instead of 4. Skin finally shattered." },
  { recipe: beans, date: "28 Jun", changed: "Cast iron on top, no foil. Weight went up to 4 kg." },
  { recipe: cabbage, date: "31 May", changed: "First time off protein. Same principle, quarter the time." }
]

const comparison = {
  axes: ["Oven time", "Can be made ahead", "Dairy", "Cost / head"],
  rows: [
    { recipe: brick, values: ["45 min", "Brine only", "None", "£3.10"], emphasis: [1] },
    { recipe: beans, values: ["3 hr", "Entirely", "None", "£1.40"], emphasis: [1] },
    { recipe: focaccia, values: ["22 min", "Dough, 24 hr", "None", "£0.60"], emphasis: [1] },
    { recipe: cacio, values: ["None", "No", "Pecorino", "£2.20"], emphasis: [2] }
  ]
}

const days = [
  {
    day: "Sunday",
    tasks: [
      { text: "Cook 1 kg white beans, keep the liquid", recipeTitle: "Used in 3 dinners", sharedBase: true },
      { text: "Dry-brine the chicken, uncovered, top shelf", recipeTitle: "Chicken under a brick" },
      { text: "Mix the focaccia dough, into the fridge", recipeTitle: "Focaccia, cold proof" }
    ]
  },
  {
    day: "Monday",
    tasks: [{ text: "Beans, olive oil, lemon. Twelve minutes.", recipeTitle: "From the base" }]
  },
  {
    day: "Tuesday",
    tasks: [
      { text: "Chicken under a brick. Bake the focaccia alongside.", recipeTitle: "Two recipes" }
    ]
  }
]

const sections = [
  {
    name: "Produce",
    items: [
      { name: "Lemons", qty: "4" },
      { name: "Flat parsley", qty: "2 bunch" },
      { name: "Garlic", qty: "2 head" },
      { name: "Savoy cabbage", qty: "1" }
    ]
  },
  {
    name: "Butcher",
    items: [
      { name: "Chicken, spatchcocked", qty: "1.6 kg" },
      { name: "Pancetta, in a piece", qty: "120 g" }
    ]
  },
  {
    name: "Dry goods",
    items: [
      { name: "Cannellini, dried", qty: "1 kg" },
      { name: "Strong flour", qty: "500 g" },
      { name: "Olive oil, for finishing", qty: "500 ml" }
    ]
  }
]

const troubles = [
  {
    symptom: "Skin is pale and rubbery",
    cause: "Moisture left on the bird, or the pan never got back to temperature.",
    fix: "Lift it out, dry the pan, and go again for four minutes with the weight on."
  },
  {
    symptom: "Breast dry, thigh underdone",
    cause: "The bird was not flattened enough, so it is not cooking in one plane.",
    fix: "Press harder at the joint before it goes in. Backbone out, breastbone cracked."
  },
  {
    symptom: "Pan smoking within a minute",
    cause: "Too much oil, or the oil went in before the pan was up to heat.",
    fix: "A film, not a pool. The bird brings its own fat within two minutes."
  }
]

const matches = [
  { recipe: beans, missing: [] },
  { recipe: focaccia, missing: [] },
  { recipe: cabbage, missing: ["Savoy cabbage"] },
  { recipe: brick, missing: ["Pancetta", "Savoy cabbage"] }
]

const substitutions = [
  {
    wants: "Pecorino Romano",
    have: "Parmesan",
    note: "Less sharp and less salty. Add a third more, and hold back the salt in the water."
  },
  {
    wants: "Double cream",
    have: "Crème fraîche",
    note: "Splits less at heat, and the sourness is welcome against the beans."
  },
  {
    wants: "Pancetta",
    have: "Smoked bacon",
    note: "The smoke arrives whether you want it or not. Render it further to compensate."
  }
]

const steps = [
  "Dry the surface. Wet food steams before it browns.",
  "Give each piece a hand's width of pan.",
  "Press once, then leave it alone for four minutes.",
  "Move it only when it releases on its own."
]

export default function KitPage() {
  return (
    <>
      <SiteChrome stamp="Week 30 · Tue" />

      <main className={styles.sheet}>
        <header className={styles.head}>
          <h1 className={styles.title}>Block kit</h1>
          <p className={styles.lede}>
            Every block at every treatment it supports. The last specimen of each set uses a
            deliberately sparse recipe — no image, no summary, no make-ahead — so degradation is
            visible rather than theoretical.
          </p>
        </header>

        <Specimen name="SiteChrome" treatment="invariant · no treatment prop" note="above">
          <p className={styles.aside}>Rendered at the top of this page.</p>
        </Specimen>

        <Specimen name="AllergenNotice" treatment="no treatment prop" note="placed by the app">
          <AllergenNotice
            allergen="Dairy"
            recipeTitle={cacio.title}
            detail="Pecorino Romano is the sauce; there is no version of this dish without it. The substitution table is not a workaround for the allergy — it is for the second cook at the same table."
          />
        </Specimen>

        <Specimen name="TechniqueThread" treatment="full">
          <TechniqueThread
            title={
              <>
                Six weeks
                <br />
                of one pan
              </>
            }
            entries={thread}
            untried="Starting the pan cold"
            treatment="full"
          />
        </Specimen>

        <Specimen name="TechniqueThread" treatment="collapsed">
          <TechniqueThread
            title="Six weeks of one pan"
            entries={thread}
            untried="starting the pan cold"
            treatment="collapsed"
          />
        </Specimen>

        <Specimen name="ComparisonTable" treatment="full">
          <ComparisonTable
            title="Four ways to feed six people"
            axes={comparison.axes}
            rows={comparison.rows}
            treatment="full"
          />
        </Specimen>

        <Specimen name="ComparisonTable" treatment="collapsed" note="two axes maximum">
          <ComparisonTable
            title="Four ways to feed six people"
            axes={["Can be made ahead", "Dairy"]}
            rows={comparison.rows.map((row) => ({
              ...row,
              values: [row.values[1], row.values[2]],
              emphasis: row.emphasis?.map((i) => i - 1).filter((i) => i >= 0)
            }))}
            treatment="collapsed"
          />
        </Specimen>

        <Specimen name="RecipeCard" treatment="full">
          <RecipeCard recipe={brick} treatment="full" />
        </Specimen>

        <Specimen name="RecipeCard" treatment="full" note="sparse recipe · no image, no summary">
          <RecipeCard recipe={cabbage} treatment="full" />
        </Specimen>

        <Specimen name="RecipeCard" treatment="collapsed">
          <RecipeCard recipe={brick} treatment="collapsed" />
        </Specimen>

        <Specimen name="RecipeCard" treatment="oneline">
          <RecipeCard recipe={brick} treatment="oneline" />
        </Specimen>

        <Specimen name="ForkedRecipeCard" treatment="full">
          <ForkedRecipeCard
            recipe={beans}
            forkPoint={beans.forkPoint ?? "Step 6 of 9"}
            branches={[
              {
                label: "No dairy",
                title: "Finish with olive oil and lemon",
                body: "Lift two thirds into a second pan. Reduce hard for four minutes, then a long pour of oil off the heat — the starch does the emulsifying."
              },
              {
                label: "With dairy",
                title: "Finish with butter and parmesan rind",
                body: "The rind goes in at step four if you know in advance. Otherwise: butter, off the heat, one cube at a time, and do not let it boil after."
              }
            ]}
            treatment="full"
          />
        </Specimen>

        <Specimen name="ForkedRecipeCard" treatment="collapsed">
          <ForkedRecipeCard
            recipe={beans}
            forkPoint="Step 6 of 9"
            branches={[
              { label: "No dairy", title: "Olive oil and lemon", body: "" },
              { label: "With dairy", title: "Butter and parmesan rind", body: "" }
            ]}
            treatment="collapsed"
          />
        </Specimen>

        <Specimen name="WhyThisWorks" treatment="full">
          <WhyThisWorks
            principle="Contact is the whole job"
            body="Browning is a surface event. Every dish below solves the same problem — how to keep food pressed against hot metal long enough for the surface to change — and each solves it with a different tool."
            recipes={[brick, cabbage, focaccia]}
            evidence={["Weight", "Cut face", "Surface area"]}
            treatment="full"
          />
        </Specimen>

        <Specimen name="WhyThisWorks" treatment="collapsed">
          <WhyThisWorks
            principle="Contact is the whole job"
            body=""
            recipes={[brick, cabbage, focaccia]}
            treatment="collapsed"
          />
        </Specimen>

        <Specimen name="SkillPrimer" treatment="full">
          <div className={styles.third}>
            <SkillPrimer
              numeral="02"
              technique="Heat"
              title="Contact is the whole job"
              body="Browning is a surface event. Anything that lifts the food off the pan — moisture, crowding, fidgeting — costs you colour."
              steps={steps}
              readingTime="Read · 6 min"
              treatment="full"
            />
          </div>
        </Specimen>

        <Specimen name="SkillPrimer" treatment="collapsed">
          <div className={styles.third}>
            <SkillPrimer
              numeral="03"
              technique="Salt"
              title="Weigh it, don't guess it"
              body="One per cent of whatever you are cooking."
              steps={["Weigh the food.", "Take one per cent.", "Salt in stages.", "Taste at the end."]}
              readingTime="4 min"
              treatment="collapsed"
            />
          </div>
        </Specimen>

        <Specimen name="TroubleshootingList" treatment="full">
          <TroubleshootingList items={troubles} treatment="full" />
        </Specimen>

        <Specimen name="TroubleshootingList" treatment="collapsed" note="cause column dropped">
          <TroubleshootingList items={troubles} treatment="collapsed" />
        </Specimen>

        <Specimen name="PrepSchedule" treatment="full">
          <PrepSchedule
            title={
              <>
                Sunday makes
                <br />
                four dinners
              </>
            }
            days={days}
            treatment="full"
          />
        </Specimen>

        <Specimen name="PrepSchedule" treatment="collapsed">
          <PrepSchedule title="Sunday makes four dinners" days={days} treatment="collapsed" />
        </Specimen>

        <Specimen name="ShoppingList" treatment="full">
          <ShoppingList sections={sections} treatment="full" />
        </Specimen>

        <Specimen name="ShoppingList" treatment="collapsed">
          <ShoppingList sections={sections} treatment="collapsed" />
        </Specimen>

        <Specimen name="PantryMatch" treatment="full">
          <PantryMatch
            have={[
              "Cannellini",
              "Olive oil",
              "Garlic",
              "Rosemary",
              "Anchovy",
              "Lemon",
              "Strong flour",
              "Parmesan rind",
              "Chilli flakes"
            ]}
            missing={["Pancetta", "Savoy cabbage", "Double cream"]}
            matches={matches}
            treatment="full"
          />
        </Specimen>

        <Specimen name="PantryMatch" treatment="collapsed">
          <PantryMatch
            have={["Cannellini", "Olive oil", "Garlic"]}
            missing={["Pancetta", "Savoy cabbage"]}
            matches={matches}
            treatment="collapsed"
          />
        </Specimen>

        <Specimen name="TonightShortlist" treatment="full">
          <TonightShortlist recipes={[brick, beans, cabbage]} title="Three for tonight" treatment="full" />
        </Specimen>

        <Specimen name="TonightShortlist" treatment="collapsed">
          <TonightShortlist recipes={[brick, beans, cabbage]} treatment="collapsed" />
        </Specimen>

        <Specimen name="MakeAheadCallout" treatment="full">
          <MakeAheadCallout
            step={focaccia.makeAhead ?? "Dough, 24 hr ahead"}
            recipeTitle={focaccia.title}
            treatment="full"
          />
        </Specimen>

        <Specimen name="MakeAheadCallout" treatment="oneline">
          <MakeAheadCallout step="Dough, 24 hr ahead" recipeTitle={focaccia.title} treatment="oneline" />
        </Specimen>

        <Specimen name="LeftoversNote" treatment="oneline only">
          <LeftoversNote
            recipeTitle={brick.title}
            text="Thursday's brothy beans, once the carcass has been in the pot an hour"
          />
        </Specimen>

        <Specimen name="FromYourHistory" treatment="oneline only">
          <FromYourHistory recipe={brick} text="you have cooked this four times since May" />
        </Specimen>

        <Specimen name="SeasonalNote" treatment="oneline only">
          <SeasonalNote text="Savoy cabbage is at its best for three more weeks." />
        </Specimen>

        <Specimen name="StoryIntro" treatment="full">
          <StoryIntro body="I bought the brick for two pounds at a reclamation yard, wrapped it in three layers of foil, and it has sat on the back of the hob ever since. Everything below is what it taught me, in the order it taught me." treatment="full" />
        </Specimen>

        <Specimen name="StoryIntro" treatment="collapsed">
          <StoryIntro body="I bought the brick for two pounds at a reclamation yard, wrapped it in three layers of foil, and it has sat on the back of the hob ever since. Everything below is what it taught me, in the order it taught me." treatment="collapsed" />
        </Specimen>

        <Specimen name="TechniqueNote" treatment="full">
          <TechniqueNote
            technique="Weighted sear"
            body="Weight does what patience cannot: it holds the whole surface against the metal at once. Anything heavy and flat will do, as long as it is heavier than you think."
            treatment="full"
          />
        </Specimen>

        <Specimen name="TechniqueNote" treatment="oneline">
          <TechniqueNote
            technique="Weighted sear"
            body="Weight holds the whole surface against the metal at once."
            treatment="oneline"
          />
        </Specimen>

        <Specimen name="SubstitutionTable" treatment="full">
          <SubstitutionTable rows={substitutions} treatment="full" />
        </Specimen>

        <Specimen name="SubstitutionTable" treatment="collapsed">
          <SubstitutionTable rows={substitutions} treatment="collapsed" />
        </Specimen>

        <Specimen name="ScalingControl" treatment="control · client component">
          <ScalingControl defaultYield={6} householdSize={4} />
        </Specimen>
      </main>

      <SiteFooter items={["Mise", "Block kit", "Everything in its place", "© 2026"]} />
    </>
  )
}
