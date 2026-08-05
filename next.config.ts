import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* The dev-mode Next badge sits in the bottom-left corner, which is inside the
     recording frame. Nothing that is not part of the system is allowed in shot. */
  devIndicators: false
};

export default nextConfig;
