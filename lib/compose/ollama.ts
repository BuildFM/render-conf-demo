import { z } from "zod";

/**
 * Ollama, through its NATIVE /api/chat rather than its OpenAI-compatible shim.
 *
 * The shim looked like the tidier choice and is the wrong one here. On Ollama 0.7.1
 * `/v1/chat/completions` silently ignores both `think: false` and
 * `chat_template_kwargs.enable_thinking` — a hybrid-reasoning model spends its whole
 * token budget in the `reasoning` field, returns `content: ""`, and the SDK reports
 * "No object generated: the model did not return a response." Nothing in that error
 * points at thinking, which is what makes it worth writing down.
 *
 * The native endpoint honours `think` and takes a JSON Schema in `format` for
 * grammar-constrained decoding, which is strictly better than asking politely for
 * JSON. Verified on all three models.
 *
 * Small enough to read in one sitting, which is the point — this is the layer the
 * demo's whole argument rests on, and a provider package would hide it.
 */

const HOST = (process.env.MISE_OLLAMA_URL ?? "http://localhost:11434").replace(/\/v1\/?$/, "");

/** The compose prompt is ~3k tokens and older Ollama defaults to a 4k window, which
 *  truncates the vocabulary silently — the model then composes from whatever survived
 *  and the failure looks like stupidity rather than a config value. */
const NUM_CTX = Number(process.env.MISE_OLLAMA_CTX ?? 8192);

export const generateLocalObject = async <T>({
  model,
  prompt,
  schema
}: {
  model: string;
  prompt: string;
  schema: z.ZodType<T>;
}): Promise<T> => {
  const res = await fetch(`${HOST}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      /* The same decision as disabling extended thinking on Sonnet. This call
         arranges blocks inside a manifest; the judgment happened in the nightly
         profile call. Harmless on models that have no thinking mode. */
      think: false,
      messages: [{ role: "user", content: prompt }],
      format: z.toJSONSchema(schema),
      options: { temperature: 0, num_ctx: NUM_CTX }
    })
  });

  if (!res.ok) {
    throw new Error(`ollama ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const body = (await res.json()) as { message?: { content?: string; thinking?: string } };
  const content = body.message?.content;

  if (!content) {
    /* Almost always thinking that was not disabled, or a context window too small to
       leave room for output. Say so, rather than letting a generic parse error send
       the next person hunting through the prompt. */
    throw new Error(
      `ollama returned no content${body.message?.thinking ? " (it returned thinking instead — `think:false` was not honoured)" : ""}`
    );
  }

  return schema.parse(JSON.parse(content));
};
