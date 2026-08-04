/** What the gateway actually offers. Slugs move; do not trust a hardcoded guess.
 *    node --env-file=.env.local scripts/list-models.mjs */
if (!process.env.AI_GATEWAY_API_KEY && process.env.VERCEL_AI_GATEWAY_API_KEY) {
  process.env.AI_GATEWAY_API_KEY = process.env.VERCEL_AI_GATEWAY_API_KEY;
}
const { gateway } = await import("ai");
const { models } = await gateway.getAvailableModels();
const anth = models.filter((m) => m.id.startsWith("anthropic/"));
console.log(`${models.length} models available. Anthropic:\n`);
for (const m of anth) console.log("  " + m.id);
