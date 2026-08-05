import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { StageView } from "@/components/stage/stage-view";
import type { Household } from "@/lib/signals/types";

/**
 * The split screen — the spine of the demo.
 *
 * Every other route here shows an output, and outputs are what a personalization
 * engine also produces. This is the only view that shows a cause.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const StagePage = async () => {
  const raw = await readFile(path.join(process.cwd(), "lib/manifest/manifest.json"), "utf8");
  const hash = createHash("sha256").update(raw).digest("hex").slice(0, 7);

  const { households } = JSON.parse(
    await readFile(path.join(process.cwd(), "lib/content/households.json"), "utf8")
  ) as { households: Household[] };

  return (
    <StageView
      households={households.map((h) => ({ id: h.id, label: h.label }))}
      initialRaw={raw}
      initialHash={hash}
      /* Opens on the section the beat edits. No scroll hunting on camera. */
      initialSection="obligations"
    />
  );
};

export default StagePage;
