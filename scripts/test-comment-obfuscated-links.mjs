import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../src/userscript/entry-prefix.js", import.meta.url), "utf8");
const start = source.indexOf("  const COMMENT_LINK_URL_RE");
const end = source.indexOf("  function openCommentLink", start);
if (start < 0 || end < 0) throw new Error("找不到评论拆分链接测试接缝");

class FakeText {
  constructor(value) {
    this.nodeType = 3;
    this.nodeValue = value;
    this.parentNode = null;
  }
}
class FakeElement {
  constructor(localName, attributes = {}, children = []) {
    this.nodeType = 1;
    this.localName = localName;
    this.className = attributes.class || "";
    this.attributes = { ...attributes };
    this.childNodes = [];
    this.parentNode = null;
    for (const child of children) this.append(child);
  }
  append(child) {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }
  getAttribute(name) {
    return this.attributes[name] ?? null;
  }
  hasAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name);
  }
  closest() {
    return null;
  }
}

const context = {
  URL,
  console,
  Element: FakeElement,
  ShadowRoot: class {},
  COMMENT_LINK_MARK: "data-bk-comment-link",
  COMMENT_LINK_URL_ATTR: "data-bk-comment-link-url"
};
vm.runInNewContext(`${source.slice(start, end)}\nglobalThis.testApi = { normalizeCommentLink, restoreCommentLinks, isCommentEmojiNode, collectCommentLinkTokens, hasLiveCommentLinkButton };`, context);
const { normalizeCommentLink, restoreCommentLinks, isCommentEmojiNode, collectCommentLinkTokens, hasLiveCommentLinkButton } = context.testApi;

const first = { kind: "text", text: "请打开 https://example.com/" };
const emoji = { kind: "emoji", text: "", node: {} };
const last = { kind: "text", text: "download?id=1。", node: {} };
const links = restoreCommentLinks([first, emoji, last]);
if (links.length !== 1 || links[0].url !== "https://example.com/download?id=1") {
  throw new Error(`Emoji 拆分链接还原错误：${JSON.stringify(links)}`);
}
const unicodeEmojiLink = restoreCommentLinks([
  { kind: "text", text: "htt😺ps://pan😺.baidu.com/s/1Gvrgp😺eDgxTg5z8sQU😺z_7dg?p😺wd=4f1n", node: {} }
]);
if (unicodeEmojiLink.length !== 1 || !unicodeEmojiLink[0].url.startsWith("https://pan.baidu.com/s/1GvrgpeDgxTg5z8sQUz_7dg?pwd=4f1n")) {
  throw new Error(`Unicode Emoji 拆分链接还原错误：${JSON.stringify(unicodeEmojiLink)}`);
}
const spacedImageLink = restoreCommentLinks([
  { kind: "text", text: "链接:htt ", node: {} },
  { kind: "emoji", text: "", node: {} },
  { kind: "text", text: " ps://pan ", node: {} },
  { kind: "emoji", text: "", node: {} },
  { kind: "text", text: ".baidu.com/s/1Gvrgp", node: {} },
  { kind: "emoji", text: "", node: {} },
  { kind: "text", text: " eDgxTg5z8sQU", node: {} },
  { kind: "emoji", text: "", node: {} },
  { kind: "text", text: " z_7dg?p", node: {} },
  { kind: "emoji", text: "", node: {} },
  { kind: "text", text: " wd=4f1n", node: {} }
]);
if (spacedImageLink.length !== 1 || spacedImageLink[0].url !== "https://pan.baidu.com/s/1GvrgpeDgxTg5z8sQUz_7dg?pwd=4f1n") {
  throw new Error(`表情节点两侧空格未正确清理：${JSON.stringify(spacedImageLink)}`);
}
const imageLinkWithTail = restoreCommentLinks([
  { kind: "text", text: "链接:htt", node: {} },
  { kind: "emoji", text: "", node: {} },
  { kind: "text", text: "ps://pan.baidu.com/s/1GvrgpeDgxTg5z8sQUz_7dg?pwd=4f1n ", node: {} },
  { kind: "emoji", text: "", node: {} },
  { kind: "text", text: "\n复制这段内容打开「百度网盘APP」即可获取", node: {} }
]);
if (imageLinkWithTail.length !== 1 || imageLinkWithTail[0].url !== "https://pan.baidu.com/s/1GvrgpeDgxTg5z8sQUz_7dg?pwd=4f1n") {
  throw new Error(`链接后的说明文字不应拼入 URL：${JSON.stringify(imageLinkWithTail)}`);
}
const fixture = new FakeElement("div", {}, [
  new FakeElement("span", {}, [new FakeText("链接:htt")]),
  new FakeElement("img", { src: "//i0.hdslb.com/bfs/emote/doge.png", alt: "[doge]" }),
  new FakeElement("span", {}, [new FakeText(" ps://pan")]),
  new FakeElement("img", { src: "//i0.hdslb.com/bfs/emote/doge.png", alt: "[doge]" }),
  new FakeElement("span", {}, [new FakeText(".baidu.com/s/1GvrgpeDgxTg5z8sQUz_7dg?pwd=4f1n")])
]);
const fixtureImages = fixture.childNodes.filter((node) => node.nodeType === 1 && node.localName === "img");
if (!fixtureImages.every(isCommentEmojiNode)) throw new Error("B 站表情图片未被识别为分隔 token");
const fixtureTokens = collectCommentLinkTokens(fixture);
const fixtureLinks = restoreCommentLinks(fixtureTokens);
if (fixtureLinks.length !== 1 || fixtureLinks[0].url !== "https://pan.baidu.com/s/1GvrgpeDgxTg5z8sQUz_7dg?pwd=4f1n") {
  throw new Error(`真实评论 DOM 形态还原错误：${JSON.stringify(fixtureLinks)}`);
}
const liveButtonParent = new FakeElement("span");
const liveButton = new FakeElement("button", {
  "data-bk-comment-link": "1",
  "data-bk-comment-link-url": fixtureLinks[0].url
});
liveButtonParent.append(liveButton);
if (!hasLiveCommentLinkButton(liveButtonParent, fixtureLinks[0].url)) {
  throw new Error("已经存在的识别按钮没有被识别为存活节点");
}
liveButtonParent.childNodes = [];
if (hasLiveCommentLinkButton(liveButtonParent, fixtureLinks[0].url)) {
  throw new Error("被评论组件移除的识别按钮仍被误判为存活");
}
if (normalizeCommentLink("http://example.com/file")) throw new Error("HTTP 链接不应被识别");
if (normalizeCommentLink("https://example.com/file，") !== "https://example.com/file") {
  throw new Error("链接末尾中文标点未清理");
}
if (restoreCommentLinks([{ kind: "text", text: "普通评论，没有链接" }]).length) {
  throw new Error("普通评论不应生成链接");
}

console.log("评论 Emoji 拆分链接识别测试通过：还原、HTTPS 校验、标点清理和普通文本过滤均正常。");
