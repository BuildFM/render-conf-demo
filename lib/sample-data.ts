import type { Recipe } from "./types"

/* Sample data for app/kit. Not shipped to the demo — the demo composes from real
   records. The last recipe is deliberately sparse: no image, no summary, no
   makeAhead, no forkPoint. Every block must render it without throwing. */

export const brick: Recipe = {
  id: "041",
  title: "Chicken under a brick",
  technique: ["Weighted sear"],
  allergens: [],
  yield: 3,
  activeTime: 35,
  totalTime: 1560,
  image: {
    src: "/images/hero-chicken.png",
    alt: "Chicken under a brick, charred lemon, herb sauce"
  },
  summary:
    "Flattened and pressed, the bird cooks in a single plane — thigh and breast finish in the same minute instead of arguing about it.",
  makeAhead: "Dry-brine, up to 24 hr ahead"
}

export const beans: Recipe = {
  id: "018",
  title: "White beans, long cooked",
  technique: ["Braise"],
  allergens: [],
  yield: 6,
  activeTime: 25,
  totalTime: 180,
  summary:
    "Beans, aromatics and three hours are shared by everyone at the table. Nothing before step six differs, so the pot stays one pot until the last twenty minutes.",
  forkPoint: "Step 6 of 9",
  makeAhead: "Entirely, two days ahead"
}

export const focaccia: Recipe = {
  id: "027",
  title: "Focaccia, cold proof",
  technique: ["Cold proof"],
  allergens: ["Gluten"],
  yield: 8,
  activeTime: 20,
  totalTime: 1500,
  summary: "A wet dough, a cold night in the fridge, and twenty-two minutes of real heat.",
  makeAhead: "Dough, 24 hr ahead",
  season: "All year"
}

export const cacio: Recipe = {
  id: "033",
  title: "Cacio e pepe, properly",
  technique: ["Emulsion"],
  allergens: ["Dairy"],
  yield: 2,
  activeTime: 15,
  totalTime: 15,
  summary:
    "Pecorino, pepper, pasta water and nothing else. The whole dish is one emulsion that either holds or does not."
}

/** The sparse one. Nothing optional is present. */
export const cabbage: Recipe = {
  id: "052",
  title: "Charred cabbage, brown butter",
  technique: ["Dry heat"],
  allergens: ["Dairy"],
  yield: 4,
  activeTime: 20,
  totalTime: 40
}

export const recipes = [brick, beans, focaccia, cacio, cabbage]
