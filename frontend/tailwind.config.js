/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          500: "#3b82f6",
          600: "#2563eb",
          950: "#172554"
        }
      },
      boxShadow: {
        panel: "0 24px 80px rgba(15, 23, 42, 0.35)"
      }
    },
  },
  plugins: [],
};
