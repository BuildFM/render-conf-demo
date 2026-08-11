import type { Facts } from "./gates";

/**
 * WHAT IF THEY HAD DONE SOMETHING ELSE.
 *
 * A small set of behavioural facts that can be overridden from the URL, so the
 * vocabulary strip can be driven live: flip one, watch half the vocabulary grey out
 * or light up, with no model call and no rebuild. Eligibility is pure code, so this
 * is instant and it cannot fail — which is the point. The beat it exists for is
 * "here is the part the model never touches", and a beat that depends on a network
 * round trip is a beat that can die on conference wifi.
 *
 * Query params rather than client state, deliberately. The composed pages have no
 * client JavaScript in them and that property is load-bearing for the argument; a
 * toggle that needed `useState` would put the first client component on the page
 * whose server-rendered purity is the claim. The cost is a round trip per flip,
 * which is around 100ms with no model involved. The gain, beyond the property, is
 * that EVERY STATE IS A URL — so a take can be recorded against exact states, and a
 * live demo that goes wrong can be rescued by typing one.
 *
 * `?facts=technique:0,repeats:1`
 */

export type Toggle = {
  /** The key in the facts map. Must be a LEAF — see the note below. */
  fact: string;
  /** Short name for the URL. Unique across this list, and PLAIN: it goes in the
   *  address bar, and the address bar is on a projector. */
  slug: string;
  /**
   * WHAT THE PERSON DID, in a reader's words.
   *
   * Subject to the copy rule: a label has to decode in one second, from the back of
   * a room, over the top of somebody talking. Plain English, no metaphor, no internal
   * vocabulary. These were written the other way first — "Cooks on a rhythm", "Cooks
   * dishes that fork", "Pantry on file" — and every one of them named the mechanism
   * instead of the behaviour. "Fork" is a word this codebase made up; "rhythm" is a
   * word for a conjunction of two facts that the reader cannot see; "on file" is a
   * database talking about itself.
   *
   * The chips underneath print the raw predicate (`needs user.expandsTechnique =
   * true`) and that is deliberate — those are the machine's own words and their being
   * the machine's own words is the point. This layer is the human one. Do not let it
   * drift back toward the other.
   */
  label: string;
  on: boolean | number;
  off: boolean | number;
};

/**
 * ONLY LEAF FACTS ARE OVERRIDABLE, and the constraint is not cosmetic.
 *
 * `computeFacts` derives several facts from the same profile signals — `user.hasRhythm`,
 * `state.planningPressure` and `state.makeAheadPressure` all read `makeAheadPattern`.
 * Overriding a fact that others are derived from would move one and leave the rest
 * stale, so the strip would show a household that opens technique notes and a
 * make-ahead callout that disagreed about why. Every fact below is read by
 * preconditions and by nothing else in the map, so overriding it is coherent.
 *
 * `user.makeAheadPattern` and `user.abandonsOnListLength` are deliberately absent
 * for exactly this reason. If either is ever wanted here, the override has to move
 * up into the profile signals and let `computeFacts` run again.
 *
 * Five, not fifteen. A panel of switches reads as a control room, and the reading
 * this beat has to survive is "so it's a rules engine" — which a long enough list of
 * toggles argues FOR. These are chosen for how many chips they move.
 *
 * EVERY ONE IS A `user.*` FACT, and that is not a coincidence.
 *
 * The panel is headed "what this household did", and it used to carry
 * `state.dietarySplit` and `state.pantryKnown` — both of which come straight off
 * `household.declared`, the signup form. They are things the household SAID. Putting
 * them under that heading contradicted the one distinction the whole demo is built
 * on, on the panel the room is looking at while you draw it. Declared versus derived
 * is the argument; it cannot be muddled here of all places.
 *
 * So the declared two are gone. What is left is every behavioural leaf fact that any
 * precondition actually reads — there is no sixth, because the remaining `user.*`
 * facts (`savedNeverCooked`, `repeats`) gate nothing and a switch that moves no chip
 * is a switch that teaches the room the switches do nothing.
 */
export const TOGGLES: Toggle[] = [
  /* The big one: five blocks need it and a sixth needs it false. */
  { fact: "user.expandsTechnique", slug: "technique", label: "Opens the technique notes", on: true, off: false },
  { fact: "user.hasRhythm", slug: "repeats", label: "Repeats dishes and cooks ahead", on: true, off: false },
  /* `on` MUST BE THE THRESHOLD THE PRECONDITION ASKS FOR, not a comfortably large
     number. It is read twice — to force the fact, and by `toggleState` to decide
     which way the switch is currently pointing — so a numeric toggle set to 10
     against a gate that wants 2 shows OFF for a household with 4, beside a chip that
     is plainly eligible. Twin B did exactly that. */
  { fact: "user.cookedOfComparable", slug: "cooked", label: "Has cooked two of these dishes", on: 2, off: 0 },
  { fact: "user.cooksForkingDishes", slug: "twoWays", label: "Cooks dishes that go two ways", on: 2, off: 0 },
  { fact: "user.abandonedOrRepeated", slug: "gaveUp", label: "Gave up on a dish, or cooked one twice", on: 1, off: 0 }
];

const BY_SLUG = new Map(TOGGLES.map((t) => [t.slug, t]));

/** slug -> whether it is forced on. Absent means "leave the real fact alone". */
export type Overrides = Map<string, boolean>;

export const parseOverrides = (param: string | undefined): Overrides => {
  const out: Overrides = new Map();
  if (!param) return out;
  for (const piece of param.split(",")) {
    const [slug, value] = piece.split(":");
    if (!BY_SLUG.has(slug)) continue;
    out.set(slug, value === "1" || value === "true");
  }
  return out;
};

export const serializeOverrides = (o: Overrides): string =>
  [...o.entries()].map(([slug, on]) => `${slug}:${on ? 1 : 0}`).join(",");

/** The facts map with the overrides applied on top. Pure — the original is untouched
 *  so anything that wants the household as it really is can still ask. */
export const applyOverrides = (facts: Facts, o: Overrides): Facts => {
  if (o.size === 0) return facts;
  const out = { ...facts };
  for (const [slug, on] of o) {
    const t = BY_SLUG.get(slug)!;
    out[t.fact] = on ? t.on : t.off;
  }
  return out;
};

/** Is this toggle currently on — from the override if there is one, otherwise from
 *  what the household actually did. Rendered as the switch's position, so the panel
 *  opens showing the truth rather than showing everything off. */
export const toggleState = (t: Toggle, facts: Facts, o: Overrides): boolean => {
  const forced = o.get(t.slug);
  if (forced !== undefined) return forced;
  const actual = facts[t.fact];
  return typeof actual === "boolean" ? actual : Number(actual) >= Number(t.on);
};

/** The override set with one toggle flipped. Used to build each switch's href. */
export const flipped = (t: Toggle, facts: Facts, o: Overrides): Overrides => {
  const next = new Map(o);
  next.set(t.slug, !toggleState(t, facts, o));
  return next;
};
