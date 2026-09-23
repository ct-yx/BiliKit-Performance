# BiliKit Performance

面向 Bilibili 的 Edge/Chromium userscript。重点优化首页信息流封面 CDN、有限预加载和首页布局稳定，同时保留 B 站原生预览与交互。

## 功能

- 首页图片 CDN 按地区和实际图片节点探测选择；地域未确认时沿用 B 站原始地址。
- 复用短期节点缓存；网络恢复或连接类型变化后合并进行一次重新探测。
- 对失败图片只回退该资源；连续失败后切换后续资源使用的节点，不批量重载已显示图片。
- 首页信息流观察器共享新增节点调度，避免全页面重复扫描及卡片内部预览变化触发布局处理。
- 首屏可见封面保持高优先级；视口下方约两行仍有限预加载，但使用浏览器默认优先级，减少与首屏请求的竞争；不处理视频预览内容。
- 首页推荐请求保留原始 `Request` 参数，只对幂等 GET/HEAD 的网络错误或 5xx 有限重试，不定时中止正常请求。
- 保留播放 CDN 适配、原有设置键 `bilikit:` 和调试统计接口。

## 安装与升级

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或兼容的用户脚本管理器。
2. 从 [bilikit-performance.user.js](https://raw.githubusercontent.com/ct-yx/BiliKit-Performance/main/bilikit-performance.user.js) 安装。
3. 如果仍安装着旧版 BiliKit Core，请先停用旧版，再启用 BiliKit Performance，避免两个脚本同时运行。

这是一个使用新名称和 namespace 的新脚本身份，旧版不会自动升级到本仓库。设置仍使用原有 `bilikit:` 键。

## 调试

在 Bilibili 首页开发者工具 Console 查看：

```js
window.__BILIKIT_HOME_FEED_STATS__
window.__BILIKIT_HOME_FEED_COORDINATOR_STATS__
window.__BILIKIT_HOME_LAYOUT_STATS__
window.__BILIKIT_HOME_FEED_PRIORITY_STATS__
window.__BILIKIT_HOME_IMAGE_STATS__
window.__BILIKIT_CDN_STATS__
```

其中首页图片节点的 `hostSource`、`region`、`probe`、`fallbackCount` 用于确认 CDN 实际选择与回退；`retryRequests` 应只在网络错误或 5xx 时增长。统计对象只用于诊断，不包含 Cookie 或认证信息。

## CDN 和原生行为边界

只改写 B 站 `i0/i1/i2.hdslb.com/bfs/` 图片对象。地域未知时不强制换节点；已完成且正在显示的图片不会为换节点而重新下载；加载中或后来新增的图片可以使用当前优选节点。MCDN 签名链路不会被伪造，播放/悬停预览内容、质量和交互不由封面预加载逻辑改变。免登录状态下需要登录的收藏、稍后再看、点赞失败是 B 站预期行为。

## 许可

MIT License；原脚本作者与上游信息见 userscript 元数据和 [LICENSE](LICENSE)。
