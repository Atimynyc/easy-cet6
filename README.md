# easy-cet6 · 六级碎片化刷题

纯前端、无构建。打开 `index.html` 即可使用（建议用本地静态服务，避免部分浏览器限制 `file://`）。

## 目录

```
index.html              页面骨架与样式
app.js                  交互逻辑
data/dict.js            词库
data/sample-papers.js   公开示例套（默认）
data/papers.js          历年真题（本地自备，已 gitignore）
cet6-standalone.html    旧单文件版（保留备份，可删）
```

## 加载真题

1. 将真题数据保存为 `data/papers.js`，格式：

```js
window.PAPERS_DATA = [ /* 套次数组 */ ];
```

2. 刷新页面。题库芯片会显示「真题库 · N 套」。

若没有 `data/papers.js`，自动使用 `data/sample-papers.js` 示例数据。

本地已有真题时，可从旧单文件导出，或直接使用本仓库拆分时生成的 `data/papers.js`（勿提交到公开远程）。

## 进度

学习进度保存在浏览器 `localStorage` 键 `easy-cet6-v1`。可在「我的」页导出 / 导入 / 清空。

## 开发

无需 npm。用任意静态服务器即可，例如：

```bash
python -m http.server 8765
```

然后打开 http://127.0.0.1:8765/
