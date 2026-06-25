const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { requestBuffer, requestText } = require("./http");
const { normalizeUrl, parseHttpUrl } = require("./normalize");

function createLinkMetadataService({ faviconDir, suggestCategoryForLink }) {
  return {
    readLinkMetadata: (targetUrl) => readLinkMetadata(targetUrl, suggestCategoryForLink),
    serveFavicon: (res, targetUrl) => serveFavicon(res, targetUrl, faviconDir)
  };
}

function sendFaviconFallback(res) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#160b27"/><path d="M14 44h36M18 20h28M20 32h24" stroke="#26f4ff" stroke-width="5" stroke-linecap="round"/><path d="M14 44h36M18 20h28M20 32h24" stroke="#ff3df2" stroke-width="2" stroke-linecap="round"/></svg>`;
  res.writeHead(200, {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "public, max-age=86400"
  });
  res.end(svg);
}

async function serveFavicon(res, targetUrl, faviconDir) {
  const parsed = parseHttpUrl(targetUrl);
  if (!parsed) {
    sendFaviconFallback(res);
    return;
  }

  fs.mkdirSync(faviconDir, { recursive: true });
  const cacheKey = crypto.createHash("sha256").update(parsed.origin).digest("hex");
  const cacheFile = path.join(faviconDir, `${cacheKey}.bin`);
  const metaFile = path.join(faviconDir, `${cacheKey}.json`);

  if (fs.existsSync(cacheFile) && fs.existsSync(metaFile)) {
    const meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
    res.writeHead(200, {
      "Content-Type": meta.contentType || "image/x-icon",
      "Cache-Control": "public, max-age=604800"
    });
    fs.createReadStream(cacheFile).pipe(res);
    return;
  }

  try {
    const icon = await fetchBestFavicon(parsed);
    fs.writeFileSync(cacheFile, icon.buffer);
    fs.writeFileSync(metaFile, JSON.stringify({ contentType: icon.contentType }, null, 2));
    res.writeHead(200, {
      "Content-Type": icon.contentType,
      "Cache-Control": "public, max-age=604800"
    });
    res.end(icon.buffer);
  } catch {
    sendFaviconFallback(res);
  }
}

async function fetchBestFavicon(pageUrl) {
  const html = await requestBuffer(pageUrl.href, { accept: "text/html,*/*", limit: 250_000 }).catch(() => null);
  const candidates = [];

  if (html?.buffer) {
    const htmlText = html.buffer.toString("utf8");
    candidates.push(...extractIconUrls(htmlText, pageUrl));
  }

  candidates.push(new URL("/favicon.ico", pageUrl.origin).href);
  candidates.push(new URL("/apple-touch-icon.png", pageUrl.origin).href);

  const uniqueCandidates = [...new Set(candidates)];
  for (const candidate of uniqueCandidates) {
    try {
      const response = await requestBuffer(candidate, { accept: "image/*,*/*", limit: 500_000 });
      if (response.buffer.length > 0 && response.contentType.startsWith("image/")) return response;
    } catch {
      // Try the next declared or conventional favicon location.
    }
  }

  throw new Error("No favicon found");
}

async function readLinkMetadata(targetUrl, suggestCategoryForLink) {
  const parsed = parseHttpUrl(normalizeUrl(String(targetUrl || "")));
  if (!parsed) return { ok: false, message: "Ungueltige URL" };

  try {
    const html = await requestText(parsed.href, { accept: "text/html,*/*", limit: 1_500_000 });
    const title = extractPageTitle(html);
    const category = suggestCategoryForLink({ title, url: parsed.href });
    return {
      ok: Boolean(title),
      url: parsed.href,
      title: title.slice(0, 80),
      suggestedCategory: category,
      message: title ? "" : "Seitentitel nicht gefunden"
    };
  } catch (error) {
    return {
      ok: false,
      url: parsed.href,
      title: "",
      suggestedCategory: suggestCategoryForLink({ title: "", url: parsed.href }),
      message: error.message
    };
  }
}

function extractPageTitle(html) {
  const ogTitle = getMetaContent(html, "property", "og:title")
    || getMetaContent(html, "name", "og:title")
    || getMetaContent(html, "property", "twitter:title")
    || getMetaContent(html, "name", "twitter:title");
  const title = ogTitle || html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  return decodeHtmlText(title).replace(/\s+/g, " ").trim();
}

function getMetaContent(html, attrName, attrValue) {
  const metaPattern = /<meta\b[^>]*>/gi;
  for (const [tag] of html.matchAll(metaPattern)) {
    const attrs = readHtmlAttrs(tag);
    if (String(attrs[attrName] || "").toLowerCase() === attrValue.toLowerCase()) {
      return attrs.content || "";
    }
  }
  return "";
}

function extractIconUrls(html, pageUrl) {
  const urls = [];
  const linkPattern = /<link\b[^>]*>/gi;
  for (const [tag] of html.matchAll(linkPattern)) {
    const attrs = readHtmlAttrs(tag);
    const rel = attrs.rel || "";
    const href = attrs.href || "";
    if (href && /\b(icon|apple-touch-icon)\b/i.test(rel)) {
      urls.push(new URL(href, pageUrl.href).href);
    }
  }
  return urls;
}

function readHtmlAttrs(tag) {
  const attrs = {};
  const attrPattern = /\s([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of tag.matchAll(attrPattern)) {
    attrs[match[1].toLowerCase()] = decodeHtmlText(match[3] || match[4] || match[5] || "");
  }
  return attrs;
}

function decodeHtmlText(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

module.exports = {
  createLinkMetadataService
};
