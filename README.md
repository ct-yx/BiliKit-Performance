# BiliKit Core (Edge/Chromium)

面向 Microsoft Edge / Chromium 的 Bilibili 油猴核心脚本，重点优化播放 CDN 命中和海外网络下的卡顿问题。

## 功能

- 改写 Bilibili 播放接口返回的 DASH、DURL 和 PGC 嵌套播放地址。
- 同时覆盖 `fetch`、XHR、`JSON.parse`、`__playinfo__` 与 `__INITIAL_STATE__` 这几条常见数据链路。
- 智能识别 Akamai、AWS/海外镜像、BStar、香港 Equinix、PCDN/IP 等地址，并切换到可配置的镜像节点。
- MCDN 保留 Bilibili 原始代理链路，避免直接替换 Host 造成 `403`。
- 保留原始主地址、备用地址、路径和签名查询参数。
- Edge/Chromium 播放连续 `waiting`、`stalled` 或报错时，可自适应切换到强制模式并刷新一次。
- 提供设置面板和 `window.__BILIKIT_CDN_STATS__` 运行统计。

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或兼容的用户脚本管理器。
2. 打开仓库中的 `BiliKit Core.edge.user.js`，点击 Raw，再由 Tampermonkey 安装。
3. 如果已安装原版 BiliKit Core，请先停用原版，避免两个脚本同时改写播放数据。
4. 打开 Bilibili 首页的 BiliKit 设置，确认“CDN 优选”已启用。

默认配置为“智能模式 + Edge 卡顿自适应 + `upos-sz-mirrorhw.bilivideo.com`”。节点质量取决于运营商、地区和时段；如果智能模式没有改善当前线路，可在设置面板尝试“强制改写”或其它节点。

## 查看是否生效

在 Bilibili 播放页的开发者工具 Console 中执行：

```js
window.__BILIKIT_CDN_STATS__
```

重点查看：

- `rewriteCount`：实际改写的播放条目数量。
- `lastSourceHost`：最近一次被改写的原始节点。
- `lastTargetHost`：最近一次使用的目标节点。
- `mode`：当前实际模式，卡顿自适应触发后会变为 `force`。

`rewriteCount: 0` 不一定表示脚本失效，也可能表示 Bilibili 当前已经分配了智能模式不会改写的国内节点。

## CDN 兼容说明

本脚本的节点识别参考 [BiliUniverse/Redirect v0.2.21](https://github.com/Biliverse/Redirect/releases/tag/v0.2.21) 的公开规则。该项目在 2026-09-13 的版本更新中补充了香港 Equinix CDN，并明确了 PCDN/MCDN 的专用端口与代理处理方式。

脚本只对能够安全直接替换 Host 的媒体地址执行改写。MCDN 的 `:8000`、`:8082`、`:4483`、`:9102` 端口及其代理签名链路不做简单 Host 替换。

## 许可

MIT License。原脚本作者与上游信息见脚本头部元数据。
