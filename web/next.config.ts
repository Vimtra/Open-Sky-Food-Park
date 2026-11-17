import os from "node:os";
import path from "node:path";
import type { NextConfig } from "next";

// This PC's LAN addresses, so phones and laptops on the same Wi-Fi can use the dev server.
// Read at startup, so a new address after a router change only needs a server restart.
const lanAddresses = Object.values(os.networkInterfaces())
  .flat()
  .filter((a): a is os.NetworkInterfaceInfo => Boolean(a && a.family === "IPv4" && !a.internal))
  .map((a) => a.address);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: lanAddresses,
  turbopack: {
    // The repo root also has a package.json (shared tooling); this app's root is web/.
    root: path.resolve(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
