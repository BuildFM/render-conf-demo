import type { Occasion } from "@/lib/signals/types";

/**
 * The FAST pace layer.
 *
 * The profile is who somebody is and it moves over ninety days. An occasion is what
 * they are doing this fortnight, and then it is gone. Everything here is arithmetic
 * — no model is asked what day it is, what an occasion means, or whether one
 * applies.
 */

/**
 * "Today", for the purposes of the demo.
 *
 * The whole point of the beat is watching one occasion look different at fourteen
 * days out, three days out, and on the morning — which cannot be recorded in real
 * time. `MISE_TODAY` (or `?today=` on the page) moves the clock; unset, it is the
 * real date, which is what a person visiting the site gets.
 *
 * Deliberately NOT stored on the occasion. Writing `daysUntil` into the JSON would
 * make the three moments three fixtures, and the argument is that they are one
 * fixture seen from three distances.
 */
export const effectiveToday = (override?: string): Date => {
  const raw = override ?? process.env.MISE_TODAY;
  const d = raw ? new Date(`${raw}T12:00:00`) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

const DAY = 24 * 60 * 60 * 1000;

/** Whole days from `today` to the occasion. Negative once it is past. */
export const daysUntil = (occasion: Occasion, today: Date): number => {
  const target = new Date(`${occasion.date}T12:00:00`).getTime();
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12).getTime();
  return Math.round((target - from) / DAY);
};

/**
 * The occasion in force for this household right now, or null.
 *
 * Bounded at BOTH ends. It does not exist before it was scheduled, and it stops
 * existing after the date — which is what makes it a layer rather than a setting.
 *
 * **Expiry is the half that makes it a pace layer.** A fast layer that never resets
 * is not a fast layer, it is a preference — so the day after the party the occasion
 * stops being state and the page goes back to being about the cook. Nothing is
 * deleted; it simply stops being true, which is also how the real thing would work.
 */
export const activeOccasion = (
  occasions: Occasion[],
  householdId: string,
  today: Date
): { occasion: Occasion; daysUntil: number } | null => {
  /* Compared at noon on BOTH ends, the way `daysUntil` already does it. Against a
     raw wall clock, an occasion scheduled for today did not exist until 12:00: the
     same URL rendered an ordinary page in the morning and an occasion page after
     lunch, with no scaling and no guest allergen notice in between. A date is a
     day, not an instant. */
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12).getTime();
  const mine = occasions
    .filter((o) => o.householdId === householdId)
    .filter((o) => new Date(`${o.scheduledOn}T12:00:00`).getTime() <= from)
    .map((o) => ({ occasion: o, daysUntil: daysUntil(o, today) }))
    .filter((o) => o.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil);
  return mine[0] ?? null;
};

/** How the occasion is described to the composition call. Prose for a prompt, not
 *  for a page — nothing here reaches a reader. */
export const occasionBrief = (o: Occasion, days: number): string => {
  const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  const avoid = o.avoid.length ? ` One guest cannot eat ${o.avoid.join(" or ")}.` : "";
  return `They are cooking for ${o.guests} people ${when} — ${o.label}.${avoid} This is a one-off occasion, not a change in who they are: it expires after the date and the page goes back to their usual shape.`;
};
