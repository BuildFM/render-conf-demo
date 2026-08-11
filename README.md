# Mise

A demo recipe site where a model assembles each household's page at request time, choosing only
from a component vocabulary defined in `lib/manifest/manifest.json`. Built for a conference talk;
it is not a product and is not deployed anywhere.

There are three fixture households with 90 days of generated cooking history each. Two of them
(Twin A and Twin B) declare identical profile data and differ only in behaviour, so their pages
come out different.

Under every composed page is a **vocabulary strip**: all 16 blocks in three states — not eligible
(a gate said no, in code, with the failing condition printed), offered to the model but not chosen,
and chosen. It is the quickest way to see what the model actually decided versus what the
application decided for it.

`docs/demo-script.md` is the run sheet for the talk. `docs/STATE.md` is the long-form state of the
project and explains why most things are the way they are.

## Requirements

- Node 20.9+ (Next 16 floor)
- pnpm

## Run it

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000/start for an index of every route.

No API key is required — see Option C below.

## Model configuration

The app makes two model calls:

| call | when | what it does | model env var |
|---|---|---|---|
| Profile | nightly in principle; cached to disk here | reads ~200 raw log rows and picks the pattern worth acting on | `MISE_PROFILE_MODEL` |
| Compose | every page view | arranges permitted blocks into a layout | `MISE_COMPOSE_MODEL` |

### Option A — hosted model via Vercel AI Gateway

```bash
cp .env.example .env.local
# set AI_GATEWAY_API_KEY
pnpm dev
```

`node scripts/list-models.mjs` lists the model slugs your gateway offers, for setting
`MISE_COMPOSE_MODEL` / `MISE_PROFILE_MODEL`.

### Option B — local via Ollama

```bash
ollama serve
ollama pull qwen3.5:9b
MISE_PROVIDER=ollama pnpm dev
```

This path does not use the AI SDK. Ollama's OpenAI-compatible endpoint ignores requests to disable
thinking, so hybrid-reasoning models spend their budget in the `reasoning` field and return an empty
response. `lib/compose/ollama.ts` calls the native API instead, honours `think: false`, and passes a
JSON Schema for grammar-constrained decoding.

### Option C — no key

Runs without any model. The three profiles are committed under `lib/signals/cache/`, and composition
falls back to a deterministic stub that picks the first eligible blocks. Every page renders; the
telemetry rail reports `compose: stub`.

### Environment variables

| variable | default | purpose |
|---|---|---|
| `AI_GATEWAY_API_KEY` | — | gateway key (`VERCEL_OIDC_TOKEN` also works) |
| `MISE_PROFILE_MODEL` | `anthropic/claude-opus-5` | profile call |
| `MISE_COMPOSE_MODEL` | `anthropic/claude-sonnet-5` | per-view composition call |
| `MISE_PROVIDER` | `gateway` | set to `ollama` to run locally |
| `MISE_OLLAMA_MODEL` | `qwen3.5:9b` | local model |
| `MISE_OLLAMA_URL` | `http://localhost:11434` | native API, not `/v1` |
| `MISE_TODAY` | today | overrides the current date |
| `MISE_NO_CACHE` | — | `1` disables the compose cache |

## How a page is built

All of it runs in `lib/compose/pipeline.ts`, which both `/h/…` and `/twins` call. Every step is
code except step 5.

1. **Load the manifest** — read from disk per request, never bundled, so edits apply without a
   rebuild. Components marked `"retired": true` are dropped here and are invisible to everything
   downstream. `lib/manifest/load.ts`
2. **Compute facts** — from content, profile and session. `lib/compose/gates.ts`
3. **Fire obligations** — conditions evaluated in code before the model runs (e.g. allergen notices).
4. **Filter the vocabulary** — the model only sees components the household qualifies for.
5. **Compose** — the model picks blocks, order, treatment and recipes.
6. **Complete assemblies, enforce adjacency and widths** — in code.
7. **Validate, repair once, then fall back** — if validation fails twice, a hand-authored page is
   served.
8. **Resolve slots** — ids and enums in, values out. `lib/render/resolve.ts`. The model never emits
   facts about a dish.

The telemetry rail at the foot of each page reports the model used, latency, cache hit, whether a
repair or fallback happened, and any dropped blocks with reasons.

## Key files

| file | what it is |
|---|---|
| `lib/manifest/manifest.json` | the component vocabulary the model sees (no CSS) |
| `lib/compose/pipeline.ts` | the ten stages, in order |
| `lib/compose/gates.ts` | facts, permissions, obligations, assemblies, widths |
| `lib/compose/compose.ts` | the composition model call and its prompt |
| `lib/compose/validate.ts` | composition validation rules |
| `lib/compose/overrides.ts` | the behavioural facts `?facts=` can force |
| `lib/render/resolve.ts` | ids in, values out |
| `components/stage/vocabulary-strip.tsx` | the strip under every composed page |

Comments in these files explain the reasoning behind each decision.

## Routes

| route | what it is |
|---|---|
| `/start` | index of every route, in the order the demo runs |
| `/` | hand-authored home page; no household, model or signal |
| `/h/h-learner`, `/h/h-twin-a`, `/h/h-twin-b` | the three composed pages |
| `/twins` | Twin A and Twin B's vocabulary strips stacked, with no pages — the eligibility comparison |
| `/kit` | every block at every treatment, with sample data |
| `/stage` | the manifest beside the pages it produces; edit it and all three recompose |
| `/api/context` | each household's data, split into gated-in-code vs sent-to-model |
| `/api/manifest` | the manifest as served |

## Query parameters

Both work on any `/h/…` page, and every combination is a URL you can bookmark or type.

| param | example | what it does |
|---|---|---|
| `?today=` | `?today=2026-06-11` | moves the clock (see the dinner party fixture) |
| `?facts=` | `?facts=technique:0` | forces behavioural facts, so you can watch eligibility re-gate |

`?facts=` takes a comma-separated list of `slug:0` or `slug:1`. The slugs are defined in
`lib/compose/overrides.ts` and the switches at the foot of the strip build the URLs for you. Only
facts derived from behaviour are exposed, and only leaf facts — see the notes in that file for why.
When any fact is forced, the frozen profile is withheld from the compose prompt, because it
describes the household as they actually behave; the telemetry rail says so.

## Editing the vocabulary

On `/stage`, each row in the blocks list has a square: filled means the block is in the vocabulary,
empty means it is struck out. Click it and press ⌘S — this writes `"retired": true` into that
component in `lib/manifest/manifest.json` and all three pages recompose against the smaller
vocabulary. Click again to put it back; nothing is deleted.

`pnpm stage:status` reports whether any block is currently struck out, and `pnpm stage:reset` puts
them all back.

## Dinner party fixture

One household has a scheduled dinner party. It is ordinary application state entered through a form —
no model creates, reads or infers it. It exists for a fortnight and then expires.

It is dated **6–20 June 2026 and is therefore expired**, so the household's ordinary page is what
you get by default. Keep it that way: while an occasion is live, that household's page is an
occasion page instead. `?today=2026-06-11` overrides the date so you can view the same fixture at
each phase (choosing, shopping, prep, the day itself). The phase is derived from the date and the
manifest's preconditions key on it. `/start` lists the dates.

## CLI

```bash
pnpm exec tsx --env-file=.env.local scripts/compose.mjs            # all households
pnpm exec tsx --env-file=.env.local scripts/compose.mjs h-twin-a   # one household
pnpm exec tsx --env-file=.env.local scripts/compose.mjs --dry      # eligibility only, no model call
pnpm exec tsx --env-file=.env.local scripts/compose.mjs --today=2026-06-11
```

Prints the vocabulary offered, what the model chose, whether it validates, and what resolved.

- `scripts/cost.mjs` — prices one real call of each kind
- `pnpm bake-off` — runs the same composition across several models and reports valid-response rates

## Real vs fixture

Real: the manifest, gating, both model calls, the validator, the fallback, and slot resolution.

Fixtures: the recipes, households, and 90 days of cooking history, generated by
`scripts/generate-logs.mjs`. There is no database, auth or cart; the places those would go are
marked in the code.
