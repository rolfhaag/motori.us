import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Legacy share-page URLs from before the multi-page migration.
      {
        source: "/build/e9-3-0cs.html",
        destination: "/builds/71e9S38B36/",
        permanent: true,
      },
      {
        source: "/builder/mahlzeit-motorsport.html",
        destination: "/builders/mahlzeit-motorsport/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
