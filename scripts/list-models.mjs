/**
 * What the gateway actually offers. Model slugs move; the two in .env.example are
 * a best guess until this has been run once against a real key.
 *
 *   node --env-file=.env.local scripts/list-models.mjs
 */
import { gateway } from "ai";

if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
  console.error("No AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN. See .env.example.");
  process.exit(1);
}

const { models } = await gateway.getAvailableModels();
const anthropic = models.filter((m) => m.id.startsWith("anthropic/"));
console.log(`${models.length} models available. Anthropic:\n`);
for (const m of anthropic) console.log(`  ${m.id}`);
