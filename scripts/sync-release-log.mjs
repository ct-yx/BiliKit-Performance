import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const DEFAULT_REPOSITORY = "ct-yx/BiliKit-Performance";
const repository = process.env.GITHUB_REPOSITORY || DEFAULT_REPOSITORY;
const apiBase = process.env.GITHUB_API_URL || "https://api.github.com";
const outputPath = resolve("docs/changelog.json");

if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
  throw new Error(`Invalid GitHub repository: ${repository}`);
}

const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "BiliKit-Performance-changelog-sync",
};
if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

const response = await fetch(`${apiBase}/repos/${repository}/releases?per_page=100`, { headers });
if (!response.ok) {
  const details = (await response.text()).trim();
  throw new Error(`GitHub Releases API failed (${response.status}): ${details || response.statusText}`);
}

const releases = await response.json();
if (!Array.isArray(releases)) {
  throw new Error("GitHub Releases API returned an unexpected response");
}

const normalizedReleases = releases
  .filter((release) => !release.draft && !release.prerelease && release.published_at && release.tag_name)
  .sort((left, right) => right.published_at.localeCompare(left.published_at))
  .map((release) => ({
    tagName: release.tag_name,
    name: release.name || release.tag_name,
    publishedAt: release.published_at,
    htmlUrl: release.html_url,
    body: release.body || "",
  }));

const output = `${JSON.stringify({ repository, releases: normalizedReleases }, null, 2)}\n`;
let current = "";
try {
  current = await readFile(outputPath, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

if (current === output) {
  console.log(`Release changelog is already up to date (${normalizedReleases.length} releases)`);
  process.exit(0);
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, output, "utf8");
console.log(`Synced ${normalizedReleases.length} releases to ${outputPath}`);
