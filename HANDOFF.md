# BiliKit Performance 交接文档

## 1. 项目定位

BiliKit Performance 是运行在 Edge/Chromium 浏览器中的 Bilibili userscript，用于优化首页信息流、搜索页和播放页的网络调度与 CDN 使用，并在播放器右键菜单中提供下载工作台。

当前维护范围只有 Tampermonkey 等 userscript 管理器中的脚本：

- 仓库：<https://github.com/ct-yx/BiliKit-Performance>
- 默认分支：`main`
- 当前版本：`0.6.49`
- 发布入口：`bilikit-performance.user.js`
- 原始安装地址：<https://raw.githubusercontent.com/ct-yx/BiliKit-Performance/main/bilikit-performance.user.js>
- 本文档创建前的基线提交：`32036b15c0ef9efbde6fdb9c65ea869b640fdfe4`

接手时以远程仓库的最新 `main` 和 `git rev-parse HEAD` 为准；上面的提交只是本文档建立时的定位基线。

## 2. 明确的范围决策

Edge 扩展已经从当前分支移除，不再作为本项目的开发目标：

- 移除提交：`32036b1 chore: 移除未维护的 Edge 扩展`
- 扩展移除前的历史快照：`fe39416`
- 后续修改默认只进入 userscript 源码和 userscript 构建流程。
- 不要因为看到历史提交就恢复扩展目录、扩展构建器或扩展测试。
- 只有用户再次明确要求扩展迁移时，才把它作为独立迁移项目重新评估；迁移必须以已验证的 userscript 为基线，不能把历史扩展代码直接当作现行实现。

根目录的 `bilikit-performance.user.js` 和 `bilikit-remux.worker.js` 是构建生成物，不要手动编辑。需要修改行为时编辑 `src/`，然后运行构建。

## 3. 源码结构

| 路径 | 职责 |
| --- | --- |
| `src/userscript/metadata.txt` | userscript 元数据、版本和权限声明；构建时原样作为文件头。 |
| `src/userscript/entry-prefix.js` | 入口前段；运行时去重、document-start 预连接、首页请求优先级、配置、页面识别、网络与生命周期基础设施。 |
| `src/userscript/download-workspace.js` | 播放器下载工作台；播放响应捕获、视频/合集/番剧列表、身份校验、轨道请求、任务队列、文件名、音频元数据、保存和下载 UI。 |
| `src/userscript/entry-suffix.js` | 入口后段；抽屉/新标签页导航、播放页交互、唤醒锁、收藏夹修复接入、设置 UI、模块初始化和跨抽屉消息。 |
| `src/userscript/core/network-hooks.mjs` | `fetch`、XHR、History 等网络/导航钩子的可组合管理器。由构建器打包进 userscript。 |
| `src/userscript/core/download-progress.mjs` | 下载/转码/保存阶段进度、速度、ETA 和转码样本模型。由构建器打包进 userscript。 |
| `src/remux.worker.js` | Mediabunny 音视频轨道直通重封装 Worker 源码；支持 MP4 合并和仅音频导出。 |
| `scripts/lib/primary-bundle.mjs` | 拼接三个入口片段，内嵌两个核心模块和生成的 Worker。 |
| `scripts/build-userscript.mjs` | 读取 metadata，生成根目录 userscript。 |
| `scripts/build-remux-worker.mjs` | 使用 esbuild 构建并压缩根目录 Worker。 |
| `scripts/test-*.mjs` | 构建、下载身份/请求/列表/文件名/生命周期/进度、首页加载、网络钩子和收藏夹修复测试。 |
| `docs/FEATURES.md` | 面向使用者的功能说明；详细行为变化应同步更新。 |

构建器通过两个明确标记注入模块：

`/* @bilikit-module:network-hooks */`
`/* @bilikit-module:download-progress */`

Worker 通过 `DOWNLOAD_WORKER_SOURCE` 标记内嵌到 userscript。标记数量变化会让构建失败，这是为了避免源码拼接发生静默错位。

## 4. 主要功能边界

### 首页与搜索页

- 首页 document-start 阶段建立常用接口和图片域名的预连接，并调整首页相关请求优先级。
- 首页 Feed 使用有限的观察和队列处理卡片、封面预加载、广告楼层隐藏、布局修复和真实下滑后的原生自动加载。
- 自动加载只在用户真实下滑并停止后进行有限探测；没有新增内容时不会用无限重试把页面拖慢。
- 搜索页单独处理预连接和已确认的接口 URL 问题，不把首页 Feed 规则强行套到搜索结果。

### CDN 与播放页

- 图片和播放资源分别处理；根据地域、缓存和失败回退选择节点。
- 只处理可确认的 Bilibili 播放响应和合法直连地址，不伪造签名、不改清晰度、不绕过访问控制。
- 播放卡片支持抽屉、新标签页和当前页打开；播放页支持回程、网页全屏协作和正式播放时的 Screen Wake Lock。
- 播放页生命周期必须随 SPA URL 和播放器状态清理旧监听器、旧轨道快照和旧任务引用。

### 收藏夹修复

- 仅在 `space.bilibili.com/<mid>/favlist` 页面运行。
- 通过公开官方元数据和受限的公开兜底来源恢复可确认的失效收藏卡片信息。
- 不把私密收藏、无法确认的懒加载缺失条目或第三方返回的占位数据伪造成真实数据。
- 缓存键为 `bilikit:favorites-fix:v1`，不保存 Cookie、签名 URL、媒体 URL 或第三方脚本代码。

### 下载工作台

- 从播放器右键菜单打开；默认当前 BVID/CID 和当前分 P。
- 普通视频支持同 BV 多 P、合集多 BV 和混合批量；番剧使用独立的季度/正片目录和官方播放接口。
- 支持合并 MP4、分别下载视频/音频轨和仅下载音频。
- MP4 合并是直通重封装，不重新编码；仅在点击合并时创建内嵌 Worker。
- 每个任务独立校验 BVID/AV、CID、分 P、响应长度、轨道时长和当前页面身份，不能复用其他视频的签名地址。
- 轨道 URL 只保留在当前页面内存中，不写入 localStorage、任务持久化数据或文件名。

文件名规则是功能契约的一部分：

- 合并：`标题_BVxxxx_P01_1080P_AVC_AAC_video_audio.mp4`
- 视频分轨：`标题_BVxxxx_P01_1080P_AVC_video.mp4`
- 仅音频：`音乐名_作者.m4a`
- 音频标题和作者优先从页面/轨道可识别信息提取；无法识别音乐名时回退视频标题，无法识别作者时使用约定的未知作者回退值。
- 音频的 BVID、分 P、CID、编码、码率和来源标题等技术信息写入元数据，不放进仅音频文件名。
- `audio/mp4` 使用 `.m4a`；原始 FLAC、Ogg/Opus、MP3、AAC、E-AC-3 等无法走 MP4 直通时按实际容器/编码映射扩展名。
- 页面标题中的 `P2_`、`P 02 -` 等重复分 P 前缀会被清理，统一保留 `_P02` 标识。

## 5. 构建与发布

首次接手或依赖锁文件变化后：

```
npm ci
```

完整构建：

```
npm run build
```

构建顺序是：

1. `build:remux-worker` 从 `src/remux.worker.js` 生成 `bilikit-remux.worker.js`。
2. `build:userscript` 读取 `src/userscript/metadata.txt`，拼接三个入口片段，打包两个 `.mjs` 核心模块，并把 Worker 内容嵌入 `bilikit-performance.user.js`。

发布前只把构建生成的根目录 userscript 作为安装文件；不要从单独的源码片段安装，也不要把扩展目录或 ZIP 当作当前项目产物。

版本更新时至少同步检查：

```
src/userscript/metadata.txt
package.json
README.md
docs/FEATURES.md
```

当前 `package.json` 和锁文件固定使用 Mediabunny `1.59.1`、esbuild `0.28.2`。Worker 头部保留 Mediabunny 的 MPL-2.0 来源标记，许可证文本在 `third_party/mediabunny/LICENSE`。

## 6. 本地验证

基础检查：

```
python3 /Users/chenhong/.codex/skills/tampermonkey-build/scripts/validate_userscript.py bilikit-performance.user.js
node --check bilikit-performance.user.js
node --check bilikit-remux.worker.js
git diff --check
```

完整测试：

```
for name in $(node -e 'for (const name of Object.keys(require("./package.json").scripts).filter((name) => name.startsWith("test:"))) console.log(name)'); do
  npm run "$name" || exit 1
done
```

常用的定向测试：

```
npm run test:userscript-build
npm run test:download-filename
npm run test:download-file-extension
npm run test:download-audio
npm run test:download-collection
npm run test:download-bangumi
npm run test:home-feed-auto-load
npm run test:favorites-fix
```

`test:download-file-extension` 检查的是音频容器扩展名，不是浏览器扩展测试。

验证生成物是否被意外手改：

```
git diff -- bilikit-performance.user.js bilikit-remux.worker.js
npm run build
git diff --check
```

重复构建应保持稳定；`test:userscript-build` 会检查重复构建一致性、Worker 内嵌内容和外部 Worker 资源依赖。

## 7. 真实运行验证

静态检查和 Node 测试不能证明 Edge 页面行为。userscript 的真实验证环境是 Edge + Tampermonkey：

1. 在目标 Edge profile 安装并启用 Tampermonkey。
2. 使用仓库根目录生成的 `bilikit-performance.user.js` 安装或更新脚本。
3. 确认没有同时运行旧版 BiliKit userscript、历史 Edge 扩展或重复脚本实例。
4. 至少回归首页、搜索页、普通视频播放页、合集/多 P、番剧页和收藏夹页。
5. 下载工作台至少验证合并 MP4、分别下载音视频轨、仅下载音频、文件扩展名、文件名和音频元数据。
6. 对页面卡顿、重复请求、旧任务残留或 SPA 切换问题，记录 Edge 页面和 DevTools 的实际证据，不以 Node 测试替代。

如果没有进行 Edge 实测，只能报告“本地构建和静态/行为测试通过”，不能写成“页面验证通过”。

## 8. 已知限制

- 不绕过登录、会员、付费、DRM、地区限制或其他访问控制。
- 下载只处理当前页面已识别出的分 P、合集条目或番剧正片。
- 签名媒体地址只存在于当前页面内存，刷新或切页后需要重新捕获/请求。
- Bilibili 页面结构、官方接口、播放签名和 CDN 行为变化时，需要重新做页面回归。
- Global Speed 联动不是本项目当前职责。
- 浏览器下载管理器、网络节点和登录态会影响真实下载结果，不能只凭脚本日志判断保存成功。
- 历史扩展版本的问题不应通过恢复扩展代码来修复；如果以后重新考虑扩展，需要单独定义兼容层、权限、生命周期和性能验收标准。

## 9. 新工作空间接手

在旧对话和旧本地目录可以删除之前，先确认当前提交已经推送到 GitHub。新工作空间可从干净克隆开始：

```
git clone https://github.com/ct-yx/BiliKit-Performance.git
cd BiliKit-Performance
npm ci
npm run build
```

然后执行第 6 节的基础检查和完整测试，再按第 7 节在 Edge + Tampermonkey 做真实回归。

接手后的第一轮检查建议：

```
git status --short --branch
git remote -v
git log -1 --oneline --decorate
rg -n "@version|DOWNLOAD_WORKER_SOURCE|bilikit-module" src package.json scripts
```

## 10. 后续修改规则

- 先读 `README.md`、本文档、`docs/FEATURES.md` 和相关测试，再改源码。
- 用户明确提出的页面行为问题，优先补一个可重复的测试或断言，再修复实现。
- 修改下载身份、文件名、扩展名、元数据或 Worker 时，必须运行相关下载测试和 `test:userscript-build`。
- 修改首页观察器、网络钩子或 SPA 生命周期时，必须运行对应测试，并在 Edge 中回归页面切换和刷新。
- 任何提交前运行 `git diff --check`，确认没有把构建产物之外的临时文件、日志、下载文件或本地配置带入仓库。
- GitHub 提交和推送使用已登录的 `ct-yx` 身份；不要用本机用户名冒充提交者，也不要把 Cookie、token、签名 URL 或私有媒体地址写入仓库。
