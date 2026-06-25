const fs = require("fs");
const path = require("path");
const {
  createDefaultData,
  migrateData,
  normalizeData
} = require("./normalize");

function createDataStore({ dataDir, faviconDir }) {
  const dataFile = path.join(dataDir, "homedash.json");
  const defaultData = createDefaultData();

  function ensureDataFile() {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(faviconDir, { recursive: true });
    if (!fs.existsSync(dataFile)) {
      fs.writeFileSync(dataFile, JSON.stringify(defaultData, null, 2));
    }
  }

  function readData() {
    ensureDataFile();
    const data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    const migrated = migrateData(data);
    if (JSON.stringify(migrated) !== JSON.stringify(data)) {
      fs.writeFileSync(dataFile, `${JSON.stringify(migrated, null, 2)}\n`);
    }
    return migrated;
  }

  function writeData(data) {
    fs.mkdirSync(dataDir, { recursive: true });
    const existing = fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile, "utf8")) : {};
    const mergedData = preserveExistingStatusSecrets(data, existing);
    const safeData = normalizeData({
      ...mergedData,
      admin: {
        ...existing.admin,
        ...mergedData.admin
      },
      schemaVersion: mergedData.schemaVersion || 6
    });
    fs.writeFileSync(dataFile, `${JSON.stringify(safeData, null, 2)}\n`);
    return safeData;
  }

  function readDataWithoutMigration() {
    ensureDataFile();
    return JSON.parse(fs.readFileSync(dataFile, "utf8"));
  }

  return {
    ensureDataFile,
    readData,
    readDataWithoutMigration,
    writeData
  };
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

module.exports = {
  createDataStore
};
