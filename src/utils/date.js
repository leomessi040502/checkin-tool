/**
 * 日期辅助函数
 */

/** 获取今天的日期字符串 (YYYY-MM-DD，基于本地时区) */
export function getTodayStr() {
  const now = new Date()
  return formatDateStr(now)
}

/** 将 Date 转为 YYYY-MM-DD 字符串（基于本地时区） */
export function formatDateStr(date) {
  const d = date instanceof Date ? date : new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 格式化为中文日期：2026年9月15日 */
export function formatChineseDate(date) {
  const d = date instanceof Date ? date : new Date(date)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

/** 获取最近7天（不含今天）的日期列表，按从近到远排列 */
export function getLast7Days() {
  const days = []
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    days.push({
      dateStr: formatDateStr(d),
      label: formatChineseDate(d),
      weekday: `周${weekdays[d.getDay()]}`,
    })
  }
  return days
}

/** 计算剩余天数：正数=未来，0=今天，负数=已过期 */
export function getDaysRemaining(targetDate) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(targetDate)
  target.setHours(0, 0, 0, 0)
  const diffMs = target.getTime() - today.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

/** 将 ISO 时间戳格式化为 HH:mm（本地时区） */
export function formatTime(isoString) {
  const d = new Date(isoString)
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}
