# The demo, as performed — 7 minutes, four moves

The run sheet for the live demo inside the RenderATL talk: what is on screen, what you
do, and what you say. `docs/STATE.md` is authority on what the code does and why it is
built the way it is; this file stays a script.

**What it has to land:** a design system is what earns a model the right to compose an
interface. Every move is one step of that, and no move is a feature tour.

The through-line is the **vocabulary strip** — sixteen blocks, in three states. It is
on screen in three of the four moves, and it is the only object the room tracks from
beginning to end.

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

> This is the vocabulary. Sixteen blocks — everything this site is capable of putting
> on a page. A person wrote those sixteen. The model cannot invent a seventeenth.
>
> Three states. Grey means it wasn't eligible — and it tells you why.

**Read one grey chip out loud, verbatim.** "needs user dot expands technique equals
true". The machine's own words beat any paraphrase.

> That was decided in code, before the model was asked anything.
>
> Outlined means the model was offered it and passed. Yellow means it's on the page.
>
> Nine of sixteen were offered. Three are on the page. That gap — outlined to yellow —
> is the entire amount of authority the model has here.

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

It lands: the vocabulary halves, **9 of 16 down to 5**, and the page now opens on a
recipe.

> Two different things just happened, and they are not the same kind of thing.
>
> Five blocks went grey. That's code. It's arithmetic, it took a hundred
> milliseconds, and it would work with the wifi off.
>
> And *then* the model built a page out of what was left.
>
> And look what it had to build — this household just got a recipe on their home page.
> Take away the one thing we actually learned about them, and they get the page
> everybody with no history gets.
>
> The order is the whole design. The design system gets to say no first. The model
> only ever chooses from what survived.

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

**Point at the declared panel, then move down to the fact rows.**

> Here is what they have each actually done since. Not the same.
>
> Same sixteen blocks, same order, twice. Look straight down.

*(let them scan — the one moment the room works instead of you)*

> Six differ. And nobody wrote a template for either of these people.

Optional, and the best answer to the question you will otherwise get in Q&A:

> If you're thinking this is personalisation — personalisation has one of these
> panels. This has three, and the model is on the weaker side of the split.

**The job:** kill the "it's just personalisation" reading with declared-versus-derived,
rather than by arguing.

---

## Move 4 — the ending · 115s

**Screen** `/stage`

> Manifest on the left — the actual file, read off disk on every request, not a build
> artifact. Three composed pages on the right.
>
> I'm going to take a block out of the vocabulary.

**Click the square beside `ForkedRecipeCard`** — the row dims, strikes through and
reads `REMOVED`. **Then ⌘S.**

> Three model calls, running now.

*(~15s, all three live. Narrate the rail — every count moves and the arrows read from
the back.)*

> Twin A's page was built around that block. There is no template for "what if the
> fork is gone", because nobody wrote one. The vocabulary changed and the page
> reorganised itself.

**Then the thing worth waiting for — point at Twin A's `obligations 2 → 3`.**

> And look: it didn't just lose a block. There are *more* allergy warnings on that
> page than there were a second ago. Different dishes are on it now, and the warnings
> follow the dishes — nobody decided that either.
>
> That's the part you can't fake. Any *single* page I've shown you, you could
> reverse-engineer into an if-statement. This you can't.

Struck the wrong one? Click it again — it is a toggle and nothing is deleted.

| What should move | vocabulary | and |
|---|---|---|
| The learner | 9/16 → 9/15 | — |
| Twin A | 7/16 → 6/15 | `obligations 2 → 3`, `blocks 3/3 → 4/4` |
| Twin B | 7/16 → 7/15 | — |

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
