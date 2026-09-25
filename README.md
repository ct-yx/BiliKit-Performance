# BiliKit Performance

面向 Bilibili 的 Edge / Chromium userscript，优化首页信息流、搜索页和播放页的网络调度与 CDN 使用，并在播放器右键菜单中提供当前视频下载工作台。

当前版本：**0.6.21**

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
- 播放页、首页和搜索页的精确 `playurl` 响应会处理可替换的 `bilivideo` 直连地址，也覆盖 B 站原生悬停预览的播放地址。播放页下载工作台另有独立的只读捕获器，不依赖 CDN 改写或免登录模块。
- MCDN / `edge.mountaintoys.cn` 等带签名的代理地址不会被简单替换 Host；如果 B 站返回了签名完整的直连备用地址，会优先使用该备用地址并保留原代理回退。
- 不扫描普通 JSON，不伪造 MCDN 签名，不改变清晰度、预览内容或播放器交互。

### 播放和列表交互

- 视频卡片可选择用抽屉、新标签页或当前页打开。
- 抽屉模式支持网页全屏和隐藏切换过程；隐藏切换会等待播放器准备后再显示，因此可能稍晚出现。
- 播放页左下角提供“回程”胶囊，记录视频导航栈，可跳回上一个视频并按需要恢复离开时的进度。
- 正式播放时可申请 Screen Wake Lock，防止支持该 API 的浏览器在播放过程中休眠；悬停预览不会申请唤醒锁。
- “稍后再看”“不感兴趣”“更多”等按钮会放行给 B 站原生处理，不由卡片打开逻辑截断。

### 播放器下载工作台

- 在播放器右键菜单末尾增加幂等的“BiliKit 视频下载工作台”入口；工作台复用 BiliKit 抽屉外壳，不再打开第二个播放器。
- 读取当前播放页已有的 DASH 信息，默认当前分 P 和清晰度；“清晰度”与“编码”分开选择，编码选项随清晰度变化。
- 如果当前页面还没有被捕获的播放响应，打开工作台后会根据 URL 中的 BV/AV ID，通过 B 站官方 `view` 和 `x/player/wbi/playurl` 接口主动补齐当前分 P 的 CID、视频轨和音频轨；不会调用第三方下载接口。
- 优先复用当前页面最近的合法 WBI playurl 请求；签名过期时在同一次主动获取中构造新的 WBI 请求。请求只执行一次，失败后由“重新获取轨道”按钮触发重试。
- 支持“合并 MP4”“分别下载音视频轨”和“仅下载音频”。合并使用 Mediabunny 编码包直通重封装，不重新编码；MP4 索引前置，支持 seek。
- 下载文件名统一使用下划线格式，不使用空格、连字符或加号：合并示例为 `标题_BVxxxx_P01_1080P_AVC_AAC_video_audio.mp4`，视频分轨为 `标题_BVxxxx_P01_1080P_AVC_video.mp4`，音频分轨为 `标题_BVxxxx_P01_AAC_192kbps_audio.m4a`。合并 Blob 使用浏览器原生文件名保存，避免 Edge/Tampermonkey 将 Blob URL 回退为 UUID；分轨下载继续使用下载管理器。仅下载音频时按返回的 MIME 和容器命名：B 站常见的 `audio/mp4` 使用 `.m4a`，原始 FLAC、Ogg/Opus、MP3 等才使用对应扩展名；不会再把音频轨命名为视频用的 `.mp4`。
- 如果 B 站页面标题已经带有当前分 P 前缀（例如 `P2_标题` 或 `P 02 - 标题`），文件名会去掉这个重复前缀，只保留统一的 `_P02` 标识。
- 免登录模式下 B 站可能隐藏全局 `__playinfo__`；工作台从当前播放接口响应建立内存快照，并要求请求/响应身份与当前 BVID、CID、路由一致。没有请求身份的全局 `__playinfo__` 只有在页面已确认 CID 且时长一致时才可回退使用；当前播放器时长尚未匹配时会等待。无法确认身份的旧响应会被丢弃，不会借用当前页面标题给它重新贴标签。
- 分轨使用页面下发的原始签名地址；快照在 CDN 改写前复制，并绑定当前 BVID、CID、P 和路由。合并通过 Tampermonkey 请求 API 读取轨道。签名地址不展示、不写入存储或任务记录；任务只在当前页面内存中。
- 下载前会验证轨道资源总长度；合并前还会核对视频轨、音频轨与当前视频时长。遇到部分响应、长度不符或时长不符时任务会失败，不生成错误 MP4；CDN 不提供可验证长度时也会停止下载。
- Mediabunny 1.59.1 的 MP4 Worker 经 tree-shaking 后为 **221,778 字节（gzip 59,328 字节）**；Worker 代码内嵌在单文件 userscript 中，仅点击“合并 MP4”时创建，不再依赖远程 `@resource`。
- Worker 源码：[src/remux.worker.js](src/remux.worker.js)。重建命令：`npm ci && npm run build:remux-worker`；构建会生成开发用 Worker 文件并同步内嵌到 userscript，依赖锁定 Mediabunny 1.59.1 和 esbuild 0.28.2。
- 刷新或切换播放页后，URL 中 `/video/BV.../`（也兼容 `/video/av.../`）是当前视频身份的最高优先级，BV 正文大小写按 B 站规则保留，后面的 `?spm_id_from=...`、`?vd_source=...` 等跟踪参数不会影响识别。若页面状态缺失 CID，会优先读取播放器 `getManifest()`，再按 URL 的 `p` 参数选择分 P；轨道优先通过与当前视频 ID/CID 匹配的 playurl 响应重新捕获，没有捕获结果时，打开工作台会主动重放当前页面的官方播放接口。页面内嵌的 `__playinfo__` 只有在页面状态也确认同一视频且时长一致时才作为回退，`last_play_cid` 不会单独证明当前视频。SPA URL 变化会立即清空旧轨道，播放器时长尚未更新时工作台保持等待，不会继续显示上一个视频的轨道或签名地址；主动请求和捕获响应都必须再次通过当前 BVID/AV、CID、分 P 和时长校验。签名地址仍只留在页面内存。
- 第三方来源：[Vanilagy/mediabunny v1.59.1](https://github.com/Vanilagy/mediabunny/tree/v1.59.1)，许可为 MPL-2.0，完整文本见 [third_party/mediabunny/LICENSE](third_party/mediabunny/LICENSE)。生成 Worker 保留来源和许可标记。

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

“主题同步”也会作用于 BiliKit 自己的设置面板和播放器下载工作台：选择“跟随系统”时随系统主题变化，选择“始终深色”或“始终浅色”时覆盖系统主题。该设置不需要刷新即可同步到已打开的 BiliKit 界面。

## 安装与升级

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或其他兼容的 userscript 管理器。
2. 从 [Raw 地址安装或更新](https://raw.githubusercontent.com/ct-yx/BiliKit-Performance/main/bilikit-performance.user.js)。
3. 打开 Bilibili 页面，确认脚本管理器中的脚本名称为 `BiliKit Performance (Edge/Chromium)`，版本为 `0.6.21`。

本项目使用新的脚本名称和 namespace，是独立于旧版 BiliKit Core 的新脚本身份。旧版不会自动升级到本仓库；安装前请先停用旧版，避免两个脚本同时 hook 请求、重复修改页面或产生不稳定行为。

脚本 metadata 仅匹配 Bilibili，并声明下载工作台实际需要的 Tampermonkey `GM_download`、`GM_xmlhttpRequest` 权限，以及 `bilivideo.com` / `bilivideo.cn` 两个媒体域名。官方 `view/playurl` 获取使用当前页面原生 `fetch`，不新增 `@connect`；跨域媒体权限只用于用户主动启动的下载，普通浏览、预览和打开工作台不会读取媒体轨道或启动 Worker。由于首页请求和播放地址处理需要尽早执行，脚本使用 `@run-at document-start` 和 `@sandbox raw`。

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
window.__BILIKIT_DOWNLOAD_STATS__
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
- `__BILIKIT_DOWNLOAD_STATS__`：当前页面捕获/拒绝计数、主动获取次数与成功/失败次数、获取来源、URL 中识别到的视频 ID、捕获的 BVID/CID、时长、实际命中的 playurl 端点、URL 切换次数及拒绝原因，不包含签名 URL。

这些接口只用于诊断，不会输出 Cookie、access key 或其他认证信息。排查首页慢或缺卡时，应同时确认脚本版本和 B 站自身接口状态，不能只根据浏览器扩展报错归因于本脚本。

## 行为边界与已知限制

- CDN 优选是基于地域、节点探测和失败反馈的启发式优化，不保证所有网络、运营商和时段都比 B 站原生分配更快；可以在设置中关闭某一地区改写，让 B 站自行分配。
- 地域未确认时不会强制换节点。节点切换只影响后续请求和未完成资源，不会批量刷新已经显示的图片。
- 首页自动加载只在未检测到 BiliKit Feed 时运行；它通过原生首页滚动加载机制触发，不直接请求首页接口、不克隆卡片，也不会修改 Feed 脚本。
- 首页自动加载是有限的启发式触发：页面结构变化、原生接口未响应或浏览器阻止滚动探测时，可能只完成部分加载或跳过本轮。
- 下载工作台只处理当前 URL 对应视频和当前分 P 的 DASH 轨道；会通过 B 站官方元数据/播放接口补齐缺失轨道，不批量下载合集或请求其他分 P，不绕过登录、付费、DRM 或其他访问限制。DASH 不可用、签名地址过期、官方接口拒绝、管理器权限被拒或编码无法直通封装时，会显示失败或保留可用的分轨选项。
- 合并 MP4 会在内存中暂存音视频轨并生成输出；长视频/高码率可能占用较多内存，可改用分轨下载。任务与签名地址不跨页面保存。
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
node scripts/test-download-extension.mjs
node scripts/test-download-filename.mjs
node scripts/test-download-save.mjs
```

静态检查通过不等于真实 Edge 回归完成。首页刷新、搜索结果、悬停预览、播放页、MCDN、布局稳定和扩展联动应在目标浏览器中分别验证。

## 许可证

[MIT License](LICENSE)。脚本作者和上游信息以 userscript metadata 与许可证文件为准。
