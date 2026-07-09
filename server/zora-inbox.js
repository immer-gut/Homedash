const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const INBOX_SCHEMA_VERSION = 1;
const VALID_STATUSES = new Set(["new", "processing", "processed", "archived"]);

function createZoraInboxStore({ dataDir }) {
  const dataFile = path.join(dataDir, "zora-inbox.json");

  function ensureInboxFile() {
    fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(dataFile)) {
      writeInbox({ schemaVersion: INBOX_SCHEMA_VERSION, items: [] });
    }
  }

  function readInbox() {
    ensureInboxFile();
    const raw = fs.readFileSync(dataFile, "utf8");
    const parsed = raw.trim() ? JSON.parse(raw) : {};
    return normalizeInbox(parsed);
  }

  function writeInbox(inbox) {
    const normalized = normalizeInbox(inbox);
    fs.writeFileSync(dataFile, `${JSON.stringify(normalized, null, 2)}\n`);
    return normalized;
  }

  function listItems({ status = "new" } = {}) {
    const normalizedStatus = String(status || "new").toLowerCase();
    const items = readInbox().items;
    if (!normalizedStatus || normalizedStatus === "all") return items;
    if (!VALID_STATUSES.has(normalizedStatus)) return [];
    return items.filter((item) => item.status === normalizedStatus);
  }

  function createItem({ text, source = "homedash" }) {
    const trimmedText = normalizeText(text);
    if (!trimmedText) throw new Error("Text fehlt");
    const now = new Date().toISOString();
    const inbox = readInbox();
    const item = {
      id: crypto.randomUUID(),
      text: trimmedText,
      status: "new",
      source: normalizeSource(source),
      createdAt: now,
      updatedAt: now,
      processedAt: ""
    };
    inbox.items.unshift(item);
    writeInbox(inbox);
    return item;
  }

  function updateItem(id, patch = {}) {
    const inbox = readInbox();
    const index = inbox.items.findIndex((item) => item.id === id);
    if (index < 0) return null;
    const current = inbox.items[index];
    const nextStatus = patch.status === undefined ? current.status : String(patch.status || "").toLowerCase();
    if (!VALID_STATUSES.has(nextStatus)) throw new Error("Status ungueltig");
    const now = new Date().toISOString();
    const next = {
      ...current,
      status: nextStatus,
      updatedAt: now
    };
    if (patch.text !== undefined) {
      const nextText = normalizeText(patch.text);
      if (!nextText) throw new Error("Text fehlt");
      next.text = nextText;
    }
    if (patch.source !== undefined) next.source = normalizeSource(patch.source);
    if (nextStatus === "processed" && !next.processedAt) next.processedAt = now;
    if (nextStatus !== "processed") next.processedAt = "";
    inbox.items[index] = next;
    writeInbox(inbox);
    return next;
  }

  function deleteItem(id) {
    const inbox = readInbox();
    const nextItems = inbox.items.filter((item) => item.id !== id);
    if (nextItems.length === inbox.items.length) return false;
    writeInbox({ ...inbox, items: nextItems });
    return true;
  }

  return {
    createItem,
    deleteItem,
    listItems,
    updateItem
  };
}

function normalizeInbox(inbox = {}) {
  return {
    schemaVersion: INBOX_SCHEMA_VERSION,
    items: (Array.isArray(inbox.items) ? inbox.items : [])
      .map(normalizeItem)
      .filter(Boolean)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 500)
  };
}

function normalizeItem(item = {}) {
  const text = normalizeText(item.text);
  if (!text) return null;
  const status = String(item.status || "new").toLowerCase();
  const createdAt = normalizeIsoDate(item.createdAt) || new Date().toISOString();
  return {
    id: String(item.id || crypto.randomUUID()).slice(0, 80),
    text,
    status: VALID_STATUSES.has(status) ? status : "new",
    source: normalizeSource(item.source),
    createdAt,
    updatedAt: normalizeIsoDate(item.updatedAt) || createdAt,
    processedAt: normalizeIsoDate(item.processedAt) || ""
  };
}

function normalizeText(value) {
  return String(value || "").trim().slice(0, 5000);
}

function normalizeSource(value) {
  return String(value || "homedash").trim().slice(0, 60) || "homedash";
}

function normalizeIsoDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const time = Date.parse(raw);
  return Number.isFinite(time) ? new Date(time).toISOString() : "";
}

module.exports = {
  createZoraInboxStore
};
