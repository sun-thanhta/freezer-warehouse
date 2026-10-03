import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the project root: a stray lockfile higher up (e.g. in $HOME) would otherwise be picked as the root.
  turbopack: { root: path.resolve(".") },
};

export default nextConfig;
