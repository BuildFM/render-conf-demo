# Mise

A recipe site where a model composes the page at request time, choosing only from a
vocabulary a person defined in advance.

It is a demo built for a talk, and it is arguing one thing: **a design system is what
earns a model the right to compose an interface.** Not a productivity tool for
building the system — a precondition for letting anything else touch the layout.

Three households, ninety days of cooking history each. On every request a model picks
which blocks appear on that household's page, in what order, at what depth, and with
which recipes. It picks from `lib/manifest/manifest.json` and it cannot go outside it.
The pages are not the point; the point is that the manifest **causes** them. Any one
page can be reverse-engineered into an `if` statement. A change to the vocabulary
propagating across three different households, with no template written for any of
them, cannot.

Two of the three households — Twin A and Twin B — declare **identical** data: same
size, same diet, same stated skill, same weeknight minutes. Their pages are not
alike, because what differs is ninety days of behaviour, and the profile call reads
behaviour rather than the form.

## Run it

```bash
pnpm install
pnpm dev
```

Then open **http://localhost:3000/start**, which is an index of every route.

Node 20.9+ (Next 16's floor). No API key needed to see it work — see below.

## Wire it up to your own model

The demo makes **two** model calls, and they are deliberately different in kind.

| | when | what it does | model |
|---|---|---|---|
| **Profile** | nightly in principle, cached to disk here | reads ~200 raw log rows and decides which pattern about this cook is worth acting on | `MISE_PROFILE_MODEL` |
| **Compose** | every page view | arranges permitted blocks into a layout | `MISE_COMPOSE_MODEL` |

The split is the interesting part. Counting is easy — a query can tell you someone
opened eleven recipes with a make-ahead step. Deciding that make-ahead affinity is
the *salient* fact, out of several hundred true statements about the same log, is the
judgment. That is call one, and it is slow and expensive and runs rarely. Call two is
cheap and runs constantly and makes no judgments about people at all.

### Option A — a hosted model through Vercel AI Gateway

```bash
cp .env.example .env.local
# put a key in AI_GATEWAY_API_KEY
pnpm dev
```

`node scripts/list-models.mjs` prints what your gateway actually offers, so you can
set `MISE_COMPOSE_MODEL` / `MISE_PROFILE_MODEL` to slugs that exist.

### Option B — entirely local, through Ollama

```bash
ollama serve
ollama pull qwen3.5:9b
MISE_PROVIDER=ollama pnpm dev
```

The local path does **not** go through the AI SDK. Ollama's OpenAI-compatible shim
silently ignores requests to turn thinking off, so a hybrid-reasoning model spends
its whole budget in the `reasoning` field and returns an empty response. The native
client in `lib/compose/ollama.ts` is seventy lines and honours `think: false`, and it
takes a JSON Schema for grammar-constrained decoding — which is strictly better than
asking a model politely for JSON.

### Option C — no key at all

It still runs. The three profiles are committed under `lib/signals/cache/`, so call
one is already answered, and composition falls back to a deterministic stub that
picks the first eligible blocks. Every page renders, the telemetry rail says
`compose: stub`, and the reasoning sentence reads `[stub composition — no model
available]`. You will see the machinery — permissions, obligations, assemblies,
layout — without seeing a model make choices.

### Environment

| variable | default | what it does |
|---|---|---|
| `AI_GATEWAY_API_KEY` | — | gateway key. `VERCEL_OIDC_TOKEN` works too |
| `MISE_PROFILE_MODEL` | `anthropic/claude-opus-5` | the nightly inference call |
| `MISE_COMPOSE_MODEL` | `anthropic/claude-sonnet-5` | the per-view composition call |
| `MISE_PROVIDER` | `gateway` | set to `ollama` to run locally |
| `MISE_OLLAMA_MODEL` | `qwen3.5:9b` | local model |
| `MISE_OLLAMA_URL` | `http://localhost:11434` | native API, not `/v1` |
| `MISE_TODAY` | today | moves the clock — see "the occasion" below |
| `MISE_NO_CACHE` | — | `1` disables the compose cache, so every load is a fresh call |

## How a page gets built

Every step below is code except step 5. That is the whole design.

1. **Load the manifest** — from disk, on every request, never bundled. Editing it
   changes the pages with no rebuild. `lib/manifest/load.ts`
2. **Compute facts** — from content, profile and session. `lib/compose/gates.ts`
3. **Fire obligations** — conditions evaluated in code before the model is consulted.
   An allergen notice is not something a model may decide to omit.
4. **Filter the vocabulary** — the model is only ever shown components this household
   qualifies for. Typically half the vocabulary drops out.
5. **Compose** — the model picks blocks, order, treatment and recipes. ← *the only
   step that is a model*
6. **Complete assemblies, enforce adjacency and widths** — in code. Blocks that move
   as a unit are completed rather than requested; how wide a block is was never the
   model's decision.
7. **Validate, repair once, then fall back** — a half-valid layout never reaches a
   person. If validation fails twice, a hand-authored page is served instead.
8. **Resolve slots** — ids and enums in, values out. `lib/render/resolve.ts`. The
   model never emits a fact about a dish, so it cannot say anything false about one.
   That is a structural safety property rather than a procedural one.

The telemetry rail at the foot of every page reports all of it: which model, how
long, cache hit or not, whether a repair happened, whether it fell back, and any
block that was dropped and why.

## The five files that carry the argument

| file | what it is |
|---|---|
| `lib/manifest/manifest.json` | the design system, as far as the model is concerned. It never sees CSS |
| `lib/compose/gates.ts` | facts, permissions, obligations, assemblies, widths — everything the model does not decide |
| `lib/compose/compose.ts` | the one model call that touches layout, and the prompt it sends |
| `lib/compose/validate.ts` | what makes a composition rejectable |
| `lib/render/resolve.ts` | ids in, values out — where "the model never emits a fact" is enforced |

The comments in those files carry the reasoning, including the failures that caused
each decision. They are worth more than this README.

## Routes

| | |
|---|---|
| `/start` | index of everything below |
| `/` | the hand-authored home page. No household, no model, no signal |
| `/h/h-learner`, `/h/h-twin-a`, `/h/h-twin-b` | the three composed pages |
| `/kit` | every block at every treatment, with sample data |
| `/stage` | the manifest beside the pages it causes. Edit the left, the right moves |
| `/api/context` | each household's data, split into what gates in code and what the model is sent |
| `/api/manifest` | the manifest as served |

## The occasion

One household has a dinner party scheduled. It is ordinary application state, put
there through a form the way you would put an event in a calendar — no model creates
one, reads one, or infers one. It exists for two weeks and then expires: the day
after the party the page goes back to being about the cook, and nothing was deleted
to make that happen.

`?today=2026-08-13` moves the clock, so you can watch one fixture from several
distances: deciding what to cook, shopping for it, getting ahead of it, and running
the day. Those are four differently shaped pages out of one vocabulary, and nobody
wrote four pages — the phase is subtraction from a date, and the manifest's
preconditions key on it. `/start` lists the dates.

## Working on it without a browser

```bash
pnpm exec tsx --env-file=.env.local scripts/compose.mjs            # all households
pnpm exec tsx --env-file=.env.local scripts/compose.mjs h-twin-a   # one
pnpm exec tsx --env-file=.env.local scripts/compose.mjs --dry      # eligibility only, no model call
pnpm exec tsx --env-file=.env.local scripts/compose.mjs --today=2026-08-20
```

It prints the vocabulary the model was offered, what it chose, whether that
validates, and what resolved. `scripts/cost.mjs` prices a real call of each kind;
`pnpm bake-off` runs the same composition across several models and reports how often
each returns something valid.

## What is real and what is furniture

Real: the manifest, the gating, the two model calls, the validator, the fallback, the
resolution of every value on the page.

Fixtures: the recipes, the households, and the ninety days of cooking history, which
were generated (`scripts/generate-logs.mjs`) rather than collected from anybody.
There is no database, no auth and no cart — the places those would live are marked in
the code.

It is a proof of concept built in a few days to make one argument on a stage. It is
not a product, it is not deployed anywhere, and it is not trying to be either.
