<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 网站界面规则

- 全站设置入口统一使用 `app/_ui/settings-button.tsx` 的 `SettingsButton`，包括页面外观、背景、日记和卡片背景设置。
- 设置按钮外观：42px 圆形、21px 白色细线齿轮（描边 1.7）、半透明灰色底、白色细边，不添加常驻外环。仅在键盘聚焦时显示白色焦点描边。图标附近的紫色鸟来自鼠标跟随效果，不绘入按钮。
- 页面只负责设置按钮的位置及打开行为，不自行替换图标、尺寸、颜色或添加外环。必须提供准确的中文 `aria-label` 和悬停提示，保留键盘焦点指示。

## AI 项目上传验收规则

- AI 项目推送、上传文件访问和项目展示页必须使用 `pnpm build` 后的 `pnpm start` 生产服务验收，不能以 `pnpm dev` 的结果代替使用者验收。
- 从独立项目目录运行 `scripts/push-to-lyrebird.mjs`，通过 `LYREBIRD_URL` 指向生产服务；不得直接编辑 `data/projects.json` 代替推送流程。
- 必须在服务启动后推送新增文件，并在不重启服务的情况下验证航迹卡片、详情、图片、README、文件预览和下载。运行时文件读取使用 `/api/projects/files/`，不能依赖启动时扫描的 public 静态文件。
- 从浏览器的使用者路径检查浅色与深色模式，覆盖主标题、章节标题、README 标题、画廊和附件预览。项目详情的深色标题应为白色加粗，新增章节同样遵守。

## 协作与数据兼容

- 开始修改前阅读 `CONTRIBUTING.md`，先检查 Git 状态、相关页面和共享组件。保留工作区已有的未提交改动；未经明确指令不得提交、推送或合并。
- 保留协作者实现的首页导航、入场动效、视频背景及背景跟随能力。共享背景走 `app/_background/media.tsx`，用户明确选择“跟随主页”时才跟随，独立背景不能因修改其他页面而被重置。
- 航迹显示名称为“航迹 / Trajectory”，路由继续使用 `/dossier`，存储继续使用 `lyrebird-dossier`。名称调整不能顺便改掉已有链接、记录 ID 或存储键。
- 不得通过清空 localStorage、删除 IndexedDB、覆盖用户项目文件或回填演示数据修复错误。改变结构时提供兼容读取或明确迁移；读取失败时保留原数据并显示可理解的错误。
- 浮光卡片必须完整呈现文字，允许全区域拖动并保存位置，放下后继续轻柔浮动。进入最后一页、分页删除后重排页码及至少保留一页的规则不能被破坏。
- 航迹项目卡片、详情和成长归档共用项目数据；同 ID 推送用于更新，不能创建重复分区。README 必须按源文件所在目录解析相对链接，目录上传必须保留路径。
- 共鸣当前是本地原型。身份切换和邀请码不是服务端鉴权，不得宣称已实现真实双人云同步；编辑本人日记限制、心愿重复完成保护、纪念日闰年处理和坏数据保护必须保留。
- 全站主题使用 `app/_theme/theme.tsx`；动画尊重减少动态效果偏好，不遮挡正文点击、输入、拖动及键盘操作。页面之间切换后应清理事件、计时器和对象 URL。
- 发布前检查未跟踪文件，确保运行时引用的 `flowball` 动画、Logo、图标和背景资源随源码一起交付。私人文件排除规则不能为了“完整上传”而删除。
