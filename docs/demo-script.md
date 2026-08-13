# How this demo was performed — 7 minutes, four moves

A record of the live demo given inside the RenderATL talk: what was on screen, what
was clicked, and what was said over it. It is kept here because the reasons behind the
sequence are the most useful thing in the repo for anyone building something similar —
why the pages carry the argument and the instruments only explain it, why a move that
is all diagnostics loses a room, and where each beat was measured rather than guessed.

If you are reading this to understand the system rather than to run it,
`docs/STATE.md` is the authority on what the code does and why.

Written in the second person because it started life as a run sheet, and reads better
left that way.

**What it has to land:** a design system is what earns a model the right to compose an
interface. Every move is one step of that, and no move is a feature tour.

The through-line is the **vocabulary strip** — fifteen blocks, in three states. Moves
1 and 2 teach it in full; move 3 spends it, showing only the three counts under two
real pages. **Pages carry the argument, instruments explain it.** If a move is all
instrument, the room has stopped looking at design.

---

## Pre-flight

**Restart the dev server, then warm two pages.** The compose cache is an in-memory
`Map`, so a restart empties it. Load `/h/h-learner` and `/twins` once each and leave
them. Moves 1 and 3 become instant, move 2 stays live, and move 4 is guaranteed live
because the manifest edit changes the hash.

Do **not** run `MISE_NO_CACHE=1`. Right flag for recording, wrong one here — it costs
four seconds of silence on moves 1 and 3 for no gain.

**Check the vocabulary is whole.** `pnpm stage:status` says whether a rehearsal left a
block struck out. It should read *vocabulary — whole*.

**Wifi insurance.** The model calls are the only thing leaving the machine. If the
venue network is bad, `MISE_PROVIDER=ollama` composes 9/9 valid on local models.
Decide before you walk on, not during.

**Windows.** Browser at 1440 wide or more — `/stage` needs it. Have `/` open before
you start.

---

## Move 0 — the ground · 20s

**Screen** `/`

Nothing to do. It should already be up when you start talking.

> This is the home page of a recipe site. A person designed it, in advance, and every
> visitor gets exactly this. Hold on to it — it's the last thing you'll see today that
> somebody drew.

**The job:** a baseline. Without it the room has nothing to measure the composed pages
against.

---

## Move 1 — the page · 90s

**Screen** `/h/h-learner`

Navigate. Let it sit before you say anything — the page has to be read before it is
explained.

> Same site. One household, ninety days of cooking history behind it.

*(beat — let them look)*

> It's a recipe site. There is no recipe on this page.

*(let that sit — the strongest three seconds in the demo)*

> Somebody who abandons long ingredient lists and has never once repeated a dish
> doesn't need another dish. They need the technique. Nobody wrote that as an
> if-statement. Let me show you what did it.

**Scroll to the strip.**

> This is the vocabulary. Fifteen blocks — everything this site is capable of putting
> on a page. A person wrote those fifteen. The model cannot invent a sixteenth.
>
> Three columns. Read the numbers.
>
> Seven were never offered. A gate said no, in code, before the model was asked
> anything — and it tells you which gate.

**Read one chip in the first column out loud, verbatim.** "needs user dot expands
technique equals true". The machine's own words beat any paraphrase.

> Five it was shown and passed over. Three it used.
>
> So of fifteen blocks, the model got a say over eight of them and used three. Those
> two columns on the right are the whole of its authority. Everything on the left had
> already been decided.

*(The counts are the point — nobody has to read a chip to see the shape of it.)*

**The job:** turn "these pages are different" from a claim into a fact the room can
count. Everything after this depends on the three states being understood.

---

## Move 2 — the gate · 100s

**Screen** same page, scrolled to the switches at the foot of the strip.

> These five are things this household *did*. Not things they told us — every one of
> them computed from ninety days of log.
>
> This one says they open the technique notes. Let me say they don't.

**Click "Opens the technique notes".**

> That's a live model call, running now.

*(4–6s. Do not fill it with apology. The wait is proof it is happening.)*

It lands. The columns visibly rebalance — **7 / 5 / 3 becomes 11 / 1 / 3** — and the
page now opens on a recipe.

> Two different things just happened, and they are not the same kind of thing.
>
> Seven became eleven. Four blocks moved into the left-hand column. That's code —
> it's arithmetic, it took a hundred milliseconds, and it would work with the wifi
> off.
>
> And *then* the model built a page out of what was left.
>
> And look what it had to build — this household just got a recipe on their home page.
> Take away the one thing we actually learned about them, and they get the page
> everybody with no history gets.

**Glance back at move 0 if you can — it is the same dish, at the same size.**

> Look familiar? That's the page I opened with. The one a person had to draw, because
> the system knew nothing about anybody.
>
> The order is the whole design. The design system gets to say no first. The model
> only ever chooses from what survived.

*(This page looks thin next to the one before it. That is the point rather than a
fault: there is nothing left to say about this household, so the page doesn't say
much. Say so — it is the whole argument in one sentence.)*

> ⚠ **Check before you use the callback.** With every lead gated out, the opening
> block is whichever support block the model gives `hero` to — usually `RecipeCard`,
> which is the same block and the same dish the hand-authored home page opens on. If
> it came out on the comparison table instead, skip the callback and keep the
> "everybody with no history" line, which is true either way.

**Point at the rail** — `profile: withheld — facts overridden`.

> It also noticed I was lying about this person, and withheld the profile. It won't
> write a claim about somebody who doesn't exist.

> ⚠ **End this move on the composition.** Toggles-then-blocks is exactly what a rules
> engine looks like, and that is the strongest competing explanation for the whole
> talk. Flip the switch, get the reaction at the chips moving, and move on without
> saying *"and then the model made a page out of what was left"* — and you have demoed
> a rules engine to a room of people looking for a reason to call it one.

**The job:** make the code half tangible, and pre-empt "isn't this a rules engine?" by
showing the model working *after* the rules ran.

---

## Move 3 — the proof · 75s

**Screen** `/twins`

> Two households. Same form at signup — same size, same diet, same stated skill, the
> same nine things in the pantry. Byte for byte identical.

**Point at the declared panel, then let them look at the two pages.**

*(beat — this is the one moment the room works instead of you. Two pages, side by
side, obviously not the same page.)*

> One of them opens on a dish that splits two ways. The other opens on a schedule.
> Nobody wrote a template for either of these people.

**Point at the line above the pages.**

> They qualify for the same *number* of blocks — six of fifteen each. Not the same
> six.
>
> And underneath each page is why: not what they told us, what they did.

**Read the how-many-differ number off the screen, don't say one from here.** The page
computes it live, and the model's support choices move it between runs.

Optional, and the best answer to the question you will otherwise get in Q&A:

> If you're thinking this is personalisation — personalisation has one of these
> panels. This has three, and the model is on the weaker side of the split.

**The job:** kill the "it's just personalisation" reading with declared-versus-derived,
rather than by arguing.

---

## Move 4 — the ending · 115s

**Screen** `/stage`

> Manifest on the left — the actual file, read off disk on every request, not a build
> artifact. Same two pages on the right.
>
> I'm going to take a block out of the vocabulary.

**Click the square beside `ForkedRecipeCard`** — the row dims, strikes through and
reads `REMOVED`. **Then ⌘S.**

> Two model calls, running now.

*(~10s, both live. Narrate the rail — every count moves and the arrows read from the
back.)*

> Twin A's page was built around that block. There is no template for "what if the
> fork is gone", because nobody wrote one. The vocabulary changed and the page
> reorganised itself.

**If Twin A's `obligations` went UP, point at it — it is the best thing in the demo.**

> And look: it didn't just lose a block. There are *more* allergy warnings on that
> page than there were a second ago. Different dishes are on it now, and the warnings
> follow the dishes — nobody decided that either.
>
> That's the part you can't fake. Any *single* page I've shown you, you could
> reverse-engineer into an if-statement. This you can't.

Struck the wrong one? Click it again — it is a toggle and nothing is deleted.

| What should move | vocabulary |
|---|---|
| Twin A | 6/15 → 5/14 |
| Twin B | 6/15 → 6/14 |

Twin A's `obligations` count often rises as well, because the dishes on the page
change and the warnings follow the dishes. It does not do it every run — check the
rail before you point at it.

The learner is deliberately not on this board. Its page does not change when a block
is struck — `blocks 3/3` before and after — so a third pane would sit perfectly still
while its neighbours moved, which on a stage reads as *did that one fail?* Two panes
are also 890px each against three at 578px, which is the difference between seeing
that a page changed and seeing what it changed into.

**The job:** the only move that cannot be explained away. It gets the most time for
that reason.

---

## Close · 20s

> Two cents a page. About four seconds. Eight of the ten steps that built it were
> code, and one was a model — and the design system is what made that one step safe
> enough to allow.

Re-run `scripts/cost.mjs` a few times and settle on the figure before you say it.

---

## If it breaks

| What | Say | Then |
|---|---|---|
| Rail reads `fallback: DEFAULT PAGE` | "That's the system refusing to show you a half-valid page. It would rather serve the hand-authored one." | Reload. It is a real property, not a save. |
| A compose hangs past ~15s | Keep talking about the strip — it is already on screen and needs no model. | Reload once, then go to clips. |
| Network is gone | — | `MISE_PROVIDER=ollama`, decided in advance. Otherwise clips. |
| A page looks wrong after the finale | "The vocabulary changed, so the pages did." | Only if it *is* true. Check the rail before claiming it. |
| Anything unrecoverable | — | Clips. Do not debug in front of the room. |

Every state in moves 1–3 is a URL. If a click misfires, type the address — that is
what `?facts=` being in the query string bought you. `/start` lists them all in
performance order.

---

## Do not say

- **"The user profile."** The data panel and the fact rows read as a CRM record the
  moment you name them that way, which makes it look *more* like personalisation, not
  less. Lead with the identical declared block, then the divergent derived facts.
- **"The AI decides what you see."** It decides ordering and depth inside a permitted
  set. Overstating it hands away the whole argument.
- **"Prompt."** There is no text box anywhere in this demo and nobody types at a
  model. Saying the word puts one in the room's head.

---

## Cutting to five minutes

Drop in this order:

1. **The personalisation line in move 3** (−15s). Save it for Q&A.
2. **Move 0** (−20s). Costs the baseline; survivable if a slide already showed the
   home page.
3. **Move 2's rail callout** — the withheld profile (−20s). Subtlest point in the demo
   and the first thing a rushed room will not follow.
4. **Move 1's chip reading** — name the three states without reading one aloud (−25s).

Do not cut move 4. Do not cut the pause after "there is no recipe on this page."
