/**
 * 每日打卡提醒（运行在 Cloudflare Worker 里，由定时任务触发）
 *
 * 流程：
 *   1. 用 service_role key 读 Supabase，算出「今天谁还有哪些分类没打卡」
 *   2. 按用户生成提醒文案
 *   3. 走 PushPlus 或企业微信机器人把消息发出去
 *
 * 需要的环境变量：
 *   SUPABASE_URL                  Supabase 项目地址
 *   SUPABASE_SERVICE_ROLE_KEY     Supabase service_role key（放 Secret，别进代码）
 *   PUSH_CHANNEL                  "pushplus" 或 "wecom"
 *   PUSHPLUS_TOKENS               用户名 → token 的 JSON，例如 {"leomessi":"abc123"}
 *                                 也可以直接填一个 token，所有人共用
 *   WECOM_WEBHOOK                 企业微信机器人的 webhook 地址（PUSH_CHANNEL=wecom 时用）
 *   SITE_URL                      提醒里附带的链接，默认 https://check-intool.online
 */

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000

/** 取「北京时间」的今天，格式 YYYY-MM-DD */
export function beijingTodayStr(now = new Date()) {
  const bj = new Date(now.getTime() + BEIJING_OFFSET_MS)
  const pad = (n) => String(n).padStart(2, '0')
  return `${bj.getUTCFullYear()}-${pad(bj.getUTCMonth() + 1)}-${pad(bj.getUTCDate())}`
}

async function sbGet(env, path) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    throw new Error(`Supabase 查询失败 ${path} -> ${res.status} ${(await res.text()).slice(0, 200)}`)
  }
  return res.json()
}

/**
 * 算出今天还有哪些人、有哪些分类没打卡
 * @returns {Array<{userId, username, pending, doneCount, total}>} 只返回「有遗漏」的人
 */
export async function buildReminders(env) {
  const today = beijingTodayStr()

  const [profiles, categories, checkins] = await Promise.all([
    sbGet(env, 'profiles?select=id,username'),
    sbGet(env, 'categories?select=id,name,icon,user_id&order=created_at'),
    sbGet(env, `checkins?select=user_id,category_id&checkin_date=eq.${today}`),
  ])

  // 今天已经打过卡的分类，按用户归集
  const doneByUser = {}
  checkins.forEach((c) => {
    if (!c.category_id) return
    if (!doneByUser[c.user_id]) doneByUser[c.user_id] = new Set()
    doneByUser[c.user_id].add(c.category_id)
  })

  return profiles
    .map((p) => {
      const cats = categories.filter((c) => c.user_id === p.id)
      const done = doneByUser[p.id] || new Set()
      const pending = cats.filter((c) => !done.has(c.id))
      return {
        userId: p.id,
        username: p.username,
        pending,
        doneCount: done.size,
        total: cats.length,
      }
    })
    // 全打完的人不推送
    .filter((item) => item.pending.length > 0)
}

/** 生成提醒文案 */
export function buildMessage(item, siteUrl) {
  const names = item.pending.map((c) => `${c.icon || '📌'} ${c.name}`).join('、')
  const title = `今日还有 ${item.pending.length} 项没打卡`
  const content = [
    `${item.username}，今天还有 ${item.pending.length} 项没打卡：`,
    names,
    '',
    `已完成 ${item.doneCount}/${item.total} 项`,
    '',
    `去补上 → ${siteUrl}`,
  ].join('\n')
  return { title, content }
}

/** PushPlus：按用户各自的 token 一对一推送 */
async function pushPlus(token, title, content) {
  const res = await fetch('https://www.pushplus.plus/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, title, content, template: 'txt' }),
  })
  const raw = (await res.text()).slice(0, 300)
  let ok = res.ok
  try {
    const json = JSON.parse(raw)
    if (typeof json.code === 'number') ok = res.ok && json.code === 200
  } catch {
    // 非 JSON 返回，以 HTTP 状态为准
  }
  return { ok, status: res.status, raw }
}

/** 企业微信群机器人：整段文本推进群 */
async function pushWecom(webhook, content) {
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msgtype: 'text', text: { content } }),
  })
  const raw = (await res.text()).slice(0, 300)
  let ok = res.ok
  try {
    const json = JSON.parse(raw)
    if (typeof json.errcode === 'number') ok = res.ok && json.errcode === 0
  } catch {
    // 非 JSON 返回，以 HTTP 状态为准
  }
  return { ok, status: res.status, raw }
}

/**
 * 解析某个用户对应的 PushPlus token
 * PUSHPLUS_TOKENS 支持两种写法：
 *   1. JSON 映射：{"leomessi":"token1","另一个人":"token2"}
 *   2. 单个 token 字符串：所有人共用
 */
export function resolveToken(env, username) {
  const raw = (env.PUSHPLUS_TOKENS || '').trim()
  if (!raw) return null
  if (raw.startsWith('{')) {
    try {
      const map = JSON.parse(raw)
      return map[username] || map['*'] || null
    } catch {
      return null
    }
  }
  return raw
}

/**
 * 执行一次每日提醒
 * @returns {object} 执行结果，便于排查
 */
export async function runDailyReminder(env) {
  const today = beijingTodayStr()
  const siteUrl = env.SITE_URL || 'https://check-intool.online'
  const channel = (env.PUSH_CHANNEL || 'pushplus').toLowerCase()

  const missing = []
  if (!env.SUPABASE_URL) missing.push('SUPABASE_URL')
  if (!env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (channel === 'pushplus' && !env.PUSHPLUS_TOKENS) missing.push('PUSHPLUS_TOKENS')
  if (channel === 'wecom' && !env.WECOM_WEBHOOK) missing.push('WECOM_WEBHOOK')
  if (missing.length > 0) {
    return { today, channel, error: `缺少环境变量：${missing.join(', ')}`, results: [] }
  }

  let reminders
  try {
    reminders = await buildReminders(env)
  } catch (e) {
    return { today, channel, error: String(e.message || e), results: [] }
  }

  if (reminders.length === 0) {
    return { today, channel, skipped: '今天所有人都打完卡了，不推送', results: [] }
  }

  const results = []
  for (const item of reminders) {
    const { title, content } = buildMessage(item, siteUrl)

    if (channel === 'wecom') {
      // 企业微信是推到群里，文案里带上用户名
      const r = await pushWecom(env.WECOM_WEBHOOK, `${title}\n${content}`)
      results.push({ username: item.username, channel, ok: r.ok, status: r.status, raw: r.raw })
      continue
    }

    const token = resolveToken(env, item.username)
    if (!token) {
      results.push({ username: item.username, channel, ok: false, error: '没找到对应的 PushPlus token' })
      continue
    }
    const r = await pushPlus(token, title, content)
    results.push({ username: item.username, channel, ok: r.ok, status: r.status, raw: r.raw })
  }

  return { today, channel, results }
}
