/* Display formatting. Blocks receive resolved values, so the only formatting
   left is the two numeric fields on Recipe. */

/** 35 -> "35 min" · 180 -> "3 hr" · 1560 -> "26 hr" · 200 -> "3 hr 20" */
export const formatMinutes = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest}`
}

/** 3 -> "Serves 3". Yield is a household number, never a range in the data. */
export const formatYield = (people: number): string => `Serves ${people}`

/** 0 -> "Nothing" · 1 -> "One item" · 2 -> "Two items" · n -> "5 items" */
const WORDS = ["Nothing", "One item", "Two items", "Three items", "Four items"]
export const formatShortfall = (count: number): string =>
  WORDS[count] ?? `${count} items`
