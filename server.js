const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const {
  createDefaultData,
  migrateData,
  normalizeData,
  normalizeHomeAssistantEntities,
  normalizeProfile,
  normalizeStatusWidget,
  normalizeUrl,
  normalizeWeatherWidget,
  parseHttpUrl
} = require("./server/normalize");
const {
  requestBuffer,
  requestHead,
  requestJson
} = require("./server/http");
const { readProxmoxStatus } = require("./server/status/proxmox");
const { readProxmoxBackupStatus } = require("./server/status/proxmox-backup");
const { readHomeAssistantStatus } = require("./server/status/home-assistant");
const { readGenericServiceStatus } = require("./server/status/generic");
const { readUnraidStatus } = require("./server/status/unraid");
const { readAmpStatus } = require("./server/status/amp");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = process.env.DATA_DIR || "/data";
const DATA_FILE = path.join(DATA_DIR, "homedash.json");
const FAVICON_DIR = path.join(DATA_DIR, "favicons");
const PUBLIC_DIR = path.join(__dirname, "public");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const STATUS_TARGETS = parseStatusTargets(process.env.HOMEDASH_STATUS_TARGETS || "[]");
const APP_VERSION = readAppVersion();
const sessions = new Map();

const defaultData = createDefaultData();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

function ensureDataFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(FAVICON_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
  }
}

function readData() {
  ensureDataFile();
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const migrated = migrateData(data);
  if (JSON.stringify(migrated) !== JSON.stringify(data)) {
    fs.writeFileSync(DATA_FILE, `${JSON.stringify(migrated, null, 2)}\n`);
  }
  return migrated;
}

function writeData(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const existing = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) : {};
  const mergedData = preserveExistingStatusSecrets(data, existing);
  const safeData = normalizeData({
    ...mergedData,
    admin: {
      ...existing.admin,
      ...mergedData.admin
    },
    schemaVersion: mergedData.schemaVersion || 6
  });
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(safeData, null, 2)}\n`);
  return safeData;
}

function preserveExistingStatusSecrets(incoming, existing) {
  const existingWidgets = new Map();
  for (const profile of Array.isArray(existing.profiles) ? existing.profiles : []) {
    for (const target of Array.isArray(profile.statusTargets) ? profile.statusTargets : []) {
      if (target.id) existingWidgets.set(String(target.id), target);
    }
    for (const link of Array.isArray(profile.links) ? profile.links : []) {
      if (link.id && link.statusWidget) existingWidgets.set(String(link.id), link.statusWidget);
    }
  }
  for (const link of Array.isArray(existing.links) ? existing.links : []) {
    if (link.id && link.statusWidget && !existingWidgets.has(String(link.id))) {
      existingWidgets.set(String(link.id), link.statusWidget);
    }
  }

  const mergeTarget = (target) => {
    if (!target?.id) return target;
    const existingWidget = existingWidgets.get(String(target.id));
    if (!existingWidget || String(existingWidget.type || "basic").toLowerCase() !== String(target.type || "basic").toLowerCase()) {
      return target;
    }
    return preserveStatusWidgetSecrets(target, existingWidget);
  };

  return {
    ...incoming,
    profiles: Array.isArray(incoming.profiles)
      ? incoming.profiles.map((profile) => ({
          ...profile,
          statusTargets: Array.isArray(profile.statusTargets) ? profile.statusTargets.map(mergeTarget) : profile.statusTargets,
          links: Array.isArray(profile.links)
            ? profile.links.map((link) => link?.statusWidget ? { ...link, statusWidget: mergeTarget({ id: link.id, ...link.statusWidget }) } : link)
            : profile.links
        }))
      : incoming.profiles,
    links: incoming.links
  };
}

function preserveStatusWidgetSecrets(incoming, existing) {
  const fields = ["tokenId", "tokenSecret", "apiKey", "username", "password", "headerValue"];
  const merged = { ...incoming };
  for (const field of fields) {
    if (String(merged[field] || "") === "" && String(existing[field] || "") !== "") {
      merged[field] = existing[field];
    }
  }
  return merged;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((cookie) => cookie.trim().split("="))
      .filter(([key, value]) => key && value)
  );
}

function isAuthed(req) {
  const data = readDataWithoutMigration();
  if (!ADMIN_PASSWORD && !data.admin?.passwordHash) return true;
  const sessionId = parseCookies(req).homedash_session;
  const session = sessionId ? sessions.get(sessionId) : null;
  if (!session) return false;
  if (session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return false;
  }
  return true;
}

function requireAuth(req, res) {
  if (isAuthed(req)) return true;
  sendJson(res, 401, { error: "Admin login required" });
  return false;
}

function readDataWithoutMigration() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (ADMIN_PASSWORD && password === ADMIN_PASSWORD) return true;
  if (!storedHash) return false;
  const [salt, expectedHash] = storedHash.split(":");
  if (!salt || !expectedHash) return false;
  const actualHash = hashPassword(password, salt).split(":")[1];
  return crypto.timingSafeEqual(Buffer.from(actualHash, "hex"), Buffer.from(expectedHash, "hex"));
}

function createAdminSession(res) {
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, { expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 });
  setSessionCookie(res, sessionId);
}

function setSessionCookie(res, sessionId) {
  res.setHeader("Set-Cookie", `homedash_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", "homedash_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
}

function toPublicData(data, req) {
  const { passwordHash, ...publicAdmin } = data.admin || {};
  const authenticated = isAuthed(req);
  const publicData = authenticated ? data : redactStatusSecrets(data);
  return {
    ...publicData,
    app: {
      name: "Homedash",
      version: APP_VERSION
    },
    admin: {
      ...publicAdmin,
      enabled: Boolean(ADMIN_PASSWORD || passwordHash)
    },
    auth: {
      enabled: Boolean(ADMIN_PASSWORD || passwordHash),
      authenticated
    }
  };
}

function readAppVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));
    return String(packageJson.version || "0.0.0");
  } catch {
    return "0.0.0";
  }
}

function redactStatusSecrets(data) {
  const redactTarget = (target) => target ? {
    ...target,
      tokenId: "",
      tokenSecret: "",
      apiKey: "",
      username: "",
      password: "",
      headerValue: ""
  } : target;
  const profiles = (data.profiles || []).map((profile) => ({
    ...profile,
    statusTargets: (profile.statusTargets || []).map(redactTarget)
  }));
  return {
    ...data,
    profiles,
    statusTargets: (data.statusTargets || []).map(redactTarget)
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

async function serveFavicon(res, targetUrl) {
  const parsed = parseHttpUrl(targetUrl);
  if (!parsed) {
    sendFaviconFallback(res);
    return;
  }

  fs.mkdirSync(FAVICON_DIR, { recursive: true });
  const cacheKey = crypto.createHash("sha256").update(parsed.origin).digest("hex");
  const cacheFile = path.join(FAVICON_DIR, `${cacheKey}.bin`);
  const metaFile = path.join(FAVICON_DIR, `${cacheKey}.json`);

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

async function readLinkMetadata(targetUrl) {
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

function hostLabel(parsed) {
  return parsed.hostname.replace(/^www\./i, "").split(".")[0] || "Link";
}

function suggestCategoryForLink({ title, url }) {
  const data = readData();
  const activeProfile = data.profiles.find((profile) => profile.id === data.activeProfileId) || data.profiles[0];
  const categories = activeProfile?.categories || [];
  const links = activeProfile?.links || [];
  const parsed = parseHttpUrl(url);
  const origin = parsed?.origin.toLowerCase() || "";
  const text = normalizeSuggestText(`${title} ${url}`);
  const scores = new Map();

  for (const link of links) {
    if (origin && parseHttpUrl(link.url)?.origin.toLowerCase() === origin) {
      scores.set(link.category, (scores.get(link.category) || 0) + 12);
    }
  }

  for (const category of categories) {
    const normalizedName = normalizeSuggestText(category.name);
    if (!normalizedName) continue;
    if (text.includes(normalizedName)) scores.set(category.name, (scores.get(category.name) || 0) + 8);
    for (const token of normalizedName.split(" ").filter((token) => token.length >= 4)) {
      if (text.includes(token)) scores.set(category.name, (scores.get(category.name) || 0) + 2);
    }
  }

  const hints = [
    ["Medien", ["youtube", "netflix", "plex", "photo", "immich", "spotify", "twitch"]],
    ["Business", ["billbee", "ebay", "etsy", "shop", "kasuwa", "paypal", "stripe"]],
    ["Netzwerk", ["fritz", "router", "mikrotik", "adguard", "dns", "wifi", "wlan"]],
    ["Server", ["docker", "proxmox", "nginx", "portainer", "idrac", "unraid", "nas"]],
    ["Smart Home", ["home assistant", "homematic", "zigbee", "mqtt", "shelly"]],
    ["Sicherheit", ["vaultwarden", "bitwarden", "password", "backup"]],
    ["Werkstatt", ["tool", "werkstatt", "svg", "3d", "druck"]]
  ];
  const knownNames = new Map(categories.map((category) => [category.name.toLowerCase(), category.name]));
  for (const [name, keywords] of hints) {
    const category = knownNames.get(name.toLowerCase());
    if (!category) continue;
    if (keywords.some((keyword) => text.includes(keyword))) scores.set(category, (scores.get(category) || 0) + 5);
  }

  return [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function normalizeSuggestText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseStatusTargets(raw) {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    const targets = Array.isArray(parsed) ? parsed : [parsed];
    return targets
      .map((target) => ({
        id: String(target.id || target.name || crypto.randomUUID()).slice(0, 80),
        name: String(target.name || target.type || "Status").slice(0, 80),
        type: String(target.type || "basic").toLowerCase(),
        url: normalizeUrl(String(target.url || "")),
        statusPath: String(target.statusPath || ""),
        apiKey: String(target.apiKey || ""),
        username: String(target.username || ""),
        password: String(target.password || ""),
        tokenId: String(target.tokenId || ""),
        tokenSecret: String(target.tokenSecret || ""),
        entities: normalizeHomeAssistantEntities(target.entities),
        headerName: String(target.headerName || ""),
        headerValue: String(target.headerValue || ""),
        debug: target.debug === true
      }))
      .filter((target) => target.url && parseHttpUrl(target.url));
  } catch (error) {
    console.error(`HOMEDASH_STATUS_TARGETS konnte nicht gelesen werden: ${error.message}`);
    return [];
  }
}

function publicStatusTarget(target) {
  return {
    id: target.id,
    name: target.name,
    type: target.type,
    url: target.url,
    enabled: target.enabled !== false
  };
}

function getConfiguredStatusTargets(data) {
  const linkTargets = [];
  for (const profile of data.profiles || []) {
    for (const target of profile.statusTargets || []) {
      linkTargets.push(target);
    }
    for (const link of profile.links || []) {
      if (!link.statusWidget?.enabled) continue;
      linkTargets.push({
        ...link.statusWidget,
        id: link.id,
        name: link.title,
        url: link.statusWidget.url || link.url
      });
    }
  }
  return [...STATUS_TARGETS, ...linkTargets].filter((target) => target.url && parseHttpUrl(target.url));
}

async function readStatusTargets() {
  const targets = getConfiguredStatusTargets(readData());
  const items = await Promise.all(targets.map(readStatusTarget));
  return {
    configured: targets.length,
    updatedAt: new Date().toISOString(),
    items
  };
}

async function readStatusTarget(target) {
  const base = {
    ...publicStatusTarget(target),
    ok: false,
    status: "offline",
    details: [],
    metrics: []
  };

  try {
    if (target.enabled === false) {
      return { ...base, message: "Deaktiviert", metrics: [{ label: "Status", value: "Aus" }] };
    }
    if (target.type === "proxmox") return await readProxmoxStatus(target, base);
    if (target.type === "proxmoxbackup") return await readProxmoxBackupStatus(target, base);
    if (target.type === "unraid" && target.apiKey) return await readUnraidStatus(target, base);
    if (target.type === "amp" && target.username && target.password) return await readAmpStatus(target, base);
    if (target.type === "homeassistant") {
      if (!target.apiKey) return { ...base, message: "Home Assistant Token fehlt" };
      return await readHomeAssistantStatus(target, base);
    }
    return await readGenericServiceStatus(target, base);
  } catch (error) {
    return {
      ...base,
      message: error.message || "Nicht erreichbar"
    };
  }
}

async function readWeather() {
  const data = readData();
  const weather = normalizeWeatherWidget(data.widgets?.weather);
  if (!weather.enabled) return { enabled: false };
  if (!weather.latitude || !weather.longitude) {
    return { enabled: true, ok: false, label: weather.label, message: "Koordinaten fehlen" };
  }

  const params = new URLSearchParams({
    latitude: weather.latitude,
    longitude: weather.longitude,
    current: "temperature_2m,relative_humidity_2m,weather_code,precipitation",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "1"
  });
  const payload = await requestJson(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  const current = payload.current || {};
  const daily = payload.daily || {};
  const temperature = roundNumber(current.temperature_2m);
  const code = Number(current.weather_code);

  return {
    enabled: true,
    ok: true,
    label: weather.label,
    updatedAt: current.time || new Date().toISOString(),
    temperature,
    condition: weatherCodeText(code),
    weatherCode: Number.isFinite(code) ? code : null,
    precipitation: roundNumber(current.precipitation),
    humidity: roundNumber(current.relative_humidity_2m),
    rainChance: roundNumber(firstArrayValue(daily.precipitation_probability_max)),
    high: roundNumber(firstArrayValue(daily.temperature_2m_max)),
    low: roundNumber(firstArrayValue(daily.temperature_2m_min))
  };
}

function firstArrayValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function roundNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function weatherCodeText(code) {
  if ([0].includes(code)) return "Klar";
  if ([1, 2].includes(code)) return "Teilweise wolkig";
  if ([3].includes(code)) return "Bewölkt";
  if ([45, 48].includes(code)) return "Nebel";
  if ([51, 53, 55, 56, 57].includes(code)) return "Nieselregen";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Regen";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Schnee";
  if ([95, 96, 99].includes(code)) return "Gewitter";
  return "Wetter";
}

function requestText(targetUrl, { accept, limit, headers = {} }) {
  return new Promise((resolve, reject) => {
    const parsed = parseHttpUrl(targetUrl);
    if (!parsed) {
      reject(new Error("Invalid URL"));
      return;
    }

    const transport = parsed.protocol === "https:" ? https : http;
    const request = transport.request(
      parsed,
      {
        headers: { Accept: accept, "User-Agent": "Homedash/1.0", ...headers },
        rejectUnauthorized: false,
        timeout: 5000
      },
      (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume();
          requestText(new URL(response.headers.location, parsed.href).href, { accept, headers, limit }).then(resolve, reject);
          return;
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          response.resume();
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const chunks = [];
        let size = 0;
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve(Buffer.concat(chunks).toString("utf8"));
        };
        response.on("data", (chunk) => {
          size += chunk.length;
          chunks.push(chunk);
          const text = Buffer.concat(chunks).toString("utf8");
          if (size >= limit || /<\/head>/i.test(text) || /<\/title>/i.test(text)) {
            response.destroy();
            finish();
          }
        });
        response.on("end", finish);
      }
    );
    request.on("timeout", () => request.destroy(new Error("Request timeout")));
    request.on("error", (error) => {
      if (error.code === "ECONNRESET") return;
      reject(error);
    });
    request.end();
  });
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function serveStatic(req, res) {
  const requestPath = new URL(req.url, `http://${req.headers.host}`).pathname;
  const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath === "/" ? "index.html" : safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (fallbackError, fallback) => {
        if (fallbackError) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": mimeTypes[".html"] });
        res.end(fallback);
      });
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (url.pathname === "/api/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/homedash" && req.method === "GET") {
      sendJson(res, 200, toPublicData(readData(), req));
      return;
    }

    if (url.pathname === "/api/homedash" && req.method === "PUT") {
      if (!requireAuth(req, res)) return;
      const body = await readRequestBody(req);
      const saved = writeData(JSON.parse(body));
      sendJson(res, 200, toPublicData(saved, req));
      return;
    }

    if (url.pathname === "/api/setup" && req.method === "POST") {
      const current = readData();
      if (current.setupComplete && (ADMIN_PASSWORD || current.admin?.passwordHash) && !isAuthed(req)) {
        sendJson(res, 409, { error: "Setup already completed" });
        return;
      }
      const body = JSON.parse(await readRequestBody(req));
      const firstProfile = normalizeProfile({
        id: "default",
        name: body.profileName || "Start",
        categories: (Array.isArray(body.categories) ? body.categories : ["Links"]).map((name) => ({ name })),
        links: []
      });
      const saved = writeData({
        ...current,
        setupComplete: true,
        title: body.title || current.title,
        subtitle: body.subtitle || current.subtitle,
        theme: body.theme || current.theme,
        admin: body.password ? { passwordHash: hashPassword(body.password) } : current.admin,
        activeProfileId: firstProfile.id,
        profiles: [firstProfile]
      });
      if (body.password) {
        createAdminSession(res);
      }
      sendJson(res, 200, toPublicData(saved, req));
      return;
    }

    if (url.pathname === "/api/import" && req.method === "POST") {
      if (!requireAuth(req, res)) return;
      const body = JSON.parse(await readRequestBody(req));
      const saved = writeData({ ...body, setupComplete: true });
      sendJson(res, 200, toPublicData(saved, req));
      return;
    }

    if (url.pathname === "/api/auth/status" && req.method === "GET") {
      const data = readData();
      sendJson(res, 200, { enabled: Boolean(ADMIN_PASSWORD || data.admin?.passwordHash), authenticated: isAuthed(req) });
      return;
    }

    if (url.pathname === "/api/auth/login" && req.method === "POST") {
      const body = JSON.parse(await readRequestBody(req));
      const data = readData();
      if (!ADMIN_PASSWORD && !data.admin?.passwordHash || verifyPassword(body.password, data.admin?.passwordHash)) {
        createAdminSession(res);
        sendJson(res, 200, { enabled: Boolean(ADMIN_PASSWORD || data.admin?.passwordHash), authenticated: true });
        return;
      }
      sendJson(res, 401, { error: "Invalid password" });
      return;
    }

    if (url.pathname === "/api/auth/shortcut" && req.method === "POST") {
      const data = readData();
      createAdminSession(res);
      sendJson(res, 200, { enabled: Boolean(ADMIN_PASSWORD || data.admin?.passwordHash), authenticated: true });
      return;
    }

    if (url.pathname === "/api/auth/logout" && req.method === "POST") {
      const sessionId = parseCookies(req).homedash_session;
      if (sessionId) sessions.delete(sessionId);
      clearSessionCookie(res);
      const data = readData();
      sendJson(res, 200, { enabled: Boolean(ADMIN_PASSWORD || data.admin?.passwordHash), authenticated: false });
      return;
    }

    if (url.pathname === "/api/link-status" && req.method === "GET") {
      const target = url.searchParams.get("url") || "";
      const parsed = parseHttpUrl(target);
      if (!parsed) {
        sendJson(res, 200, { ok: false, status: 0, error: "Invalid URL" });
        return;
      }
      try {
        const result = await requestHead(parsed.href);
        sendJson(res, 200, result);
      } catch (error) {
        sendJson(res, 200, { ok: false, status: 0, error: error.message });
      }
      return;
    }

    if (url.pathname === "/api/link-metadata" && req.method === "GET") {
      sendJson(res, 200, await readLinkMetadata(url.searchParams.get("url") || ""));
      return;
    }

    if (url.pathname === "/api/status" && req.method === "GET") {
      sendJson(res, 200, await readStatusTargets());
      return;
    }

    if (url.pathname === "/api/weather" && req.method === "GET") {
      sendJson(res, 200, await readWeather());
      return;
    }

    if (url.pathname === "/api/homedash/export" && req.method === "GET") {
      if (!requireAuth(req, res)) return;
      const data = JSON.stringify(readData(), null, 2);
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=homedash.json"
      });
      res.end(data);
      return;
    }

    if (url.pathname === "/api/favicon" && req.method === "GET") {
      await serveFavicon(res, url.searchParams.get("url") || "");
      return;
    }

    if (req.method === "GET" || req.method === "HEAD") {
      serveStatic(req, res);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Bad request" });
  }
});

ensureDataFile();
server.listen(PORT, HOST, () => {
  console.log(`Homedash running on http://${HOST}:${PORT}`);
});
