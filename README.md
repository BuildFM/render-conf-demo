# Mise

A demo recipe site where a model assembles each household's page at request time, choosing only
from a component vocabulary defined in `lib/manifest/manifest.json`. Built for a conference talk;
it is not a product and is not deployed anywhere.

There are three fixture households with 90 days of generated cooking history each. Two of them
(Twin A and Twin B) declare identical profile data and differ only in behaviour, so their pages
come out different.

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

Every step is code except step 5.

1. **Load the manifest** — read from disk per request, never bundled, so edits apply without a
   rebuild. `lib/manifest/load.ts`
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
| `lib/compose/gates.ts` | facts, permissions, obligations, assemblies, widths |
| `lib/compose/compose.ts` | the composition model call and its prompt |
| `lib/compose/validate.ts` | composition validation rules |
| `lib/render/resolve.ts` | ids in, values out |

Comments in these files explain the reasoning behind each decision.

## Routes

| route | what it is |
|---|---|
| `/start` | index of everything below |
| `/` | hand-authored home page; no household, model or signal |
| `/h/h-learner`, `/h/h-twin-a`, `/h/h-twin-b` | the three composed pages |
| `/kit` | every block at every treatment, with sample data |
| `/stage` | the manifest beside the pages it produces |
| `/api/context` | each household's data, split into gated-in-code vs sent-to-model |
| `/api/manifest` | the manifest as served |

## Dinner party fixture

One household has a scheduled dinner party. It is ordinary application state entered through a form —
no model creates, reads or infers it. It expires after two weeks.

`?today=2026-08-13` overrides the date so you can view the same fixture at different phases
(planning, shopping, prep, day-of). The phase is derived from the date and the manifest's
preconditions key on it. `/start` lists the relevant dates.

## CLI

```bash
pnpm exec tsx --env-file=.env.local scripts/compose.mjs            # all households
pnpm exec tsx --env-file=.env.local scripts/compose.mjs h-twin-a   # one household
pnpm exec tsx --env-file=.env.local scripts/compose.mjs --dry      # eligibility only, no model call
pnpm exec tsx --env-file=.env.local scripts/compose.mjs --today=2026-08-20
```

Prints the vocabulary offered, what the model chose, whether it validates, and what resolved.

- `scripts/cost.mjs` — prices one real call of each kind
- `pnpm bake-off` — runs the same composition across several models and reports valid-response rates

## Real vs fixture

Real: the manifest, gating, both model calls, the validator, the fallback, and slot resolution.

Fixtures: the recipes, households, and 90 days of cooking history, generated by
`scripts/generate-logs.mjs`. There is no database, auth or cart; the places those would go are
marked in the code.
