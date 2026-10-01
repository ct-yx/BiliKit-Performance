# BiliKit Performance

面向 Bilibili 的 Edge / Chromium userscript，优化首页信息流、搜索页和播放页的网络调度与 CDN 使用，并在播放器右键菜单中提供当前视频下载工作台。

当前版本：**0.6.48**

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

### 播放器下载工作台

- 在播放器右键菜单末尾增加幂等的“BiliKit 视频下载工作台”入口；工作台复用 BiliKit 抽屉外壳，不再打开第二个播放器。
- 读取当前播放页已有的 DASH 信息，默认当前分 P 和清晰度；“清晰度”与“编码”分开选择，编码选项随清晰度变化。
- 如果当前页面还没有被捕获的播放响应，打开工作台后会根据 URL 中的 BV/AV ID，通过 B 站官方 `view` 和 `x/player/wbi/playurl` 接口主动补齐当前分 P 的 CID、视频轨和音频轨；不会调用第三方下载接口。
- 优先复用当前页面最近的合法 WBI playurl 请求；签名过期时在同一次主动获取中构造新的 WBI 请求。请求只执行一次，失败后由“重新获取轨道”按钮触发重试。
- 支持“合并 MP4”“分别下载音视频轨”和“仅下载音频”。合并使用 Mediabunny 编码包直通重封装，不重新编码；MP4 索引前置，支持 seek。
- 下载文件名统一使用下划线格式，不使用空格、连字符或加号：合并示例为 `标题_BVxxxx_P01_1080P_AVC_AAC_video_audio.mp4`，视频分轨为 `标题_BVxxxx_P01_1080P_AVC_video.mp4`，音频分轨为 `标题_BVxxxx_P01_AAC_192kbps_audio.m4a`。合并 Blob 使用浏览器原生文件名保存，避免 Edge/Tampermonkey 将 Blob URL 回退为 UUID；分轨下载继续使用下载管理器。仅下载音频时按返回的 MIME 和容器命名：B 站常见的 `audio/mp4` 使用 `.m4a`，原始 FLAC、Ogg/Opus、MP3 等才使用对应扩展名；不会再把音频轨命名为视频用的 `.mp4`。
- 如果 B 站页面标题已经带有当前分 P 前缀（例如 `P2_标题` 或 `P 02 - 标题`），文件名会去掉这个重复前缀，只保留统一的 `_P02` 标识。
- 下载标题优先读取播放页正文顶部的完整视频标题；B 站标签页在分 P 页面可能只显示 `P2_哔哩哔哩_bilibili`，该短标题不会再作为文件名前缀。
- 免登录模式下 B 站可能隐藏全局 `__playinfo__`；工作台从当前播放接口响应建立内存快照，并要求请求/响应身份与当前 BVID、CID、路由一致。没有请求身份的全局 `__playinfo__` 只有在页面已确认 CID 且时长一致时才可回退使用；当前播放器时长尚未匹配时会等待。无法确认身份的旧响应会被丢弃，不会借用当前页面标题给它重新贴标签。
- 分轨使用页面下发的原始签名地址；快照在 CDN 改写前复制，并绑定当前 BVID、CID、P 和路由。合并通过 Tampermonkey 请求 API 读取轨道。签名地址不展示、不写入存储或任务记录；任务只在当前页面内存中。
- 下载前会验证轨道资源总长度；合并前还会核对视频轨、音频轨与当前视频时长。遇到部分响应、长度不符或时长不符时任务会失败，不生成错误 MP4；CDN 不提供可验证长度时也会停止下载。
- Mediabunny 1.59.1 的 MP4 Worker 经 tree-shaking 后为 **221,778 字节（gzip 59,328 字节）**；Worker 代码内嵌在单文件 userscript 中，仅点击“合并 MP4”时创建，不再依赖远程 `@resource`。
- Worker 源码：[src/remux.worker.js](src/remux.worker.js)。开发时可单独运行 `npm run build:remux-worker` 生成 Worker；发布单文件 userscript 时运行 `npm ci && npm run build`，由构建流程先生成 Worker、再将它内嵌到 userscript。依赖锁定 Mediabunny 1.59.1 和 esbuild 0.28.2。
- 刷新或切换播放页后，URL 中 `/video/BV.../`（也兼容 `/video/av.../`）是当前视频身份的最高优先级，BV 正文大小写按 B 站规则保留，后面的 `?spm_id_from=...`、`?vd_source=...` 等跟踪参数不会影响识别。若页面状态缺失 CID，会优先读取播放器 `getManifest()`，再按 URL 的 `p` 参数选择分 P；轨道优先通过与当前视频 ID/CID 匹配的 playurl 响应重新捕获，没有捕获结果时，打开工作台会主动重放当前页面的官方播放接口。页面内嵌的 `__playinfo__` 只有在页面状态也确认同一视频且时长一致时才作为回退，`last_play_cid` 不会单独证明当前视频。SPA URL 变化会立即清空旧轨道，播放器时长尚未更新时工作台保持等待，不会继续显示上一个视频的轨道或签名地址；主动请求和捕获响应都必须再次通过当前 BVID/AV、CID、分 P 和时长校验。签名地址仍只留在页面内存。
- 同一 BV 下的多个 P 会读取播放器选集目录和 B 站官方 `view` 接口，显示 P 编号、分 P 标题、CID 和时长；默认只勾选当前 P，可全选或逐项选择。官方目录与页面 `data-cid` 不一致的 P 会标记为不一致并跳过，避免串片；不同 BV 的推荐视频列表不纳入本功能。
- 下载工作台统一使用一个**视频列表**：没有不同 BV 合集时显示同 BV 的 `P01/P02`；确认存在合集后，每个合集 BV 显示为 `C01/C02` 父项，父项复选会选择该 BV 的全部 P，内部各 P 仍以 `Cxx_P01/Cxx_P02` 子项独立选择。这样可以同时选择多个合集 BV、其中某个 BV 的指定 P，以及普通同 BV 分 P；每个实际下载项仍按自身 BVID/CID 建立独立任务，不会把父项重复生成另一份文件。默认只勾选当前 BVID/CID 对应 P，列表提供全选、取消全选和逐项勾选。合集优先读取 `__INITIAL_STATE__.videoData.ugc_season.sections[].episodes[]`，真实播放页没有内嵌状态时再用播放器列表的顺序、标题和 CID 作为临时目录，纯 CID 不直接证明合集身份，最终仍须由官方 `view` 确认不同 BVID/AV。
- 番剧页继续使用同一个右键菜单和下载工作台，不新增独立按钮或页面；番剧模式与普通视频的分 P/合集模式独立处理。正片列表来自官方 `pgc/view/web/season` 的 `result.episodes`，不会把幕后花絮或相关推荐加入列表；单季度显示 `E01/E02`，检测到页面正片区存在多个季度时按按钮顺序显示 `S01E01/S02E01`，并以 `S01/S02` 作为季度父项支持全选。每个季度单独读取自己的 `season_id`，目录请求最多并发 2 个；每集使用独立 `season_id + ep_id + BVID/AID + CID` 请求 `/pgc/player/web/playurl`。读取完轨道后，MP4 合并仍进入原有本地最多 4 个并发和内存容量预算。
- 每个视频列表项按独立 BVID/AV、CID 和分 P 获取官方 `view/playurl` 数据，不复用其他视频的签名地址或轨道缓存；旧 DOM CID 与官方 `view.pages` 不一致时，以该 BV 自己的 page/CID 映射为准。文件使用对应的 `C01`、`C02_P02` 或 `P02` 标识和实际轨道信息，例如 `条目标题_BVxxxx_C02_P02_1080P_AVC_AAC_video_audio.mp4`；不处理推荐列表中与当前合集无关的视频。
- 批量下载时每个 `BVID + P + CID` 都使用自己的播放接口响应，不会把合集中的多个 BV 或其分 P 合并成同一个任务；清晰度/编码优先匹配当前选择，无法匹配时按同清晰度其他编码、较低清晰度、最低可用清晰度依次降级，并在任务中提示。官方身份解析设有小并发闸门，防止全选大型合集时压垮接口；身份确认后，分轨任务立即交给下载管理器，不由脚本统一限流。合并任务独立排队，最多 4 个，并结合 CPU、设备内存、条目时长、轨道码率和清晰度动态调整并发，超长或高码率条目会自动降低并发。
- B 站 `ugc_season` 的合集条目在不同页面版本中可能把 `pages` 返回为完整数组或数字；完整数组会展开为 `Cxx_Pyy`，数字只保留条目数量并等待该 BV 的官方 `view.pages` 补齐 CID，不会凭数量伪造下载项。
- 下载工作台会在任务卡中显示估算文件大小、下载进度、转码进度和综合进度；全局摘要显示总下载速度、下载/保存/综合进度，以及预计下载、预计转码和预计总计时间。速度和进度默认约每 500 毫秒刷新，实际保存阶段只显示浏览器或下载管理器已报告的进度，不伪造磁盘写入速度。
- “下载工作台”设置可以分别控制摘要、总速度、全局进度、预计时间、文件大小和任务阶段进度；还可以调整 250–2000 毫秒的刷新间隔，以及 3000–5000 毫秒的转码样本阈值。合并任务超过阈值后才记录一次转码性能样本，模型保留最近 3 条原始样本，旧样本只保留数值模型，不保存媒体地址、Cookie、CID 或签名参数。
- 第三方来源：[Vanilagy/mediabunny v1.59.1](https://github.com/Vanilagy/mediabunny/tree/v1.59.1)，许可为 MPL-2.0，完整文本见 [third_party/mediabunny/LICENSE](third_party/mediabunny/LICENSE)。生成 Worker 保留来源和许可标记。

## 设置面板

脚本只在 B 站首页挂载设置入口：右下角独立齿轮。它不占用、不嵌入也不修改 B 站“最近观看”等原生悬浮按钮；设置面板中的模块可以单独开关。

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

下载工作台可以进一步设置：

- 显示全局下载摘要、总下载速度、全局下载/保存/综合进度、预计文件大小和任务阶段进度。
- 进度刷新间隔默认 500 毫秒，可调整为 250–2000 毫秒；刷新只更新界面和统计，不改变媒体请求并发。
- 转码样本最短耗时默认 3000 毫秒，可调整为 3000–5000 毫秒。只有超过阈值的合并任务才会进入模型，模型保留最近 3 条样本并结合媒体字节量估算后续转码时间。
- 保存阶段没有可观测的磁盘写入回调时显示“提交保存/已保存”状态，不伪造保存速度或精确磁盘进度。

设置写入现有的 `bilikit:` 配置体系。修改开关或大多数参数后，按面板底部提示刷新页面生效；旧配置键会继续复用。

“主题同步”也会作用于 BiliKit 自己的设置面板和播放器下载工作台：选择“跟随系统”时随系统主题变化，选择“始终深色”或“始终浅色”时覆盖系统主题。该设置不需要刷新即可同步到已打开的 BiliKit 界面。

## 安装与升级

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或其他兼容的 userscript 管理器。
2. 从 [Raw 地址安装或更新](https://raw.githubusercontent.com/ct-yx/BiliKit-Performance/main/bilikit-performance.user.js)。
3. 打开 Bilibili 页面，确认脚本管理器中的脚本名称为 `BiliKit Performance (Edge/Chromium)`，版本为 `0.6.48`。

本项目使用新的脚本名称和 namespace，是独立于旧版 BiliKit Core 的新脚本身份。旧版不会自动升级到本仓库；安装前请先停用旧版，避免两个脚本同时 hook 请求、重复修改页面或产生不稳定行为。

脚本 metadata 仅匹配 Bilibili，并声明下载工作台实际需要的 Tampermonkey `GM_download`、`GM_xmlhttpRequest` 权限，以及 `bilivideo.com` / `bilivideo.cn` 媒体域名、收藏夹官方元数据域名 `api.bilibili.com` 和失效元数据恢复来源 `www.biliplus.com`、`www.jijidown.com`。收藏夹修复只在收藏夹页请求这些公开元数据；普通浏览、预览和打开下载工作台不会因此读取收藏夹内容。由于首页请求和播放地址处理需要尽早执行，脚本使用 `@run-at document-start` 和 `@sandbox raw`。

本地开发源码位于 `src/userscript/`，运行 `npm run build` 生成单文件 `bilikit-performance.user.js`；Remux Worker 由构建命令嵌入发布脚本，开发时保留独立源码。修改下载列表或批量任务后，可运行 `npm run test:download-video-list`、`npm run test:download-mixed-batch` 和 `npm run test:download-lifecycle` 回归验证。

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
window.__BILIKIT_FAVORITES_FIX_STATS__
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
- `__BILIKIT_DOWNLOAD_STATS__`：当前页面捕获/拒绝计数、主动获取次数与成功/失败次数、获取来源、URL 中识别到的视频 ID、捕获的 BVID/CID、时长、实际命中的 playurl 端点、统一视频列表数量与选择数、合集批量状态、合并排队/运行数量、动态合并并发、内存预算、URL 切换次数及拒绝原因，不包含签名 URL。兼容字段包括 `collectionCount`、`collectionSelectedCount`、`collectionBatchActive`、`collectionBatchMode` 和 `lastCollectionError`；进度字段包括 `activeTaskCount`、`globalDownloadSpeedBytes`、`globalLoadedBytes`、`globalTotalBytes`、`globalDownloadProgress`、`globalRemuxProgress`、`globalSaveProgress`、`globalOverallProgress`、`downloadEtaMs`、`remuxEtaMs`、`totalEtaMs`、`remuxModelReady`、`remuxSampleCount` 和 `lastRemuxSampleMs`。工作台全局摘要只显示总下载速度、按任务媒体大小加权的综合进度、预计下载和预计总计；预计转码不再单独显示。
- `__BILIKIT_FAVORITES_FIX_STATS__`：收藏夹官方接口来源、外部元数据请求/命中/未命中次数、最近命中来源、卡片/接口条目数、恢复条目数、更新条目数、缓存条目数、标题/封面恢复数、未解决数、悬停面板数和最近错误；不记录 Cookie 或媒体地址。

这些接口只用于诊断，不会输出 Cookie、access key 或其他认证信息。排查首页慢或缺卡时，应同时确认脚本版本和 B 站自身接口状态，不能只根据浏览器扩展报错归因于本脚本。

## 行为边界与已知限制

- CDN 优选是基于地域、节点探测和失败反馈的启发式优化，不保证所有网络、运营商和时段都比 B 站原生分配更快；可以在设置中关闭某一地区改写，让 B 站自行分配。
- 地域未确认时不会强制换节点。节点切换只影响后续请求和未完成资源，不会批量刷新已经显示的图片。
- 首页自动加载只在未检测到 BiliKit Feed 时运行；它通过原生首页滚动加载机制触发，不直接请求首页接口、不克隆卡片，也不会修改 Feed 脚本。
- 首页自动加载是有限的启发式触发：页面结构变化、原生接口未响应或浏览器阻止滚动探测时，可能只完成部分加载或跳过本轮。
- 下载工作台只处理当前 URL 对应视频列表中的 BVID/AV + CID 项；合集条目和其内部 P 可以同时选择，每个项单独获取 DASH 轨道，不处理不同 BV 的推荐列表，不绕过登录、付费、DRM 或其他访问限制。DASH 不可用、签名地址过期、官方接口拒绝、管理器权限被拒或编码无法直通封装时，会显示失败或保留可用的分轨选项。
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
node scripts/test-download-mixed-batch.mjs
node scripts/test-download-save.mjs
```

静态检查通过不等于真实 Edge 回归完成。首页刷新、搜索结果、悬停预览、播放页、MCDN、布局稳定和扩展联动应在目标浏览器中分别验证。

## 许可证

[MIT License](LICENSE)。脚本作者和上游信息以 userscript metadata 与许可证文件为准。

收藏夹修复功能参考了 [crnkv/bilibili-favorites-fix-cerenkov-mod](https://github.com/crnkv/bilibili-favorites-fix-cerenkov-mod) 所公开展示的功能需求和 B 站页面结构。该仓库及其上游使用 GPL-3.0；BiliKit 没有复制其源码、jQuery 依赖、资源文件或缓存实现，收藏夹模块是保持 MIT 许可的独立实现。失效元数据恢复只读取 [BiliPlus aidinfo](https://www.biliplus.com/api/aidinfo) 和 [Jijidown get_info](https://www.jijidown.com/api/v1/video/get_info) 的公开返回值，不捆绑或再分发这些站点的代码；来源不可用时不伪造标题和封面。
