/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "primary-fixed": "#6ffbbe",
        "on-secondary-fixed": "#001f26",
        "on-background": "#dce3f0",
        "outline": "#86948a",
        "on-secondary": "#003640",
        "on-primary": "#003824",
        "error": "#ffb4ab",
        "secondary-fixed-dim": "#4cd7f6",
        "inverse-on-surface": "#2a313b",
        "on-primary-fixed": "#002113",
        "on-secondary-container": "#00424e",
        "tertiary-fixed": "#e1e0ff",
        "on-tertiary-container": "#1d17b2",
        "on-tertiary-fixed": "#07006c",
        "surface-container": "#19202a",
        "on-primary-fixed-variant": "#005236",
        "error-container": "#93000a",
        "on-secondary-fixed-variant": "#004e5c",
        "secondary": "#4cd7f6",
        "secondary-container": "#03b5d3",
        "surface-tint": "#4edea3",
        "surface-dim": "#0d141d",
        "surface-container-lowest": "#080f18",
        "primary": "#4edea3",
        "primary-container": "#10b981",
        "secondary-fixed": "#acedff",
        "surface-variant": "#2e353f",
        "surface-container-highest": "#2e353f",
        "tertiary-fixed-dim": "#c0c1ff",
        "tertiary-container": "#9699ff",
        "primary-fixed-dim": "#4edea3",
        "on-tertiary-fixed-variant": "#2f2ebe",
        "on-primary-container": "#00422b",
        "surface-bright": "#333a44",
        "outline-variant": "#3c4a42",
        "surface-container-low": "#151c25",
        "on-surface": "#dce3f0",
        "on-tertiary": "#1000a9",
        "surface-container-high": "#232a34",
        "inverse-primary": "#006c49",
        "on-error-container": "#ffdad6",
        "surface": "#0d141d",
        "background": "#0d141d",
        "on-surface-variant": "#bbcabf",
        "tertiary": "#c0c1ff",
        "inverse-surface": "#dce3f0",
        "on-error": "#690005"
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "sans-serif"],
        body: ["Plus Jakarta Sans", "sans-serif"]
      },
      spacing: {
        "space-xs": "0.25rem",
        "space-sm": "0.5rem",
        "space-md": "1rem",
        "space-lg": "1.5rem",
        "space-xl": "2rem",
        "margin-desktop": "3rem"
      }
    }
  },
  plugins: [],
}
