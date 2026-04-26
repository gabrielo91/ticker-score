import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        darkscore: {
          bg: "var(--darkscore-bg)",
          card: "var(--darkscore-card)",
          border: "var(--darkscore-border)"
        },
        text: {
          primary: "var(--text-primary)",
          muted: "var(--text-muted)"
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
