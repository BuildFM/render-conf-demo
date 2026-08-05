import type { JSONValue, LanguageModel } from "ai";

/**
 * Which model composes, and on whose hardware.
 *
 * The composition call runs per view, so an afternoon of iterating on the stage
 * view is hundreds of calls — three per save. That is the cost this exists to
 * attack, alongside the compose cache in ./cache.ts.
 *
 * The local path does NOT go through the AI SDK. Ollama's OpenAI-compatible
 * endpoint cannot turn thinking off, so a hybrid-reasoning model returns an empty
 * response; the native client in ./ollama.ts is used instead. See the note there.
 *
 *   MISE_PROVIDER=ollama pnpm dev
 *   MISE_PROVIDER=ollama npx tsx --env-file=.env.local scripts/compose.mjs
 *
 * Env:
 *   MISE_PROVIDER      "gateway" (default) | "ollama"
 *   MISE_OLLAMA_MODEL  default "qwen3.5:9b"
 *   MISE_OLLAMA_URL    default "http://localhost:11434" (native API, not /v1)
 *   MISE_COMPOSE_MODEL overrides the gateway model
 */

export type ComposeModel = {
  /** Hosted only. The local path does not go through the AI SDK at all — see the
   *  note in lib/compose/ollama.ts. */
  model: LanguageModel | null;
  /** Passed straight to generateObject. Provider-specific and mutually exclusive. */
  providerOptions: Record<string, Record<string, JSONValue>>;
  label: string;
  local: boolean;
  /** Bare model name for the local client, e.g. "qwen3.5:9b". */
  localName: string;
};

/** qwen3.6 ships only at 27b and 35b — roughly 16GB and 21GB at Q4, neither of which
 *  loads on 18GB of unified memory. The default is the largest of its family that
 *  actually runs here. */
const OLLAMA_MODEL = process.env.MISE_OLLAMA_MODEL ?? "qwen3.5:9b";
const GATEWAY_MODEL = process.env.MISE_COMPOSE_MODEL ?? "anthropic/claude-sonnet-5";

export const isLocal = () => (process.env.MISE_PROVIDER ?? "gateway").toLowerCase() === "ollama";

/** A model is available if there is a gateway key, or if we are pointed at a local
 *  server that needs no credentials. Without this the local path silently composes
 *  stubs — the failure mode the env note in lib/env.ts already warns about once. */
export const hasComposeModel = () =>
  isLocal() || Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);

export const composeModel = (): ComposeModel => {
  if (!isLocal()) {
    return {
      model: GATEWAY_MODEL,
      // Arrangement, not judgment — see the note at the call site.
      providerOptions: { anthropic: { thinking: { type: "disabled" } } },
      label: GATEWAY_MODEL,
      local: false,
      localName: ""
    };
  }

  return {
    model: null,
    providerOptions: {},
    label: `ollama/${OLLAMA_MODEL}`,
    local: true,
    localName: OLLAMA_MODEL
  };
};
