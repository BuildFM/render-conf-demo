# Mise — React handoff

Direction for Claude Design. Produce the components from the
`Mise Design System` catalogue as TypeScript React, ready to drop into the demo app.

The catalogue itself needs no revision — the visual and editorial decisions in it
are settled and several are better than the brief that produced them. This document
is about **form**, not design: how the code should be shaped so it integrates
without a translation pass.

---

## Target environment

Next.js 16 App Router · React 19 · TypeScript strict · pnpm.
Repo: `render-conf-demo`. Components land in `components/`.

---

## 1. TypeScript, not JSX

The earlier kit shipped `.jsx` with sidecar `.d.ts`. This one should be `.tsx`
directly. Props typed inline with `type`, destructured in the signature, no
`React.FC`, no `interface` unless something is genuinely being extended.

```tsx
type RecipeCardProps = {
  recipe: Recipe
  treatment: Treatment
}

export const RecipeCard = ({ recipe, treatment }: RecipeCardProps) => { … }
```

---

## 2. One shared types file — do not redefine `Recipe`

```
lib/types.ts
```

`Recipe`, `Treatment`, and the small row/item shapes (`Task`, `Item`,
`ThreadEntry`, `TroubleshootingItem`, `SubstitutionRow`, `ComparisonRow`,
`PantryCandidate`) all live there and are imported. Twenty-one components each
declaring their own `Recipe` is the single most likely source of drift.

```ts
export type Recipe = {
  id: string
  title: string
  technique: string[]
  allergens: string[]
  yield: number
  activeTime: number      // minutes
  totalTime: number       // minutes
  image: { src: string; alt: string }
  forkPoint?: string
  makeAhead?: string
  season?: string
}

export type Treatment = "full" | "collapsed" | "oneline"
```

**Optional fields are genuinely optional.** `forkPoint`, `makeAhead`, `season` and
sometimes `image` will be absent, and a block must degrade rather than throw. The
model composes from real data and will occasionally pick something incomplete.

---

## 3. Styling: CSS Modules over tokens. No Tailwind utilities, no inline styles.

The repo has Tailwind v4 installed for page scaffolding. **Do not use it inside
these components.** This design needs `font-variation-settings`, exact tracking, and
sub-pixel type sizes; expressing that in utility classes fights the design and loses.

- One `*.module.css` co-located with each component.
- **Every value is a token reference — `var(--acid)`, `var(--space-7)`,
  `var(--display-s-size)`. No hard-coded hex, anywhere, for any reason.** If a token
  is missing for something the catalogue specifies, add it to the token file rather
  than inlining the value.
- Tokens come from a single `app/tokens.css` ported from the kit's
  `reference/styles.css`, imported once in the root layout.

The reason is not tidiness. The talk's argument is that the design system is a
machine-readable artifact; a demo whose components each hard-code `#D8FF47`
quietly contradicts it, and someone will open the source.

---

## 4. Port the 13 primitives too

The blocks are built from the first kit's primitives — `DisplayHeading`, `Eyebrow`,
`SectionHead`, `Button`, `TextLink`, `StatRow`, `FigureWell`, `IndexTable`,
`PrimerCard`, `SignalBand`, `Masthead`, `SiteFooter`, `EmailCapture`. Those are
currently `.jsx` with inline styles.

Port them to the same `.tsx` + CSS-Module + token convention, into
`components/core/`, `components/layout/`, `components/content/`. Blocks import from
there rather than restating the primitive's markup.

If a block needs a primitive to do something new — `SiteChrome` needs search in
`Masthead`, `SkillPrimer` needs steps under `PrimerCard` — **extend the primitive
with an optional prop**, do not fork it.

---

## 5. Treatments: build exactly these, and no others

The catalogue declares `"full" | "collapsed" | "oneline"` on nearly every block but
only designs one oneline. That gap has to close before the app runs, because the
manifest advertises available treatments **to the model** — if it is told `oneline`
exists and nothing was drawn, it will ask for one and the page renders something
nobody designed.

Resolving it by narrowing rather than by drawing nine more states. Build only what
is listed:

| Component | Treatments |
|---|---|
| `TechniqueThread` | full, collapsed |
| `ComparisonTable` | full, collapsed |
| `AllergenNotice` | **none** — takes no `treatment` prop |
| `RecipeCard` | full, collapsed, oneline |
| `ForkedRecipeCard` | full, collapsed |
| `WhyThisWorks` | full, collapsed |
| `SkillPrimer` | full, collapsed |
| `TroubleshootingList` | full, collapsed |
| `PrepSchedule` | full, collapsed |
| `ShoppingList` | full, collapsed |
| `PantryMatch` | full, collapsed |
| `SiteChrome` | **none** — invariant |
| `TonightShortlist` | full, collapsed |
| `MakeAheadCallout` | full, oneline |
| `LeftoversNote` | **oneline only** |
| `FromYourHistory` | oneline only |
| `SeasonalNote` | oneline only |
| `StoryIntro` | full, collapsed |
| `ScalingControl` | **none** — it is a control |
| `TechniqueNote` | full, oneline |
| `SubstitutionTable` | full, collapsed |

Type each block's prop to its own supported subset — `treatment: "full" |
"collapsed"` — rather than to the shared `Treatment` union. The compiler then
enforces what the manifest advertises.

---

## 6. A kit route, please

```
app/kit/page.tsx
```

Every block rendered at every treatment it supports, with sample data, under a
labelled heading. Nothing fancy — it is a contact sheet.

This is the highest-value thing in this handoff after the components themselves. It
lets the whole set be eyeballed in one scroll, catches drift between the catalogue
and the code, and doubles as the check that no component crashes on absent optional
fields. Include one deliberately sparse recipe — no `image`, no `makeAhead`, no
`forkPoint` — so degradation is visible rather than theoretical.

---

## 7. Details that will otherwise need fixing later

- **Self-host the fonts.** The kit `@import`s Archivo and IBM Plex Mono from Google.
  Download both, add local `@font-face` rules, commit the files. Archivo must be the
  variable cut — the `wdth` axis carries the identity and a static cut will not
  reproduce it. Conference wifi is not a dependency worth having.
- **Plain `<img>` inside `FigureWell`**, not `next/image`. Local files, fixed wells,
  a recorded demo — the optimisation buys nothing and the configuration costs time.
- **Focus states are required**, not optional: 2px `var(--acid)` outline at 2px
  offset on everything interactive. The catalogue omits them; the first kit's README
  asks for them.
- **No client components except `ScalingControl`.** No `useState` smuggled in for a
  hover effect — hover is CSS.
- **No icon library, no emoji.** Typographic glyphs only: `→`, `·`, `©`, `!`.
- **Semantic markup.** `ComparisonTable`, `IndexTable`, `TroubleshootingList` and
  `ShoppingList` should be real `<table>` elements even though the prototypes use
  CSS grid. They are tabular data and the demo is shown to designers.
- **Type floor holds in code:** mono body ≥ 15px, micro-labels ≥ 11.5px, and nothing
  load-bearing set in `paper-dim`. Three labels in the catalogue itself sit at
  10–11px — document furniture, but do not carry them into components.

---

## 8. Out of scope

- **Recipe detail.** Built in the catalogue, and it can stay there as a reference,
  but it is not being implemented. The demo is one surface — the home screen — and
  the recording never navigates away from it. `RecipeHero`, `IngredientList` and
  `StepList` remain stubs.
- Newsletter, footer, and any marketing section beyond what the default home page
  needs.
- Responsive behaviour below 1180px. Desktop only; it is a recorded demo.
- Animation of any kind. Colour and border transitions at 130ms, nothing else. No
  transforms, no scale, no lift.

---

## Deliverable

```
components/core/       display-heading.tsx  eyebrow.tsx  button.tsx  text-link.tsx
components/layout/     masthead.tsx  section-head.tsx  signal-band.tsx  site-footer.tsx
components/content/    figure-well.tsx  stat-row.tsx  index-table.tsx  primer-card.tsx
components/blocks/     technique-thread.tsx  comparison-table.tsx  … (all 21)
components/obligations/allergen-notice.tsx
lib/types.ts
app/tokens.css
app/kit/page.tsx
```

Each component: kebab-case filename, named export matching the catalogue name
exactly, co-located `.module.css`. A short `.prompt.md` beside each is welcome but
optional.

**Export names are load-bearing.** `TechniqueThread`, not `TechniqueThreadBlock`.
The name is the identifier the model uses to request the component, so a rename is
not a rename — it breaks composition.
