import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { manifestSchema } from "@/lib/manifest/load";

/**
 * The manifest, over HTTP, so the stage view can edit the real file.
 *
 * This exists for one beat: the room watches a change to the vocabulary propagate
 * across three households with no template written. Editing in the app rather than
 * in an editor keeps cause and effect inside one capture region — no window
 * switching in frame.
 *
 * PUT parses before it writes. A malformed manifest reaching disk takes all three
 * panes down mid-take, and the recovery is off-camera. A parse failure returns the
 * error and the file is untouched.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MANIFEST_PATH = path.join(process.cwd(), "lib/manifest/manifest.json");

const hashOf = (raw: string) => createHash("sha256").update(raw).digest("hex").slice(0, 7);

export const GET = async () => {
  const raw = await readFile(MANIFEST_PATH, "utf8");
  return NextResponse.json({ raw, hash: hashOf(raw) }, { headers: { "cache-control": "no-store" } });
};

export const PUT = async (req: Request) => {
  const { raw } = (await req.json()) as { raw?: string };
  if (typeof raw !== "string") {
    return NextResponse.json({ ok: false, error: "no manifest body" }, { status: 400 });
  }

  /* Two gates, and they fail differently. JSON.parse tells you where; the schema
     tells you what. Both are worth reporting verbatim — this pane is the only
     place the error is visible. */
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "invalid JSON", kind: "json" },
      { status: 422 }
    );
  }

  const parsed = manifestSchema.safeParse(json);
  if (!parsed.success) {
    const error = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"} — ${i.message}`)
      .join("\n");
    return NextResponse.json({ ok: false, error, kind: "schema" }, { status: 422 });
  }

  await writeFile(MANIFEST_PATH, raw, "utf8");
  return NextResponse.json({ ok: true, hash: hashOf(raw) });
};
