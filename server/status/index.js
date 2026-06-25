const { readAmpStatus } = require("./amp");
const { readGenericServiceStatus } = require("./generic");
const { readHomeAssistantStatus } = require("./home-assistant");
const { readProxmoxStatus } = require("./proxmox");
const { readProxmoxBackupStatus } = require("./proxmox-backup");
const { readUnraidStatus } = require("./unraid");

const statusProviders = {
  proxmox: {
    read: readProxmoxStatus
  },
  proxmoxbackup: {
    read: readProxmoxBackupStatus
  },
  homeassistant: {
    missingMessage: "Home Assistant Token fehlt",
    canRead: (target) => Boolean(target.apiKey),
    read: readHomeAssistantStatus
  },
  unraid: {
    canRead: (target) => Boolean(target.apiKey),
    read: readUnraidStatus
  },
  amp: {
    canRead: (target) => Boolean(target.username && target.password),
    read: readAmpStatus
  }
};

function getStatusProvider(target) {
  return statusProviders[target.type] || { read: readGenericServiceStatus };
}

async function readStatusWithProvider(target, base) {
  if (target.enabled === false) {
    return { ...base, message: "Deaktiviert", metrics: [{ label: "Status", value: "Aus" }] };
  }

  const provider = getStatusProvider(target);
  if (provider.canRead && !provider.canRead(target)) {
    return { ...base, message: provider.missingMessage || "Zugangsdaten fehlen" };
  }

  return await provider.read(target, base);
}

module.exports = {
  getStatusProvider,
  readStatusWithProvider,
  statusProviders
};
