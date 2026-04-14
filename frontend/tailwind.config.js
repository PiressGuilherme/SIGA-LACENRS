/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        lacen: {
          primary: "#7b1020",
          secondary: "#1a3a5c",
          accent: "#f5c518",
          success: "#009c3b",
          danger: "#c8102e",
        },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
  // Classes dinâmicas que não aparecem literalmente no código (passadas como props ou geradas em runtime)
  safelist: [
    // WellGrid cursorColor/cursorShadow props em MontarPlaca
    'border-[#1a3a5c]', 'ring-[#3b82f6]',
    // WellGrid cursorColor/cursorShadow props em MontarPCR
    'border-emerald-700', 'ring-emerald-400',
    // GROUP_COLORS bgActive (MontarPlaca) — segurança extra
    'bg-blue-500', 'bg-emerald-500', 'bg-orange-500', 'bg-violet-500', 'bg-pink-600',
  ],
};
