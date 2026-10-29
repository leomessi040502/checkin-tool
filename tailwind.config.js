/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
    },
    extend: {
      maxWidth: {
        'mobile': '480px',
      },
      colors: {
        // 藏青主色（类名保持 primary-* 不变，值从蓝换成藏青）
        primary: {
          50: '#F2F5F9',
          100: '#E8EDF5',
          200: '#C9D6EA',
          300: '#9DB4D3',
          400: '#6B8BB8',
          500: '#33507F',
          600: '#263E66',
          700: '#223457',
          800: '#1B2A4A',
          900: '#121F38',
        },
        // 金色点缀：仅"成就"三处 + 浅底徽章
        gold: {
          100: '#F7F0DD',
          200: '#EAD9A8',
          500: '#C9A24B',
          700: '#854F0B',
        },
        // 墨色文字三阶
        ink: {
          400: '#8A94A6',
          600: '#5A6474',
          900: '#121F38',
        },
        // 页面背景
        surface: '#F6F7F9',
        // 成功绿：打卡天数数字
        success: {
          50: '#EAF4EE',
          600: '#2F855A',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(27, 42, 74, 0.06)',
      },
    },
  },
  plugins: [],
}
