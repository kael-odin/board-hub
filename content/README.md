# content/ —— 看板内容目录

这里存放书架上所有看板的**原始数据**。这个目录不会作为网页直接对外提供，
所有读取都要经过站点的鉴权接口（`/api/boards/*`），只有登录用户能看到。

## 目录结构

```
content/
  boards/
    index.json              ← 书架索引（自动维护，勿手改格式）
    <slug>/                 ← 每个看板一个目录，slug 即访问地址 /boards/<slug>
      config.json           ← 元信息：标题/类型/标签/摘要/封面/hidden 等
      index.html            ← type=html   的看板正文（AI 生成的完整 HTML）
      index.md              ← type=markdown 的看板正文
      sheet.json            ← type=sheet   的表格快照（在线可编辑）
      source.xlsx / .csv …  ← 原始数据附件（详情页「原始数据」按钮下载的就是它）
      <sha256>.<ext>        ← 正文引用的图片，按内容哈希命名
```

## 约定

- **html 文件** → `content/boards/<slug>/index.html`
- **md 文件** → `content/boards/<slug>/index.md`
- **excel 文件** → 转换后的快照在 `sheet.json`，**原始 xlsx 一律叫 `source.<原扩展名>`**（如 `source.xlsx`），原始文件名记录在 `config.json` 的 `source.name` 里
- **图片** → 与看板同目录，哈希命名；正文里通过 `/api/boards/<slug>/asset/<文件名>` 引用
- 新建看板推荐直接用网页：`/write`（发布）或 `/repo`（把仓库里已有的文件收进书架）

## 手动放一个看板（git push 方式）

1. 建目录 `content/boards/my-report/`
2. 放一个 `index.html`（或 `index.md`）
3. 写一个最小 `config.json`：

```json
{ "title": "我的报表", "type": "html" }
```

4. 在 `content/boards/index.json` 里加一条（照抄已有条目的格式）
5. 提交并推送，Vercel 重新部署后即可访问
