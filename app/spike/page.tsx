import { loadManifest } from "@/lib/manifest/load";

// Both are required for the manifest to be re-read per request.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Day-1 spike. Proves the one thing the demo's final beat depends on:
 * editing lib/manifest/manifest.json changes this page on refresh, with no rebuild.
 *
 * Delete once the real composed route exists.
 */
const SpikePage = async () => {
  const manifest = await loadManifest();
  const readAt = new Date().toISOString();

  return (
    <main style={{ fontFamily: "ui-monospace, monospace", padding: 40, lineHeight: 1.7 }}>
      <h1>manifest reload spike</h1>
      <p>
        version <b>{manifest.version}</b> · hash <b>{manifest.hash}</b> · read at {readAt}
      </p>
      <p>
        {manifest.components.length} permissions · {manifest.obligations.length} obligations ·{" "}
        {manifest.assemblies.length} assemblies
      </p>
      <ul>
        {manifest.components.map((c) => (
          <li key={c.name}>
            <b>{c.name}</b> — {c.intent}
          </li>
        ))}
        {manifest.obligations.map((o) => (
          <li key={o.name}>
            <b>{o.name}</b> — required when: {o.requiredWhen}
          </li>
        ))}
      </ul>
      <p>Edit lib/manifest/manifest.json and refresh. The hash must change.</p>
    </main>
  );
};

export default SpikePage;
