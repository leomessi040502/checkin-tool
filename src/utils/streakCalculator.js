/**
 * 连续打卡天数计算工具
 */
import { getTodayStr, formatDateStr } from './date'

/** 将日期值规范化为 YYYY-MM-DD 字符串 */
function normalizeDate(dateVal) {
  if (typeof dateVal === 'string') {
    return dateVal.slice(0, 10)
  }
  if (dateVal instanceof Date) {
    return formatDateStr(dateVal)
  }
  return String(dateVal).slice(0, 10)
}

/**
 * 从 startDate 起往前逐天检查，计算连续命中天数
 * @param {Set} dateSet - 日期集合（YYYY-MM-DD）
 * @param {Date} startDate - 起始日期（含）
 * @returns {number} 连续天数
 */
function countConsecutiveDays(dateSet, startDate) {
  let count = 0
  const d = new Date(startDate)
  d.setHours(0, 0, 0, 0)
  // 最多检查 365 天，防止异常数据导致死循环
  for (let i = 0; i < 365; i++) {
    const dateStr = formatDateStr(d)
    if (dateSet.has(dateStr)) {
      count++
      d.setDate(d.getDate() - 1)
    } else {
      break
    }
  }
  return count
}

/**
 * 计算某用户各分类连续打卡天数和总连续打卡天数
 * 动态按 category_id 分组，总连续天数逻辑不变（任意分类有打卡即连续）
 * @param {Array} checkins - 某用户的所有打卡记录，每条含 { checkin_date, category_id }
 * @returns {{ categoryStreaks: { [string]: number }, totalStreak: number }}
 */
export function calculateStreaks(checkins) {
  if (!checkins || checkins.length === 0) {
    return { categoryStreaks: {}, totalStreak: 0 }
  }

  // 按日期和分类分组
  const dateSet = new Set() // 任意分类有打卡的日期集合
  const categoryDateSets = {} // { [category_id]: Set<dateStr> }

  checkins.forEach((c) => {
    const dateStr = normalizeDate(c.checkin_date)
    dateSet.add(dateStr)
    const catId = c.category_id
    // category_id 为 null（分类已删除）的记录不计入分类连续天数，但计入总连续天数
    if (catId) {
      if (!categoryDateSets[catId]) {
        categoryDateSets[catId] = new Set()
      }
      categoryDateSets[catId].add(dateStr)
    }
  })

  const todayStr = getTodayStr()
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)

  // 分类连续天数：今天有该分类打卡→从今天算；否则从昨天算
  const calcCategoryStreak = (catSet) => {
    if (catSet.has(todayStr)) {
      return countConsecutiveDays(catSet, now)
    }
    return countConsecutiveDays(catSet, yesterday)
  }

  // 总连续天数：今天有任意打卡→从今天算；否则从昨天算
  const calcTotalStreak = () => {
    if (dateSet.has(todayStr)) {
      return countConsecutiveDays(dateSet, now)
    }
    return countConsecutiveDays(dateSet, yesterday)
  }

  const categoryStreaks = {}
  Object.keys(categoryDateSets).forEach((catId) => {
    categoryStreaks[catId] = calcCategoryStreak(categoryDateSets[catId])
  })

  return {
    categoryStreaks,
    totalStreak: calcTotalStreak(),
  }
}
