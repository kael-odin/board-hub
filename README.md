# Board Hub

**私有看板书架。** 把 AI 从 Excel 生成的 HTML 看板收进来，统一展示、管理与追溯 —— 内容经服务端鉴权出库，只有拿到密码的人才能查看与下载。

基于 [kael-odin-blog](https://github.com/kael-odin/kael-odin-blog) 的设计系统改造而来。**没有数据库**：内容是仓库里的文件，登录态是签名的 cookie，写入由服务端 GitHub App 完成。

---

## 它是怎么工作的

```
AI 把 Excel 整成 HTML / 报表
        │
        ├─ 方式 A：网页内编辑（管理员）
        │    /write → 粘贴 HTML 或导入 Excel → 实时预览 → 发布
        │
        ├─ 方式 B：仓库浏览收编（管理员）
        │    /repo → 点开仓库里已有的 .html / .md / .xlsx → 预览 → 一键收进书架
        │
        └─ 方式 C：直接 git push
             把文件放进 content/boards/<slug>/ 提交即可

        ↓
   浏览器 → /api/* （校验登录与角色）→ 服务端用 GitHub App 提交回仓库
        ↓
   Vercel 检测到 push，自动重新部署（约 1-2 分钟）
        ↓
   登录后访问 /boards/<slug> 查看
```

**内容不进 `public/`**：看板存在 `content/boards/` 下，Web 服务器不会直接吐出这些文件；所有读取都经过 `/api/boards/*` 校验会话后返回，拿到直链也读不到。

---

## 权限：两种角色

| | 查看者（viewer） | 管理者（admin） |
|---|---|---|
| 浏览看板 / 看正文 / 图片 | ✅ | ✅ |
| 下载原始数据（.xlsx 等） | ✅ | ✅ |
| 新建 / 编辑 / 删除看板 | ❌ | ✅ |
| 仓库浏览（/repo，含在线编辑、收编） | ❌ | ✅ |
| 站点配置（外观、首页布局） | ❌ | ✅ |
| 看到「隐藏」的看板 | ❌ | ✅ |

登录方式：`/login` 输入密码。用哪个密码登录就是哪种角色（`ADMIN_PASSWORD` / `VIEWER_PASSWORD`，环境变量配置）。查看者不需要任何 GitHub 凭据。

服务端强制执行以上所有规则 —— 前端隐藏按钮只是体验优化，直接调 API 一样会被 401/403 挡住。

---

## 内容结构

```
content/boards/<slug>/        ← git 跟踪，但不作为静态资源对外
  ├── index.html      type=html      iframe 隔离渲染
  ├── index.md        type=markdown  走站点的 markdown 渲染链
  ├── sheet.json      type=sheet     Univer 快照，可在线编辑
  ├── source.<ext>    原始数据附件（.xlsx / .csv 等，详情页可下载）
  └── <sha256>.<ext>  图片等资源（上传时按内容哈希命名）
content/boards/index.json     列表索引（发布时由服务端写入）
```

`config.json` 字段：`{ title, type, tags, date, summary, cover, hidden, category, images, source }`。

| type | 查看 | 编辑 |
|---|---|---|
| `html` | `<iframe srcdoc sandbox="allow-scripts">` 完全隔离 | CodeMirror（HTML 高亮） |
| `markdown` | marked + shiki + katex + mermaid + DOMPurify | CodeMirror（Markdown 高亮） |
| `image` | 图墙 + 灯箱（方向键切换） | 在「图片管理」里增删排序 |
| `sheet` | Univer 表格引擎（只读） | Univer 表格引擎（可编辑） |

### 关于 Excel

导入 `.xlsx` 时前端用 SheetJS 解析成 Univer 快照（存 JSON 文本，可 diff），**同时把原始文件以 `source.<ext>` 存进仓库** —— 展示用快照，追溯用原件，详情页有「原始数据」下载按钮。保真度说明：转换只搬运「值 + 公式 + 日期 + 多工作表」，不搬运样式、条件格式、图表、透视表。

上传体积受服务端函数请求体限制，单个文件上限 **4MB**。

### 渲染隔离与资源鉴权

看板用 `<iframe sandbox="allow-scripts">` 渲染，样式脚本与站点完全隔离。因为 sandbox iframe（opaque origin）发子资源请求时不带 cookie，服务端在返回正文时会给其中的 `/api/boards/<slug>/asset/*` 链接附加签名参数（`?k=`），只有能读到看板正文的人才能拿到这些带签名的资源地址。

---

## 部署（Vercel）

1. 把仓库导入 Vercel（Next.js 会被自动识别，无需额外构建设置）。
2. 配置环境变量（参考 `.env.example`）：

| 变量 | 必填 | 说明 |
|---|---|---|
| `AUTH_SECRET` | ✅ | 会话签名密钥，随机长字符串 |
| `ADMIN_PASSWORD` | ✅ | 管理员密码 |
| `VIEWER_PASSWORD` | 建议 | 查看者密码；不设则没有查看者角色 |
| `GITHUB_OWNER` / `GITHUB_REPO` / `GITHUB_BRANCH` | ✅ | 内容仓库（如 `kael-odin` / `board-hub` / `main`） |
| `GITHUB_APP_ID` | 写入必需 | GitHub App 的 App ID |
| `GITHUB_APP_PRIVATE_KEY` | 写入必需 | App 私钥 `.pem` 全文（多行或 `\n` 转义均可） |
| `NEXT_PUBLIC_GITHUB_OWNER` / `_REPO` / `_BRANCH` | 建议 | 仓库页展示用的仓库标识 |

3. **GitHub App**（服务端提交用）：
   - GitHub → Settings → Developer settings → GitHub Apps → New GitHub App
   - Webhook 取消勾选；权限只需 **Repository permissions → Contents: Read and write**；其余留空
   - 创建后生成 **Private key** 下载 `.pem`，把 App **安装到内容仓库**（Only select repositories）
   - App ID 填 `GITHUB_APP_ID`，`.pem` 全文填 `GITHUB_APP_PRIVATE_KEY`

> 私钥只存在 Vercel 环境变量里，浏览器永远接触不到；浏览器里的写入请求先过管理员会话，再由服务端完成 GitHub 提交。

---

## 本地开发

```bash
pnpm install
cp .env.example .env.local   # 填好 AUTH_SECRET / ADMIN_PASSWORD 等
pnpm dev                     # http://localhost:2025
```

其他命令：`pnpm build`（生产构建）、`pnpm svg`（重新生成 SVG 索引）。

---

## 与其他方案的区别

| | Board Hub | 多维表格（NocoDB/Teable 等） | CRM（Twenty 等） |
|---|---|---|---|
| 内容形态 | AI 生成的任意 HTML | 结构化表格 | 客户/商机记录 |
| 展示自由度 | 完全自由 | 受限于内置视图 | 受限于内置布局 |
| 在线编辑 | 改 HTML 源码 / 表格 | 改单元格 | 改字段 |
| 持久化 | Git 仓库（无数据库） | 数据库 | 数据库 |
| 访问控制 | 密码登录 · 双角色 | 账号体系 | 账号体系 |

适合「AI 生成 → 收纳 → 受控分享」这条链路；需要频繁结构化编辑的数据，多维表格更合适。

---

## 许可

MIT。本项目的设计系统与 GitHub App 编辑能力继承自 [YYsuni/2025-blog-public](https://github.com/YYsuni/2025-blog-public) 模板（经 kael-odin-blog 二次开发），原始版权声明见 `LICENSE`。
