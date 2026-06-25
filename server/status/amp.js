const crypto = require("crypto");
const { requestJsonPost } = require("../http");

async function readAmpStatus(target, base) {
  const login = await requestJsonPost(new URL("/API/Core/Login", target.url).href, {
    body: {
      username: target.username,
      password: target.password,
      token: "",
      rememberMe: false
    }
  });
  const sessionId = login.sessionID || login.SESSIONID || login.sessionId || login.result?.sessionID;
  if (!sessionId) throw new Error("AMP Login fehlgeschlagen");

  const status = await requestJsonPost(new URL("/API/Core/GetStatus", target.url).href, {
    body: { SESSIONID: sessionId }
  });
  const metrics = [];
  const source = status.result || status;
  const instances = filterAmpServerInstances(await readAmpInstances(target, sessionId));
  const instanceStatuses = filterAmpServerInstances(await readAmpInstanceStatuses(target, sessionId));
  const instanceStatusDetails = await Promise.all(instances.map((instance) => readAmpInstanceCoreStatus(target, sessionId, instance)));
  let mergedInstances = mergeAmpInstances(instances.length ? instances : instanceStatuses, instanceStatuses, instanceStatusDetails);
  mergedInstances = await Promise.all(mergedInstances.map((instance) => readAmpApplicationStatus(target, instance)));
  const totalInstances = mergedInstances.length;
  if (totalInstances) {
    const online = Math.min(mergedInstances.filter(isAmpInstanceOnline).length, totalInstances);
    metrics.push({ label: "Server", value: `${online}/${totalInstances}` });
  }
  const cpu = totalInstances
    ? averageNumbers(mergedInstances.map(readAmpCpuPercent))
    : readAmpCpuPercent(source);
  const memory = totalInstances
    ? sumNumbers(mergedInstances.map(readAmpMemoryMb))
    : readAmpMemoryMb(source);
  const users = totalInstances
    ? sumNumbers(mergedInstances.map(readAmpUsersOnline))
    : readAmpUsersOnline(source);
  if (cpu !== undefined) metrics.push({ label: "CPU", value: formatAmpMetric(cpu, "%") });
  if (memory !== undefined) metrics.push({ label: "RAM", value: formatAmpMetric(memory, "MB") });
  if (users !== undefined) metrics.push({ label: "User", value: String(users).slice(0, 24) });

  return {
    ...base,
    ok: true,
    status: "online",
    message: getAmpStatusMessage(source),
    details: getAmpInstanceDetails(mergedInstances),
    metrics,
    debug: target.debug === true ? getAmpDebugLines(source, mergedInstances) : []
  };
}

async function readAmpInstances(target, sessionId) {
  try {
    const response = await requestJsonPost(new URL("/API/ADSModule/GetInstances", target.url).href, {
      body: { SESSIONID: sessionId }
    });
    return extractAmpInstances(response);
  } catch {
    return [];
  }
}

async function readAmpInstanceStatuses(target, sessionId) {
  try {
    const response = await requestJsonPost(new URL("/API/ADSModule/GetInstanceStatuses", target.url).href, {
      body: { SESSIONID: sessionId }
    });
    return extractAmpInstances(response);
  } catch {
    return [];
  }
}

async function readAmpInstanceCoreStatus(target, sessionId, instance) {
  const instanceId = getAmpInstanceId(instance);
  if (!instanceId) return {};
  const instanceBase = new URL(`/API/ADSModule/Servers/${encodeURIComponent(instanceId)}/API/`, target.url).href;
  const directStatus = await readAmpProxiedCoreStatus(instanceBase, sessionId);
  if (Object.keys(directStatus).length) return { ...directStatus, InstanceID: instanceId, DebugSource: "proxy" };
  try {
    const login = await requestJsonPost(new URL(`/API/ADSModule/Servers/${encodeURIComponent(instanceId)}/API/Core/Login`, target.url).href, {
      body: {
        SESSIONID: sessionId,
        username: target.username,
        password: target.password,
        token: "",
        rememberMe: true
      }
    });
    const instanceSessionId = login.sessionID || login.SESSIONID || login.sessionId || login.result?.sessionID;
    if (!instanceSessionId) return {};
    const loginStatus = await readAmpProxiedCoreStatus(instanceBase, instanceSessionId);
    return { ...loginStatus, InstanceID: instanceId, DebugSource: "instance-login" };
  } catch {
    return {};
  }
}

async function readAmpProxiedCoreStatus(instanceBase, sessionId) {
  const status = await requestJsonPost(new URL("Core/GetStatus", instanceBase).href, {
    body: { SESSIONID: sessionId }
  }).catch(() => ({}));
  const updates = await requestJsonPost(new URL("Core/GetUpdates", instanceBase).href, {
    body: { SESSIONID: sessionId }
  }).catch(() => ({}));
  const statusSource = status.result || status;
  const updateSource = updates.result || updates;
  const liveStatus = updateSource.Status || updateSource.status || {};
  if (!Object.keys(statusSource).length && !Object.keys(updateSource).length) return {};
  return {
    ...(liveStatus || {}),
    ...status,
    ...statusSource,
    Updates: updateSource
  };
}

async function readAmpApplicationStatus(_target, instance) {
  return instance;
}

function extractAmpInstances(response) {
  const candidates = [
    response.result,
    response.Result,
    response.instances,
    response.Instances,
    response.availableInstances,
    response.AvailableInstances,
    response.data,
    response.Data,
    response
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const instances = candidate.flatMap((item) => {
        if (Array.isArray(item?.AvailableInstances) || Array.isArray(item?.availableInstances)) return extractAmpInstances(item);
        return isAmpInstanceLike(item) ? [item] : extractAmpInstances(item);
      });
      if (instances.length) return instances;
    }
    if (candidate && typeof candidate === "object") {
      const availableInstances = Array.isArray(candidate.AvailableInstances)
        ? candidate.AvailableInstances
        : Array.isArray(candidate.availableInstances)
          ? candidate.availableInstances
          : undefined;
      if (availableInstances) return availableInstances.filter(isAmpInstanceLike);
      if (isAmpInstanceLike(candidate)) return [candidate];
      const values = Object.values(candidate).filter((value) => value && typeof value === "object");
      const instances = values.flatMap((value) => {
        const nestedInstances = Array.isArray(value.AvailableInstances)
          ? value.AvailableInstances
          : Array.isArray(value.availableInstances)
            ? value.availableInstances
            : undefined;
        if (nestedInstances) return nestedInstances;
        if (isAmpInstanceLike(value)) return [value];
        return [];
      }).filter(isAmpInstanceLike);
      if (instances.length) return instances;
    }
  }
  return [];
}

function filterAmpServerInstances(instances) {
  const filtered = instances.filter(isAmpServerInstance);
  return filtered.length ? filtered : instances.filter((instance) => !isAmpDaemonInstance(instance));
}

function mergeAmpInstances(primaryInstances, ...sources) {
  const map = new Map();
  for (const instance of primaryInstances) {
    if (!instance || typeof instance !== "object") continue;
    const key = getAmpInstanceKey(instance) || crypto.randomUUID();
    map.set(key, { ...instance });
  }
  for (const source of sources.flat()) {
    if (!source || typeof source !== "object" || !Object.keys(source).length) continue;
    const key = getAmpInstanceKey(source);
    if (key && map.has(key)) map.set(key, { ...map.get(key), ...source });
    else if (!key && map.size === 1) {
      const [existingKey] = map.keys();
      map.set(existingKey, { ...map.get(existingKey), ...source });
    } else if (!primaryInstances.length && key) map.set(key, { ...(map.get(key) || {}), ...source });
  }
  return [...map.values()];
}

function isAmpServerInstance(instance) {
  if (!instance || typeof instance !== "object" || isAmpDaemonInstance(instance)) return false;
  if (instance.Disabled === true || instance.Suspended === true) return false;
  const moduleName = getAmpModuleName(instance);
  if (!moduleName) return true;
  return !/\b(ads|amp|admin|daemon)\b/i.test(moduleName);
}

function isAmpDaemonInstance(instance) {
  if (!instance || typeof instance !== "object") return false;
  if (instance.Daemon === true || instance.daemon === true) return true;
  const moduleName = getAmpModuleName(instance);
  const name = String(instance.InstanceName || instance.FriendlyName || instance.DisplayName || instance.Name || "").toLowerCase();
  return /\b(ads|amp|admin|daemon)\b/i.test(moduleName) || /\b(ads|amp|admin|daemon|local instances|controller|target)\b/i.test(name);
}

function getAmpModuleName(instance) {
  return String(
    instance?.ModuleDisplayName ??
    instance?.ModuleName ??
    instance?.Module ??
    instance?.moduleDisplayName ??
    instance?.moduleName ??
    instance?.module ??
    ""
  );
}

function getAmpInstanceKey(instance) {
  return String(
    getAmpInstanceId(instance) ||
    instance?.InstanceName ||
    instance?.FriendlyName ||
    instance?.DisplayName ||
    instance?.Name ||
    instance?.name ||
    ""
  ).toLowerCase();
}

function getAmpInstanceId(instance) {
  return String(
    instance?.InstanceID ??
    instance?.InstanceId ??
    instance?.instanceId ??
    instance?.id ??
    instance?.Id ??
    ""
  );
}

function getAmpInstanceName(instance, fallback = "Instanz") {
  return String(
    instance?.FriendlyName ||
    instance?.InstanceName ||
    instance?.DisplayName ||
    instance?.Name ||
    instance?.name ||
    fallback
  );
}

function getAmpInstanceDetails(instances) {
  return instances.slice(0, 6).map((instance, index) => {
    const online = isAmpInstanceOnline(instance);
    const memory = readAmpMemoryMb(instance);
    const users = readAmpUsersOnline(instance);
    const detailParts = [];
    if (memory !== undefined) detailParts.push(formatAmpMetric(memory, "MB"));
    if (users !== undefined) detailParts.push(String(users));
    return {
      label: getAmpInstanceName(instance, `Instanz ${index + 1}`).slice(0, 40),
      value: detailParts.join(" · "),
      online,
      memory: memory !== undefined ? formatAmpMetric(memory, "MB") : "",
      users: users !== undefined ? String(users) : ""
    };
  });
}

function isAmpInstanceLike(value) {
  return Boolean(value && typeof value === "object" && (
    value.InstanceID ||
    value.InstanceName ||
    value.FriendlyName ||
    value.DisplayName ||
    value.Module ||
    value.ModuleName ||
    value.AppState ||
    value.app_state ||
    value.State ||
    value.state ||
    value.Status ||
    value.status ||
    value.Running !== undefined
    || value.running !== undefined
    || value.IsRunning !== undefined
    || value.is_running !== undefined
  ));
}

function isAmpInstanceOnline(instance) {
  if (instance.AppOnline === true) return true;
  if (instance.AppOnline === false) return false;
  const portStatus = readAmpRequiredPortStatus(instance);
  if (portStatus !== undefined) return portStatus;
  const appState = readAmpApplicationState(instance);
  if (appState !== undefined) return appState === 20 || /\b(ready|running|started|online)\b/i.test(String(appState));
  const runningValue = instance.Running ?? instance.running ?? instance.IsRunning ?? instance.is_running;
  if (runningValue === false || runningValue === 0 || String(runningValue).toLowerCase() === "false") return false;
  return false;
}

function readAmpRequiredPortStatus(instance) {
  const ports = [
    ...(Array.isArray(instance?.Updates?.Ports) ? instance.Updates.Ports : []),
    ...(Array.isArray(instance?.Updates?.ports) ? instance.Updates.ports : []),
    ...(Array.isArray(instance?.Ports) ? instance.Ports : []),
    ...(Array.isArray(instance?.ports) ? instance.ports : [])
  ];
  const relevantPorts = ports.filter((port) => {
    const label = String(port.Name || port.name || port.Description || port.description || "").toLowerCase();
    if (/amp|admin|web|metrics|rcon|query/.test(label)) return false;
    return port.Required === true || port.required === true || /minecraft|game|server/.test(label);
  });
  if (!relevantPorts.length) return undefined;
  return relevantPorts.some((port) => port.Listening === true || port.listening === true);
}

function readAmpApplicationState(instance) {
  const candidates = [
    instance?.Status?.State,
    instance?.status?.state,
    instance?.Updates?.Status?.State,
    instance?.Updates?.Status?.state,
    instance?.Updates?.status?.State,
    instance?.Updates?.status?.state,
    instance?.State,
    instance?.state,
    typeof instance?.Status === "object" ? undefined : instance?.Status,
    typeof instance?.status === "object" ? undefined : instance?.status,
    instance?.CurrentState,
    instance?.current_state,
    instance?.AppState,
    instance?.app_state
  ].filter((value) => value !== undefined && value !== null && value !== "");
  if (!candidates.length) return undefined;
  const numeric = candidates.map((value) => Number(value)).find((value) => Number.isFinite(value));
  if (numeric !== undefined) return numeric;
  const text = String(candidates[0]).toLowerCase();
  if (/\b(stopped|sleeping|offline|suspended|failed|stopping|maintenance|indeterminate)\b/.test(text)) return 0;
  if (/\b(ready|running|started|online)\b/.test(text)) return 20;
  return text;
}

function readAmpCpuPercent(source) {
  return ignoreZeroMetric(readAmpMetricValue(source, [
    "CPUUsage",
    "CPU",
    "CPU Usage",
    "CPU Usage %",
    "Processor Usage"
  ], ["Percent", "percent", "RawValue", "rawValue", "Value", "value"]));
}

function readAmpMemoryMb(source) {
  return ignoreZeroMetric(readAmpMetricValue(source, [
    "MemoryUsageMB",
    "Memory",
    "Memory Usage",
    "RAM",
    "RAM Usage"
  ], ["RawValue", "rawValue", "Value", "value", "MB", "mb"]));
}

function readAmpUsersOnline(source) {
  const direct = readAmpDirectNumber(source, [
    "AppPlayers",
    "appPlayers",
    "Players",
    "players",
    "PlayerCount",
    "playerCount",
    "PlayersOnline",
    "playersOnline",
    "OnlinePlayers",
    "onlinePlayers",
    "CurrentPlayers",
    "currentPlayers",
    "UsersOnline",
    "usersOnline",
    "ActiveUsers",
    "activeUsers",
    "UserCount",
    "userCount",
    "ClientCount",
    "clientCount"
  ]);
  if (direct !== undefined) return direct;
  return readAmpMetricValue(source, [
    "UsersOnline",
    "Active Users",
    "Connected Users",
    "User Count",
    "Users",
    "Players",
    "Players Online",
    "Online Players",
    "Current Players",
    "Player Count",
    "Connected Players",
    "Clients",
    "Clients Connected"
  ], ["RawValue", "rawValue", "Value", "value", "Count", "count"]);
}

function readAmpMetricValue(source, names, fields) {
  if (!source || typeof source !== "object") return undefined;
  const sources = [
    source,
    source.Status,
    source.status,
    source.Updates?.Status,
    source.Updates?.status
  ].filter((candidate) => candidate && typeof candidate === "object");
  for (const candidate of sources) {
    for (const name of names) {
      const direct = toFiniteNumber(candidate[name]);
      if (direct !== undefined) return direct;
    }
    const metrics = candidate.Metrics || candidate.metrics || {};
    const metricEntries = Object.entries(metrics);
    for (const name of names) {
      const metric = findAmpMetric(metrics, metricEntries, name);
      if (!metric || typeof metric !== "object") continue;
      for (const field of fields) {
        const value = toFiniteNumber(metric[field]);
        if (value !== undefined) return value;
      }
    }
  }
  return undefined;
}

function readAmpDirectNumber(source, names) {
  if (!source || typeof source !== "object") return undefined;
  const sources = [
    source,
    source.Status,
    source.status,
    source.Updates?.Status,
    source.Updates?.status
  ].filter((candidate) => candidate && typeof candidate === "object");
  for (const candidate of sources) {
    for (const name of names) {
      const direct = toFiniteNumber(candidate[name]);
      if (direct !== undefined) return direct;
    }
  }
  return undefined;
}

function findAmpMetric(metrics, entries, name) {
  return metrics[name] ||
    metrics[name.toLowerCase()] ||
    entries.find(([key]) => normalizeAmpMetricName(key) === normalizeAmpMetricName(name))?.[1] ||
    entries.find(([key]) => normalizeAmpMetricName(key).includes(normalizeAmpMetricName(name)))?.[1];
}

function normalizeAmpMetricName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function averageNumbers(values) {
  const numbers = values.map(toFiniteNumber).filter((value) => value !== undefined);
  if (!numbers.length) return undefined;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function sumNumbers(values) {
  const numbers = values.map(toFiniteNumber).filter((value) => value !== undefined);
  if (!numbers.length) return undefined;
  return numbers.reduce((sum, value) => sum + value, 0);
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function ignoreZeroMetric(value) {
  return value === 0 ? undefined : value;
}

function getAmpDebugLines(source, instances) {
  const lines = [];
  lines.push(`ADS state=${shortDebugValue(source?.State ?? source?.state ?? source?.Status ?? source?.status ?? "n/a")}`);
  instances.slice(0, 8).forEach((instance, index) => {
    const name = getAmpInstanceName(instance, `Instanz ${index + 1}`);
    const state = readAmpApplicationState(instance);
    const raw = [
      `app=${shortDebugValue(instance.AppState ?? instance.app_state)}`,
      `state=${shortDebugValue(instance.State ?? instance.state)}`,
      `live=${shortDebugValue(instance.Updates?.Status?.State ?? instance.Updates?.status?.state ?? instance.Status?.State ?? instance.status?.state)}`,
      `ports=${shortDebugValue(formatAmpDebugPorts(instance))}`,
      `users=${shortDebugValue(readAmpUsersOnline(instance))}`,
      `running=${shortDebugValue(instance.Running ?? instance.running ?? instance.IsRunning ?? instance.is_running)}`,
      `src=${shortDebugValue(instance.DebugSource || "list")}`
    ].join(" ");
    lines.push(`${name}: online=${isAmpInstanceOnline(instance)} resolved=${shortDebugValue(state)} ${raw}`);
  });
  return lines;
}

function formatAmpDebugPorts(instance) {
  const ports = [
    ...(Array.isArray(instance?.Updates?.Ports) ? instance.Updates.Ports : []),
    ...(Array.isArray(instance?.Updates?.ports) ? instance.Updates.ports : []),
    ...(Array.isArray(instance?.Ports) ? instance.Ports : []),
    ...(Array.isArray(instance?.ports) ? instance.ports : [])
  ];
  if (!ports.length) return "-";
  return ports.slice(0, 4).map((port) => {
    const name = String(port.Name || port.name || "port").replace(/\s+/g, "");
    const number = port.Port || port.port || port.PortNumber || port.port_number || "?";
    const listening = port.Listening ?? port.listening;
    return `${name}:${number}:${listening === true ? "on" : "off"}`;
  }).join(",");
}

function shortDebugValue(value) {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "object") return "{...}";
  return String(value).slice(0, 24);
}

function getAmpStatusMessage(source) {
  const status = source.Status || source.StateName || source.StateDescription || "";
  if (status && !/^\d+$/.test(String(status))) return String(status).slice(0, 40);
  return "AMP erreichbar";
}

function formatAmpMetric(value, fallbackUnit = "") {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value).slice(0, 24);
  const rounded = Math.round(number * 10) / 10;
  return `${rounded}${fallbackUnit}`;
}

module.exports = {
  readAmpStatus
};
