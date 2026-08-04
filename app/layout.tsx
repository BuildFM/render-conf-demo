import type { ReactNode } from "react"
import "./tokens.css"

export const metadata = {
  title: "Mise",
  description: "Everything in its place."
}

/** The only place tokens.css is imported. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
