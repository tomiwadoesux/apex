import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Random web photos used as the service backdrops are served from picsum.
    // Its URLs 302 to a fastly CDN; Next follows that redirect without needing
    // the redirect host allow-listed, so picsum.photos alone is enough.
    remotePatterns: [new URL("https://picsum.photos/**")],
  },
};

export default nextConfig;
