import tokens from './src/design-system/tokens.js'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    '../backend/templates/**/*.html',
  ],
  theme: {
    extend: {
      colors: {
        rs: tokens.colors.rs,
        brand: tokens.colors.brand,
        neutral: tokens.colors.neutral,
        success: tokens.colors.success,
        warning: tokens.colors.warning,
        danger: tokens.colors.danger,
        info: tokens.colors.info,
        processing: tokens.colors.processing,
        bg: tokens.colors.bg,
      },
      fontFamily: tokens.typography.fontFamily,
      spacing: tokens.spacing,
      borderRadius: tokens.radius,
      boxShadow: tokens.shadow,
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}