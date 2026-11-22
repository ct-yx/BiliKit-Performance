import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/userscript/entry-prefix.js", import.meta.url), "utf8");
const start = source.indexOf("  const GUEST_LOGIN_GUARD_PROMPTED_KEY");
const end = source.indexOf("  const DRAWER_HISTORY_KEY", start);
if (start < 0 || end < 0) throw new Error("找不到未登录提示拦截模块");
const moduleSource = source.slice(start, end);

for (const selector of [".bili-mini-mask", ".login-panel-popover", ".login-tip", ".bpx-player-toast-item"]) {
  if (!moduleSource.includes(selector)) throw new Error(`未登录提示拦截缺少选择器：${selector}`);
}
for (const text of ["扫码登录", "登录后你可以", "登录哔哩哔哩", "高清视频免费看", "试看"]) {
  if (!moduleSource.includes(text)) throw new Error(`未登录提示拦截缺少提示文本识别：${text}`);
}
if (!moduleSource.includes('setField("guest-login-guard", "enabled", true)')) {
  throw new Error("首页提示没有把开启结果写入设置");
}
if (/addFetch\(|addXHR\(|credentials\s*:\s*["']omit/.test(moduleSource)) {
  throw new Error("未登录提示拦截不应改写评论或播放请求");
}
if (source.includes("const noLogin") || source.includes('"no-login-net"')) {
  throw new Error("旧免登录模块或网络 Hook 仍残留");
}

console.log("未登录提示拦截测试通过：三类提示选择器、首页设置入口和无请求改写约束均存在。");
