/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        muted: "#667085",
        line: "#E6EAF0",
        surface: "#F7F9FC",
        brand: {
          50: "#EEF6FF",
          100: "#D9ECFF",
          600: "#1769E0",
          700: "#1557BA",
          900: "#123260"
        },
        success: "#14804A",
        warning: "#B7791F",
        danger: "#C2410C"
      },
      boxShadow: {
        soft: "0 18px 45px rgba(16, 24, 40, 0.08)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
