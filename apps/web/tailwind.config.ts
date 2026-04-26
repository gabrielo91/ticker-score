import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        darkscore: {
          bg: "#08090d",
          card: "#12141a",
          border: "#1e2028"
        },
        text: {
          primary: "#f0f0f0",
          muted: "#8a8f98"
        },
        accent: {
          green: "#00dc82",
          red: "#ff4757",
          amber: "#ffc107",
          blue: "#3b82f6",
          cyan: "#06b6d4"
        }
      },
      fontFamily: {
        mono: [
          "var(--font-jetbrains-mono)",
          "JetBrains Mono",
          "ui-monospace",
          "monospace"
        ],
        sans: [
          "var(--font-dm-sans)",
          "DM Sans",
          "ui-sans-serif",
          "system-ui",
          "sans-serif"
        ]
      },
      borderRadius: {
        card: "12px"
      }
    }
  },
  plugins: []
};

export default config;
