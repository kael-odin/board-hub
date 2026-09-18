# kael-odin-blog 改进路线图

> 2026-09-18 凌晨自主改进会话产出。基础：fork 自 YYsuni/2025-blog-public 的 Next.js 博客，Vercel 部署，GitHub App 网页端编辑内容回写仓库。

## ✅ 本次已完成（已上线验证）

### P0 — 写作可靠性
| 项 | 说明 | 验证 |
| --- | --- | --- |
| 草稿 + 自动保存 | 编辑器每 800ms 存 localStorage，`pagehide` 兜底；≤400KB 图片随草稿转 dataURL 保存；刷新后自动恢复并提示；发布/删除成功自动清草稿 | 构建通过，逻辑评审 |
| 真正的上下线 | hidden 文章：RSS / sitemap 排除、文章页 robots noindex、访客侧显示「文章不存在」（已认证不受影响） | 线上实测：RSS/sitemap 排除 ✅、noindex ✅ |
| slug 查重 + 校验 | 新建时远端查重防覆盖旧文；slug 字符集/长度校验、标题必填（错误先于鉴权提示） | 构建通过 |
| 修 bug | 照片页删除按钮缺 `group` 类永远不可见；首页拖拽布局「保存」现在真实提交 card-styles.json（含密钥引导）；meta-section console.log | 构建通过 |
| 点赞实时化 | GET 读数改走 Contents API（installation token 内存缓存 45min），消除 raw CDN 5 分钟延迟；前端失败不再假 +1 | 线上实测：POST 后立即 GET=1 ✅ |
| 文章页 SEO | `/blog/[id]` 改服务端包裹 + `generateMetadata`：文章级 title/description/OG 图/发布时间/keywords | 线上实测：og:title ✅ |
| 旧图回收 | 编辑文章时自动对比新内容引用与文章目录现存文件，同一次提交删除不再被引用的旧图片 | 构建通过 |
| 类型安全 | 关闭 `typescript.ignoreBuildErrors`，类型错误从此阻断部署（当前基线 0 错误） | `pnpm build` 通过 |

### P1 — 内容能力
| 项 | 说明 |
| --- | --- |
| 图片自动压缩 | 编辑器入库图片自动转 WebP（quality 0.82、超宽缩至 1920、压缩无收益则保留原图），共享工具 `src/lib/image-compress.ts` |
| 视频支持 | 正文单独一行粘贴 B站/YouTube 链接自动转 16:9 嵌入播放器（`video-embed.tsx`）；编辑器支持本地上传 mp4/webm（≤80MB），正文渲染 `<video>` |
| Mermaid 图表 | ` ```mermaid ` 代码块渲染为 SVG（securityLevel=strict），失败降级为普通代码块 |
| XSS 消毒 | 文章 HTML 全量过 DOMPurify（白名单放行 iframe 等合法嵌入） |
| 项目页升级 | 可选 16:9 封面大图、GitHub star 数展示（会话缓存）、标签筛选、空状态提示 |
| 编辑器分屏预览 | 宽屏（2xl）右侧实时预览，开关持久化；slug 由标题自动生成（中文转拼音，按需加载 pinyin-pro） |

### P2 — 体验与清理
- **暗色模式（全站）**：左下角太阳/月亮切换器（localStorage 持久化 + 首帧防闪烁脚本）；`--lc-*`/`--dk-*` 双层 token 映射，站点配置的浅色主题不受影响；代码块 shiki 双主题（one-light / one-dark-pro）；mermaid 图表跟随主题；背景插画自动压暗；全站 50+ 文件补齐 `dark:` 配对类。浏览器逐页 QA 通过（首页/文章/编辑器/项目/关于 + 往返切换与浅色回归检查）。
- **编辑器移动端适配**：窄屏纵向堆叠、操作按钮换行，手机可以写文章了。
- 音乐卡歌单化：`src/config/playlist.json` 追加 `{name,url}` 即可加歌，自动连播/跳错曲。
- giscus 评论脚手架：默认关闭；在 giscus.app 生成参数填入 `site-content.json → comments.giscus` 并 `enabled:true` 即启用。
- 清理：`lang=zh-CN`、允许双指缩放、About 文案个人化、删除死代码（`music/list.ts`、`batch-delete-blogs.ts`、`upsertBlogsIndex`）、移除原作者残留（'Suni' 回退、package/wrangler 名称）。

## 📌 使用备忘
- **写文章**：首页「写文章」→ 导入 .pem（Downloads 里有 `kael-odin-blog.*.pem`）→ 编辑器改完即自动存草稿；手机也能写。
- **明暗主题**：左下角太阳/月亮按钮，选择会记住；文章内代码块、mermaid 图表都会跟随。
- **加音乐**：音频放 `public/music/`，在 `src/config/playlist.json` 加一条。
- **开评论**：见上 giscus 三步。
- **视频**：B站/YouTube 直接贴链接；本地视频≤80MB 从「图片管理」上传。

## ✅ 2026-09-18 凌晨会话追加完成
- **Vercel Web Analytics**：根布局挂载 `@vercel/analytics/react`，线上已验证脚本注入（生产环境控制台即可看流量）。
- **robots.txt**：`src/app/robots.ts`，放行全站、屏蔽 /write 与 /api、指向 sitemap。
- **next/image 渐进迁移**：艺术图/头像/文章封面缩略图/项目图标与封面/**文章正文图**均已迁移（`/_next/image` 优化+srcset，生产实测生效）；正文图带守卫——blob:/data: 源（编辑器预览）自动回退原生 img，灯箱大图保持原生；配置 `dangerouslyAllowSVG` 支持 SVG 插图。
- **圣诞装饰暗色调校**：雪花雪点两主题保持白色（暗色下更清晰）；全局清理 14 处 dark 类双写残留。
- **移动端文章封面**：手机端文章页顶部补显示封面（桌面仍走侧栏）。
- **OG 图回退**：无封面文章社交分享回退为站点头像。
- **窄屏溢出保护**：Markdown 表格与 KaTeX 块级公式可横向滚动。
- **板块页独立标题**：11 个板块页改为 server metadata wrapper，各自拥有中文标题与描述（博客文章/我的项目/推荐分享/优秀博客/照片墙/碎语/时钟/关于本站/图片压缩/Live2D/SVG 图标库）。
- **命名修正**：`aritcle-card.tsx` → `article-card.tsx`。

## 🔜 待办（按价值排序，未实施）
1. **hidden 的强保护**：内容文件仍以静态资源存在，拿到直链仍可读（架构限制）；若需强保护需改为服务端鉴权 API 出内容——涉及内容加载架构重设计，建议单独规划。

## 🔧 运维备忘
- Vercel 环境变量：`NEXT_PUBLIC_GITHUB_APP_ID=3002414`、`GITHUB_APP_PRIVATE_KEY`（.pem 全文）。**改 NEXT_PUBLIC_* 后必须 Redeploy**。
- GitHub 账号旧名 `ordin-thordata`（改名重定向对 raw 有效、对 API 子路径 404）——配置里不要再写旧名。
- 点赞数据在仓库根 `likes.json`，由 Vercel 服务端凭据提交（bot 记录）。
