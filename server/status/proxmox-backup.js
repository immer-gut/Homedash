const { requestJson } = require("../http");

async function readProxmoxBackupStatus(target, base) {
  const headers = target.tokenId && target.tokenSecret
    ? { Authorization: `PBSAPIToken=${target.tokenId}:${target.tokenSecret}` }
    : {};
  const version = await requestJson(new URL("/api2/json/version", target.url).href, { headers });
  const metrics = [];
  if (version.data?.version) metrics.push({ label: "Version", value: String(version.data.version) });

  if (!headers.Authorization) {
    return {
      ...base,
      ok: true,
      status: "online",
      message: "PBS API erreichbar",
      metrics
    };
  }

  const nodeStatus = await requestJson(new URL("/api2/json/nodes/localhost/status", target.url).href, { headers }).catch(() => null);
  const datastoreUsage = await requestJson(new URL(target.statusPath || "/api2/json/status/datastore-usage", target.url).href, { headers }).catch(() => null);
  const stores = extractProxmoxBackupDatastores(datastoreUsage);
  const tasks = await readProxmoxBackupTasks(target, headers);
  const snapshots = await readProxmoxBackupSnapshots(target, headers, stores);
  const lastBackup = snapshots[0];
  const failedTasks = tasks.filter(isFailedProxmoxBackupTask);
  const runningTasks = tasks.filter(isRunningProxmoxBackupTask);
  const verifyIssue = tasks.find((task) => isVerifyProxmoxBackupTask(task) && isFailedProxmoxBackupTask(task));
  const total = stores.reduce((sum, store) => sum + Number(store.total || 0), 0);
  const used = stores.reduce((sum, store) => sum + Number(store.used || 0), 0);
  const cpu = toFiniteNumber(nodeStatus?.data?.cpu);
  const memoryUsed = toFiniteNumber(nodeStatus?.data?.memory?.used);
  const memoryTotal = toFiniteNumber(nodeStatus?.data?.memory?.total);

  metrics.push({ label: "Datastores", value: String(stores.length) });
  if (total > 0) metrics.push({ label: "Speicher", value: `${Math.round((used / total) * 100)}%` });
  if (lastBackup) metrics.push({ label: "Backup", value: formatRelativeTime(lastBackup.time) });
  metrics.push({ label: "Fehler", value: String(failedTasks.length) });
  if (runningTasks.length) metrics.push({ label: "Jobs", value: `${runningTasks.length} aktiv` });
  metrics.push({ label: "Verify", value: verifyIssue ? "Fehler" : "OK" });
  if (cpu !== undefined) metrics.push({ label: "CPU", value: `${Math.round(cpu * 100)}%` });
  if (memoryUsed !== undefined && memoryTotal > 0) metrics.push({ label: "RAM", value: `${Math.round((memoryUsed / memoryTotal) * 100)}%` });

  return {
    ...base,
    ok: true,
    status: failedTasks.length || verifyIssue ? "warning" : "online",
    message: failedTasks.length ? `${failedTasks.length} Task-Fehler` : stores.length ? "PBS online" : "PBS API erreichbar",
    details: [
      ...stores.slice(0, 4).map((store) => ({
        label: store.name,
        value: store.total > 0 ? `${formatPercent(store.used, store.total)} belegt` : "Datastore erreichbar",
        memory: store.total > 0 ? `${formatBytes(store.used)} / ${formatBytes(store.total)}` : ""
      })),
      ...buildProxmoxBackupTaskDetails(lastBackup, runningTasks, failedTasks, verifyIssue)
    ],
    metrics
  };
}

async function readProxmoxBackupTasks(target, headers) {
  const url = new URL("/api2/json/nodes/localhost/tasks", target.url);
  url.searchParams.set("limit", "50");
  const payload = await requestJson(url.href, { headers }).catch(() => null);
  const data = payload?.data ?? payload;
  return (Array.isArray(data) ? data : [])
    .map(normalizeProxmoxBackupTask)
    .filter((task) => task.upid || task.type || task.status || task.startTime)
    .sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
}

async function readProxmoxBackupSnapshots(target, headers, stores) {
  const snapshots = (await Promise.all(stores.slice(0, 6).map(async (store) => {
    const namespaces = await readProxmoxBackupNamespaces(target, headers, store.name);
    return (await Promise.all(namespaces.map(async (namespace) => {
      const url = new URL(`/api2/json/admin/datastore/${encodeURIComponent(store.name)}/snapshots`, target.url);
      if (namespace) url.searchParams.set("ns", namespace);
      const payload = await requestJson(url.href, { headers }).catch(() => null);
      const data = payload?.data ?? payload;
      return (Array.isArray(data) ? data : []).map((snapshot) => normalizeProxmoxBackupSnapshot(snapshot, store.name, namespace));
    }))).flat();
  }))).flat();
  return snapshots
    .filter((snapshot) => snapshot.time)
    .sort((a, b) => b.time - a.time);
}

async function readProxmoxBackupNamespaces(target, headers, storeName) {
  const seen = new Set([""]);
  const queue = [""];
  while (queue.length) {
    const parent = queue.shift();
    const url = new URL(`/api2/json/admin/datastore/${encodeURIComponent(storeName)}/namespace`, target.url);
    if (parent) url.searchParams.set("ns", parent);
    const payload = await requestJson(url.href, { headers }).catch(() => null);
    const data = payload?.data ?? payload;
    for (const child of extractProxmoxBackupNamespaceChildren(data, parent)) {
      if (!seen.has(child) && child.split("/").length <= 8) {
        seen.add(child);
        queue.push(child);
      }
    }
  }
  return [...seen];
}

function extractProxmoxBackupNamespaceChildren(data, parent) {
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.namespaces)
      ? data.namespaces
      : Array.isArray(data?.children)
        ? data.children
        : [];
  return list
    .map((entry) => normalizeProxmoxBackupNamespace(entry, parent))
    .filter(Boolean);
}

function normalizeProxmoxBackupNamespace(entry, parent) {
  const raw = typeof entry === "string"
    ? entry
    : entry?.ns || entry?.namespace || entry?.path || entry?.name || entry?.id || "";
  const value = String(raw || "").replace(/^\/+|\/+$/g, "");
  if (!value) return "";
  return value.includes("/") || !parent ? value : `${parent}/${value}`;
}

function normalizeProxmoxBackupTask(task) {
  const upid = String(task?.upid || task?.UPID || "");
  return {
    upid,
    type: String(task?.worker_type || task?.type || extractUpidPart(upid, 4) || "").toLowerCase(),
    status: String(task?.status || task?.state || "").trim(),
    user: String(task?.user || task?.userid || ""),
    startTime: Number(task?.starttime || task?.startTime || task?.start || 0),
    endTime: Number(task?.endtime || task?.endTime || task?.end || 0)
  };
}

function normalizeProxmoxBackupSnapshot(snapshot, store, namespace = "") {
  const backupType = String(snapshot?.["backup-type"] || snapshot?.backupType || snapshot?.backup_type || "");
  const backupId = String(snapshot?.["backup-id"] || snapshot?.backupId || snapshot?.backup_id || "");
  const backupTime = Number(snapshot?.["backup-time"] || snapshot?.backupTime || snapshot?.backup_time || snapshot?.time || 0);
  const ns = String(snapshot?.ns || snapshot?.namespace || namespace || "").replace(/^\/+|\/+$/g, "");
  return {
    store,
    namespace: ns,
    type: backupType,
    id: backupId,
    time: backupTime,
    label: [store, ns, backupType, backupId].filter(Boolean).join(" / ")
  };
}

function extractUpidPart(upid, index) {
  const parts = String(upid || "").split(":");
  return parts[index] || "";
}

function isRunningProxmoxBackupTask(task) {
  return !task.endTime && !task.status;
}

function isFailedProxmoxBackupTask(task) {
  const status = String(task.status || "").toLowerCase();
  if (!status) return false;
  return (status !== "ok" && !status.includes("ok")) || status.includes("error") || status.includes("fail");
}

function isVerifyProxmoxBackupTask(task) {
  return String(task.type || "").includes("verify") || String(task.upid || "").toLowerCase().includes("verify");
}

function buildProxmoxBackupTaskDetails(lastBackup, runningTasks, failedTasks, verifyIssue) {
  const details = [];
  if (lastBackup) {
    details.push({
      label: "Letztes Backup",
      value: `${formatRelativeTime(lastBackup.time)} (${lastBackup.label || "Snapshot"})`
    });
  }
  if (runningTasks.length) {
    details.push({
      label: "Laufende Jobs",
      value: runningTasks.slice(0, 3).map((task) => task.type || "Task").join(", ")
    });
  }
  if (failedTasks.length) {
    const latest = failedTasks[0];
    details.push({
      label: "Letzter Fehler",
      value: `${latest.type || "Task"} ${latest.status || "Fehler"}`.slice(0, 80)
    });
  }
  details.push({
    label: "Verify",
    value: verifyIssue ? `Fehler: ${verifyIssue.status || verifyIssue.type}`.slice(0, 80) : "Keine Verify-Fehler in den letzten Tasks"
  });
  return details;
}

function extractProxmoxBackupDatastores(payload) {
  const data = payload?.data ?? payload;
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.datastores)
      ? data.datastores
      : Array.isArray(data?.stores)
        ? data.stores
        : [];
  return list
    .map((store) => ({
      name: String(store.store || store.name || store.datastore || "Datastore").slice(0, 80),
      used: Number(store.used || store.disk_used || store["disk-used"] || 0),
      total: Number(store.total || store.disk_total || store["disk-total"] || 0)
    }))
    .filter((store) => store.name);
}

function formatPercent(used, total) {
  const usedNumber = Number(used);
  const totalNumber = Number(total);
  if (!Number.isFinite(usedNumber) || !Number.isFinite(totalNumber) || totalNumber <= 0) return "?";
  return `${Math.round((usedNumber / totalNumber) * 100)}%`;
}

function formatBytes(value) {
  let number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let unitIndex = 0;
  while (number >= 1024 && unitIndex < units.length - 1) {
    number /= 1024;
    unitIndex += 1;
  }
  const rounded = number >= 10 || unitIndex === 0 ? Math.round(number) : Math.round(number * 10) / 10;
  return `${rounded} ${units[unitIndex]}`;
}

function formatRelativeTime(epochSeconds) {
  const timestamp = Number(epochSeconds) * 1000;
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "?";
  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) return "gerade eben";
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `vor ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `vor ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `vor ${days}d`;
  return new Date(timestamp).toLocaleDateString("de-DE");
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

module.exports = {
  readProxmoxBackupStatus
};
