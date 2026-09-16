import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { withTimeoutToast } from '../utils/apiWrapper'
import { getTodayStr } from '../utils/date'

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
  const [categoryId, setCategoryId] = useState('')
  const [type, setType] = useState('periodic')
  const [targetCount, setTargetCount] = useState('')
  const [startDate, setStartDate] = useState(getTodayStr())
  const [endDate, setEndDate] = useState('')
  const [categories, setCategories] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

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
        setCategoryId(initialData.category_id || '')
        setType(initialData.type || 'periodic')
        setTargetCount(String(initialData.target_count || ''))
        setStartDate(initialData.start_date || today)
        setEndDate(initialData.end_date || '')
      } else {
        setTitle('')
        setCategoryId('')
        setType('periodic')
        setTargetCount('')
        setStartDate(today)
        setEndDate('')
      }
      setError('')
      setSubmitting(false)
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
        .select('id, name, icon, sort_order')
        .order('sort_order', { ascending: true }))
      if (catError) throw catError
      setCategories(data || [])
    } catch {
      setCategories([])
    }
  }

  if (!isOpen) return null

  const validate = () => {
    if (!title.trim()) {
      return '请输入目标名称'
    }
    if (!categoryId) {
      return '请选择分类'
    }
    const count = parseInt(targetCount, 10)
    if (!targetCount || isNaN(count) || count < 1) {
      return '请输入有效的目标次数'
    }
    if (type === 'periodic') {
      if (!endDate) {
        return '请选择截止日期'
      }
      if (endDate <= startDate) {
        return '截止日期必须晚于起始日期'
      }
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

    try {
      const payload = {
        title: title.trim(),
        category_id: categoryId,
        type,
        target_count: parseInt(targetCount, 10),
        start_date: startDate,
        end_date: type === 'periodic' ? endDate : null,
      }

      if (isEdit) {
        // 编辑时不修改 status（status 由系统自动计算）
        const { error: updateError } = await withTimeoutToast(supabase
          .from('goals')
          .update({
            title: payload.title,
            category_id: payload.category_id,
            type: payload.type,
            target_count: payload.target_count,
            start_date: payload.start_date,
            end_date: payload.end_date,
          })
          .eq('id', initialData.id))
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await withTimeoutToast(supabase
          .from('goals')
          .insert({
            ...payload,
            user_id: currentUserId,
          }))
        if (insertError) throw insertError
      }

      onSuccess()
    } catch {
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
        <h2 className="mb-4 text-lg font-bold text-gray-900">
          {isEdit ? '编辑目标' : '新增目标'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 目标名称 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              目标名称
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={30}
              placeholder="请输入目标名称"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary-500"
            />
            <p className="mt-1 text-right text-xs text-gray-400">
              {title.length}/30
            </p>
          </div>

          {/* 分类选择 - 动态加载 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              分类
            </label>
            {categories.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-300 py-2.5 text-center text-sm text-gray-400">
                暂无分类，请先在打卡页添加分类
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={`flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      categoryId === cat.id
                        ? 'border-primary-500 bg-primary-50 text-primary-600'
                        : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 类型选择 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
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
                      ? 'border-primary-500 bg-primary-50 text-primary-600'
                      : 'border-gray-200 text-gray-500'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 目标次数 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              目标次数
            </label>
            <input
              type="number"
              value={targetCount}
              onChange={(e) => setTargetCount(e.target.value)}
              min={1}
              placeholder="请输入正整数"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary-500"
            />
          </div>

          {/* 起始日期 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              起始日期
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary-500"
            />
          </div>

          {/* 截止日期 - 仅周期目标显示 */}
          {type === 'periodic' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                截止日期
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary-500"
              />
            </div>
          )}

          {/* 错误提示 */}
          {error && <p className="text-center text-sm text-red-500">{error}</p>}

          {/* 按钮组 */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                submitting
                  ? 'cursor-not-allowed bg-primary-300 text-white'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              {submitting ? '提交中…' : isEdit ? '保存' : '确认'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default GoalFormModal
