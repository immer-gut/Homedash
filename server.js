const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const {
  normalizeHomeAssistantEntities,
  normalizeProfile,
  normalizeStatusWidget,
  normalizeUrl,
  parseHttpUrl
} = require("./server/normalize");
const {
  requestHead
} = require("./server/http");
const { createAuthService } = require("./server/auth");
const { createDataStore } = require("./server/data-store");
const { createLinkMetadataService } = require("./server/link-metadata");
const { createWeatherService } = require("./server/weather");
const { readStatusWithProvider } = require("./server/status");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = process.env.DATA_DIR || "/data";
const FAVICON_DIR = path.join(DATA_DIR, "favicons");
const PUBLIC_DIR = path.join(__dirname, "public");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const STATUS_TARGETS = parseStatusTargets(process.env.HOMEDASH_STATUS_TARGETS || "[]");
const APP_VERSION = readAppVersion();

const {
  ensureDataFile,
  readData,
  readDataWithoutMigration,
  writeData
} = createDataStore({
  dataDir: DATA_DIR,
  faviconDir: FAVICON_DIR
});
const auth = createAuthService({
  adminPassword: ADMIN_PASSWORD,
  appVersion: APP_VERSION,
  readDataWithoutMigration,
  sendJson
});
const { readLinkMetadata, serveFavicon } = createLinkMetadataService({
  faviconDir: FAVICON_DIR,
  suggestCategoryForLink
});
const { readWeather } = createWeatherService({ readData });

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readAppVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));
    return String(packageJson.version || "0.0.0");
  } catch {
    return "0.0.0";
  }
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
        openUrl: normalizeUrl(String(target.openUrl || "")),
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
    openUrl: createOpenUrl(target),
    enabled: target.enabled !== false
  };
}

function createOpenUrl(target) {
  const parsed = parseHttpUrl(target.openUrl || target.url);
  if (!parsed) return "";
  parsed.username = "";
  parsed.password = "";
  parsed.search = "";
  parsed.hash = "";
  if (!target.openUrl && (["homeassistant", "proxmox", "proxmoxbackup", "unraid", "amp"].includes(target.type) || /^\/(api|api2|graphql)(\/|$)/i.test(parsed.pathname))) {
    parsed.pathname = "/";
  }
  return parsed.href;
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
    return await readStatusWithProvider(target, base);
  } catch (error) {
    return {
      ...base,
      message: error.message || "Nicht erreichbar"
    };
  }
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
      sendJson(res, 200, auth.toPublicData(readData(), req));
      return;
    }

    if (url.pathname === "/api/homedash" && req.method === "PUT") {
      if (!auth.requireAuth(req, res)) return;
      const body = await readRequestBody(req);
      const saved = writeData(JSON.parse(body));
      sendJson(res, 200, auth.toPublicData(saved, req));
      return;
    }

    if (url.pathname === "/api/setup" && req.method === "POST") {
      const current = readData();
      if (current.setupComplete && (ADMIN_PASSWORD || current.admin?.passwordHash) && !auth.isAuthed(req)) {
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
        admin: body.password ? { passwordHash: auth.hashPassword(body.password) } : current.admin,
        activeProfileId: firstProfile.id,
        profiles: [firstProfile]
      });
      if (body.password) {
        auth.shortcut(res, saved);
      }
      sendJson(res, 200, auth.toPublicData(saved, req));
      return;
    }

    if (url.pathname === "/api/import" && req.method === "POST") {
      if (!auth.requireAuth(req, res)) return;
      const body = JSON.parse(await readRequestBody(req));
      const saved = writeData({ ...body, setupComplete: true });
      sendJson(res, 200, auth.toPublicData(saved, req));
      return;
    }

    if (url.pathname === "/api/auth/status" && req.method === "GET") {
      const data = readData();
      sendJson(res, 200, auth.getAuthState(data, req));
      return;
    }

    if (url.pathname === "/api/auth/login" && req.method === "POST") {
      const body = JSON.parse(await readRequestBody(req));
      const data = readData();
      const result = auth.login(req, res, data, body.password);
      if (result) {
        sendJson(res, 200, result);
        return;
      }
      sendJson(res, 401, { error: "Invalid password" });
      return;
    }

    if (url.pathname === "/api/auth/shortcut" && req.method === "POST") {
      const data = readData();
      sendJson(res, 200, auth.shortcut(res, data));
      return;
    }

    if (url.pathname === "/api/auth/logout" && req.method === "POST") {
      const data = readData();
      sendJson(res, 200, auth.logout(req, res, data));
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
      if (!auth.requireAuth(req, res)) return;
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
