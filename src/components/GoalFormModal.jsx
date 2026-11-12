import { useState, useEffect } from 'react'
import { CalendarDays, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { withTimeoutToast } from '../utils/apiWrapper'
import { getTodayStr, formatChineseDate } from '../utils/date'
import DatePickerModal from './DatePickerModal'

const TYPES = [
  { key: 'periodic', label: '周期目标' },
  { key: 'lifelong', label: '长期累计' },
]

/**
 * 新增/编辑目标弹窗
 *
 * @param {boolean} isOpen
 * @param {() => void} onClose
 * @param {() => void} onSuccess
 * @param {object|null} initialData - 编辑模式时传入的目标数据
 * @param {string} currentUserId
 */
function GoalFormModal({ isOpen, onClose, onSuccess, initialData, currentUserId }) {
  const isEdit = !!initialData
  const [title, setTitle] = useState('')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([])
  const [type, setType] = useState('periodic')
  const [targetCount, setTargetCount] = useState('')
  const [startDate, setStartDate] = useState(getTodayStr())
  const [endDate, setEndDate] = useState('')
  const [categories, setCategories] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [datePickerTarget, setDatePickerTarget] = useState(null) // 'start' | 'end' | null

  const today = getTodayStr()

  // 弹窗打开时加载分类列表
  useEffect(() => {
    if (isOpen) {
      fetchCategories()
    }
  }, [isOpen])

  // 弹窗打开时重置表单
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title || '')
        setSelectedCategoryIds([])
        setType(initialData.type || 'periodic')
        setTargetCount(String(initialData.target_count || ''))
        setStartDate(initialData.start_date || today)
        setEndDate(initialData.end_date || '')
        // 编辑时异步加载已关联分类
        fetchGoalCategories(initialData.id)
      } else {
        setTitle('')
        setSelectedCategoryIds([])
        setType('periodic')
        setTargetCount('')
        setStartDate(today)
        setEndDate('')
      }
      setError('')
      setSubmitting(false)
      setDatePickerTarget(null)
    }
  }, [isOpen, initialData, today])

  // 阻止滚动穿透
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const fetchCategories = async () => {
    try {
      const { data, error: catError } = await withTimeoutToast(supabase
        .from('categories')
        .select('id, name, icon')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: true }))
      if (catError) throw catError
      setCategories(data || [])
    } catch {
      setCategories([])
    }
  }

  // 编辑时加载已关联分类
  const fetchGoalCategories = async (goalId) => {
    try {
      const { data, error: relError } = await withTimeoutToast(supabase
        .from('goal_categories')
        .select('category_id')
        .eq('goal_id', goalId))
      if (relError) throw relError
      setSelectedCategoryIds((data || []).map((r) => r.category_id))
    } catch {
      setSelectedCategoryIds([])
    }
  }

  if (!isOpen) return null

  const validate = () => {
    if (!title.trim()) {
      return '请输入目标名称'
    }
    // 至少关联一个当前仍存在的分类（过滤已删除分类的死链）
    const validCount = selectedCategoryIds.filter((id) =>
      categories.some((c) => c.id === id),
    ).length
    if (validCount === 0) {
      return '请至少关联一个分类'
    }
    // 目标次数：可空，若填写必须为正整数
    const count = targetCount ? parseInt(targetCount, 10) : null
    if (targetCount && (isNaN(count) || count < 1)) {
      return '请输入有效的目标次数'
    }
    // 截止日期：可空，若填写必须晚于起始日期
    if (endDate && endDate <= startDate) {
      return '截止日期必须晚于起始日期'
    }
    // 周期目标：目标次数和截止日期至少填一个
    // 长期目标：都可以不填
    if (type === 'periodic' && !count && !endDate) {
      return '周期目标需填写目标次数或截止日期'
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return

    const errMsg = validate()
    if (errMsg) {
      setError(errMsg)
      return
    }

    setSubmitting(true)
    setError('')
    const startTime = Date.now()

    // 过滤掉已不存在的分类（防止已删除分类的死链被静默保留）
    const validCategoryIds = selectedCategoryIds.filter((id) =>
      categories.some((c) => c.id === id),
    )

    let goalId = null
    try {
      const count = targetCount ? parseInt(targetCount, 10) : null
      const payload = {
        title: title.trim(),
        type,
        target_count: count,
        start_date: startDate,
        end_date: endDate || null,
      }

      if (isEdit) {
        // 编辑时不修改 status（status 由系统自动计算）
        const { error: updateError } = await withTimeoutToast(supabase
          .from('goals')
          .update({
            title: payload.title,
            type: payload.type,
            target_count: payload.target_count,
            start_date: payload.start_date,
            end_date: payload.end_date,
          })
          .eq('id', initialData.id))
        if (updateError) throw updateError
        goalId = initialData.id
      } else {
        const { data: insertData, error: insertError } = await withTimeoutToast(supabase
          .from('goals')
          .insert({
            ...payload,
            user_id: currentUserId,
          })
          .select('id')
          .single())
        if (insertError) throw insertError
        goalId = insertData.id
      }

      // 同步关联：优先走事务 RPC（删旧+插新在同一事务，失败不会把关联清空）
      const { error: rpcError } = await withTimeoutToast(
        supabase.rpc('replace_goal_categories', {
          p_goal_id: goalId,
          p_category_ids: validCategoryIds,
        }),
      )
      const rpcMissing = rpcError?.code === 'PGRST202' || rpcError?.code === '42883'

      if (!rpcError) {
        onSuccess()
      } else if (rpcMissing) {
        // 迁移 011 未执行：降级为差集增删，尽量缩小失败窗口
        const { data: existing } = await withTimeoutToast(supabase
          .from('goal_categories')
          .select('category_id')
          .eq('goal_id', goalId))
        const oldIds = (existing || []).map((r) => r.category_id)
        const toDelete = oldIds.filter((id) => !validCategoryIds.includes(id))
        const toAdd = validCategoryIds.filter((id) => !oldIds.includes(id))

        if (toDelete.length > 0) {
          const { error: delErr } = await withTimeoutToast(supabase
            .from('goal_categories')
            .delete()
            .eq('goal_id', goalId)
            .in('category_id', toDelete))
          if (delErr) throw delErr
        }
        if (toAdd.length > 0) {
          const { error: addErr } = await withTimeoutToast(supabase
            .from('goal_categories')
            .insert(toAdd.map((catId) => ({ goal_id: goalId, category_id: catId }))))
          if (addErr) throw addErr
        }
        onSuccess()
      } else {
        throw rpcError
      }
    } catch {
      // 新建目标时若关联写入失败，删掉刚创建的目标，避免留下无分类的孤儿目标
      if (!isEdit && goalId) {
        try {
          await withTimeoutToast(supabase.from('goals').delete().eq('id', goalId))
        } catch {
          // 回滚失败仅记录，不覆盖原始错误提示
        }
      }
      setError('操作失败，请重试')
      // 防抖：确保按钮至少禁用 2 秒
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 2000 - elapsed)
      setTimeout(() => setSubmitting(false), remaining)
      return
    }
    setSubmitting(false)
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !submitting) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center"
      onClick={handleOverlayClick}
    >
      <div
        className="relative z-10 max-h-[90vh] w-full max-w-mobile overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold text-ink-900">
          {isEdit ? '编辑目标' : '新增目标'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 目标名称 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">
              目标名称
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={30}
              placeholder="请输入目标名称"
              className="w-full rounded-lg border border-primary-200 px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary-500"
            />
            <p className="mt-1 text-right text-xs text-ink-400">
              {title.length}/30
            </p>
          </div>

          {/* 分类选择 - 动态加载 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">
              分类
            </label>
            {categories.length === 0 ? (
              <p className="rounded-lg border border-dashed border-primary-200 py-2.5 text-center text-sm text-ink-400">
                暂无分类，请先在打卡页添加分类
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const selected = selectedCategoryIds.includes(cat.id)
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategoryIds((prev) =>
                          prev.includes(cat.id)
                            ? prev.filter((id) => id !== cat.id)
                            : [...prev, cat.id]
                        )
                      }}
                      className={`flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        selected
                          ? 'border-primary-500 bg-primary-100 text-primary-600'
                          : 'border-primary-200 text-ink-600'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* 类型选择 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">
              类型
            </label>
            <div className="flex gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setType(t.key)
                    if (t.key === 'lifelong') setEndDate('')
                  }}
                  className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                    type === t.key
                      ? 'border-primary-500 bg-primary-100 text-primary-600'
                      : 'border-primary-200 text-ink-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 目标次数 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">
              目标次数 <span className="text-xs font-normal text-ink-400">（选填）</span>
            </label>
            <input
              type="number"
              value={targetCount}
              onChange={(e) => setTargetCount(e.target.value)}
              min={1}
              placeholder="请输入正整数"
              className="w-full rounded-lg border border-primary-200 px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary-500"
            />
          </div>

          {/* 起始日期：自绘日历，可选任意日期 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">
              起始日期
            </label>
            <button
              type="button"
              onClick={() => setDatePickerTarget('start')}
              className="flex w-full items-center gap-2 rounded-lg border border-primary-200 px-3 py-2.5 text-sm text-ink-600 transition-colors hover:border-primary-500"
            >
              <CalendarDays size={16} className="text-primary-500" />
              {startDate ? formatChineseDate(startDate) : '选择日期'}
            </button>
          </div>

          {/* 截止日期：不能早于起始日期 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">
              截止日期 <span className="text-xs font-normal text-ink-400">（选填）</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDatePickerTarget('end')}
                className="flex flex-1 items-center gap-2 rounded-lg border border-primary-200 px-3 py-2.5 text-sm text-ink-600 transition-colors hover:border-primary-500"
              >
                <CalendarDays size={16} className="text-primary-500" />
                {endDate ? formatChineseDate(endDate) : '选择日期'}
              </button>
              {endDate && (
                <button
                  type="button"
                  onClick={() => setEndDate('')}
                  aria-label="清除截止日期"
                  className="flex items-center justify-center rounded-lg border border-primary-200 px-3 py-2.5 text-ink-400 transition-colors hover:text-red-500"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-ink-400">
              {type === 'periodic'
                ? '周期目标：目标次数和截止日期至少填写一个'
                : '长期目标：目标次数和截止日期均可不填'}
            </p>
          </div>

          {/* 错误提示 */}
          {error && <p className="text-center text-sm text-red-500">{error}</p>}

          {/* 按钮组 */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-lg border border-primary-200 bg-white py-2.5 text-sm font-medium text-ink-600 transition-colors hover:bg-primary-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                submitting
                  ? 'cursor-not-allowed bg-primary-300 text-white'
                  : 'bg-primary-500 text-white hover:bg-primary-600'
              }`}
            >
              {submitting ? '提交中…' : isEdit ? '保存' : '确认'}
            </button>
          </div>
        </form>

        {/* 起始日不限；截止日不能早于起始日 */}
        <DatePickerModal
          isOpen={datePickerTarget === 'start'}
          value={startDate}
          onClose={() => setDatePickerTarget(null)}
          onConfirm={(date) => {
            setStartDate(date)
            setDatePickerTarget(null)
          }}
        />
        <DatePickerModal
          isOpen={datePickerTarget === 'end'}
          value={endDate}
          min={startDate}
          onClose={() => setDatePickerTarget(null)}
          onConfirm={(date) => {
            setEndDate(date)
            setDatePickerTarget(null)
          }}
        />
      </div>
    </div>
  )
}

export default GoalFormModal
