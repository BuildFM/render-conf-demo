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
      /* Opens on the vocabulary — the fifteen blocks — because that is what the
         manifest IS, and it reads as a list rather than as a file. The beat that
         edits `obligations` is one click away; before, the drawer opened mid-file
         on the section being typed into, which showed the demo's punchline first. */
      initialSection="components"
    />
  );
};

export default StagePage;
