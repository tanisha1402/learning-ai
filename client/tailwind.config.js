/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Palette taken from the AIgnite Buildathon sticker.
        ink: { DEFAULT: "#2c144e", hover: "#3f1d70" },
        violet: { DEFAULT: "#6b3184", soft: "#8a4aa8" },
        coral: { DEFAULT: "#fe714f", deep: "#c2410c" },
        lilac: "#f0e9f7",
        mist: "#f7f4fb",
        line: "#e4dcee",
        muted: "#5f5675",
      },
      fontFamily: {
        // System fonts only (no downloads, works offline).
        sans: [
          '"Segoe UI Variable Text"',
          '"Segoe UI"',
          "system-ui",
          "-apple-system",
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        display: [
          '"Segoe UI Variable Display"',
          '"Segoe UI"',
          "system-ui",
          "-apple-system",
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
