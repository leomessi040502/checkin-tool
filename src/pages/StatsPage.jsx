import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { withTimeoutToast } from '../utils/apiWrapper'
import { getTodayStr, formatDateStr } from '../utils/date'
import { calculateStreaks } from '../utils/streakCalculator'

const TABS = [
  { key: 'user', label: '按用户' },
  { key: 'time', label: '按时间' },
  { key: 'category', label: '按分类' },
]

const TIME_RANGES = [
  { key: 'today', label: '今日' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
]

/** 将日期值规范化为 YYYY-MM-DD 字符串 */
function normalizeDate(dateVal) {
  if (typeof dateVal === 'string') return dateVal.slice(0, 10)
  if (dateVal instanceof Date) return formatDateStr(dateVal)
  return String(dateVal).slice(0, 10)
}

function StatsPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('user')
  const [timeRange, setTimeRange] = useState('today')
  const [loading, setLoading] = useState(true)
  const [checkins, setCheckins] = useState([])
  const [profiles, setProfiles] = useState([])
  const [categories, setCategories] = useState([])

  // 一次性加载所有数据：checkins、profiles、categories
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [checkinsRes, profilesRes, categoriesRes] = await Promise.all([
          withTimeoutToast(supabase.from('checkins').select('id, user_id, category_id, checkin_date, note, created_at')),
          withTimeoutToast(supabase.from('profiles').select('id, username')),
          withTimeoutToast(supabase.from('categories').select('id, name, icon, user_id').order('created_at', { ascending: true })),
        ])
        if (!checkinsRes.error && checkinsRes.data) setCheckins(checkinsRes.data)
        if (!profilesRes.error && profilesRes.data) setProfiles(profilesRes.data)
        if (!categoriesRes.error && categoriesRes.data) setCategories(categoriesRes.data)
      } catch {
        // 查询失败保持空状态，不崩溃
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // 构建 user_id → username 映射
  const profileMap = useMemo(() => {
    const map = {}
    profiles.forEach((p) => {
      map[p.id] = p.username || '未知用户'
    })
    return map
  }, [profiles])

  // 按 user_id 分组分类
  const categoriesByUser = useMemo(() => {
    const map = {}
    categories.forEach((cat) => {
      if (!map[cat.user_id]) map[cat.user_id] = []
      map[cat.user_id].push(cat)
    })
    return map
  }, [categories])

  // 所有用户列表（profiles 中的 + checkins 中出现但不在 profiles 中的）
  const allUserIds = useMemo(() => {
    const ids = new Set(profiles.map((p) => p.id))
    checkins.forEach((c) => ids.add(c.user_id))
    return [...ids]
  }, [profiles, checkins])

  // ========== 按用户统计 ==========
  const userStats = useMemo(() => {
    return allUserIds
      .map((userId) => {
        const userCheckins = checkins.filter((c) => c.user_id === userId)
        const username = profileMap[userId] || '未知用户'
        const totalCount = userCheckins.length

        // 各分类次数（仅该用户自己的分类）
        const userCats = categoriesByUser[userId] || []
        const categoryCounts = {}
        userCats.forEach((cat) => {
          categoryCounts[cat.id] = 0
        })
        userCheckins.forEach((c) => {
          if (c.category_id && categoryCounts[c.category_id] !== undefined) {
            categoryCounts[c.category_id]++
          }
        })

        // 孤儿记录：category_id 为空，或指向的分类已不属于该用户（多半是分类被删过）
        // 这类记录无法归入任何现有分类，会在「次数」里凭空消失，需要单独暴露出来
        const userCatIds = new Set(userCats.map((cat) => cat.id))
        const orphanCount = userCheckins.filter(
          (c) => !c.category_id || !userCatIds.has(c.category_id)
        ).length

        const streaks = calculateStreaks(userCheckins)

        return {
          userId,
          username,
          totalCount,
          categoryCounts,
          streaks,
          userCategories: userCats,
          orphanCount,
        }
      })
      .sort((a, b) => b.totalCount - a.totalCount)
  }, [allUserIds, checkins, profileMap, categoriesByUser])

  // ========== 按时间统计 ==========
  const timeStats = useMemo(() => {
    const todayStr = getTodayStr()
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    // 确定日期范围
    let startDate
    if (timeRange === 'today') {
      startDate = new Date(now)
    } else if (timeRange === 'week') {
      startDate = new Date(now)
      startDate.setDate(startDate.getDate() - 6) // 最近7天（含今天）
    } else {
      // month: 从本月1号到今天
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    const startDateStr = formatDateStr(startDate)

    // 过滤范围内的 checkins
    const filtered = checkins.filter((c) => {
      const dateStr = normalizeDate(c.checkin_date)
      return dateStr >= startDateStr && dateStr <= todayStr
    })

    const totalCount = filtered.length

    // 按用户分组统计各分类次数
    const userBreakdown = allUserIds
      .map((userId) => {
        const userCats = categoriesByUser[userId] || []
        const userFiltered = filtered.filter((c) => c.user_id === userId)
        if (userFiltered.length === 0 && userCats.length === 0) return null

        const catCounts = {}
        userCats.forEach((cat) => {
          catCounts[cat.id] = 0
        })
        userFiltered.forEach((c) => {
          if (c.category_id && catCounts[c.category_id] !== undefined) {
            catCounts[c.category_id]++
          }
        })

        return {
          userId,
          username: profileMap[userId] || '未知用户',
          categories: userCats,
          counts: catCounts,
          userTotal: userFiltered.length,
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.userTotal - a.userTotal)

    // 构建每日趋势数据
    const dailyCountMap = {}
    filtered.forEach((c) => {
      const dateStr = normalizeDate(c.checkin_date)
      dailyCountMap[dateStr] = (dailyCountMap[dateStr] || 0) + 1
    })

    const days = []
    const d = new Date(startDate)
    while (d <= now) {
      const dateStr = formatDateStr(d)
      const isToday = dateStr === todayStr
      days.push({
        dateStr,
        count: dailyCountMap[dateStr] || 0,
        label: timeRange === 'today' ? '今日' : `${d.getMonth() + 1}/${d.getDate()}`,
        isToday,
      })
      d.setDate(d.getDate() + 1)
    }

    const maxCount = Math.max(...days.map((day) => day.count), 1)

    return { totalCount, userBreakdown, days, maxCount }
  }, [checkins, timeRange, categoriesByUser, allUserIds, profileMap])

  // ========== 按分类统计 ==========
  const categoryStats = useMemo(() => {
    // 按用户分组，显示各自的分类排名
    return allUserIds
      .map((userId) => {
        const userCats = categoriesByUser[userId] || []
        const userCheckins = checkins.filter((c) => c.user_id === userId)

        const catRanking = userCats
          .map((cat) => {
            const catCheckins = userCheckins.filter((c) => c.category_id === cat.id)
            // 累计天数 = 该分类打过卡的不同日期数量（同一天多次只算 1 天）
            const days = new Set(catCheckins.map((c) => normalizeDate(c.checkin_date))).size
            return { ...cat, count: catCheckins.length, days }
          })
          .sort((a, b) => b.count - a.count)

        const totalCheckins = userCheckins.length

        // 孤儿记录：无法归入任何现有分类的打卡
        const userCatIds = new Set(userCats.map((cat) => cat.id))
        const orphanCount = userCheckins.filter(
          (c) => !c.category_id || !userCatIds.has(c.category_id)
        ).length

        return {
          userId,
          username: profileMap[userId] || '未知用户',
          categories: catRanking,
          totalCheckins,
          orphanCount,
        }
      })
      .filter((item) => item.categories.length > 0)
      .sort((a, b) => b.totalCheckins - a.totalCheckins)
  }, [checkins, categoriesByUser, allUserIds, profileMap])

  // 空状态：无分类
  const noCategories = categories.length === 0
  // 空状态：无打卡数据
  const isEmpty = checkins.length === 0

  return (
    <div className="px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-ink-900">统计</h1>

      {/* Tab 切换 */}
      <div className="mb-5 flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`relative flex-1 rounded-lg py-2 text-sm transition-colors ${
              activeTab === tab.key
                ? 'bg-white font-medium text-primary-600'
                : 'border border-primary-200 bg-white text-ink-600'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-gold-500" />
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-ink-400">加载中…</div>
      ) : noCategories ? (
        /* 无分类空状态 */
        <div className="flex flex-col items-center py-16">
          <span className="mb-3 text-5xl">🏷️</span>
          <p className="mb-4 text-sm text-ink-600">还没有分类，去添加分类吧</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-lg bg-primary-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600"
          >
            去添加分类
          </button>
        </div>
      ) : isEmpty ? (
        /* 无打卡数据空状态 */
        <div className="flex flex-col items-center py-16">
          <span className="mb-3 text-5xl">📭</span>
          <p className="mb-4 text-sm text-ink-600">还没有打卡记录，去打卡吧</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-lg bg-primary-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600"
          >
            去打卡
          </button>
        </div>
      ) : (
        <>
          {/* ===== 按用户 ===== */}
          {activeTab === 'user' && (
            <div className="space-y-3">
              {userStats.map((user, index) => (
                <div key={user.userId} className="card p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {index === 0 && user.totalCount > 0 ? '🥇' : `#${index + 1}`}
                    </span>
                    <span className="font-medium text-ink-900">{user.username}</span>
                    <span className="ml-auto text-sm text-ink-600">
                      总打卡{' '}
                      <span className="font-bold text-success-600">
                        {user.totalCount}
                      </span>{' '}
                      次 ·{' '}
                      <span className="font-bold text-success-600">
                        {user.streaks.totalDays || 0}
                      </span>{' '}
                      天
                    </span>
                  </div>

                  {user.totalCount === 0 ? (
                    <p className="mt-2 text-xs text-ink-400">暂无记录</p>
                  ) : (
                    <>
                      {/* 各分类次数（仅该用户自己的分类） */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {user.userCategories.map((cat) => (
                          <span
                            key={cat.id}
                            className="rounded bg-primary-100 px-2 py-0.5 text-xs text-ink-600"
                          >
                            {cat.icon} {cat.name}{' '}
                            <span className="font-medium text-primary-600">
                              {user.categoryCounts[cat.id] || 0}
                            </span>
                            次 ·{' '}
                            <span className="font-medium text-primary-600">
                              {user.streaks.categoryDays[cat.id] || 0}
                            </span>
                            天
                          </span>
                        ))}
                      </div>

                      {/* 孤儿记录提示：分类被删过 / category_id 丢失的打卡 */}
                      {user.orphanCount > 0 && (
                        <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                          ⚠️ 有{' '}
                          <span className="font-bold">{user.orphanCount}</span>{' '}
                          条打卡没关联到现有分类（分类可能已被删除重建）
                        </p>
                      )}

                      {/* 累计天数 / 连续天数（两者分开写清，避免把「连续」误读成「累计」） */}
                      <div className="mt-3 border-t border-primary-50 pt-3">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
                          <span>
                            🔥 连续{' '}
                            <span className="font-bold text-success-600">
                              {user.streaks.totalStreak}
                            </span>{' '}
                            天
                          </span>
                          <span>
                            累计{' '}
                            <span className="font-bold text-success-600">
                              {user.streaks.totalDays || 0}
                            </span>{' '}
                            天
                          </span>
                          {user.userCategories.map((cat) => (
                            <span key={cat.id}>
                              {cat.icon} {cat.name} 连续{' '}
                              <span className="font-bold text-success-600">
                                {user.streaks.categoryStreaks[cat.id] || 0}
                              </span>{' '}
                              天
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ===== 按时间 ===== */}
          {activeTab === 'time' && (
            <div>
              {/* 时间范围切换 */}
              <div className="mb-4 flex gap-2">
                {TIME_RANGES.map((range) => (
                  <button
                    key={range.key}
                    type="button"
                    onClick={() => setTimeRange(range.key)}
                    className={`relative flex-1 rounded-lg py-1.5 text-sm transition-colors ${
                      timeRange === range.key
                        ? 'bg-primary-100 font-medium text-primary-600'
                        : 'border border-primary-200 bg-white text-ink-600'
                    }`}
                  >
                    {range.label}
                    {timeRange === range.key && (
                      <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-gold-500" />
                    )}
                  </button>
                ))}
              </div>

              {/* 总次数 + 各用户分类次数 */}
              <div className="card mb-4 p-4">
                <h2 className="section-title mb-3">
                  全员打卡总次数：
                  <span className="font-bold text-success-600">
                    {timeStats.totalCount}
                  </span>
                </h2>
                {timeStats.userBreakdown.map((ub) => (
                  <div key={ub.userId} className="mb-3 last:mb-0">
                    <div className="mb-1.5 flex items-center gap-2 text-xs text-ink-600">
                      <span className="font-medium text-ink-900">{ub.username}</span>
                      <span>
                        <span className="font-bold text-success-600">
                          {ub.userTotal}
                        </span>{' '}
                        次
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ub.categories.map((cat) => (
                        <div
                          key={cat.id}
                          className="flex-1 rounded-lg bg-surface py-2 text-center"
                        >
                          <div className="text-xs text-ink-600">{cat.icon} {cat.name}</div>
                          <div className="mt-0.5 text-lg font-bold text-success-600">
                            {ub.counts[cat.id] || 0}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* 每日打卡趋势图 */}
              <div className="card p-4">
                <h2 className="section-title mb-3">每日打卡趋势</h2>
                <div className="flex items-end gap-1" style={{ height: '140px' }}>
                  {timeStats.days.map((day) => {
                    const barHeight = timeStats.maxCount > 0
                      ? (day.count / timeStats.maxCount) * 100
                      : 0
                    return (
                      <div
                        key={day.dateStr}
                        className="flex flex-1 flex-col items-center justify-end"
                        style={{ height: '100%' }}
                      >
                        <span className="mb-0.5 text-xs text-ink-600">
                          {day.count > 0 ? day.count : ''}
                        </span>
                        <div
                          className={`w-3/5 rounded-t transition-all ${day.isToday ? 'bg-primary-600' : 'bg-primary-300'}`}
                          style={{
                            height: `${barHeight}%`,
                            minHeight: day.count > 0 ? '4px' : '0',
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
                <div className="mt-1 flex gap-1">
                  {timeStats.days.map((day, idx) => (
                    <div
                      key={day.dateStr}
                      className="flex-1 text-center text-xs text-ink-400"
                    >
                      {/* 月份模式下每隔几天显示一次标签，避免拥挤 */}
                      {timeRange === 'month' && timeStats.days.length > 10
                        ? idx % Math.ceil(timeStats.days.length / 8) === 0
                          ? day.label
                          : ''
                        : day.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== 按分类 ===== */}
          {activeTab === 'category' && (
            <div className="space-y-4">
              {categoryStats.map((userItem) => (
                <div key={userItem.userId} className="card p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-3.5 w-[3px] rounded-full bg-gold-500" />
                    <span className="font-bold text-ink-900">{userItem.username}</span>
                    <span className="ml-auto text-sm text-ink-600">
                      总打卡{' '}
                      <span className="font-bold text-success-600">
                        {userItem.totalCheckins}
                      </span>{' '}
                      次
                    </span>
                  </div>

                  {userItem.categories.length === 0 ? (
                    <p className="py-2 text-xs text-ink-400">暂无分类</p>
                  ) : (
                    <div className="space-y-2">
                      {userItem.categories.map((cat, idx) => (
                        <div
                          key={cat.id}
                          className="flex items-center gap-2"
                        >
                          <span className="w-6 text-center text-sm text-ink-600">
                            {idx === 0 && cat.count > 0 ? '🥇' : idx + 1}
                          </span>
                          <span className="text-lg">{cat.icon}</span>
                          <span className="flex-1 text-sm text-ink-600">
                            {cat.name}
                          </span>
                          <span className="text-xs text-ink-400">
                            累计{' '}
                            <span className="font-bold text-success-600">
                              {cat.days}
                            </span>{' '}
                            天
                          </span>
                          <span className="w-16 text-right text-sm">
                            <span className="font-bold text-success-600">
                              {cat.count}
                            </span>{' '}
                            次
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 孤儿记录提示 */}
                  {userItem.orphanCount > 0 && (
                    <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                      ⚠️ 另有{' '}
                      <span className="font-bold">{userItem.orphanCount}</span>{' '}
                      条打卡没关联到现有分类（分类可能已被删除重建）
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default StatsPage
