import type { NextConfig } from "next";

const config: NextConfig = {
  // The console reads the chain from the browser. There is no server of its
  // own to configure, and deliberately no API route that could become the
  // adjudicator.
  reactStrictMode: true,
};

export default config;
