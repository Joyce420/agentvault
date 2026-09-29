
export default {
  content: ["./index.html", "./deploy.html", "./live.html", "./src/**/*.js"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "surface-container-lowest": "#050e17",
        "surface-container-low": "#0b1827",
        "surface-container": "#0f1f2d",
        "surface-container-high": "#14283b",
        "surface-container-highest": "#1c364e",
        "surface": "#07111d",
        "background": "#07111d",
        "on-surface": "#f1f5f9",
        "on-surface-variant": "#94a3b8",
        "on-surface-muted": "#64748b",
        "outline": "#1f3a4d",
        "outline-variant": "#162e40",
        "primary": "#38bdf8",
        "secondary": "#4ade80",
        "error": "#fb7185"
      },
      fontFamily: {
        "display": ["Space Grotesk", "Plus Jakarta Sans", "sans-serif"],
        "body": ["Plus Jakarta Sans", "-apple-system", "sans-serif"],
        "mono": ["JetBrains Mono", "monospace"]
      }
    }
  }
};
