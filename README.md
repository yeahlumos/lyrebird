# Lyrebird（琴鸟）

Lyrebird 是一个使用 Next.js App Router、TypeScript 和 Tailwind CSS 构建的个人空间。主页通向浮光、独白、航迹和共鸣；造物保留背景与空白内容区，引力场和树洞目前为占位。

浮光用于漂浮灵感记录；独白按日期保存图文；航迹包含履历、成长归档和项目展示；共鸣提供本地关系日记、纪念日与共同心愿。全站支持深浅色、可选飞鸟动效和背景设置。

## 本地运行

需要 Node.js 20.9 或更新版本，以及 pnpm 11。克隆仓库后在项目根目录运行：

```powershell
corepack enable
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。如果 3000 端口被占用，使用终端输出的地址。修改代码后开发服务器会自动刷新；已有页面可手动刷新查看最新内容。

## 数据存放

各空间的浏览器记录主要保存在 localStorage；上传的背景、配图与详情附件使用 IndexedDB，共鸣部分头像和卡片背景使用压缩 Data URL。同一台设备换浏览器或清除网站数据后，这些内容不会自动同步。

共鸣的邀请码、身份切换和双人日记目前仅用于本浏览器体验，没有跨设备绑定或云同步。纪念日提醒在网站打开时运行，不提供关闭网站后的后台通知。

AI 项目推送接口使用本机文件 `data/projects.json` 和 `public/uploads/projects/`。这些路径以及 `.env.local` 已排除在 Git 之外。新克隆的仓库没有作者的私人记录，页面会从空白状态正常运行；每位使用者可以自行添加内容。

## 项目推送

项目详情页支持文件和文件夹上传。通过其他项目目录批量推送时，按 [AI_PUSH_GUIDE.md](AI_PUSH_GUIDE.md) 准备 `lyrebird.json` 与 `README.md`。本地默认开发密钥见 `.env.example`；把接口放到可被他人访问的服务器之前，必须在 `.env.local` 中设置独立的 `LYREBIRD_SYNC_KEY`。

接口会写入服务器本机磁盘。部署到没有持久可写磁盘的托管环境时，项目推送数据不能靠当前文件存储方式保留。

## 检查

```powershell
pnpm lint
pnpm build
```

开发按小阶段进行，每次只实现当前指定的功能。

协作者请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 与 [AGENTS.md](AGENTS.md)。本地待发布改动的审阅清单见 [UPDATE_REVIEW.md](UPDATE_REVIEW.md)。
