/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      // 移动端优先，默认样式针对手机
      sm: '640px',   // 小屏手机横屏
      md: '768px',   // 平板竖屏
      lg: '1024px',  // 平板横屏 / 小桌面
      xl: '1280px',  // 桌面
    },
    extend: {
      maxWidth: {
        'mobile': '480px', // 移动端最大宽度限制
      },
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
}
