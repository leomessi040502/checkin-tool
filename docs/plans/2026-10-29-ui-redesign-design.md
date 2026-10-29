# UI 改版设计文档 —— 商务成熟风（藏青 + 金点缀）

> 日期：2026-10-29 ｜ 状态：用户已确认通过
> 范围：美观与排版优化，仅动"皮"（className 与展示层 JSX），不动任何数据逻辑、交互流程、路由与 Supabase 查询。

## 一、用户拍板的四要素

1. 风格：商务成熟风（克制、精致、有质感）
2. 图标：界面装饰 emoji 全部换成 lucide-react 线条图标；分类 emoji 保留，装入统一圆形容器
3. 范围：一次全改（6 个页面 + 底部导航 + 所有弹窗），一次推送验证
4. 主色：藏青 + 金点缀

## 二、设计系统（写入 tailwind.config.js）

### 色彩 token

| token | 值 | 用途 |
|---|---|---|
| primary-800 | #1B2A4A | 主色；已打卡卡片深底；头像圆底 |
| primary-700 | #223457 | 深色按钮 hover |
| primary-600 | #263E66 | 交互色、图标色、链接文字 |
| primary-500 | #33507F | 按钮主色（主要 CTA） |
| primary-200 | #C9D6EA | 边框、描边 |
| primary-100 | #E8EDF5 | 浅底：emoji 容器、次级按钮底 |
| primary-50 | #F2F5F9 | 最浅底 |
| gold-500 | #C9A24B | 金点缀（下述三处） |
| gold-100 | #F7F0DD | 金浅底（徽章） |
| gold-700 | #854F0B | 金底上的文字 |
| ink-900 | #121F38 | 主文字 |
| ink-600 | #5A6474 | 次级文字 |
| ink-400 | #8A94A6 | 弱化文字 |
| surface | #F6F7F9 | 页面背景（替换 gray-50） |
| success-600 | #2F855A | 成功绿：打卡天数数字（保留绿色语义） |

### 金色使用边界（克制原则）

仅限三处，出现即代表"成就/强调"：
1. 区块标题左侧 3px 竖条
2. 已打卡卡片的"已完成"标识（圆圈勾 + 文字）
3. 底部导航选中项顶部 20px 短横条

### 字号层次

- 页面标题 20px / semibold
- 区块标题 15px / medium（配金色竖条）
- 正文 14px，辅助 12px，弱化 11px

### 圆角 / 阴影 / 边框

- 卡片 rounded-xl（12px），弹窗 rounded-2xl（16px），按钮/输入框 rounded-lg（8px）
- 卡片阴影：`0 1px 3px rgba(27,42,74,0.06)`
- 边框：0.5~1px `#E3E7EE`

## 三、全局骨架

- `index.css`：body 背景改 surface；#root 保留 480px 限宽
- 底部导航（BottomNav.jsx）：
  - 图标换 lucide-react：打卡=CheckCircle2、倒计时=Clock3、目标=Target、统计=BarChart3、我的=User
  - 选中态：藏青 600 图标+文字，顶部金色短横条（20px 宽）
  - 未选中：#A8B0BE
  - 新增 `padding-bottom: env(safe-area-inset-bottom)` 适配 iPhone
- 图标依赖：`lucide-react`（新增 package.json 依赖，tree-shakable，仅打包用到的图标）

## 四、各页面设计要点

### 打卡页（首页）
- 问候语保留；日期胶囊按钮白底藏青描边
- 已打卡卡片：深藏青底（primary-800）+ 反白分类名 + 金色"已完成"标识（CircleCheck 图标）；emoji 放入 28px 圆形容器（primary-100 底）
- 未打卡卡片：白底浅边，emoji 容器 primary-100，分类名 ink-900，"未打卡" ink-400
- 区块标题"我的打卡/全员打卡动态"带金色竖条；"我的打卡"右上角金色小字"已完成 N/M"
- 补卡按钮：白底藏青描边 + PlusCircle 图标
- 全员动态卡片：头像 = 藏青圆底 + 用户名首字白字；"我"徽章金浅底；条目左侧 14px 图标方块容器

### 登录页
- 标题升级：藏青圆底 CircleCheck 徽标 + 主标题 ink-900
- 模式切换 tab：选中白底藏青字（沿用结构，换色）
- 登录/注册按钮：primary-500 藏青底；禁用态浅灰不变
- 错误提示保留红色

### 统计页
- tab 选中：藏青文字 + 金色短下划线
- 天数/次数数字：成功绿 #2F855A 加粗放大（"连续/累计"标注保留）
- 卡片与提示条按新 token 换色，黄色 orphan 提示保留警示语义（amber 系）

### 目标页 / 倒计时页
- 进度条藏青填充、圆角胶囊；达标/完成徽章金色浅底
- 倒计时大数字藏青加粗
- GoalCard/CountdownCard 内 emoji 装入圆形容器统一观感

### 我的页
- 头像：藏青圆底 + 用户名首字
- 统计卡片：左侧 3px 藏青竖条 + 数字强调
- 各设置弹窗按弹窗统一规范

### 所有弹窗（统一规范）
- 容器 rounded-2xl、白底
- 主按钮：primary-500 藏青底白字；取消：白底浅描边 ink-600
- 危险操作（删除/注销）保留红色系
- 输入框：rounded-lg，聚焦藏青描边
- DatePickerModal：格子选中态藏青、今天快捷键金浅底徽章

## 五、明确不动的（边界）

- 数据逻辑、Supabase 查询、RLS、worker.js、reminder.js
- 交互流程：自绘日历"点确定才切换"、全员动态折叠、补卡流程
- 路由结构与 ProtectedRoute
- 分类 emoji 的存储与用户选择自由

## 六、实施与验证流程

1. 直接改真实仓库 `D:\桌面\AI工具\check-in tool-v1\checkin-tool` 的文件
2. cp 同步到 Trae 副本 `D:\trae-cn\builder文件夹\checkin-tool`
3. `"C:/Program Files/nodejs/npm.cmd" --prefix "D:/trae-cn/builder文件夹/checkin-tool" run build` 验证 + lint
4. 告知用户在 GitHub Desktop Commit + Push
5. 2~4 分钟后线上生效，手机打开 https://check-intool.online 对照设计稿验收

## 七、风险与回滚

- 纯样式改动，无数据风险；最坏情况 git revert 上一个 commit 即可整体回滚
- lucide-react 新增依赖：体积影响极小（按需打包），构建若报错则检查 import 路径
