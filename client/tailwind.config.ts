import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        slate: "#334155",
        mist: "#e2e8f0",
        accent: "#0d9488",
        amber: "#d97706",
        danger: "#dc2626",
      },
      boxShadow: {
        card: "0 10px 32px rgba(15, 23, 42, 0.10)",
      },
      fontFamily: {
        sans: ["'Source Sans 3'", "system-ui", "sans-serif"],
        heading: ["'Merriweather Sans'", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        page:
          "radial-gradient(circle at 10% 10%, rgba(13, 148, 136, 0.12), transparent 35%), radial-gradient(circle at 85% 15%, rgba(14, 165, 233, 0.12), transparent 40%), radial-gradient(circle at 30% 90%, rgba(15, 23, 42, 0.08), transparent 40%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadeInUp: "fadeInUp 0.4s ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
