/**
 * Composition latency, per model. The build spec claims this call is fast and cheap
 * and says so on stage; that claim needs to survive measurement.
 *
 *   node --env-file=.env.local scripts/bench-compose.mjs
 */
if (!process.env.AI_GATEWAY_API_KEY && process.env.VERCEL_AI_GATEWAY_API_KEY) {
  process.env.AI_GATEWAY_API_KEY = process.env.VERCEL_AI_GATEWAY_API_KEY;
}
const { generateObject } = await import("ai");
const { z } = await import("zod");

const schema = z.object({
  blocks: z.array(
    z.object({
      component: z.string(),
      treatment: z.enum(["full", "collapsed", "oneline"]),
      recipeIds: z.array(z.string()).default([])
    })
  ),
  rationale: z.string()
});

const prompt = `
Compose a home page from this vocabulary. Choose which blocks appear, in what
order, at what depth, and which recipes go in them.

VOCABULARY
TechniqueThread — attempts at one technique, in order. full/collapsed. max 1.
ComparisonTable — 3-5 dishes on chosen axes. full/collapsed. max 1.
RecipeCard — one dish. full/collapsed/oneline. max 4.
SkillPrimer — fundamentals on one technique. full/collapsed. max 1.
TroubleshootingList — symptom, cause, fix. full/collapsed. max 1.
PrepSchedule — work across days. full/collapsed. max 1.

CONTENT
041 Chicken under a brick — weighted-sear; 35 min
032 Cabbage, weighted — weighted-sear; 15 min
033 Flattened quail — weighted-sear; 25 min
034 Pressed pork belly — weighted-sear; 30 min
038 White beans, long cooked — braise; 15 min
036 Focaccia, cold proof — ferment; 20 min

HOUSEHOLD
Cooks alone twice a week. Every dish finished is weighted-sear. Reads the
technique note before cooking, every time.

RULES: at most 7 blocks, at most 2 at "full". Rationale: one sentence, an
inference, under 25 words.
`;

const models = [
  ["anthropic/claude-sonnet-5", undefined],
  ["anthropic/claude-sonnet-5", { anthropic: { thinking: { type: "disabled" } } }],
  ["anthropic/claude-haiku-4.5", undefined],
  ["anthropic/claude-sonnet-4.5", undefined]
];

for (const [model, providerOptions] of models) {
  const label = `${model}${providerOptions ? " (thinking off)" : ""}`;
  try {
    const t = Date.now();
    const { object, usage } = await generateObject({
      model, schema, temperature: 0, prompt,
      ...(providerOptions ? { providerOptions } : {})
    });
    const ms = Date.now() - t;
    console.log(
      `${label.padEnd(46)} ${String(ms).padStart(6)}ms  in=${usage?.inputTokens ?? "?"} out=${usage?.outputTokens ?? "?"}  blocks=${object.blocks.length}`
    );
  } catch (e) {
    console.log(`${label.padEnd(46)}  FAILED  ${String(e.message).slice(0, 70)}`);
  }
}
