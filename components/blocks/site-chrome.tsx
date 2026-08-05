import { Masthead } from "@/components/layout/masthead"

type SiteChromeProps = {
  /** Which nav item is current. */
  active?: string
  /** "Week 30 · Tue" */
  stamp?: string
  recipeCount?: number
}

const NAV = [
  { label: "Home", href: "/" },
  { label: "Prep", href: "/prep" },
  { label: "Pantry", href: "/larder" },
  { label: "Technique", href: "/technique" },
  { label: "Index", href: "/index" }
]

/** Invariant. Identical position on every composition, always — it is the fixed
 *  point that makes the rest of the page legible as varying. Takes no treatment
 *  and the model is never asked about it. */
export const SiteChrome = ({ active = "Home", stamp, recipeCount = 41 }: SiteChromeProps) => (
  <Masthead
    items={NAV.map((item) => ({ ...item, active: item.label === active }))}
    stamp={stamp}
    search={{ placeholder: `Search ${recipeCount} recipes`, action: "/search" }}
  />
)
