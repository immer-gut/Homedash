const { requestJson } = require("../http");

async function readProxmoxStatus(target, base) {
  const headers = target.tokenId && target.tokenSecret
    ? { Authorization: `PVEAPIToken=${target.tokenId}=${target.tokenSecret}` }
    : {};
  const version = await requestJson(new URL("/api2/json/version", target.url).href, { headers });
  const metrics = [];
  if (version.data?.version) metrics.push({ label: "Version", value: String(version.data.version) });

  if (!headers.Authorization) {
    return {
      ...base,
      ok: true,
      status: "online",
      message: "API erreichbar",
      metrics
    };
  }

  const resources = await requestJson(new URL("/api2/json/cluster/resources", target.url).href, { headers });
  const data = Array.isArray(resources.data) ? resources.data : [];
  const nodes = data.filter((item) => item.type === "node");
  const guests = data.filter((item) => item.type === "qemu" || item.type === "lxc");
  const onlineNodes = nodes.filter((item) => item.status === "online").length;
  const runningGuests = guests.filter((item) => item.status === "running").length;
  const totalMemory = nodes.reduce((sum, item) => sum + Number(item.maxmem || 0), 0);
  const usedMemory = nodes.reduce((sum, item) => sum + Number(item.mem || 0), 0);
  const cpuValues = nodes
    .map((item) => toFiniteNumber(item.cpu))
    .filter((value) => value !== undefined);
  const averageCpu = cpuValues.length
    ? cpuValues.reduce((sum, value) => sum + value, 0) / cpuValues.length
    : undefined;
  const updates = await readProxmoxUpdates(target, headers, nodes);
  const updateValue = formatProxmoxUpdateValue(updates);

  metrics.push({ label: "Nodes", value: `${onlineNodes}/${nodes.length || 0}` });
  metrics.push({ label: "VM/CT", value: `${runningGuests}/${guests.length || 0}` });
  if (updates.checked) metrics.push({ label: "Updates", value: updateValue });
  if (averageCpu !== undefined) metrics.push({ label: "CPU", value: `${Math.round(averageCpu * 100)}%` });
  if (totalMemory > 0) metrics.push({ label: "RAM", value: `${Math.round((usedMemory / totalMemory) * 100)}%` });

  return {
    ...base,
    ok: onlineNodes > 0 || nodes.length === 0,
    status: onlineNodes === nodes.length ? "online" : "warning",
    message: onlineNodes === nodes.length ? "Cluster online" : "Teilweise erreichbar",
    details: nodes.slice(0, 4).map((node) => {
      const nodeName = getProxmoxNodeName(node) || "Node";
      const nodeUpdates = updates.nodes.get(nodeName);
      const hasUpdateCount = Number.isFinite(nodeUpdates);
      const nodeExact = updates.exactNodes.get(nodeName) === true;
      const updateLabel = hasUpdateCount ? `${nodeUpdates}${nodeExact ? "" : "+"} Updates` : updates.checked ? "Updates ?" : "";
      return {
        label: nodeName,
        value: updateLabel ? `${node.status || "unknown"} · ${updateLabel}` : node.status || "unknown"
      };
    }),
    debug: target.debug === true ? updates.debug : [],
    metrics
  };
}

async function readProxmoxUpdates(target, headers, nodes) {
  const nodeNames = nodes
    .map(getProxmoxNodeName)
    .filter(Boolean)
    .slice(0, 8);
  const empty = { checked: false, exact: false, total: undefined, nodes: new Map(), exactNodes: new Map(), debug: [] };
  if (!nodeNames.length) return empty;

  const results = await Promise.all(nodeNames.map(async (nodeName) => {
    const errors = [];
    try {
      const payload = await requestJson(new URL(`/api2/json/nodes/${encodeURIComponent(nodeName)}/apt/update`, target.url).href, { headers });
      const updates = extractProxmoxUpdateList(payload);
      return { nodeName, count: updates.length, exact: true, source: "apt/update", errors };
    } catch (error) {
      errors.push(`${nodeName} apt/update: ${shortDebugValue(error.message || error)}`);
    }

    try {
      const payload = await requestJson(new URL(`/api2/json/nodes/${encodeURIComponent(nodeName)}/apt/versions`, target.url).href, { headers });
      const updates = extractProxmoxVersionUpdates(payload);
      return { nodeName, count: updates.length, exact: false, source: "apt/versions", errors };
    } catch (error) {
      errors.push(`${nodeName} apt/versions: ${shortDebugValue(error.message || error)}`);
      return { nodeName, count: undefined, exact: false, source: "", errors };
    }
  }));
  const known = results.filter((result) => Number.isFinite(result.count));
  const debug = results.flatMap((result) => [
    ...result.errors,
    ...(result.source && result.source !== "apt/update" ? [`${result.nodeName} updates via ${result.source}`] : [])
  ]);
  if (!known.length) return { checked: true, exact: false, total: undefined, nodes: new Map(), exactNodes: new Map(), debug };

  return {
    checked: true,
    exact: known.every((result) => result.exact === true),
    total: known.reduce((sum, result) => sum + result.count, 0),
    nodes: new Map(known.map((result) => [result.nodeName, result.count])),
    exactNodes: new Map(known.map((result) => [result.nodeName, result.exact === true])),
    debug
  };
}

function formatProxmoxUpdateValue(updates) {
  if (!Number.isFinite(updates.total)) return "?";
  return `${updates.total}${updates.exact ? "" : "+"}`;
}

function getProxmoxNodeName(node) {
  const raw = node?.node || node?.id || "";
  return String(raw).replace(/^node\//, "").trim();
}

function extractProxmoxUpdateList(payload) {
  const data = payload?.data ?? payload;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.updates)) return data.updates;
  if (Array.isArray(data?.packages)) return data.packages;
  return [];
}

function extractProxmoxVersionUpdates(payload) {
  return extractProxmoxUpdateList(payload).filter((item) => {
    const oldVersion = item?.OldVersion || item?.oldVersion || item?.oldversion;
    const newVersion = item?.Version || item?.version;
    return oldVersion && newVersion && String(oldVersion) !== String(newVersion);
  });
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function shortDebugValue(value) {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "object") return "{...}";
  return String(value).slice(0, 24);
}

module.exports = {
  readProxmoxStatus
};
