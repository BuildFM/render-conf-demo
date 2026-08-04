/**
 * The AI SDK reads AI_GATEWAY_API_KEY. Vercel's dashboard and several of its docs
 * call the same value VERCEL_AI_GATEWAY_API_KEY, so a key pasted from there lands
 * under a name nothing reads and the app falls back to stubs with no obvious cause.
 *
 * Normalise once, at import, rather than debugging it twice.
 */
if (!process.env.AI_GATEWAY_API_KEY && process.env.VERCEL_AI_GATEWAY_API_KEY) {
  process.env.AI_GATEWAY_API_KEY = process.env.VERCEL_AI_GATEWAY_API_KEY;
}

export const hasGatewayKey = () =>
  Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
