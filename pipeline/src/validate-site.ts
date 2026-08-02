import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, posix, relative, resolve } from "node:path";
import * as cheerio from "cheerio";

const OUT_DIR = resolve("out");

if (!existsSync(OUT_DIR)) {
  console.error("Static export not found. Run `npm run build` first.");
  process.exit(1);
}

const files = walk(OUT_DIR);
const existing = new Set(files.map((file) => relative(OUT_DIR, file).replaceAll("\\", "/")));
const htmlFiles = files.filter((file) => file.endsWith(".html"));
const failures: string[] = [];
const idsByPage = new Map<string, Set<string>>();

for (const file of htmlFiles) {
  const page = relative(OUT_DIR, file).replaceAll("\\", "/");
  const $ = cheerio.load(readFileSync(file, "utf8"));
  const ids = new Set<string>();

  $("[id]").each((_, element) => {
    const id = $(element).attr("id");
    if (!id) return;
    if (ids.has(id)) failures.push(`${page}: duplicate id #${id}`);
    ids.add(id);
  });
  idsByPage.set(page, ids);

  $("a[href], img[src], link[href], script[src]").each((_, element) => {
    const tag = element.tagName.toLowerCase();
    const attribute = tag === "img" || tag === "script" ? "src" : "href";
    const url = $(element).attr(attribute);
    if (!url || isExternal(url)) return;

    const [pathPart = "", fragment] = url.split("#", 2);
    const target = resolveTarget(page, pathPart);
    if (pathPart && !target) failures.push(`${page}: ${tag} points to missing ${url}`);

    if (tag === "a" && fragment) {
      let decoded = fragment;
      try {
        decoded = decodeURIComponent(fragment);
      } catch {
        failures.push(`${page}: invalid fragment encoding #${fragment}`);
        return;
      }
      const targetIds = target ? idsForPage(target) : undefined;
      if (targetIds && !targetIds.has(decoded)) {
        failures.push(`${page}: missing fragment ${url}`);
      }
    }
  });

  $("img").each((_, element) => {
    const image = $(element);
    if (image.attr("alt") === undefined) failures.push(`${page}: image missing alt text`);
    if (!image.attr("width") || !image.attr("height")) {
      failures.push(`${page}: image missing intrinsic dimensions (${image.attr("src") ?? "unknown"})`);
    }
  });
}

if (failures.length > 0) {
  console.error(`Static export validation failed with ${failures.length} issue(s):`);
  for (const failure of failures.slice(0, 100)) console.error(`  - ${failure}`);
  if (failures.length > 100) console.error(`  - … ${failures.length - 100} more`);
  process.exit(1);
}

console.log(`Static export validated: ${htmlFiles.length} HTML pages, ${files.length} files, no broken local references.`);

function isExternal(url: string): boolean {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url);
}

function resolveTarget(page: string, rawPath: string): string | null {
  if (!rawPath) return page;

  let decoded: string;
  try {
    const pathOnly = rawPath.split("?", 1)[0] ?? "";
    if (!pathOnly) return page;
    decoded = decodeURI(pathOnly);
  } catch {
    return null;
  }

  const target = decoded.startsWith("/")
    ? decoded.slice(1)
    : posix.normalize(posix.join(posix.dirname(page), decoded));
  const normalized = target.replace(/^\.\//, "");
  const candidates = normalized === ""
    ? ["index.html"]
    : normalized.endsWith("/")
      ? [`${normalized}index.html`]
      : [normalized, `${normalized}.html`, `${normalized}/index.html`];
  return candidates.find((candidate) => existing.has(candidate)) ?? null;
}

function idsForPage(page: string): Set<string> | undefined {
  const cached = idsByPage.get(page);
  if (cached) return cached;
  if (!page.endsWith(".html") || !existing.has(page)) return undefined;

  const file = join(OUT_DIR, ...page.split("/"));
  const $ = cheerio.load(readFileSync(file, "utf8"));
  const ids = new Set<string>();
  $("[id]").each((_, element) => {
    const id = $(element).attr("id");
    if (id) ids.add(id);
  });
  idsByPage.set(page, ids);
  return ids;
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : entry.isFile() ? [path] : [];
  });
}
