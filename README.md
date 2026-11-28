# BiliKit Performance

面向 Bilibili 的 Edge / Chromium userscript，提供播放交互、下载工作台、收藏夹修复和桌面端首页增强能力。

当前版本：**0.7.5**

脚本文件：[bilikit-performance.user.js](bilikit-performance.user.js)

仓库：[ct-yx/BiliKit-Performance](https://github.com/ct-yx/BiliKit-Performance)

项目主页：[GitHub Pages](https://ct-yx.github.io/BiliKit-Performance/)

更新日志：[GitHub Pages 更新日志](https://ct-yx.github.io/BiliKit-Performance/changelog.html)

详细功能介绍：[docs/FEATURES.md](docs/FEATURES.md)

交接文档：[HANDOFF.md](HANDOFF.md)

## 功能概览

### 首页信息流

- 首页保留 B 站原生卡片排布、展示位、推荐顺序和滚动加载；脚本不接管横向列数或纵向行数，不使用 CSS Grid 重排，也不改写滚动位置。
- 首页增强只做小范围优化：稳定识别的广告卡片默认删除、封面预加载、图片节点优化、请求预连接和原生布局稳定性保护；脚本不改写卡片属性、grid 或列数，只在首页网格直接卡片上清除 B 站额外的上边距，广告、预加载和自动加载协调均可在设置中独立关闭。
- 停止滚动后的自动加载仅通过 B 站原生入口进行有限协调，不自行渲染接口结果，不克隆卡片，不伪造 `scroll` 事件；检测到 BiliKit Feed 时自动让路。
- 首页调试信息可从 `window.__BILIKIT_HOME_FEED_STATS__`、`window.__BILIKIT_HOME_FEED_COORDINATOR_STATS__`、`window.__BILIKIT_HOME_FEED_PRIORITY_STATS__`、`window.__BILIKIT_HOME_AUTO_LOAD_STATS__`、`window.__BILIKIT_HOME_LAYOUT_STATS__` 和 `window.__BILIKIT_HOME_AD_STATS__` 查看。

### 搜索页

- 提前与搜索接口和图片节点建立连接。
- 搜索结果列表和悬停预览仍交给 B 站原生逻辑处理，不用首页 Feed 规则强行改写搜索结果。

### CDN 优选

CDN 优选当前只处理播放资源：

- 根据 B 站返回的 IP 地域信息区分国内和境外出口；地域尚未确认时保持 B 站原始地址。
- 播放页和悬停预览的精确 `playurl` 响应会处理可替换的 `bilivideo` 直连地址。
- MCDN / `edge.mountaintoys.cn` 等带签名的代理地址不会被简单替换 Host；如果 B 站返回了签名完整的直连备用地址，会优先使用该备用地址并保留原代理回退。
- 不扫描普通 JSON，不伪造 MCDN 签名，不改变清晰度、预览内容或播放器交互。

### 播放和列表交互

- 视频卡片可选择用抽屉、新标签页或当前页打开。
- 抽屉模式支持网页全屏和隐藏切换过程；隐藏切换会等待播放器准备后再显示，因此可能稍晚出现。
- 播放页左下角提供“回程”胶囊，记录视频导航栈，可跳回上一个视频并按需要恢复离开时的进度。
- 正式播放时可申请 Screen Wake Lock，防止支持该 API 的浏览器在播放过程中休眠；悬停预览不会申请唤醒锁。
- “稍后再看”“不感兴趣”“更多”等按钮会放行给 B 站原生处理，不由卡片打开逻辑截断。
- “未登录提示拦截”会在用户开启后隐藏 B 站反复出现的登录弹窗、登录浮层和登录提示卡，覆盖首页、视频页等 B 站页面；它只处理页面 DOM，不改写评论或播放请求。
- 评论区会识别用 Unicode Emoji 或 B 站表情拆开的 HTTPS 链接，并在旁边提供新标签页跳转按钮；该功能可通过“评论链接识别”模块关闭。

### 下载工作台

- 播放器右键菜单仍可打开下载工作台；Bilibili 顶栏新增“下载”入口，顶栏空间不足时自动降级到右下角 BiliKit 设置按钮上方的悬浮入口。
- 输入完整 BV 号或 BV 后面的字母数字正文后，工作台会通过 B 站官方 `view` / `playurl` 接口读取分 P、CID 和 DASH 音视频轨道；下载入口不需要额外 userscript 权限。
- 普通多 P 的官方 `view.pages` 是最终 CID 目录；如果播放器旧目录的 CID 不同，工作台会按官方 page→CID 映射修正并继续下载，不会误标为“已跳过”。

### 收藏夹修复

- 在 `space.bilibili.com/<mid>/favlist` 页面独立运行，读取 B 站官方收藏夹公开元数据，修复当前页面中的失效收藏卡片，并补全可确认的标题、封面、简介、UP 主、时长、统计和分 P 信息。
- 新版收藏夹只把卡片标题严格为“已失效视频”的条目放入修复队列；正常卡片仅用于保持页面顺序和判断已加载数量，不会被改写标题、封面、卡片位置或工具菜单。
- 仅当公开收藏夹接口明确把条目标记为隐藏、且页面当前没有显示时，才按原顺序补回；这用于补回 UP 主设置为“仅自己可见”的隐藏收藏。普通懒加载缺失、私密收藏、搜索/筛选结果和无法由官方接口确认的条目不会伪造插入。
- 官方接口返回统一占位封面或仍只有“已失效视频”时，脚本会先结束卡片的加载状态，再按需用视频 AV 号查询公开元数据。BiliPlus 批量接口是优先来源；只有它缺少标题或封面时才受限并发调用较慢的 Jijidown 兜底，并且不会接受“正在加载数据…”或删除占位。只接受明确有效的标题和 HTTP(S) 封面，来源不可用时标题会显示 `查不到标题（AV号）【鼠标悬停查看简介】` 兜底，不把兜底文字写入缓存。
- 卡片匹配会按 BV、AV、`data-id` 和视频链接建立多个身份别名，再与官方条目合并；旧版本把缺失统计保存为 `0` 的缓存会按未知值兼容处理，不会覆盖本次接口返回的真实数据。官方只返回分区 ID 时，已知分区会显示名称。
- 外部查询不会阻塞收藏夹首屏；官方分页并发读取且所有公开元数据请求都有硬超时。结果成功、失败或找不到对应条目时都会立即结束卡片的“正在加载数据…”状态，不会因残留文本反复检查同一页。
- 仍显示失效占位封面的目标卡片，悬停或键盘聚焦封面时会打开 BiliKit 资料面板，展示标题、AV/BV、UP 主、简介、分区、时间、分 P、统计和失效原因。面板固定在视口内并在内部滚动，不改变卡片宽度，也不拦截 B 站封面跳转；正常卡片和已恢复真实封面的卡片不会增加该面板。
- 只在当前收藏模块已经接管的卡片标题区域做局部清理；如果旧版脚本再次写回加载占位，BiliKit 会清除该占位，但仍建议停用重复安装的旧版收藏夹脚本。
- 卡片右上角的 BiliKit 菜单可复制视频信息、查看有效封面、打开 UP 主空间和清除单条本地缓存；不拦截 B 站原生跳转、稍后再看和收藏操作。
- 缓存键为 `bilikit:favorites-fix:v1`，只保存公开元数据和有限时间的命中/未命中状态，不保存 Cookie、签名 URL、媒体 URL 或第三方脚本代码；未命中结果会在一段时间后重试。可在设置中的“收藏夹修复”模块关闭隐藏条目恢复或卡片工具菜单。
- 公开收藏夹页提供 `window.__BILIKIT_FAVORITES_FIX_API__.getEntries()`，返回带 `bvid`、`aid`、标题、分 P/CID、时长、UP 主和 `source: "public"` 的标准目录；页面右下角的“打开收藏下载”入口会把该目录交给现有下载工作台。
- 收藏下载只读取公开收藏夹，保留收藏顺序，支持单 P、多 P 和多 BV 选择；每个任务按自己的 BVID/CID 重新获取官方 `view` / `playurl`，失败项可以单独重试。可在“收藏夹修复”设置中关闭“提供收藏夹批量下载入口”。

## 设置面板

脚本只在 B 站首页挂载设置入口：右下角独立齿轮。它不占用、不嵌入也不修改 B 站“最近观看”等原生悬浮按钮；设置面板中的模块可以单独开关。

“更新跳转”模块可以关闭脚本更新后在新标签页打开 Pages 更新日志；当前 Bilibili 页面会保留，关闭后仍会保存待处理版本，重新开启后在回到 Bilibili 首页时处理。

| 模块 | 默认状态 | 作用 |
| --- | --- | --- |
| CDN 优选 | 开启 | 选择国内/境外播放节点，并处理失败回退 |
| 主题同步 | 开启 | 跟随系统深浅色，或强制深色/浅色 |
| 评论信息 | 开启 | 在评论中显示已有的性别数据和 IP 属地 |
| 防睡眠 | 开启 | 正式播放时申请屏幕唤醒锁 |
| 未登录提示拦截 | 首次进入首页时询问 | 隐藏未登录时反复出现的登录弹窗、浮层和提示卡 |
| 回程 | 开启 | 保存视频导航栈，并可带播放进度返回 |
| 评论链接识别 | 开启 | 识别评论中用 Emoji/表情拆开的 HTTPS 链接并新开标签页 |
| 首页加载 | 开启 | 删除广告、预加载封面，并协调 B 站原生首页追加 |

此外还有三个独立设置页：

- **打开方式**：抽屉、抽屉·网页全屏、新标签页（默认）或当前页；网页全屏可以选择隐藏切换过程。Safari 另有实验性的“左滑回到来源页”历史处理，Edge/Chrome/Firefox 不会改变历史。
- **封面预览**：Performance 直接为 B 站首页和搜索页的原生视频卡片提供“真视频 / 雪碧图 / 关闭”配置；真视频预览使用 B 站播放接口和静音低清流，不依赖独立 BiliKit Feed 脚本。
- **App 推荐 Feed**：可选的 BiliKit Feed 配置入口，需要另行安装对应 Feed 脚本；可以使用 TV 二维码登录获取个性化推荐。

首页加载设置位于设置面板中：可以关闭广告删除、调整封面预加载行数、关闭停止滚动后的原生自动加载，并设置每轮自动加载的目标行数。页面卡片的横向列数、纵向行数和顶部展示位始终由 B 站原生逻辑决定。

CDN 优选可以进一步设置：

- IP 地区策略：自动检测、强制国内、强制境外。
- 改写模式：智能或强制改写。
- Edge 卡顿自适应：连续 `waiting` / `stalled` 或播放器错误时，在短期会话内切换到强制模式。
- 国内镜像节点和境外镜像节点：可以选择预设、关闭改写或填写受信域名下的自定义主机名。

设置写入现有的 `bilikit:` 配置体系。修改开关或大多数参数后，按面板底部提示刷新页面生效；旧配置键会继续复用。

“主题同步”也会作用于 BiliKit 自己的设置面板：选择“跟随系统”时随系统主题变化，选择“始终深色”或“始终浅色”时覆盖系统主题。该设置不需要刷新即可同步到已打开的 BiliKit 界面。

## 安装与升级

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或其他兼容的 userscript 管理器。
2. 从 [Raw 地址安装或更新](https://raw.githubusercontent.com/ct-yx/BiliKit-Performance/main/bilikit-performance.user.js)。
3. 打开 Bilibili 页面，确认脚本管理器中的脚本名称为 `BiliKit Performance (Edge/Chromium)`，版本为 `0.7.5`。

本项目使用新的脚本名称和 namespace，是独立于旧版 BiliKit Core 的新脚本身份。旧版不会自动升级到本仓库；安装前请先停用旧版，避免两个脚本同时 hook 请求、重复修改页面或产生不稳定行为。

脚本 metadata 仅匹配 Bilibili，并声明 Tampermonkey `GM_download`、`GM_xmlhttpRequest` 权限，以及 B 站实际返回的 `bilivideo.com` / `bilivideo.cn` / `bilivideo.net` 和签名 `edge.mountaintoys.cn` 媒体域名、收藏夹官方元数据域名 `api.bilibili.com` 和失效元数据恢复来源 `www.biliplus.com`、`www.jijidown.com`。收藏夹修复只在收藏夹页请求这些公开元数据；普通浏览和预览不会因此读取收藏夹内容。由于播放地址处理需要尽早执行，脚本使用 `@run-at document-start` 和 `@sandbox raw`。

本地开发源码位于 `src/userscript/`，运行 `npm run build` 生成单文件 `bilikit-performance.user.js`；Remux Worker 由构建命令嵌入发布脚本，开发时保留独立源码。

仓库结构以 userscript 为唯一开发目标：`src/userscript/` 保存业务源码，`scripts/lib/primary-bundle.mjs` 负责生成根目录的单文件 userscript；`npm run build` 只更新 `bilikit-performance.user.js` 和 Remux Worker。Edge 扩展实现已从当前分支移除，旧实现仍可在历史提交 `fe39416` 中追溯，后续不再由本仓库构建或维护扩展目录、扩展 ZIP 和扩展桥接层。

## 调试接口

在 Bilibili 页面开发者工具 Console 中查看当前页面的只读统计：

```js
window.__BILIKIT_VERSION__
window.__BILIKIT_HOME_FEED_STATS__
window.__BILIKIT_HOME_FEED_COORDINATOR_STATS__
window.__BILIKIT_HOME_FEED_PRIORITY_STATS__
window.__BILIKIT_HOME_AUTO_LOAD_STATS__
window.__BILIKIT_HOME_LAYOUT_STATS__
window.__BILIKIT_HOME_AD_STATS__
window.__BILIKIT_HOME_IMAGE_STATS__
window.__BILIKIT_CDN_STATS__
window.__BILIKIT_FAVORITES_FIX_STATS__
```

重点字段：

- `__BILIKIT_HOME_FEED_STATS__`：首页推荐接口优先级、重试次数和最近请求。
- `__BILIKIT_HOME_FEED_COORDINATOR_STATS__`：Feed 根节点、新增节点和资源调度情况。
- `__BILIKIT_HOME_FEED_PRIORITY_STATS__`：预加载窗口、首屏高优先级图片和预加载数量。
- `__BILIKIT_HOME_AUTO_LOAD_STATS__`：自动加载开关、目标行数、原生探测次数、追加行数、批次完成数和停止原因。
- `__BILIKIT_HOME_LAYOUT_STATS__`：原生布局保护器的稳定帧、卡片/行列采样、尺寸变化和属性变化统计；不写入卡片属性，`writes` 始终为 `0`。
- `__BILIKIT_HOME_AD_STATS__`：首页广告楼层检测和隐藏数量。
- `__BILIKIT_HOME_IMAGE_STATS__`：首页图片节点、改写次数、回退和探测状态。
- `__BILIKIT_CDN_STATS__`：播放 CDN 地域、节点来源、playurl 改写和 MCDN 直连提升情况。
- `__BILIKIT_FAVORITES_FIX_STATS__`：收藏夹官方接口来源、外部元数据请求/命中/未命中次数、最近命中来源、卡片/接口条目数、恢复条目数、更新条目数、缓存条目数、标题/封面恢复数、未解决数、悬停面板数和最近错误；不记录 Cookie 或媒体地址。

这些接口只用于诊断，不会输出 Cookie、access key 或其他认证信息。排查首页慢或缺卡时，应同时确认脚本版本和 B 站自身接口状态，不能只根据浏览器扩展报错归因于本脚本。

## 行为边界与已知限制

- CDN 优选是基于地域、节点探测和失败反馈的启发式优化，不保证所有网络、运营商和时段都比 B 站原生分配更快；可以在设置中关闭某一地区改写，让 B 站自行分配。
- 地域未确认时不会强制换节点。节点切换只影响后续请求和未完成资源，不会批量刷新已经显示的图片。
- 首页信息流增强只在首页桌面端运行；卡片排布、横向列数、纵向行数、顶部展示位和新内容追加均由 B 站原生逻辑负责，脚本只做小范围资源、广告和稳定性优化。
- 未登录提示拦截只隐藏 B 站页面上的登录提示，不伪造登录态，也不提供免登录评论或 1080p；评论、播放清晰度和其他需要鉴权的能力仍由 B 站原生逻辑决定。
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
for f in scripts/test-*.mjs; do node "$f"; done
```

静态检查通过不等于真实 Edge 回归完成。首页原生刷新与滚动、搜索结果、悬停预览、播放页、MCDN 和第三方浏览器扩展联动应在目标浏览器中分别验证。

## 许可证

[MIT License](LICENSE)。脚本作者和上游信息以 userscript metadata 与许可证文件为准。

内嵌的第三方组件：[Vanilagy/mediabunny v1.59.1](https://github.com/Vanilagy/mediabunny/tree/v1.59.1)，许可为 MPL-2.0，完整文本见 [third_party/mediabunny/LICENSE](third_party/mediabunny/LICENSE)。生成 Worker 保留来源和许可标记。

收藏夹修复功能参考了 [crnkv/bilibili-favorites-fix-cerenkov-mod](https://github.com/crnkv/bilibili-favorites-fix-cerenkov-mod) 所公开展示的功能需求和 B 站页面结构。该仓库及其上游使用 GPL-3.0；BiliKit 没有复制其源码、jQuery 依赖、资源文件或缓存实现，收藏夹模块是保持 MIT 许可的独立实现。失效元数据恢复只读取 [BiliPlus aidinfo](https://www.biliplus.com/api/aidinfo) 和 [Jijidown get_info](https://www.jijidown.com/api/v1/video/get_info) 的公开返回值，不捆绑或再分发这些站点的代码；来源不可用时不伪造标题和封面。
