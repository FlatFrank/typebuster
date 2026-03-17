/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  output: "export",
  basePath: isProd ? "/typebuster" : "",
  assetPrefix: isProd ? "/typebuster/" : "",
  distDir: isProd ? "out" : ".next-dev",
  devIndicators: false,
  typedRoutes: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: isProd ? "/typebuster" : ""
  }
};

export default nextConfig;
