import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Noto Sans Thai", "Tahoma", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
