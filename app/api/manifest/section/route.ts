import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { manifestSchema } from "@/lib/manifest/load";
import { sections, sliceSection, spliceSection } from "@/lib/manifest/slice";

/**
 * One top-level section of the manifest, in and out.
 *
 * The drawer edits a slice rather than the whole file — 482 lines is not readable
 * at projection distance and the beat only ever touches one section. The splice is
 * done on raw text, so the parts nobody edited come out byte-identical.
 *
 * Validation is on the WHOLE manifest after splicing, not on the slice: a section
 * can be valid in isolation and still break the document.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MANIFEST_PATH = path.join(process.cwd(), "lib/manifest/manifest.json");
const hashOf = (raw: string) => createHash("sha256").update(raw).digest("hex").slice(0, 7);

export const GET = async (req: Request) => {
  const key = new URL(req.url).searchParams.get("key") ?? "obligations";
  const raw = await readFile(MANIFEST_PATH, "utf8");
  const slice = sliceSection(raw, key);
  if (!slice) return NextResponse.json({ error: `no section "${key}"` }, { status: 404 });

  return NextResponse.json(
    { text: slice.text, keys: sections(raw).map((s) => s.key), raw, hash: hashOf(raw) },
    { headers: { "cache-control": "no-store" } }
  );
};

export const PUT = async (req: Request) => {
  const { key, text } = (await req.json()) as { key?: string; text?: string };
  if (!key || typeof text !== "string") {
    return NextResponse.json({ ok: false, error: "need { key, text }" }, { status: 400 });
  }

  const current = await readFile(MANIFEST_PATH, "utf8");

  let next: string;
  try {
    next = spliceSection(current, key, text);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "splice failed" }, { status: 422 });
  }

  /* Two gates, failing differently: JSON.parse says where, the schema says what.
     Neither writes. A malformed manifest on disk takes all three panes down
     mid-take and the recovery is off camera. */
  let json: unknown;
  try {
    json = JSON.parse(next);
  } catch (e) {
    return NextResponse.json(
      { ok: false, kind: "json", error: e instanceof Error ? e.message : "invalid JSON" },
      { status: 422 }
    );
  }

  const parsed = manifestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        kind: "schema",
        error: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"} — ${i.message}`).join("\n")
      },
      { status: 422 }
    );
  }

  await writeFile(MANIFEST_PATH, next, "utf8");
  return NextResponse.json({ ok: true, hash: hashOf(next), raw: next });
};
