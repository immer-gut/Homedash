const crypto = require("crypto");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

function createDefaultCategories() {
  return [
    ["Business", "briefcase", "#ffb238"],
    ["Server", "server", "#35f0ff"],
    ["Netzwerk", "network", "#56ff8f"],
    ["Smart Home", "home", "#c471ff"],
    ["Sicherheit", "shield", "#ff4f7a"],
    ["Werkstatt", "tool", "#ff6f3c"],
    ["Medien", "media", "#4aa8ff"]
  ].map(([name, icon, color]) => ({ id: crypto.randomUUID(), name, icon, color }));
}

function createDefaultData() {
  return {
    schemaVersion: 6,
    setupComplete: false,
    title: "Homedash",
    subtitle: "Deine Startseite fuer Links, Profile und kleine Widgets",
    theme: "retro",
    activeProfileId: "default",
    widgets: {
      clock: true,
      notes: [],
      statusOverview: false,
      linkStats: false,
      weather: {
        enabled: false,
        label: "Zuhause",
        latitude: "",
        longitude: ""
      },
      dateCountdown: {
        enabled: false,
        items: []
      }
    },
    preferences: {
      startpageMode: true,
      shareMode: false,
      showCategoryCounts: false,
      compactCategoryLayout: false,
      showLinkStatus: true,
      showNotes: true,
      openLinksInNewTab: true
    },
    admin: {
      enabled: Boolean(ADMIN_PASSWORD)
    },
    profiles: [
      {
        id: "default",
        name: "Privat",
        categories: [{ id: crypto.randomUUID(), name: "Links", icon: "star", color: "#35f0ff", visible: true }],
        links: [],
        statusTargets: []
      }
    ]
  };
}

function normalizeData(data) {
  const defaultData = createDefaultData();
  const title = String(data.title || "Startseite").slice(0, 80);
  const subtitle = String(data.subtitle || "").slice(0, 140);
  const rawProfiles = Array.isArray(data.profiles) && data.profiles.length
    ? data.profiles
    : [
        {
          id: data.activeProfileId || "default",
          name: "Start",
          categories: data.categories,
          links: data.links,
          statusTargets: data.statusTargets
        }
      ];
  const profiles = rawProfiles.map(normalizeProfile).filter((profile) => profile.links.length || profile.categories.length || profile.statusTargets.length);
  if (!profiles.length) profiles.push(normalizeProfile(defaultData.profiles[0]));
  const activeProfileId = profiles.some((profile) => profile.id === data.activeProfileId)
    ? String(data.activeProfileId)
    : profiles[0].id;
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) || profiles[0];

  return {
    schemaVersion: Number(data.schemaVersion || 1),
    setupComplete: data.setupComplete !== false,
    title,
    subtitle,
    theme: normalizeTheme(data.theme),
    activeProfileId,
    widgets: normalizeWidgets(data.widgets),
    preferences: normalizePreferences(data.preferences),
    admin: {
      enabled: Boolean(ADMIN_PASSWORD || data.admin?.passwordHash),
      passwordHash: String(data.admin?.passwordHash || "")
    },
    profiles,
    categories: activeProfile.categories,
    links: activeProfile.links,
    statusTargets: activeProfile.statusTargets
  };
}

function normalizeProfile(profile) {
  const links = Array.isArray(profile.links) ? profile.links : [];
  const migratedTargets = links
    .filter((link) => link?.statusWidget?.enabled)
    .map((link) => ({
      ...link.statusWidget,
      id: String(link.statusWidget.id || link.id || crypto.randomUUID()),
      name: String(link.statusWidget.name || link.title || "Status"),
      url: link.statusWidget.url || link.url
    }));
  const normalizedLinks = links
    .map((link) => ({
      id: String(link.id || crypto.randomUUID()),
      title: String(link.title || "Ohne Titel").slice(0, 80),
      url: normalizeUrl(String(link.url || "")),
      category: String(link.category || "Links").slice(0, 40),
      note: String(link.note || "").slice(0, 120)
    }))
    .filter((link) => link.url);
  const normalizedTargets = normalizeStatusTargets([...(Array.isArray(profile.statusTargets) ? profile.statusTargets : []), ...migratedTargets]);

  return {
    id: String(profile.id || crypto.randomUUID()),
    name: String(profile.name || "Start").slice(0, 50),
    categories: normalizeCategories(profile.categories, normalizedLinks),
    links: normalizedLinks,
    statusTargets: normalizedTargets
  };
}

function normalizeTheme(theme) {
  return ["retro", "time-circuit", "fallout", "dark", "light", "terminal"].includes(theme) ? theme : "retro";
}

function normalizeWidgets(widgets) {
  const legacyNote = String(widgets?.quickNote || "").trim();
  const notes = Array.isArray(widgets?.notes)
    ? widgets.notes
    : legacyNote
      ? [{ id: crypto.randomUUID(), text: legacyNote }]
      : [];

  return {
    clock: widgets?.clock !== false,
    statusOverview: widgets?.statusOverview === true,
    linkStats: widgets?.linkStats === true,
    weather: normalizeWeatherWidget(widgets?.weather),
    dateCountdown: normalizeDateCountdownWidget(widgets?.dateCountdown),
    notes: notes
      .map((note) => ({
        id: String(note.id || crypto.randomUUID()),
        text: String(note.text || "").trim().slice(0, 500)
      }))
      .filter((note) => note.text)
  };
}

function normalizeDateCountdownWidget(widget) {
  const items = Array.isArray(widget?.items)
    ? widget.items
    : widget?.date || widget?.label
      ? [{ id: widget?.id, label: widget?.label, date: widget?.date }]
      : [];
  return {
    enabled: widget?.enabled === true,
    items: items
      .map((item) => {
        const rawDate = String(item?.date || "").trim();
        return {
          id: String(item?.id || crypto.randomUUID()),
          label: String(item?.label || "Datum").trim().slice(0, 40) || "Datum",
          date: /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : ""
        };
      })
      .filter((item) => item.date)
      .slice(0, 12)
  };
}

function normalizeWeatherWidget(weather) {
  const rawLatitude = String(weather?.latitude || "").trim();
  const rawLongitude = String(weather?.longitude || "").trim();
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  return {
    enabled: weather?.enabled === true,
    label: String(weather?.label || "Zuhause").trim().slice(0, 40) || "Zuhause",
    latitude: rawLatitude && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 ? String(latitude) : "",
    longitude: rawLongitude && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 ? String(longitude) : ""
  };
}

function normalizePreferences(preferences) {
  return {
    startpageMode: preferences?.startpageMode !== false,
    shareMode: preferences?.shareMode === true,
    showCategoryCounts: preferences?.showCategoryCounts === true,
    compactCategoryLayout: preferences?.compactCategoryLayout === true,
    showLinkStatus: preferences?.showLinkStatus !== false,
    showNotes: preferences?.showNotes !== false,
    openLinksInNewTab: preferences?.openLinksInNewTab !== false
  };
}

function normalizeStatusWidget(widget, fallbackUrl = "") {
  const enabled = widget?.enabled === true;
  return {
    enabled,
    type: ["basic", "proxmox", "proxmoxbackup", "unraid", "amp", "homeassistant"].includes(String(widget?.type || "").toLowerCase())
      ? String(widget.type).toLowerCase()
      : "basic",
    url: normalizeUrl(String(widget?.url || fallbackUrl || "")),
    statusPath: String(widget?.statusPath || "").slice(0, 160),
    tokenId: String(widget?.tokenId || "").slice(0, 160),
    tokenSecret: String(widget?.tokenSecret || "").slice(0, 260),
    apiKey: String(widget?.apiKey || "").slice(0, 260),
    username: String(widget?.username || "").slice(0, 160),
    password: String(widget?.password || "").slice(0, 260),
    entities: normalizeHomeAssistantEntities(widget?.entities),
    headerName: String(widget?.headerName || "").slice(0, 80),
    headerValue: String(widget?.headerValue || "").slice(0, 260),
    debug: widget?.debug === true
  };
}

function normalizeStatusTargets(targets) {
  const seen = new Set();
  return (Array.isArray(targets) ? targets : [])
    .map((target) => {
      const normalized = normalizeStatusWidget({ ...target, enabled: target?.enabled !== false }, target?.url);
      return {
        ...normalized,
        id: String(target?.id || crypto.randomUUID()).slice(0, 80),
        name: String(target?.name || target?.title || target?.type || "Status").trim().slice(0, 80) || "Status"
      };
    })
    .filter((target) => {
      if (!target.url || !parseHttpUrl(target.url) || seen.has(target.id)) return false;
      seen.add(target.id);
      return true;
    });
}

function normalizeHomeAssistantEntities(value) {
  const raw = Array.isArray(value)
    ? value.map((entry) => typeof entry === "object" ? `${entry.entityId || entry.id || ""}=${entry.label || entry.name || ""}` : String(entry)).join(",")
    : String(value || "");
  return raw
    .split(/[\n,]+/)
    .map(normalizeHomeAssistantEntitySpec)
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeHomeAssistantEntitySpec(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const separatorIndex = ["=", "|"].map((separator) => raw.indexOf(separator)).filter((index) => index > 0).sort((a, b) => a - b)[0];
  const entityId = (separatorIndex ? raw.slice(0, separatorIndex) : raw).trim();
  const label = separatorIndex ? raw.slice(separatorIndex + 1).trim().slice(0, 60) : "";
  if (!/^[a-z_]+\.[\w-]+$/i.test(entityId)) return null;
  return { entityId, label };
}

function normalizeCategories(categories, links) {
  const seen = new Set();
  const normalizedCategories = (Array.isArray(categories) ? categories : [])
    .map((category) => ({
      id: String(category.id || crypto.randomUUID()),
      name: String(category.name || "").trim().slice(0, 40),
      icon: normalizeCategoryIcon(category.icon),
      color: normalizeCategoryColor(category.color),
      visible: category.visible !== false
    }))
    .filter((category) => {
      if (!category.name || seen.has(category.name)) return false;
      seen.add(category.name);
      return true;
    });

  for (const link of links) {
    if (!seen.has(link.category)) {
      normalizedCategories.push({ id: crypto.randomUUID(), name: link.category, icon: "link", color: "#35f0ff", visible: true });
      seen.add(link.category);
    }
  }

  const categoryList = normalizedCategories.length ? normalizedCategories : createDefaultCategories();
  return categoryList.sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));
}

function normalizeCategoryIcon(icon) {
  const normalized = String(icon || "").toLowerCase();
  return ["star", "server", "network", "home", "shield", "tool", "media", "briefcase", "game", "link"].includes(normalized)
    ? normalized
    : "link";
}

function normalizeCategoryColor(color) {
  const normalized = String(color || "").trim();
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : "#35f0ff";
}

function migrateData(data) {
  const defaultData = createDefaultData();
  const normalized = normalizeData(data);
  const originalVersion = normalized.schemaVersion;

  if (originalVersion < 2) {
    normalized.links = normalized.links.map((link) => ({
      ...link,
      category: link.category || "Links"
    }));
  }

  normalized.schemaVersion = 6;
  normalized.subtitle = normalized.subtitle || defaultData.subtitle;
  const activeProfile = normalized.profiles.find((profile) => profile.id === normalized.activeProfileId) || normalized.profiles[0];
  activeProfile.categories = normalizeCategories(originalVersion < 2 ? [] : activeProfile.categories, activeProfile.links);
  normalized.categories = activeProfile.categories;
  normalized.links = activeProfile.links;
  normalized.statusTargets = activeProfile.statusTargets;

  return normalized;
}

function normalizeUrl(url) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed;
  if (/^[\w.-]+(:\d+)?(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function parseHttpUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed;
  } catch {
    return null;
  }
}

module.exports = {
  createDefaultData,
  migrateData,
  normalizeData,
  normalizeHomeAssistantEntities,
  normalizeProfile,
  normalizeStatusTargets,
  normalizeStatusWidget,
  normalizeUrl,
  normalizeWeatherWidget,
  parseHttpUrl
};
