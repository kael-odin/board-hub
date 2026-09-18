# Board Hub

**看板与报表展示中心。** 把 AI 从 Excel 生成的 HTML 看板收进来，用一个网站统一展示和管理。

基于 [kael-odin-blog](https://github.com/kael-odin/kael-odin-blog) 改造而来 —— 保留了它的设计系统、GitHub App 鉴权与浏览器端提交能力，把内容模型从 Markdown 换成了 HTML。

---

## 它是怎么工作的

```
AI 把 Excel 整理成 HTML
        │
        ├─ 方式 A：网页内编辑
        │    打开 /write → 粘贴 HTML → 实时预览 → 发布
        │
        └─ 方式 B：直接 git push
             把 HTML 放进 public/boards/<slug>/index.html 提交即可

        ↓
   浏览器用 GitHub API 把文件 commit 回本仓库
        ↓
   Vercel 检测到 push，自动重新部署（约 30-60 秒）
        ↓
   访问 /boards/<slug> 查看
```

**没有数据库、没有服务端密钥。** 所有内容都是仓库里的文件，鉴权靠你自己的 GitHub App 私钥（只存在浏览器 sessionStorage 里）。

---

## 内容结构

一个看板由 `config.json` 里的 `type` 字段决定形态：

```
public/boards/<slug>/
  ├── index.html      type=html      iframe 隔离渲染
  ├── index.md        type=markdown  走站点的 markdown 渲染链
  ├── sheet.json      type=sheet     Univer 快照，可在线编辑
  ├── config.json     { title, type, tags, date, summary, cover, hidden, category, images }
  └── <sha256>.<ext>  图片等资源（上传时按内容哈希命名）
public/boards/index.json   列表索引（发布时由浏览器写入）
```

| type | 查看 | 编辑 |
|---|---|---|
| `html` | `<iframe srcdoc sandbox="allow-scripts">` 完全隔离 | CodeMirror（HTML 高亮） |
| `markdown` | marked + shiki + katex + mermaid + DOMPurify | CodeMirror（Markdown 高亮） |
| `image` | 图墙 + 灯箱（方向键切换） | 在「图片管理」里增删排序 |
| `sheet` | Univer 表格引擎（只读） | Univer 表格引擎（可编辑） |

`type` 缺省时按 `html` 处理，因此加字段之前发布的内容不会失效。

示例：`public/boards/demo/`（HTML）、`public/boards/sheet-demo/`（表格）。

### 关于 Excel

零后端：`.xlsx` 在前端用 SheetJS 解析成 Univer 快照，存进仓库的是 **JSON 文本**（可 diff、体积小），需要时再现场导出成 `.xlsx`。

**为什么存 JSON 而不是 .xlsx**：`.xlsx` 是二进制 zip，git 无法 diff，每次保存都新增一个完整 blob，仓库会迅速膨胀。

> ⚠️ **保真度有损**：本适配层只搬运「值 + 公式 + 日期 + 多工作表」，**不搬运样式、条件格式、图表、透视表**。
> 官方的完整转换由 `@univerjs-pro/exchange-node` 完成，那是商业授权的 Pro 模块且需要常驻 Node 服务 ——
> 采用它就会打破本项目「纯 Vercel + git、零后端」的架构，因此没有采用。

---

## 渲染方式：iframe 隔离

看板用 `<iframe srcdoc sandbox="allow-scripts">` 渲染，**样式与脚本和站点完全隔离**。

这是刻意的设计：AI 生成的看板通常自带 Tailwind CDN 和内联样式，如果内联渲染，它的类名会和站点的 Tailwind 类名、`--color-*` CSS 变量互相污染。

`sandbox` **故意不给 `allow-same-origin`**，所以 iframe 拿到的是 opaque origin —— 看板里的脚本无法读取站点的 cookie / localStorage，也无法通过 `parent` 操作宿主页面。

---

## 本地开发

```bash
pnpm install
pnpm dev          # http://localhost:2025
```

其他命令：

```bash
pnpm build        # 生产构建
pnpm svg          # 重新生成 src/svgs/index.ts（改了 SVG 后运行）
```

---

## 部署

整站是**完全静态**的（`output: 'export'`）—— 内容都在 `public/` 下，写操作由浏览器直连 GitHub API，没有任何需要服务端渲染的东西。所以能部署到任意静态托管。

### GitHub Pages（当前）

推送到 `main` 会自动触发 `.github/workflows/deploy-pages.yml` 构建并发布到
**https://kael-odin.github.io/board-hub/**

Pages 部署在 `/<repo>/` 子路径下，因此构建时必须设置 `NEXT_PUBLIC_BASE_PATH=/board-hub`，
否则 `public/` 下的内容路径与 `/_next` 资源都会 404。这一点由 `src/lib/asset-path.ts` 处理：

- `withBase(path)` —— 给单个站内绝对路径加前缀
- `rewriteAssets(text)` —— 批量重写看板正文里写死的 `/boards/...`

部署在根路径（Vercel / 自定义域名）时把 `NEXT_PUBLIC_BASE_PATH` 留空，这两个函数会退化成恒等操作。

首次部署需要在仓库 **Settings → Pages** 把 Source 设为 **GitHub Actions**，
并在 **Settings → Secrets and variables → Actions** 添加两个 secret：

| Secret | 说明 |
|---|---|
| `NEXT_PUBLIC_GITHUB_APP_ID` | GitHub App 的 App ID |
| `NEXT_PUBLIC_GITHUB_ENCRYPT_KEY` | 加密浏览器缓存的私钥用，随便一串随机字符 |

> 看板发布本身也是一次 commit，所以内容更新后 Pages 会自动重新部署。

### Vercel

直接导入仓库即可，无需额外配置。**记得把 `NEXT_PUBLIC_BASE_PATH` 留空**。

### 1. 环境变量

部署平台的环境变量（参考 `.env.example`）：

| 变量 | 说明 |
|---|---|
| `NEXT_PUBLIC_GITHUB_OWNER` | 仓库所有者，如 `your-name` |
| `NEXT_PUBLIC_GITHUB_REPO` | 仓库名，默认 `board-hub` |
| `NEXT_PUBLIC_GITHUB_BRANCH` | 分支，默认 `main` |
| `NEXT_PUBLIC_GITHUB_APP_ID` | GitHub App 的 App ID |
| `NEXT_PUBLIC_GITHUB_ENCRYPT_KEY` | 用于加密浏览器里缓存的私钥，随便一串随机字符 |
| `NEXT_PUBLIC_SITE_URL` | 站点地址，如 `https://board-hub.vercel.app` |
| `SITE_URL` | 同上，给 sitemap 用 |

### 2. GitHub App

网页内编辑依赖一个**安装在本仓库上的 GitHub App**：

1. 到 GitHub → Settings → Developer settings → GitHub Apps 新建一个 App
2. 权限只需 **Repository permissions → Contents: Read and write**
3. 创建后生成 **Private key**，下载 `.pem` 文件
4. 把 App **安装到 `board-hub` 仓库**（这一步不能漏，否则提交时会 404）
5. 记下 App ID，填到 `NEXT_PUBLIC_GITHUB_APP_ID`

之后在网站右上角点「导入密钥」，选择那个 `.pem` 文件即可开始编辑。

> ⚠️ 私钥只保存在浏览器的 sessionStorage（加密后），关掉标签页就没了。服务端不存任何密钥。

---

## 与其他方案的区别

| | Board Hub | 多维表格（NocoDB/Teable 等） | CRM（Twenty 等） |
|---|---|---|---|
| 内容形态 | AI 生成的任意 HTML | 结构化表格 | 客户/商机记录 |
| 展示自由度 | 完全自由 | 受限于内置视图 | 受限于内置布局 |
| 在线编辑 | 改 HTML 源码 | 改单元格 | 改字段 |
| 持久化 | Git commit | 数据库 | 数据库 |

适合「AI 生成 → 展示」这条链路；如果是需要频繁结构化编辑的数据，多维表格更合适。

---

## 许可

MIT。本项目的设计系统与 GitHub App 编辑能力继承自 [YYsuni/2025-blog-public](https://github.com/YYsuni/2025-blog-public) 模板（经 kael-odin-blog 二次开发），原始版权声明见 `LICENSE`。
