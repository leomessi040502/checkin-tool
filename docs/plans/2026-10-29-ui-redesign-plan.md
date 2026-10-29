# UI 改版（商务成熟风）实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 check-in-tool 全站从默认灰蓝配色升级为商务成熟风（藏青 + 金点缀），统一设计规范，零功能改动。

**Architecture:** 方案 A"规范先行"——先在 tailwind.config.js 建立完整 token（藏青 primary、gold、ink、surface、success），index.css 定义全局样式与复用组件类；然后按"机械映射表"逐文件替换 className，关键组件（导航、打卡卡片、头像）给出完整代码。保持类名 `primary-*` 不变、只换色值，最大程度减少 JSX 改动。

**Tech Stack:** React 19 + Vite 8 + Tailwind CSS 3 + lucide-react（新增，tree-shakable）

**设计文档:** `docs/plans/2026-10-29-ui-redesign-design.md`（token 定义与边界以此为准）

---

## 全局约束（每个任务都必须遵守）

1. **只改两个仓库**：真实仓库 `D:\桌面\AI工具\check-in tool-v1\checkin-tool`（唯一改源）；Trae 副本 `D:\trae-cn\builder文件夹\checkin-tool`（仅用于构建验证，靠 cp 同步）
2. **不执行 git commit/push**：用户用 GitHub Desktop 手动提交，本计划所有任务完成后由用户一次性 Commit + Push（这是与技能默认流程的明确偏离，原因见交接文档"用户画像"）
3. **机械映射表**（全站统一，替换 className 时逐条对照）：

| 旧类名 | 新类名 | 说明 |
|---|---|---|
| `bg-gray-50` | `bg-surface` | 页面/内容区背景 |
| `text-gray-900` | `text-ink-900` | 主文字 |
| `text-gray-700` | `text-ink-600` | 次级文字 |
| `text-gray-500` | `text-ink-600` | 次级文字 |
| `text-gray-400` | `text-ink-400` | 弱化文字/占位 |
| `border-gray-200` | `border-primary-200` | 边框（藏青浅描边 #C9D6EA） |
| `border-gray-100` | `border-primary-50` | 分割线（#F2F5F9） |
| `bg-gray-100` | `bg-primary-50` | 计数胶囊/浅底 |
| `bg-primary-50`（按钮浅底） | `bg-primary-100` | 次级按钮底加深一档 |
| `text-primary-600` | 保留不变 | 值已换成藏青 #263E66 |
| `bg-primary-600`（主按钮） | `bg-primary-500` | 藏青 CTA 用 #33507F |
| `hover:bg-primary-700` | `hover:bg-primary-600` | CTA hover |
| 红/amber 警示色 | 保留不变 | 删除、错误、orphan 提示语义不动 |
| `text-green-600` / `bg-green-50`（统计数字） | `text-success-600` | 打卡天数数字统一成功绿 |

4. **lucide 图标映射**：✅=CheckCircle2、⏰=Clock3、🎯=Target、📊=BarChart3、👤=User、✏️=Pencil、🗑️=Trash2、📅=CalendarDays、+ 添加=Plus、补卡=CalendarClock、折叠箭头=ChevronDown/ChevronUp、关闭=X
5. **金色只出现在三处**（克制原则）：区块标题竖条、已打卡"已完成"标识、导航选中指示条。金浅底 `gold-100` 额外用于"我"徽章/达标徽章
6. **分类 emoji 不删**：一律包进 `w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center` 容器（统计页/动态区用小号 `w-8 h-8`）
7. 每个任务完成后：`cp` 改动文件到 Trae 副本对应路径

---

### Task 1: tailwind.config.js 建立 token

**Files:**
- Modify: `D:\桌面\AI工具\check-in tool-v1\checkin-tool\tailwind.config.js`

**Step 1: 整文件替换为以下内容**

```js
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
```

**Step 2: 同步到 Trae 副本**

```
cp "D:/桌面/AI工具/check-in tool-v1/checkin-tool/tailwind.config.js" "D:/trae-cn/builder文件夹/checkin-tool/tailwind.config.js"
```

**Step 3: 验证**：不构建（后续任务一起验），仅肉眼确认文件保存成功。

---

### Task 2: index.css 全局样式

**Files:**
- Modify: `D:\桌面\AI工具\check-in tool-v1\checkin-tool\src\index.css`

**Step 1: 整文件替换为以下内容**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body {
    @apply bg-surface text-ink-900 antialiased;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }

  #root {
    @apply mx-auto min-h-screen w-full max-w-mobile bg-surface;
  }
}

@layer components {
  /* 区块标题：金色竖条 + 墨色标题，全站统一 */
  .section-title {
    @apply flex items-center gap-2 text-[15px] font-semibold text-ink-900;
  }
  .section-title::before {
    content: '';
    @apply inline-block h-3.5 w-[3px] rounded-full bg-gold-500;
  }

  /* 卡片：白底 + 12px 圆角 + 藏青调柔和阴影 + 浅描边 */
  .card {
    @apply rounded-xl border border-primary-50 bg-white shadow-card;
  }
}
```

**Step 2: 同步 cp 到 Trae 副本**

**Step 3: 验证**：无需单独构建。

---

### Task 3: 安装 lucide-react（在 Trae 副本安装，产物回传真实仓库）

> 注意：真实仓库路径含空格，`npm.cmd --prefix` 会失败（交接文档坑 #2），所以安装必须在 Trae 副本做。

**Step 1: 确认真实仓库与 Trae 副本的 package.json 当前一致**（diff 两文件，不一致先以真实仓库为准覆盖 Trae 副本）

**Step 2: 在 Trae 副本安装**

```
"C:/Program Files/nodejs/npm.cmd" --prefix "D:/trae-cn/builder文件夹/checkin-tool" install lucide-react
```

Expected: 无 error，package.json dependencies 出现 `"lucide-react": "^x.x.x"`

**Step 3: 把 package.json 和 package-lock.json 从 Trae 副本 cp 回真实仓库**

**Step 4: 记录版本号**，写进最终交付说明（用户需在 GitHub Desktop 正常提交这两个文件）。

---

### Task 4: BottomNav.jsx 换新（完整代码）

**Files:**
- Modify: `D:\桌面\AI工具\check-in tool-v1\checkin-tool\src\components\BottomNav.jsx`

**Step 1: 整文件替换**

```jsx
import { NavLink } from 'react-router-dom'
import { CheckCircle2, Clock3, Target, BarChart3, User } from 'lucide-react'

const tabs = [
  { to: '/', label: '打卡', icon: CheckCircle2 },
  { to: '/countdown', label: '倒计时', icon: Clock3 },
  { to: '/goals', label: '目标', icon: Target },
  { to: '/stats', label: '统计', icon: BarChart3 },
  { to: '/profile', label: '我的', icon: User },
]

function BottomNav() {
  return (
    <nav
      className="sticky bottom-0 left-0 right-0 z-50 flex border-t border-primary-50 bg-white"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-xs transition-colors ${
                isActive ? 'text-primary-600' : 'text-ink-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-1/2 top-0 h-[3px] w-5 -translate-x-1/2 rounded-full bg-gold-500" />
                )}
                <Icon size={22} strokeWidth={1.8} />
                <span className={isActive ? 'font-medium' : ''}>{tab.label}</span>
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}

export default BottomNav
```

**Step 2: cp 同步到 Trae 副本 → 构建验证（第一次完整验证点）**

```
"C:/Program Files/nodejs/npm.cmd" --prefix "D:/trae-cn/builder文件夹/checkin-tool" run build
```

Expected: `✓ built in ...`，无 error。若报 lucide 相关错误 → 回 Task 3 检查安装。

---

### Task 5: CheckinPage.jsx 打卡页

**Files:**
- Modify: `D:\桌面\AI工具\check-in tool-v1\checkin-tool\src\pages\CheckinPage.jsx`

**Step 1: 按"全局映射表"机械替换**文件中所有旧灰系类名（该文件无 JSX 结构变化，仅 className 替换）。

**Step 2: 定点改动（这些不是机械替换，是设计升级）**

a) 两个区块标题 `<h2>` 换成：

```jsx
<h2 className="section-title mb-3">我的打卡</h2>
```
```jsx
<h2 className="section-title mb-3">全员打卡动态</h2>
```

b) "我的打卡"标题行右侧加当日进度（h2 与卡片容器之间）：

```jsx
<div className="mb-3 flex items-center justify-between">
  <h2 className="section-title">我的打卡</h2>
  {categories.length > 0 && (
    <span className="text-xs font-medium text-gold-500">
      已完成 {categories.filter((c) => todayCheckins[c.id]).length}/{categories.length}
    </span>
  )}
</div>
```
（原独立 h2 删除，以此块替代）

c) **已打卡卡片**——深藏青反白（设计核心）：

```jsx
className={`flex w-[calc(50%-0.375rem)] ${
  isToday ? 'cursor-pointer' : 'cursor-default'
} flex-col items-center gap-1 rounded-xl border py-4 transition-colors ${
  checked
    ? 'border-primary-800 bg-primary-800'
    : 'card'
}`}
```
卡片内部对应调整：
- emoji：`<span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100/20 text-2xl">{cat.icon}</span>`（已打卡时）/ 未打卡 `bg-primary-100`
- 分类名：已打卡 `text-white`，未打卡 `text-ink-900`
- 已打卡状态行改为金色：

```jsx
<span className="flex items-center gap-1 text-xs font-medium text-gold-500">
  <CheckCircle2 size={14} strokeWidth={2.2} />
  {checkin.note ? (
    <span className="max-w-[80px] truncate">{checkin.note}</span>
  ) : (
    <span>已完成</span>
  )}
</span>
```
- 未打卡状态：`text-xs text-ink-400`，文案"未打卡"
- 文件顶部 `import { CheckCircle2, Pencil, Trash2 } from 'lucide-react'`
- 编辑/删除按钮：emoji ✏️🗑️ 换成 `<Pencil size={14} />` / `<Trash2 size={14} />`（hover 色规则保留）

d) 日期胶囊按钮：边框换 `border-primary-200`，文字 `text-primary-600`。

e) 补卡按钮：`border border-primary-200 bg-white text-primary-600`，文字前加 `<CalendarClock size={16} />`（import 加入），文案"申请补卡"。

f) 全员动态卡片：外层 `rounded-xl bg-white shadow-sm` → `card`；"我"徽章：`rounded bg-gold-100 px-1.5 py-0.5 text-xs text-gold-700`；"N 项"胶囊 `bg-primary-50 text-ink-600`；展开/收起文字前换 `<ChevronDown size={14}>` / `<ChevronUp size={14}>`（去掉 ▲▼ 字符）；条目左侧 emoji 换小号容器 `<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-base">`。

g) 删除确认弹窗（文件内 inline）：按映射表换灰系色即可，红色按钮保留。

**Step 3: cp 同步 → 暂不构建（Task 6 一起验）。**

---

### Task 6: 打卡页四个弹窗

**Files:**
- Modify: `src/components/CheckinModal.jsx`
- Modify: `src/components/MakeupCheckinModal.jsx`
- Modify: `src/components/CategoryFormModal.jsx`
- Modify: `src/components/CategoryManagerModal.jsx`

**Step 1: 四个文件统一按映射表替换灰系类名**；弹窗容器统一 `rounded-2xl`；主按钮 `bg-primary-500 hover:bg-primary-600 text-white`；取消按钮 `border-primary-200 bg-white text-ink-600`；输入框聚焦 `focus:border-primary-500`；危险按钮红色保留。

**Step 2: 弹窗内 emoji 图标**（如有 ✕ 关闭钮）换 `<X size={18} />`；日期相关装饰换 `<CalendarDays size={16} />`。

**Step 3: cp 同步 → 构建 + lint 验证**

```
"C:/Program Files/nodejs/npm.cmd" --prefix "D:/trae-cn/builder文件夹/checkin-tool" run build
```
Expected: 构建通过。再跑项目 lint（package.json scripts 里的 lint 命令）。

---

### Task 7: DatePickerModal.jsx 自绘日历

**Files:**
- Modify: `src/components/DatePickerModal.jsx`

**Step 1:** 容器/按钮按映射表 + 弹窗规范替换；月份翻页箭头（◀▶ 或 emoji）换 `<ChevronLeft size={18}>` / `<ChevronRight size={18}>`；选中日格子 `bg-primary-600 text-white rounded-lg`；"今天"快捷键徽章 `bg-gold-100 text-gold-700`；未来日期置灰用 `text-ink-400 opacity-40`。

**Step 2: cp 同步，不单独构建（并入 Task 8 后验证）。**

---

### Task 8: LoginPage.jsx 登录页

**Files:**
- Modify: `D:\桌面\AI工具\check-in tool-v1\checkin-tool\src\pages\LoginPage.jsx`

**Step 1: 标题区升级**（原文字标题）：

```jsx
<div className="mb-8 flex flex-col items-center gap-3 text-center">
  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-800 shadow-card">
    <CheckCircle2 size={28} className="text-white" strokeWidth={2} />
  </div>
  <div>
    <h1 className="text-2xl font-bold text-ink-900">打卡工具</h1>
    <p className="mt-1 text-sm text-ink-600">每日打卡，共同成长</p>
  </div>
</div>
```
`import { CheckCircle2 } from 'lucide-react'`

**Step 2:** 其余（tab 切换、输入框、按钮、错误提示）按映射表机械替换；登录按钮 `bg-primary-500`；卡片 `card` 类。

**Step 3: cp 同步 → 构建 + lint 验证（登录页独立可验）。**

---

### Task 9: StatsPage.jsx 统计页

**Files:**
- Modify: `D:\桌面\AI工具\check-in tool-v1\checkin-tool\src\pages\StatsPage.jsx`

**Step 1:** 按映射表机械替换。

**Step 2: 定点改动**
- tab 选中态：文字 `text-primary-600 font-medium`，下方加金色下划条 `absolute bottom-0 h-[2px] w-full rounded-full bg-gold-500`（如 tab 为按钮，包一层 relative）
- 天数/次数数字：`text-success-600 font-bold text-xl`（"连续/累计"标注文字 `text-ink-400 text-xs` 保留）
- 分类标签「N次 · M天」：`text-ink-600 text-xs`，数字部分 `text-primary-600 font-medium`
- 黄色 ⚠️ orphan 提示保留 amber 语义不动
- 各区块标题（如有）换 `.section-title`

**Step 3: cp 同步，构建并入下一验证点。**

---

### Task 10: GoalsPage.jsx + GoalCard.jsx + GoalFormModal.jsx 目标页

**Files:**
- Modify: `src/pages/GoalsPage.jsx`
- Modify: `src/components/GoalCard.jsx`
- Modify: `src/components/GoalFormModal.jsx`

**Step 1:** 三文件按映射表机械替换；弹窗按 Task 6 弹窗规范。

**Step 2: 定点改动**
- GoalCard：进度条 `bg-primary-100` 轨道 + `bg-primary-600` 填充，胶囊圆角；达成/完成徽章 `bg-gold-100 text-gold-700 text-xs rounded-full px-2 py-0.5`；目标 emoji 装入 `h-10 w-10 rounded-full bg-primary-100` 容器；卡片外层 `card`
- GoalsPage 区块标题换 `.section-title`；空状态"添加目标"虚线按钮 hover 色 `hover:border-primary-400 hover:text-primary-600` 保留
- GoalFormModal 内原生日期输入框（交接文档遗留项）**本次只换样式，不换控件**（避免范围蔓延；换 DatePickerModal 属后续任务）

**Step 3: cp 同步，构建并入下一验证点。**

---

### Task 11: CountdownPage.jsx + CountdownCard.jsx + CountdownFormModal.jsx 倒计时页

**Files:**
- Modify: `src/pages/CountdownPage.jsx`
- Modify: `src/components/CountdownCard.jsx`
- Modify: `src/components/CountdownFormModal.jsx`

**Step 1:** 映射表机械替换 + 弹窗规范。

**Step 2: 定点改动**
- 倒计时大数字：`text-primary-800 font-bold`（字号沿用现状）
- CountdownCard：`card` 外层；emoji 容器同 GoalCard；到期/进行中徽章——进行中 `bg-primary-100 text-primary-600`、已到期 `bg-red-50 text-red-500`
- CountdownFormModal 日期输入框同 Task 10 原则：只换样式不换控件

**Step 3: cp 同步 → 构建 + lint 验证。**

---

### Task 12: ProfilePage.jsx 我的页

**Files:**
- Modify: `D:\桌面\AI工具\check-in tool-v1\checkin-tool\src\pages\ProfilePage.jsx`

**Step 1:** 映射表机械替换。

**Step 2: 定点改动**
- 头像：找到用户名展示区，改为藏青圆底首字（若无头像展示区则新增一行）：

```jsx
<div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-800 text-lg font-semibold text-white">
  {user?.username?.charAt(0).toUpperCase()}
</div>
```
- 统计卡片：左侧 3px 藏青竖条（同 .section-title::before 的做法，用 `border-l-[3px] border-primary-600` 或独立竖条 div）+ 数字 `text-primary-800 font-bold text-xl`
- 文件内三个 inline 弹窗（改用户名/改密码/注销）按弹窗规范；注销确认红色保留

**Step 3: cp 同步，不单独构建。**

---

### Task 13: Toast.jsx + NetworkStatus.jsx 顺带换色

**Files:**
- Modify: `src/components/Toast.jsx`
- Modify: `src/components/NetworkStatus.jsx`

**Step 1:** Toast 成功态 `bg-primary-800 text-white`、错误态保留红色；NetworkStatus 提示条按映射表。emoji（如有）换对应 lucide 图标（CheckCircle2 / WifiOff / Wifi）。

**Step 2: cp 同步。**

---

### Task 14: 全站构建 + lint 终验

**Step 1: 确认所有改动文件都已 cp 到 Trae 副本**（用 node 脚本逐文件 diff 确认，防漏拷）

**Step 2: 构建**

```
"C:/Program Files/nodejs/npm.cmd" --prefix "D:/trae-cn/builder文件夹/checkin-tool" run build
```
Expected: `✓ built`，0 error

**Step 3: lint**

```
"C:/Program Files/nodejs/npm.cmd" --prefix "D:/trae-cn/builder文件夹/checkin-tool" run lint
```
Expected: 0 error 0 warning

**Step 4: 产物 hash 记录**：读取 `D:/trae-cn/builder文件夹/checkin-tool/dist/index.html` 里的 JS bundle 文件名（形如 `index-XXXX.js`），写进交付说明，供上线后比对。

---

### Task 15: 用户推送指引（点击级，写给新手）

生成一份简短推送指引（对话内直接给，不必落盘）：
1. 打开 GitHub Desktop → 左侧选 checkin-tool 仓库
2. 变更列表应出现：`tailwind.config.js`、`src/index.css`、`package.json`、`package-lock.json`、`src/pages/*.jsx`（6个）、`src/components/*.jsx`（约10个）、`docs/plans/*.md`（2个）——共约 20 个文件，全部勾选
3. Summary 填：`UI改版：商务成熟风（藏青+金）`→ Commit to main
4. Push origin；报 `Recv failure: Connection was reset` 就再点一次 Push
5. 等 2~4 分钟，访问 https://check-intool.online 验收；若想确认部署生效，看线上 index.html 引用的 JS 文件名是否与 Task 14 Step 4 记录的 hash 一致

**验收标准（手机打开逐项核对）：**
- [ ] 底部导航是线条图标，选中项上方有金色短横条，iPhone 底部不顶小黑条
- [ ] 打卡页已打卡卡片为深藏青底 + 金色"已完成"，未打卡为白卡
- [ ] 登录页有藏青圆底对勾徽标
- [ ] 统计页天数数字是绿色加粗，tab 选中带金下划线
- [ ] 所有弹窗圆角一致、主按钮藏青
- [ ] 功能全部正常：打卡、补卡、加分类、看动态、倒计时、目标、统计、登录退出

---

## 里程碑与验证点汇总

| 验证点 | 任务 | 动作 |
|---|---|---|
| V1 | Task 4 后 | build（验证 lucide + token 编译通过） |
| V2 | Task 6 后 | build + lint |
| V3 | Task 8 后 | build + lint |
| V4 | Task 11 后 | build + lint |
| V5 | Task 14 | 终验 build + lint + hash 记录 |
