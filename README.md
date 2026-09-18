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

```
public/boards/<slug>/
  ├── index.html     看板本体（一段完整的 HTML 文档）
  ├── config.json    { title, tags, date, summary, cover, hidden, category }
  └── <sha256>.<ext> 图片等资源（上传时按内容哈希命名）
public/boards/index.json   列表索引（发布时由浏览器写入）
```

`public/boards/demo/` 是一个可直接参考的示例看板。

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

### 1. 环境变量

在 Vercel 项目里配置（参考 `.env.example`）：

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
