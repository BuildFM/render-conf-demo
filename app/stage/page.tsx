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

  /**
   * THE TWINS ONLY. The learner is not on this board.
   *
   * Three panes were 578px wide against a 1180px design canvas — a scale of 0.49,
   * which is enough to see that a page changed and not enough to see what it changed
   * into. Two are 890px, or 0.75, and the difference is whether a table is a texture
   * or a table.
   *
   * The learner also earned its place off it. Striking a block from the vocabulary
   * moves its rail (`vocabulary 9/16 → 9/15`) and does not move its page — `blocks
   * 3/3` before and after — so the finale had one pane reorganising, one changing a
   * little, and one sitting perfectly still. On a stage that third pane does not read
   * as "unaffected", it reads as "did that one fail?".
   *
   * And it buys continuity: these are the same two pages the twins view shows, so by
   * the time the manifest is edited the room has already spent a minute learning what
   * they look like, and any change is measured against something it knows.
   */
  const board = households.filter((h) => h.id !== "h-learner");

  return (
    <StageView
      households={board.map((h) => ({ id: h.id, label: h.label }))}
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
