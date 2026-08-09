# Mise — where this is, 6 Aug 2026

**Read this first, from a cold start.** It assumes you know nothing about the
project. It is the state of play, not a spec — the specs live in the vault at
`~/Documents/_Obsidian/brain/meta/plans/`.

---

## What this is

A demo for a 22-minute talk at RenderATL 2026 ("Realtime UIs", UX track). The
argument: **a design system is what earns a model the right to compose an
interface at runtime.** Not a productivity tool — a precondition.

Mise is a fictional recipe site. It has one hand-authored home page and three
households with ninety days of cooking history each. At request time a model
picks which blocks appear on that household's page, in what order, at what depth,
and with which recipes — choosing only from a vocabulary a person defined in
advance, in `lib/manifest/manifest.json`.

The point being proved is not that the pages are good. It is that **the manifest
causes them.** Any single page can be reverse-engineered into an `IF` statement;
a change to the vocabulary propagating across three households without a template
being written cannot. That is why the demo ends on `/stage`, editing the manifest,
rather than on a page.

**It is a proof of concept built in a couple of days**, not a product. Do not
over-engineer it.

### The documents, and which is authoritative

| Document | Authority on |
|---|---|
| **This file** | the live state of the code |
| `~/Documents/_Obsidian/brain/domains/business/renderatl-2026-realtime-uis-talk.md` | the talk as a performance — beats, timings, lines |
| `…/meta/plans/2026-07-26-realtime-ui-demo.md` | the build spec — what the demo must prove and why |
| `…/meta/plans/2026-07-26-demo-design-brief.md` | the visual system and the manifest's contents |
| `…/meta/plans/2026-08-04-mise-implementation-plan.md` | stack and build order |
| `…/meta/plans/2026-08-06-occasion-beat.md` | the occasion beat — why it is a form and not a prompt |
| `…/outputs/renderatl-2026-talk-script.md` | the spoken script |
| `docs/component-direction.md`, `docs/react-handoff.md` | the component catalogue |

Where this file disagrees with a plan about *what the code does*, this file wins.
Where a plan disagrees with this file about *intent*, the plan wins.

**The vault has its own operating rules** (`~/Documents/_Obsidian/brain/CLAUDE.md`)
— notably: never write to `positions/` without approval, and never commit in a
repository other than the vault. Work here is left in the working tree for Brian
to review and commit.

---

## Run it

```bash
pnpm dev --port 3717      # /stage · / · /h/h-learner · /h/h-twin-a · /h/h-twin-b · /kit
```

| Command | What it does |
|---|---|
| `npx tsx --env-file=.env.local scripts/compose.mjs` | compose all three households in the terminal |
| `… scripts/compose.mjs h-twin-a` | one household |
| `… scripts/compose.mjs --dry` | eligibility only, no model calls |
| `… scripts/compose.mjs --today=2026-08-19 h-learner` | move the clock — the occasion beat's three moments |
| `… scripts/cost.mjs` | measured token cost of one call of each kind |
| `pnpm bake-off --gateway` | first-pass validity + latency, hosted |
| `pnpm bake-off --local granite4.1:8b qwen3.5:9b` | same, on local models |
| `node scripts/check-content.mjs` | content consistency |
| `pnpm stage:reset` / `stage:after` / `stage:status` | move the manifest between the two recording states |
| `npx tsc --noEmit` | typecheck |

**Work in the harness, not the browser.** Iterating through page renders is a slow
loop with no view of cause and effect, and a day was lost to it. `compose.mjs`
prints the vocabulary offered, what the model chose, whether it validates and what
resolved — three seconds per household. It found every bug worth finding.

`.env.local` holds the gateway key and is gitignored. The key arrives as
`VERCEL_AI_GATEWAY_API_KEY`; `lib/env.ts` normalises it to the name the SDK reads.

---

## Architecture in one pass

**The manifest (`lib/manifest/manifest.json`) is the artifact.** Data, not code,
read from disk on *every request* — never bundled, because the finale is editing
it and watching pages change with no rebuild. 15 components, 1 obligation, 2
assemblies. *16 components as of 6 Aug — `OccasionPlan` was added with the occasion beat.* Each component declares:

- `requires` — a **permission**: a gate the app evaluates against behaviour
- `role: lead | support` — may this block be what a page is *about*?
- `adjacency` — `mustFollow`, `neverWith`, `maxPerPage`
- `treatments` — `hero` / `full` / `collapsed` / `oneline`
- `carriesPhoto` — does it put an image on the page?

Obligations are different in kind: `requiredWhen` is not a choice the model makes.
The app evaluates it and places the block itself.

**Two model calls, deliberately different:**

| Call | Model | When | Why |
|---|---|---|---|
| Profile — *what kind of cook is this?* | Opus 5 | once per household, nightly (frozen to disk here) | the hardest judgment; latency irrelevant |
| Composition — *what should this page be?* | Sonnet 5 | per view, cached | small, structured, latency on screen |

**The pipeline** (`app/h/[household]/page.tsx`): load manifest → resolve state →
evaluate obligations → filter by precondition → compose → complete assemblies →
enforce adjacency → validate → repair once → fall back to the default page →
resolve slots → render. **Eight of the ten stages are code.** That ratio is the
argument.

**The model never emits a fact.** Every value in its output is an id, an enum or a
column heading; the app resolves ids to content. The one exception is `rationale`,
the single sentence of prose it is allowed. So it cannot say anything false about a
dish, because it is not the thing saying anything about a dish.

---

## What works

Four pages plus the stage view. Compositions land valid on the first call, no
repairs, no fallbacks, 3.5–6s each.

| Page | Lead block — stable | Support blocks — vary run to run |
|---|---|---|
| `/` default | RecipeCard @ hero | shortlist, index (hand-authored, never varies) |
| `/h/h-learner` | **TechniqueThread** | TechniqueNote, TroubleshootingList |
| `/h/h-twin-a` | **ForkedRecipeCard** + allergen notice | RecipeCard, ComparisonTable, sometimes a second fork |
| `/h/h-twin-b` | **PrepSchedule** | ShoppingList, ComparisonTable, RecipeCard |

**The lead is stable and the support blocks are not.** One eligible lead per
household is the design; which supports join it is the model's choice and moves
between runs. Do not treat a changed support list as a regression — check the lead,
and check the three facts below.

The three facts the demo actually rests on, worth re-checking after any composition
change: the learner page has **no recipe on it at all**; the twins declare
byte-identical profiles *and pantries* and share no lead block; and the allergen
notice fires on Twin A.

**Profiles are frozen** in `lib/signals/cache/` and committed. In the real system
this is a nightly batch job, so committing yesterday's run is honest — and it stops
the input moving under you mid-iteration.

### What Mise is — the product premise

Set 5 Aug, and it is load-bearing rather than flavour. **Mise is a recipe site whose
actual product is teaching people to cook.** It ships a guided cook mode — one
numbered step on screen at a time, while you cook — and technique material attached
to every dish that you can open or ignore.

That premise is what makes the event log ordinary instead of sinister. The site
knows which step was on screen when someone stopped **because putting one step on
screen is the product**. It knows which technique notes were opened because opening
them is the thing it is trying to get people to do. Nothing is inferred, bought, or
tracked across the web. Say this before the demo and every number afterwards reads
as a site watching its own feature being used; leave it out and the room hears
surveillance. The premise is in the profile prompt verbatim, so the inference is
made in the same frame the audience is given.

### The signals vocabulary

Seven event types, each carrying a `recipeId` and a timestamp. Ranked by **what
they cost the reader**, which is what predicts how much they are worth:

| Tier | Events | Costs them | Truth |
|---|---|---|---|
| Declared | `households.json` | 30 seconds, once | low, decays |
| Ambient | `opened`, `skipped` | nothing | ambiguous alone |
| In-task | `abandoned` + `atStep`, `expanded` + `component` | nothing, but the surface must exist | high |
| **Committal** | **`saved`** | a deliberate act | very high |
| Return | `returned`, repeat `completed` | a second occasion | highest available |

`atStep: 0` is a real state and means they quit on the ingredient list, before the
guided walk-through started — a reaction to the shopping, not the cooking. Twin B
does this 18 times out of 18.

**`saved` was added 5 Aug and is the only committal signal.** What it buys is not
"they liked it" but the CONTRADICTION: `user.savedNeverCooked` is intention on the
record, contradicted by behaviour. The learner saves 8 and has never started 7 of
them. A query reaches "your saved recipes"; it cannot reach "your saved recipes are
a wish list", and that gap is the whole argument for the inference call.

### Recipes have steps, because the model was inventing them

`recipes.json` carries `steps[]` for all twelve, and **`RecipeCard` at `full`
renders them** — a numbered method under a `METHOD` label, with the line "5 steps ·
guided mode takes them one at a time" underneath. Nothing on any composed page had
ever shown a method, which left the site's premise unbacked: a demo that says the
product is a guided walk-through and never shows a step is asking to be believed.

Only at `full`. `hero` is the front-page statement and already ends on "Read the
recipe →", so the method belongs on the other side of that link; `collapsed` and
`oneline` are a row and a line. **A consequence worth knowing before narrating:
today only Twin A's page shows a method**, because it is the only composition
holding a RecipeCard at `full`. That is the composer's choice, not a bug.

**`ForkedRecipeCard` renders a fork as THREE parts, not two.** It used to be an
intro paragraph and two branch blurbs — it announced "splits at step 4 of 6" while
showing no steps at all, so the fork had nothing visible to fork, and a reader
could not tell whether a branch was one step or three.

| Part | 039 | 031 |
|---|---|---|
| shared head | 1–3 | 1 |
| branch steps, both numbered from the fork | 4–6 / 4–6 | 2 / 2 |
| shared tail, when the method **rejoins** | — | 3–5 |

Each branch in `editorial.json` now carries its own `steps`, and both branches of a
dish must be the same length or the numbering after them disagrees — asserted where
they are authored, along with head + branch + tail == the method. Branch steps
replace the branch prose rather than joining it; the prose is where the steps came
from, so printing both said everything twice. `MethodList` takes a `start` so two
lists on one card can legitimately both open on "4".

**The card shows the dish's own headnote again.** `resolve.ts` was sending
`{ ...r, summary: fork.shared }` — throwing away each recipe's headnote ("Cabbage
has enough sugar to behave like an onion if you let it") and replacing it with a
paragraph that restated steps one to three. With the method on the card that
paragraph said everything twice *and* cost the card the one line saying what the
dish was. `fork.shared` is now trimmed to the CLAIM about the split — "Nothing
before this point differs." — and printed under the rule, where it is about to be
demonstrated rather than asserted at the top.

**`/kit`'s specimen was updated with it.** The gallery has its own sample data, so
the block changed underneath it and the specimen fell back to prose — a catalogue
entry showing a version of the component no page produces, which is how a kit
starts lying.

**`031` is the sharpest version of the argument** and could not be expressed at all
before: it diverges for exactly one step — anchovies or pancetta — and the other
four are identical. Nothing currently composes it, so it is unrendered; verified
through `resolveBlock` directly.

The list itself is `components/content/method-list.tsx`. It was inside PrimerCard,
whose CSS claimed "the only ordered list in the system" — copying the markup would
have made that false, so it was extracted and both use it. `steps` also exists so
`abandoned atStep 3` resolves to a real instruction.

**Before this, the profile pass was told someone quit at step three with no way to
learn what step three was, and it filled the gap in.** The learner's characterization
read "at step three, in the middle of the sear itself" — the step number was real,
the sear was invented. The composition call is locked to ids and enums; the profile
call writes free prose and is not. It is the one place in the system a model can say
something false, and it did. It now quotes the step instead:

> quit early on, at *"Skin down in a hot dry pan, weight on top. Four minutes
> without touching it"*

Every `forkPoint` string names a step number ("At the flip, step 3 of 5"), so
`steps.length` must agree with it. That was asserted when the steps were authored;
re-assert it if you touch either.

### A profile came back empty and cached anyway

The first regeneration returned a learner profile with an empty `salientInference`
and `cookedRecipeIds: []` against a log with four completions. It satisfied the
schema, so it cached, and the page rendered from it — a silent wrong answer rather
than a visible failure, which on a recording day is the worst possible shape.

Fixed in two places: `profileSchema` now requires non-empty strings, and
`getProfile` checks the answer **agrees with the log it was given** (cooked ids
must appear as completions; a log with completions cannot yield none) before
caching, retrying once at a nudged temperature because temperature 0 would
reproduce the same degenerate output. Two failures now throw rather than cache.

### `role: lead` is enforced now — it was not

Twin B lost its story to this. Its only eligible lead was `PrepSchedule`, the prompt
said "if only one lead is listed, that is the answer", and the model returned
`RecipeCard @ hero` — which **validated**, because `validate.ts` let a support block
lead whenever its treatment was `hero`. That exception exists so the hand-authored
default page, which has no household and therefore no eligible leads, can open on a
dish. It was never meant to outrank a lead that qualified, and Twin B's page opened
exactly the way the page for someone with no history opens.

`validate` now takes the eligible list, and a support block may lead **only when no
lead qualified**. The rule is also stated in the prompt, so the model stops doing it
rather than being corrected afterwards — with the validator alone Twin B cost a
repair call every load. Verified: it now leads with `PrepSchedule` on the first
call, valid, no repair, and picks up the `PlanTheWeek` assembly.

The default page passes no eligible list and validates unchanged.

### Comparison axes are an enum, not free text

`axes` was `z.array(z.string())` — the one place in the spec where the model wrote
prose that reached a finished page. It went wrong twice. First "The split itself",
which no reader could decode. Then "Protein", which `resolve.ts` has no way to
compute, so two thirds of Twin B's table rendered as a column of em-dashes.
Constraining the wording in the prompt fixed the first and could never have fixed
the second.

`AXES` in `compose.ts` is now a closed list, and `AXIS_VALUE` in `resolve.ts` is a
`Record<Axis, …>` — **exhaustive by construction**. A heading added to the
vocabulary without a way to fill it fails to typecheck instead of rendering a dash.
The old resolver matched substrings and fell back to "—", which is worse than not
compiling: it produced a plausible-looking empty cell.

This is the demo's own argument applied to the last place it was not: give the model
a vocabulary instead of a blank.

### `/stage` — the split screen

Manifest left, three composed households right. Edit, save, all three recompose.
Stills in `docs/stills/`.

Laid out to a **fixed 2560×1440 board** (27" Studio Display, 16:9) and scaled to fit
whatever window it is in, so what you see while working is what records. Every size
in `stage-view.tsx` is a constant against that frame.

**The board is positioned by arithmetic, not by `place-items: center`** — fixed
5 Aug. `transform` does not change layout, so the board's layout box stays 2560×1440
however small it is drawn, and a centred item that overflows its grid area gets
clamped to the start edge. The box ran 0→2560, scaling about its own centre parked
it at `left: 560` on a 1440-wide window, and two fifths of the frame was cut off
under `overflow: hidden`. It looked correct at 2560 CSS px and nowhere else, which
is why it was never noticed on the display it was built on. Origin is now top left
with an explicit centred offset; measured whole and unclipped at 2560×1440,
1728×1000, 1440×820 and 1280×700.

**A laptop gets a correct small replica, not a second layout.** Everything scales
together, so a 1440-wide window draws the board at 0.56 and the manifest editor
lands around 12px — workable, and the pages are legible enough to see the shapes
differ. Below roughly 1280×700 the editor drops under 11px and it becomes a preview
rather than somewhere to work.

- **A `PAGES | DATA` switch above the panes** shows the households' data (⌘D) — see below. ⌘S saves, ⌘\ collapses.
- **The drawer is 660px and opens on `blocks`.** It was 820 and opened on
  `obligations` — mid-file, on the section the finale types into, which showed the
  punchline before the argument. Opening on the vocabulary reads as a list rather
  than a file, and the narrower drawer gives each pane ~578px instead of ~530px.
  The editor dropped from 17px to the projection floor at the same time; at 17 it
  ran visibly larger than the blocks list beside it and the two tabs looked like two
  different tools.
- The drawer **collapses to a rail, not to zero** (`DRAWER_RAIL_W`) — the cause has
  to stay on screen while the pages change, or the beat is showing outputs again.
- It **edits one top-level manifest section at a time**, spliced back by byte offset
  (`lib/manifest/slice.ts`) — 482 lines cannot be read at projection distance. Every
  byte you did not edit comes back unchanged; the round trip is tested.
- **The tabs are declared, not derived from the file's keys** (`TABS` in
  `stage-view.tsx`). Six derived tabs wrapped to two lines, and two of them —
  `invariants`, `density` — are words the talk never teaches; `invariants` reads as
  "variation" at a glance. Now four: **blocks · obligations · assemblies · limits**.
  `obligations` and `assemblies` keep their names because beat 3 spends five minutes
  teaching them and the demo should pay that off. `limits` holds *two* sections,
  `density` and `invariants`, each with its own editor and its own splice — the save
  loop writes them sequentially, because each PUT reads the whole file. `version`
  moved to the header beside the hash.
- **`blocks` renders the vocabulary as a list, not as JSON**, with `raw` one click
  away. `components` is 350 of the manifest's 470 lines; as raw text it was a wall,
  and a wall the room cannot read is the same as no cause on screen — the failure
  the split screen exists to fix. Each row is a name, its `role`, its `requires` as
  conditions, and `mustFollow`/`neverWith` where declared. `maxPerPage` is left out:
  every component declares one, so it distinguishes none of them. Fourteen of the
  fifteen are in frame at once, and the four leads are the only rows in acid.
- **Save with nothing edited is deliberate.** It rewrites the same bytes — the hash
  does not move — but it is the only way to re-trigger three compositions without
  touching the manifest, and a take sometimes needs exactly that.
- **Writes are validated before they land** (JSON, then schema). A malformed
  manifest on disk takes all three panes down mid-take.
- The **consolidated rail carries the proof numerically** — `obligations 0 → 1` on
  the household that fired. It is the only thing in frame that must be legible from
  the back of the room.
- **`density` is on the rail as well, as `chosen/maxBlocks`** — added 5 Aug because
  editing `maxBlocks` moved nothing in frame and read as the manifest being ignored.
  It is not ignored: `maxBlocks` is read by the prompt (`compose.ts`), the validator
  (`validate.ts`) and the assembly-overflow trimmer (`gates.ts`). But see below —
  raising it is close to a no-op, so the second number moving on save is the only
  visible confirmation the edit landed. `blocks` stays `rendered/chosen`, which is a
  different question and catches a block that was named but could not be built.
- Telemetry is scraped off the same-origin iframes via `data-k`/`data-v`. The
  composed pages stay pure server components; the only two client components in the
  repo are both in the stage view.

### ⌘D — the other cause

Added 5 Aug. The split screen showed the manifest, which is the cause all three
pages **share**, and never showed the cause that **differs**. Three pages made by
one vocabulary out of three people, with the people off screen, is an argument
with a term missing — the room had to take on trust that the input varied at all.

A **`PAGES | DATA`switch above the panes** swaps the three columns from the composed
pages to the data that made them. Same three columns, input instead of output,
manifest still in frame. ⌘D does the same thing and the shortcut is printed on the
face of the switch — this shipped as a keystroke with nothing on screen saying it
existed, which meant it may as well not have been there. The iframes stay
mounted underneath (`display: none`) — unmounting them would throw away three live
compositions and coming back would cost a model call each.

Three groups, in the order the argument runs:

| Group | Where it comes from | What it decides |
|---|---|---|
| **What they told us** | `households.json`, declared at signup | nothing on its own |
| **What they did** | `computeFacts`, evaluated in **code** | which components are *allowed* — the `vocabulary n/15` on the rail |
| **What the model is told** | `householdContext()`, **verbatim** | how the allowed blocks are *arranged* |

**The middle group never reaches the model.** That is the part worth saying out
loud: the facts that gate the vocabulary are evaluated in code, and the model is
handed a pre-filtered menu it cannot argue with. A personalization engine has one
of these three panels. This has all three, and the model is on the weaker side of
the split.

**The twins are the payoff and it is now visible rather than asserted.** Their
declared blocks are byte-identical — *and so are their pantries* — while `cooked
of comparable` reads 10 against 4, `has rhythm` no against yes, `make ahead
pattern` no against yes. Two people who filled in the same form, read oppositely,
because the system is reading behaviour. Say that over this panel and the
"isn't this just personalization?" question from beat 2 dies here rather than
being argued with.

**Risk to hold in mind:** a per-user data panel can read as "here's the CRM
record", which makes it look *more* like personalization. The framing carries it —
lead with the identical declared block, then reveal the divergent derived facts.
Never introduce it as "the user profile".

Implementation notes: `/api/context` returns all three at once and is fetched on
the first ⌘D, not on mount — doing it on mount would run three profile loads
before the pages have composed, and composition is what the clock in frame is
timing. `test()` is exported from `gates.ts` and `householdContext()` from
`compose.ts`, so the panel evaluates conditions and renders the prompt slice with
**the same code the pipeline uses**. A display copy of either would eventually
disagree with the real one, and the display would be the lie. Only `user.*` facts
are shown; `content.*` is the recipe library and `state.*` is the session, and
neither differs between the three columns.

### The copy rule — labels are direct, prose is not

Set 5 Aug, after the composed pages read as different but not as *legible*. Two
kinds of text are on these pages and they get opposite treatment:

- **A label naming what a block is** must decode in one second, from the back of a
  room, over the top of someone talking. Plain English, no metaphor. These carry
  the argument, because the argument is that the three pages are made of different
  blocks.
- **Editorial prose** — recipe titles, the technique note, troubleshooting text,
  the rationale sentence — keeps its voice. It is authored, the model never writes
  it, and it is what stops the pages reading as generated filler.

The learner page shows the rule working: `YOU HAVEN'T TRIED THIS YET` over
`STARTING THE PAN COLD`, and `WHAT THESE 4 DISHES HAVE IN COMMON` over `CONTACT IS
THE WHOLE JOB`. The label says what it is; the prose underneath keeps the voice.
Before, the prose was doing both jobs and did neither.

What changed: `Recorded for this household` → **`Allergy warning`** (the obligation
never named the thing it warned about, and it is the last block the room sees);
`Fork · step 4 of 6` → `Splits here`; `Branch A` → `Option A`; `Your thread` →
`Every time you've tried…`; `Why these 4 work` → `What these 4 dishes have in
common`; `Compared for your kitchen` → `Compared side by side`; `Axes chosen for
your kitchen` → `Columns chosen for you`; `Shared base` → `Used again later this
week`; `Primer` → `How to do it`; `Shortfall` → `Still need`; `In the house` →
`What you have`; `Larder` → `Pantry`.

**None of this is in the compose cache key**, and none of it is text the model
reads — the model reads the manifest's `intent` strings. So it is the one class of
change that needs no recomposition and no re-verifying that the learner still has
no recipe. Safe to do the night before recording.

**These labels are unreadable in the split screen** — an eyebrow renders about 5px
at three-up scale, where the room is watching page shapes. This work pays off in
the single-page beats and on the `/h/…` pages opened in a new tab.

**The one label the model writes is now constrained too.** `ComparisonTable`'s
column heads come from `axes`, a free `z.array(z.string())` — the only words the
model authors that land on a finished page. It was producing `THE SPLIT ITSELF`,
which meant every label on the twins' page could be read cold except that one.
Both the schema `.describe()` and a prompt rule now demand a one-to-three-word
heading naming what the column measures. Measured over three runs: Twin A gives
`Where it splits · Active time · Total time` every time, Twin B `Technique ·
Active time · Where it splits`. All valid, no repairs, no fallbacks; leads
unchanged, the learner still has no recipe, the twins still diverge.

Nav also reads `HOME · PREP · PANTRY · TECHNIQUE · INDEX` — `Fire` was brand
doing a wayfinding label's job.

### The compose cache

In-memory `Map` (`lib/compose/cache.ts`), not Next's data cache — Next's would fight
`force-dynamic` and add a concept to explain on stage. **3952ms → 139ms** on a
repeat load. Keyed on manifest hash + household + profile + recipes + eligible
vocabulary + what fired + model label. Only compositions that **passed validation**
are stored; a fallback never is.

**A repair now replaces the cached entry, and the rail says so.** `remember` was
guarded by `!composeCached`, so a cache hit skipped the store. That is fine while a
cached spec stays valid — and it stops being valid the moment the VALIDATOR changes
rather than the manifest, because the manifest hash in the key has not moved. Twin B
hit exactly that after `role: lead` was enforced: every load was a cache hit whose
spec no longer validated, so every load made a live repair call and threw the result
away. Its block count moved between reloads because repairs are nondeterministic,
and the rail said `cache hit` the whole time.

Two fixes. The store guard is `(!composeCached || repaired)` — repairing means the
entry is stale by definition. And the rail reports `repair 3.7s` instead of
`cache hit` when a repair happened, because a telemetry line that says "cache hit"
while a model call is in flight is how this hid for a whole session.

> **⚠ Recording: run `MISE_NO_CACHE=1`.** The key includes the manifest hash, so
> `stage:reset` returns the file to a hash that is *already cached* — take 1
> composes for real, take 2 shows `cache hit`. `stage:reset` warns unless the flag
> is set.

### What it costs

`scripts/cost.mjs`, measured, one real call of each kind at list price:

| | Model | When | Tokens | Cost |
|---|---|---|---|---|
| Composition | Sonnet 5 | per view | 4,496 in · 196 out | ~$0.016 |
| Profile | Opus 5 | per user, per night | 5,968 in · 2,218 out | ~$0.085 |

Arranging a page is cheap and caches to nothing. The nightly inference is the one
that scales with user count — it cannot be cached or shared, because being about
exactly one person is its whole purpose. Two-thirds of it is thinking tokens.

### The local-model path

`MISE_PROVIDER=ollama` (default model `qwen3.5:9b`). **Decision: the demo stays on
Sonnet;** local is kept for the dev loop only.

Not for lack of validity — after `StoryIntro` was cut, three local models composed
9/9 valid, same as Sonnet, with *better* worst-case latency. But the validator
cannot see what actually disqualified them: they put a recipe on the learner's page
(killing the absence argument) and wrote reasoning sentences that were flat or
unfair. **Valid was never the same as good.**

The local path deliberately **bypasses the AI SDK** (`lib/compose/ollama.ts`).
Ollama's OpenAI-compatible `/v1` endpoint ignores `think: false`, so a
hybrid-reasoning model spends its whole budget on reasoning and returns empty
content — surfacing as "No object generated", which points nowhere near the cause.
The native `/api/chat` honours `think` and takes a JSON Schema in `format`.

---

## The finding worth keeping

Three unrelated local model families failed at an identical rate (6/9), on the same
household, with the same error. Removing **one** manifest entry took all three to
9/9.

`StoryIntro` could never render (no editorial was ever authored) yet had
`requires: []`, so it was offered to every household, advertised "no recipeIds
needed", and is named like something that goes first. It was bait — and only a
frontier model was expensive enough to ignore it.

**How tight the vocabulary is decides how cheap a model can do the job.** That is
the design system doing the work, and it is the thesis with a number attached.

---

## Open decisions

- ~~**Beat 6's narration does not match what happens.**~~ **Resolved 5 Aug** — the
  spec was corrected before this file was written, so this entry was stale on
  arrival. Demo spec §9 now says Twin A only, and calls it the better story: the
  obligation attaches to the dish on the page, not to the flag on the profile, so
  two households with an identical declared allergy get different pages. The
  spoken version is in the vault at `outputs/renderatl-2026-talk-script.md`.
  **No code change wanted. Do not give Twin B a dairy dish** — the absence is the
  argument.
- **Raising `maxBlocks` is close to a no-op — the prompt overrides it.** Measured
  5 Aug: at `maxBlocks: 8` the three households composed 3, 4 and 4 blocks, the same
  as at 4. `compose.ts` interpolates the cap and then, in four hardcoded sentences
  underneath, asks for three or four blocks anyway — "Add two or three SUPPORT
  blocks", "Three blocks that agree beat four that do not", "let the remaining two
  or three support it", "A page where four blocks are equally important is a page
  with nothing to say", plus "Fewer is better". The manifest sets a ceiling; the
  prose sets the actual count. So density **bites when lowered and frees when
  raised** — try `2` for a live density beat, not `8`. Deliberately left as it is:
  deriving those sentences from `maxBlocks` recomposes all three pages, and the
  learner's recipe-free page and the twins' divergence are what the demo rests on.
- **`SubstitutionTable` is dead vocabulary**, same class as `StoryIntro`. It treats
  every unmatched ingredient as substitutable, so its gap list is water, salt, pepper
  and bay leaves and the authored substitutions never get a chance. Mark staples
  non-substitutable, or cut it. It has never appeared on a page.
- **The learner page is the only one with no photograph.** Deliberate, but check it
  on a real screen beside the twins. If it reads impoverished rather than austere,
  the answer is the fifth component held in reserve, not an image.
- **Local latency is unsettled.** Side-by-side runs took 21–27s against a 4.2s
  bake-off median an hour earlier. Cold load, `keep_alive` expiry, or memory
  pressure on 18GB — not isolated.
- **Two components are built but out of the vocabulary**: `SeasonalNote`,
  `FromYourHistory`. Both produce orphans on a four-block page.

## 6 Aug, later — layout vocabulary, four phases, and an unsolved reliability problem

**Read the reliability section before doing anything else with this.**

### What Brian's feedback was, and what it fixed

*"They all look exactly the same to me. The content is different… the whole layout
should change."* Correct, and the diagnosis was worse than polish:

1. **There was no layout vocabulary.** The manifest said what may appear and at what
   depth; `<main>` was a hardcoded flex column, so every block on every page was full
   width and stacked. **The model could not produce a differently shaped page**, only
   a differently filled one — which is a CMS, and a room of designers reads it as one.
2. **The three occasion moments differed only INSIDE `OccasionPlan`.** All three led
   with the same block; only its stage count changed.
3. **The hero image moved between moments** because the composer re-picked recipes
   every call, so the page appeared to say the dinner had changed.

### What is built now

**`spans` on every component** (`full` / `half`), a design-system statement like
`treatments`. Consecutive support blocks that both permit `half` are paired into a
grid row by `enforceSpans` in `gates.ts`, and the renderer groups rows. **The model
does not choose widths** — see below.

**Four phases, four different leads.** `state.occasionPhase` is derived by
subtraction from `daysUntil`:

| Phase | Days | Lead | The job |
|---|---|---|---|
| choosing | ≥10 | `ComparisonTable` @hero | what are we making? |
| shopping | 4–9 | `ShoppingList` @hero | what do I buy? |
| prep | 1–3 | `PrepSchedule` @hero | what can I do early? |
| cooking | 0 | `OccasionPlan` @hero | what happens when? |

**`leadWhen`** — a conditional lead permission. A shopping list is what the page is
about on the Tuesday before eight people come and a supporting detail every other
day of its life; `role` alone could not say that, and two components would have been
two templates. `canLead()` in `gates.ts`, used by the prompt AND the validator so
they cannot disagree.

**`activeAssemblies`** — an assembly only binds while both members are eligible.
`PlanTheWeek` glues `ShoppingList` to `PrepSchedule`, and on the shopping day the
schedule is not eligible, so completion **deleted the lead off its own page**.

**The menu is frozen** on the occasion (`menu: ["034","038","036","039"]`). Blocks
resolve against it, keeping the model's picks that are on the menu and topping up
from it. The dinner no longer changes when you reload.

**`ShoppingList` and `ComparisonTable` gained hero treatments.** The list at hero is
a headline, a count, and two wide columns — the shop as the page rather than an
appendix.

### Reliability — NOT SOLVED, and it is the blocker

**Composition fails roughly half the time on occasion pages.** Measured 6 Aug over
15 runs across the four phases: **7 failures.** The same measurement on the twins,
whose path is unchanged: **0 in 6.** So it is specific to the occasion pages.

The failure is `AI_NoObjectGeneratedError`. The model returns the whole spec **as a
JSON string stuffed into one field** — `{ blocks: "{\"blocks\":[…]}" }` — or drops
`dominant` and `rationale`. `compose()` retries twice and salvages a stringified
payload when the content is complete (`unwrap` in `compose.ts`); the page falls back
to the default rather than crashing, so **nothing 500s** — but two of five pages
showed the default page on a single sweep, which is unusable for recording.

**What was tried and ruled out**, so nobody repeats it:

- **Not the `span` field.** Removing it from the schema entirely (the app decides
  widths now) did not move the rate. Keeping that change anyway — it is the better
  design and it is one less thing asked of the model.
- **Not the "lead is already decided" prompt block.** 4/6 without it.
- **Not the occasion prompt section.** 3/6 without it.
- **Not thinking.** `thinking: enabled` is incompatible with this structured-output
  path and fails instantly, 12/12.
- **The empty `ASSEMBLIES` heading was A cause, not THE cause.** When
  `activeAssemblies` filters everything out the prompt printed a heading and its
  rules with nothing beneath. Now prints "(none apply to this page)". One sweep
  after that fix came back 1/8; the next came back 7/15, so treat the improvement as
  unproven.

**What to try next**, in the order I would try it:

1. **Shorten the prompt.** It has roughly doubled. The occasion pages are the long
   ones and they are the ones that fail — that correlation is the strongest signal
   available and it was never tested directly by cutting length rather than sections.
2. **Split the call.** Choosing the lead and filling the page are two decisions; the
   lead is already determined by eligibility on occasion pages, so it could be passed
   in rather than asked for.
3. **Pre-compose and freeze the four occasion pages to disk**, the way profiles are
   frozen. For a recorded demo this is honest and it removes the risk entirely.
   Option 3 is the safe answer if recording day arrives before 1 or 2 works.

---

## Where 6 Aug left it — the occasion beat

**Built and working.** The fast pace layer: a household schedules a dinner IN the
product and the home page reorganises around it for a fortnight, then the occasion
expires and the page goes back to being about the cook.

**Nobody types anything.** `lib/content/occasions.json` is state authored through a
form — a date, a guest count, and a dietary note per guest chosen from the same
allergen vocabulary the recipes declare against. **No third model call.** An earlier
plan had free text parsed into structure; it was cut, because it added a call and a
parsing concept to buy a proof this beat does not need to carry, and it put a text
box on stage that reads as chat however it is framed.

### How to see it

```bash
npx tsx --env-file=.env.local scripts/compose.mjs --today=2026-08-08 h-learner   # T-14
… --today=2026-08-19    # T-3
… --today=2026-08-22     # T-0, the morning
… --today=2026-08-25     # expired — back to the ordinary learner page
```

Same on the page: `/h/h-learner?today=2026-08-19`. Unset, it is the real date and
there is no occasion, because `scheduledOn` is 8 Aug — **an occasion does not exist
before somebody created it**, which is why beat 1 of the demo still gets the
learner's ordinary recipe-free page.

### The three moments are one fixture seen from three distances

`state.daysUntil` is arithmetic (`lib/occasion.ts`), and **preconditions key on
it**, so the vocabulary offered differs per moment. `ComparisonTable` needs 7+ days
— on the morning nobody is comparing dishes. Measured:

| Moment | Lead | Stages inside the plan |
|---|---|---|
| T-14 | `OccasionPlan` @full | This week · Up to three days before · On the day |
| T-3 | `OccasionPlan` @hero | The day before · On the day |
| T-0 | `OccasionPlan` @hero | This morning |

**The plan burns down as the date closes.** That is the legible visual — the page
gets shorter and more focused, and it is not three templates.

### The allergen fires for a guest

**The best moment in the beat and it is verified.** The learner declares no dietary
restriction at all. `allergensInForce` in `gates.ts` unions the household's declared
diet with the occasion's `avoid`, so the notice fires above charred cabbage on all
three moments — for somebody who does not live there. **Nothing new was said in the
manifest**: the obligation already read "an allergen present in a dish on this
page", and it was never about the household.

### Two facts that are pressure, not habit

`state.planningPressure` and `state.makeAheadPressure` (`gates.ts`). A shopping list
is for someone who plans, and the learner does not plan — but eight people are
coming, and cooking for eight is planning whether or not you are a planner. Written
as one computed fact rather than as an OR in the manifest **on purpose**: the
manifest goes on a screen in front of six hundred people and a predicate language
with boolean operators stops being readable at a glance.

### Two robustness fixes, and the second one matters

1. **`compose()` retries once on a schema failure.** `generateObject` *throws* when
   the response does not match — it does not return something the validator can
   reject — so the repair pass never saw it. The model returns four good blocks and
   silently omits `dominant` or `rationale`.
2. **A compose failure now falls back instead of 500ing.** It was unwrapped in
   `app/h/[household]/page.tsx`, so a schema miss took the whole request down.
   Twin A did exactly this, once, on an ordinary load with no occasion involved —
   **this was latent before the occasion beat, not caused by it.** The rail now says
   `fell back to the default page — the model returned nothing usable`.

### What was NOT built, deliberately

- **No new recipes.** The audit said the twelve cover it: 034 pressed pork belly,
  038 white beans, 036 focaccia and 037 green sauce all scale and all carry
  make-ahead steps. 039 charred cabbage carries the dairy that makes the beat work.
- **No second component.** `OccasionPlan` is the only addition. The instinct here is
  a guest list, a countdown, a timeline widget — the density budget is four blocks
  and a component that cannot appear on a four-block page is dead vocabulary.
- **`ScalingControl` stayed out of the vocabulary.** The plan had it earning its
  place at last, and it cannot: it is `"use client"`, and putting an interactive
  control in a composed page breaks the no-client-JS property the whole build rests
  on. **The occasion made the scaling a statement rather than a control** — the
  system knows the number, so `OccasionPlan` prints "Scaled to 8 · ×1.33 on every
  quantity · written for 6" and no stepper is needed. Better story, and the property
  holds.

### Open

- **Cost numbers moved and the close quotes them.** `cost.mjs` now measures ~$0.02
  per composition (up from $0.016 — the occasion adds prompt tokens) and ~$0.05 for
  the profile (down from $0.085, which is single-sample variance in output tokens,
  not a change). **Run it several times and settle on a figure before the talk.**
- **`/stage` does not show the occasion** in the DATA pane yet. It renders fine; the
  fast layer is just not visible there, and it should be — it is state.
- The `?today=` parameter is visible in the URL bar. Fine for the harness, worth
  hiding or cropping when recording.

---

## Where 5 Aug left it

Seven commits, `cc80d64`..`b891138`. The working tree is clean and the dev server
runs on 3717. What moved, in the order it would matter to someone picking this up:

1. **`/stage` shows the other cause.** A `PAGES | DATA` switch (also ⌘D) swaps the
   three panes to the households' data. The drawer is 660px, opens on `blocks`, and
   the vocabulary reads as a list rather than as JSON.
2. **The premise is written down and load-bearing** — Mise teaches people to cook,
   ships a guided cook mode, and that is why the event log looks like it does.
3. **Recipes have steps and pages render them.** `RecipeCard @ full` prints a
   numbered method; `ForkedRecipeCard` prints head → branches → rejoin.
4. **Two model-authored holes closed.** The profile pass no longer invents step
   detail, and comparison axes are an enum rather than free text.
5. **Two silent-failure classes closed.** An empty profile can no longer cache, and
   a repaired composition now replaces its stale cache entry.

**The next thing is recording** — see below. Nothing above is unfinished.

## If continuing the talk track

1. **The rules-engine baseline** (build spec §8) — fourteen rules, four templates,
   built as a competent team would ship it. Not started; wants a full day. If the
   baseline is obviously bad, the comparison collapses.
2. **Record** (build spec §14) — one clip per beat, under 45s, still final frame,
   `pnpm stage:reset` between takes, `MISE_NO_CACHE=1`.

Neither is load-bearing for the code. **If the next session goes somewhere else
entirely, nothing here needs finishing first.**

---

## Things not to relearn

- **The manifest is read from disk per request** and its hash is in the cache key.
  That is what makes the live edit work. Do not bundle it.
- **Obligations are placed by the app, never the model**, and render *immediately
  above the dish they are about* — not at the top of the page.
- **Adjacency is a rule about units, not members.** A block that must follow
  `PrepSchedule` is satisfied by following the assembly `PrepSchedule` leads. The
  validator and the enforcer share one predicate (`satisfiesMustFollow`) — when they
  held separate copies they fought, and the enforcer looped.
- **Assembly completion can break rules the model never broke** — it can add a fifth
  block to a four-block page, and a completed block must be *constructible*, not just
  named (`ShoppingList` needs two recipes). Both are handled in code.
- **A block that can never render must not be in the vocabulary.** See `StoryIntro`
  above. `SubstitutionTable` is the same problem, still open.
- **Photography is declared (`carriesPhoto`), not inferred from treatment.** Three
  components carry an image. A component that gains one must gain the flag, or the
  density budget silently under-counts.
- **`AllergenNotice` carries no `!` mark.** The design brief sanctions three glyphs
  (`→ · ©`); a fourth doing the job of a warning icon, in a system that bans icon
  sets, was adding emphasis to the most emphatic thing on the page. Do not put it
  back.
- **The compose cache key does not include the prompt.** It is manifest hash +
  household + profile + recipes + eligible vocabulary + what fired + model label. So
  editing `compose.ts` and reloading a page serves the OLD composition and the rail
  says `cache hit` — the change looks like it did nothing. Verify prompt changes in
  `compose.mjs`, which never touches the cache, or restart with `MISE_NO_CACHE=1`.
- **`compose.mjs` prints `axes`**, because they are the only words the model writes
  that reach the finished page. A column head reading "The split itself" survived
  until someone opened a browser, which is exactly the loop the harness exists to
  replace. Anything the model authors has to be visible there.
- **Anything that is a count is computed from the event log**, never taken from the
  model's self-reported signals.
- **Composition runs with thinking disabled**; the profile call keeps it. That took
  compose from 16.5s to ~4s.
- **The stage view measures pane height from the bottom of the last child**, not
  `scrollHeight` — the iframe is given a tall height to lay out in, and anything
  sized to the viewport reports that height straight back.
- `devIndicators: false` in `next.config.ts` — the Next dev badge sits inside the
  recording frame.
- **Images**: twelve PNG masters (~104MB) are gitignored; optimised JPEGs at
  `public/images/recipes/` are committed. Regenerate with `sips`.
