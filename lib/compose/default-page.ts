import type { LayoutSpec } from "./compose";

/** The default page may label a group. Composed pages do not — each block carries
 *  its own heading, and a section head the model did not choose would be a design
 *  decision smuggled in by the renderer. */
export type DefaultBlock = LayoutSpec["blocks"][number] & { section?: string };

/**
 * The un-personalised home page. It does two jobs.
 *
 * 1. It is beat 0 — "this is the best home page we can make for everyone, which
 *    is exactly why it is nobody's best home page." So it has to be genuinely
 *    good. If it looks bloated on purpose it is a strawman and the room will
 *    notice.
 * 2. It is the fallback. When a composition cannot be made valid, this renders
 *    instead. Never a half-valid layout.
 *
 * Hand-authored by a person, in advance, which is the point: it is what every
 * visitor gets when nothing is known about them. It uses no household signal, and
 * it is deliberately fixed — this is the artifact the composed pages are measured
 * against.
 *
 * Worth recording: the first draft of this page broke the manifest's own adjacency
 * rule — it put SkillPrimer next to TonightShortlist, which the manifest forbids.
 * A human wrote it, validation caught it, and the composer would never have been
 * allowed to make that mistake in the first place. That is the argument in
 * miniature and it happened by accident.
 */
export const defaultPageSpec = (): LayoutSpec & { blocks: DefaultBlock[] } => ({
  blocks: [
    // Leads with the dish, not with an editorial aside. A one-line seasonal note
    // opening the page reads as a stray sentence; it closes the page instead.
    { component: "RecipeCard", treatment: "hero", recipeIds: ["041"], axes: [], emphasis: [] },
    {
      component: "TonightShortlist",
      treatment: "collapsed",
      recipeIds: ["040", "039", "037"],
      axes: [],
      emphasis: []
    },
    {
      component: "WhyThisWorks",
      treatment: "collapsed",
      recipeIds: ["041", "039", "035"],
      techniqueTag: "browning",
      axes: [],
      emphasis: []
    },
    // Three collapsed cards read as an index when they sit under one heading and
    // as leftovers when they do not.
    { component: "RecipeCard", treatment: "collapsed", recipeIds: ["038"], section: "The index", axes: [], emphasis: [] },
    { component: "RecipeCard", treatment: "collapsed", recipeIds: ["036"], axes: [], emphasis: [] },
    { component: "RecipeCard", treatment: "collapsed", recipeIds: ["034"], axes: [], emphasis: [] },
    { component: "SeasonalNote", treatment: "oneline", recipeIds: [], axes: [], emphasis: [] }
  ],
  rationale: "This is the best home page we can make for everyone."
});
