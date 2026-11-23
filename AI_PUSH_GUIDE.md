# 向 Lyrebird 推送项目

在要推送的项目根目录放置 `lyrebird.json` 和 `README.md`。`id` 用于后续更新同一项目，只能包含英文字母、数字、下划线和连字符。

```json
{
  "id": "my-project",
  "title": "项目名称",
  "tagline": "一句话简介",
  "period": "2026.11",
  "role": "负责的角色",
  "stack": ["Next.js", "TypeScript"],
  "highlights": ["成果亮点一", "成果亮点二"],
  "url": "https://example.com",
  "cover": "images/cover.png"
}
```

先在 Lyrebird 目录运行 `pnpm build`，完成后运行 `pnpm start`。再进入待推送项目目录，执行：

```powershell
node "<Lyrebird 克隆目录>\scripts\push-to-lyrebird.mjs"
```

脚本会上传当前目录的文件并保留子目录，跳过 `.git`、`node_modules`、`.next`、构建目录、`.env*` 和密钥文件。`README.md` 会作为项目说明显示。刷新个人志后，新项目会出现在精选项目卡片和成长归档中。

本机默认连接 `http://localhost:3000`，默认密钥是 `lyrebird-dev-key`。修改 Lyrebird 的 `.env.local` 后，请在推送终端设置相同的 `LYREBIRD_SYNC_KEY`。连接其他地址时设置 `LYREBIRD_URL`。项目数据和上传文件只写在本机，分别位于 `data/projects.json` 和 `public/uploads/projects/`；这两个路径已加入 `.gitignore`。

## 让 AI 整理成展示页

把下面这段交给能读取项目文件、整理图片和运行命令的 AI，并附上本说明书：

> 请阅读当前项目的代码、README 和已有图片，整理成用于 Lyrebird 个人志的对外项目展示。根据实际内容填写 lyrebird.json：标题、一句话简介、时间、角色、技术栈、成果亮点；挑选封面和截图，补充图片说明，按「项目背景、实现方法、我的贡献、成果与复盘」编排 showcase.sections。只写有依据的内容，不虚构成果。整理 README，检查引用图片都存在；检查即将上传的文件，排除隐私、凭据和无关素材。最后运行 Lyrebird 的推送脚本，并把返回的展示页链接给我。更新时沿用同一个 id。

在上面的 JSON 中可加入 `showcase`，指定展示页的图片顺序和章节。所有图片路径相对于待推送项目根目录，图片文件需要一起上传：

```json
{
  "showcase": {
    "highlights": ["已实现的核心功能", "有依据的项目成果"],
    "gallery": [
      { "path": "images/overview.png", "caption": "整体界面与主要使用流程" },
      { "path": "images/detail.png", "caption": "关键交互细节" }
    ],
    "sections": [
      { "title": "项目背景", "body": "说明使用场景与要解决的问题。支持 Markdown。" },
      { "title": "实现方法", "body": "说明方案和关键实现。", "image": "images/detail.png" },
      { "title": "成果与复盘", "body": "记录实际结果、个人贡献和后续方向。" }
    ]
  }
}
```

有 `showcase` 时，详情页会展示亮点卡片、有说明的图片画廊和分章节正文；README 与文件仓库继续保留。没有填写时，原有项目展示方式仍可使用。网页和接口负责展示及接收数据，AI 总结、选图和图片制作由你使用的外部 AI 完成；仅把网址交给不能访问本机文件或运行脚本的 AI，无法自动上传本地项目。

## 测试一条项目

1. 在另一个测试目录创建 `lyrebird.json`（使用上方格式，id 设为 `demo-project`）和 `README.md`；若填写了图片路径，在对应目录放入真实图片。
2. 在 Lyrebird 目录运行 `pnpm build`，完成后运行 `pnpm start`。本功能必须用生产服务测试，不能用开发模式代替使用者验收。
3. 在测试目录执行以下 PowerShell 命令：

```powershell
$env:LYREBIRD_URL = "http://localhost:3000"
$env:LYREBIRD_SYNC_KEY = "lyrebird-dev-key"
node "E:\100_project-going on\myidea1\lyrebird\scripts\push-to-lyrebird.mjs"
```

4. 刷新 `/dossier`，点击新增项目卡片；或打开 `/dossier/project/demo-project`。修改 README 或图片后再次执行命令，同 ID 会更新现有项目，未在本次上传的旧文件会保留。

验收时保持生产服务运行，推送后直接从卡片进入详情，确认新图片、README、预览和下载不需要重启即可使用。分别检查浅色和深色模式下的标题、正文和画廊。若使用 `pnpm start --port 3001`，将 `LYREBIRD_URL` 设为 `http://localhost:3001`。

脚本最多上传 1000 个文件，总计 100 MB。网页手动上传的附件仍存在当前浏览器 IndexedDB；AI 推送的数据保存在运行服务器的磁盘。`.gitignore` 只防止文件被提交到 Git：已推送的文件可通过网站链接访问，请只推送愿意对外展示的材料。上线运行需要可持久写入的服务器磁盘，临时文件系统不能长期保存项目。
