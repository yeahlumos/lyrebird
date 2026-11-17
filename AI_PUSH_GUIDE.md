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

先在 Lyrebird 目录运行 `pnpm dev`。再进入待推送项目目录，执行：

```powershell
node "<Lyrebird 克隆目录>\scripts\push-to-lyrebird.mjs"
```

脚本会上传当前目录的文件并保留子目录，跳过 `.git`、`node_modules`、`.next`、构建目录、`.env*` 和密钥文件。`README.md` 会作为项目说明显示。刷新个人志后，新项目会出现在精选项目卡片和成长归档中。

本机默认连接 `http://localhost:3000`，默认密钥是 `lyrebird-dev-key`。修改 Lyrebird 的 `.env.local` 后，请在推送终端设置相同的 `LYREBIRD_SYNC_KEY`。连接其他地址时设置 `LYREBIRD_URL`。项目数据和上传文件只写在本机，分别位于 `data/projects.json` 和 `public/uploads/projects/`；这两个路径已加入 `.gitignore`。
