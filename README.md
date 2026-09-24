# BiliKit Performance

面向 Bilibili 的 Edge / Chromium userscript，重点优化首页信息流、搜索页和播放页的网络调度与 CDN 使用，同时尽量保留 B 站原生预览、播放器和交互行为。

当前版本：**0.6.6**

脚本文件：[bilikit-performance.user.js](bilikit-performance.user.js)

仓库：[ct-yx/BiliKit-Performance](https://github.com/ct-yx/BiliKit-Performance)

## 功能概览

### 首页信息流

- 在 `document-start` 阶段预连接首页常用接口和图片域名。
- 提升首页推荐接口、播放接口的请求优先级；辅助接口使用较低优先级，减少首屏竞争。
- 首页推荐只对幂等的 `GET` / `HEAD` 请求处理网络错误或明确的 `5xx`，最多进行一次短延迟重试；保留原始 `Request`、请求头、凭据、`signal` 和 `init` 参数，不定时中止正常请求。
- 通过统一的首页 Feed 协调器处理新增卡片和图片资源，避免多个全页面观察器重复扫描。
- 默认隐藏首页信息流中的 `.floor-single-card` 广告楼层；不隐藏普通视频卡片，不修改视频悬停预览。
- 首屏可见封面使用较高图片优先级；视口下方默认预加载约 6 行，可在设置中调整为 4–10 行。预加载使用低优先级和有限队列，不抢占首页推荐接口。
- 只预加载封面，不改写视频预览内容。
- 停止滚动约 3 秒后，原生首页会按设置尝试自动加载一批后续内容，默认 10 行，可调整为 5–15 行；每个停止滚动周期最多触发一批。
- 自动加载探测使用同步触发并立即恢复位置的方式；加载批次期间暂缓首页格式修复，批次结束后集中修复一次，避免页面反复下跳和上提。
- 如果同步探测没有追加内容，本轮会有限重试后跳过，不使用下一帧可见滚动兜底。
- 检测到配套 BiliKit Feed 后，自动加载功能会停用，不调用 Feed 私有加载器，也不改动 Feed 脚本。
- 通过稳定的网格行间距处理减少第三排开始的错位、上下抖动和频闪；不监听卡片内部的 `class` / `style` 变化来触发布局修复。

### 搜索页

- 提前与搜索接口和图片节点建立连接。
- 修复 B 站部分搜索接口 URL 拼接异常。
- 搜索结果列表和悬停预览仍交给 B 站原生逻辑处理，不用首页 Feed 规则强行改写搜索结果。

### CDN 优选

CDN 处理分为图片和播放资源两条路径：

- 根据 B 站返回的 IP 地域信息区分国内和境外出口；地域尚未确认时保持 B 站原始地址。
- 图片节点在 `i0` / `i1` / `i2.hdslb.com` 中进行实际探测，并复用短期缓存，避免每次刷新都重复测速。
- 网络恢复或连接类型变化后才重新选择节点；连续资源失败后才切换后续请求使用的节点。
- 已经加载完成并正在显示的图片不会为了换节点而重新下载；加载中的资源或新加入信息流的资源才会按当前节点处理。
- 播放页、首页和搜索页的精确 `playurl` 响应会处理可替换的 `bilivideo` 直连地址，也覆盖 B 站原生悬停预览的播放地址。
- MCDN / `edge.mountaintoys.cn` 等带签名的代理地址不会被简单替换 Host；如果 B 站返回了签名完整的直连备用地址，会优先使用该备用地址并保留原代理回退。
- 不扫描普通 JSON，不伪造 MCDN 签名，不改变清晰度、预览内容或播放器交互。

### 播放和列表交互

- 视频卡片可选择用抽屉、新标签页或当前页打开。
- 抽屉模式支持网页全屏和隐藏切换过程；隐藏切换会等待播放器准备后再显示，因此可能稍晚出现。
- 播放页左下角提供“回程”胶囊，记录视频导航栈，可跳回上一个视频并按需要恢复离开时的进度。
- 正式播放时可申请 Screen Wake Lock，防止支持该 API 的浏览器在播放过程中休眠；悬停预览不会申请唤醒锁。
- “稍后再看”“不感兴趣”“更多”等按钮会放行给 B 站原生处理，不由卡片打开逻辑截断。

## 设置面板

脚本只在 B 站首页挂载设置入口：右下角齿轮，或与可选的 Feed 浮动按钮合并。设置面板中的模块可以单独开关。

| 模块 | 默认状态 | 作用 |
| --- | --- | --- |
| CDN 优选 | 开启 | 选择国内/境外播放和图片节点，并处理失败回退 |
| 主题同步 | 开启 | 跟随系统深浅色，或强制深色/浅色 |
| 评论信息 | 开启 | 在评论中显示已有的性别数据和 IP 属地 |
| 防睡眠 | 开启 | 正式播放时申请屏幕唤醒锁 |
| 免登录 | 开启 | 未登录时提供评论、他人动态和官方试看 1080p |
| 回程 | 开启 | 保存视频导航栈，并可带播放进度返回 |
| 首页加载 | 开启 | 隐藏首页广告位，配置封面预加载行数和停止滚动后的原生首页自动加载 |

此外还有三个独立设置页：

- **打开方式**：抽屉、抽屉·网页全屏、新标签页（默认）或当前页；网页全屏可以选择隐藏切换过程。Safari 另有实验性的“左滑回到来源页”历史处理，Edge/Chrome/Firefox 不会改变历史。
- **封面预览**：为配套 BiliKit Feed 脚本提供“真视频 / 雪碧图 / 关闭”配置。BiliKit Performance 本身不替换 B 站原生悬停预览。
- **App 推荐 Feed**：可选的 BiliKit Feed 配置入口，需要另行安装对应 Feed 脚本；可以使用 TV 二维码登录获取个性化推荐。

首页加载可以进一步设置：

- 隐藏首页广告位：默认开启，只处理首页信息流中的 `.floor-single-card`。
- 封面预加载行数：默认 6 行，范围 4–10 行。
- 停止滚动后自动加载：默认开启，停止滚动约 3 秒后触发一批原生首页加载。
- 自动加载行数：默认 10 行，范围 5–15 行。

CDN 优选可以进一步设置：

- IP 地区策略：自动检测、强制国内、强制境外。
- 改写模式：智能或强制改写。
- Edge 卡顿自适应：连续 `waiting` / `stalled` 或播放器错误时，在短期会话内切换到强制模式。
- 国内镜像节点和境外镜像节点：可以选择预设、关闭改写或填写受信域名下的自定义主机名。

设置写入现有的 `bilikit:` 配置体系。修改开关或大多数参数后，按面板底部提示刷新页面生效；旧配置键会继续复用。

## 安装与升级

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或其他兼容的 userscript 管理器。
2. 从 [Raw 地址安装或更新](https://raw.githubusercontent.com/ct-yx/BiliKit-Performance/main/bilikit-performance.user.js)。
3. 打开 Bilibili 页面，确认脚本管理器中的脚本名称为 `BiliKit Performance (Edge/Chromium)`，版本为 `0.6.6`。

本项目使用新的脚本名称和 namespace，是独立于旧版 BiliKit Core 的新脚本身份。旧版不会自动升级到本仓库；安装前请先停用旧版，避免两个脚本同时 hook 请求、重复修改页面或产生不稳定行为。

脚本 metadata 当前只声明 Bilibili 匹配规则和 `window.focus` grant，不需要额外的跨域 `@connect` 权限。由于首页请求和播放地址处理需要尽早执行，脚本使用 `@run-at document-start` 和 `@sandbox raw`。

## 调试接口

在 Bilibili 页面开发者工具 Console 中查看当前页面的只读统计：

```js
window.__BILIKIT_VERSION__
window.__BILIKIT_HOME_FEED_STATS__
window.__BILIKIT_HOME_FEED_COORDINATOR_STATS__
window.__BILIKIT_HOME_LAYOUT_STATS__
window.__BILIKIT_HOME_FEED_PRIORITY_STATS__
window.__BILIKIT_HOME_AUTO_LOAD_STATS__
window.__BILIKIT_HOME_AD_STATS__
window.__BILIKIT_HOME_IMAGE_STATS__
window.__BILIKIT_CDN_STATS__
```

重点字段：

- `__BILIKIT_HOME_FEED_STATS__`：首页推荐接口优先级、重试次数和最近请求。
- `__BILIKIT_HOME_FEED_COORDINATOR_STATS__`：Feed 根节点、新增节点和资源调度情况。
- `__BILIKIT_HOME_LAYOUT_STATS__`：布局修复的行数和归一化卡片数；正常情况下不应持续增长。
- `__BILIKIT_HOME_FEED_PRIORITY_STATS__`：预加载窗口、观察图片数、首屏高优先级图片和预加载数量。
- `__BILIKIT_HOME_AUTO_LOAD_STATS__`：自动加载开关、目标行数、触发次数、实际追加行数和跳过原因。
- `__BILIKIT_HOME_AUTO_LOAD_STATS__` 还包括 `batchCount`、`probeMode`、`visibleProbeCount`、`layoutDeferred`、`anchorCorrections`、`maxAnchorDelta` 和 `lastCancelReason`，用于确认自动加载没有产生可见探测跳动。
- `__BILIKIT_HOME_LAYOUT_STATS__` 还记录自动加载期间延迟的布局修复次数、批次结束后的修复次数和最近一次修复原因。
- `__BILIKIT_HOME_AD_STATS__`：首页广告楼层检测和隐藏数量。
- `__BILIKIT_HOME_IMAGE_STATS__`：首页图片 CDN 节点、改写次数、回退和探测状态。
- `__BILIKIT_CDN_STATS__`：播放 CDN 地域、节点来源、playurl 改写和 MCDN 直连提升情况。

这些接口只用于诊断，不会输出 Cookie、access key 或其他认证信息。排查首页慢或缺卡时，应同时确认脚本版本和 B 站自身接口状态，不能只根据浏览器扩展报错归因于本脚本。

## 行为边界与已知限制

- CDN 优选是基于地域、节点探测和失败反馈的启发式优化，不保证所有网络、运营商和时段都比 B 站原生分配更快；可以在设置中关闭某一地区改写，让 B 站自行分配。
- 地域未确认时不会强制换节点。节点切换只影响后续请求和未完成资源，不会批量刷新已经显示的图片。
- 首页自动加载只在未检测到 BiliKit Feed 时运行；它通过原生首页滚动加载机制触发，不直接请求首页接口、不克隆卡片，也不会修改 Feed 脚本。
- 首页自动加载是有限的启发式触发：页面结构变化、原生接口未响应或浏览器阻止滚动探测时，可能只完成部分加载或跳过本轮。
- 免登录模式是只读能力：页面可以显示部分公开内容，但发表评论、点赞、投币、收藏、历史同步等需要真实鉴权的操作失败属于预期行为。免登录评论也拿不到服务端只对真实登录返回的 IP 属地字段。
- 官方试看限制仍由 B 站控制，免登录模式不提供 4K、HDR 或大会员专享清晰度。
- 主题和评论信息模块只增强现有页面数据，不额外请求评论性别或属地接口；保密用户可能不显示性别。
- `navigator.wakeLock` 不存在或页面不可见时，防睡眠模块不会生效。
- B 站页面结构、接口参数、CDN 调度和浏览器扩展都可能变化；如果与其他会改写 B 站请求或播放器的脚本/扩展同时使用，应逐一停用排查。

## Global Speed 联动：当前限制与未来目标

当前版本**没有**实现 B 站原生倍速菜单与 [Global Speed](https://github.com/polywock/globalSpeed) 的配置同步。Global Speed 接管播放器后，页面直接设置 `HTMLMediaElement.playbackRate` 只能临时改变当前媒体；扩展重新应用自己保存的倍速后可能覆盖页面值，也不会同步扩展自己的界面和配置。

相关需求见 Global Speed 的开放 issue：[Feature request: documented API for website/userscript speed control #955](https://github.com/polywock/globalSpeed/issues/955)。在 Global Speed 提供稳定、公开、版本化并且需要用户授权的桥接接口之前，BiliKit 不依赖私有消息、扩展内部存储或注入扩展代码。

未来目标：

- [ ] 使用 Global Speed 官方文档化 API，并要求用户显式启用当前站点的联动。
- [ ] 在 B 站原生倍速菜单中增加可输入的数值入口，并同步 Global Speed 的有效速度、界面和配置。
- [ ] 明确媒体、标签页和站点作用域，以及设置是否持久化，避免误改全局速度。
- [ ] 兼容 B 站 SPA 导航、切换视频和播放器重建，抵抗扩展重新应用旧速度造成的覆盖。
- [ ] 在接口正式可用后完成 Edge 实机回归，验证倍速菜单、Global Speed UI、切换视频和悬停预览互不回归。

验收标准是：从 B 站倍速菜单选择数值后，Global Speed 自己的界面和配置显示相同数值；扩展的周期性重新应用不会把它改回去；切换视频后仍符合用户选择的作用域和持久化规则。没有达到这个标准前，不把“当前视频暂时改变播放速度”称为联动完成。

## 本地验证

修改脚本后可运行：

```bash
python3 /Users/chenhong/.codex/skills/tampermonkey-build/scripts/validate_userscript.py bilikit-performance.user.js
node --check bilikit-performance.user.js
```

静态检查通过不等于真实 Edge 回归完成。首页刷新、搜索结果、悬停预览、播放页、MCDN、布局稳定和扩展联动应在目标浏览器中分别验证。

## 许可证

[MIT License](LICENSE)。脚本作者和上游信息以 userscript metadata 与许可证文件为准。
