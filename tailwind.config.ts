import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#F6EFE1",
        stage: "#06070A",
        panel: "#101319",
        accent: "#8EF189",
        electric: "#6CE7F8",
        hot: "#FF8E5E"
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.08), 0 25px 80px rgba(0,0,0,0.55)",
        neon: "0 0 40px rgba(108,231,248,0.16)"
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};

export default config;
