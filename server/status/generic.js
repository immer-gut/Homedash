const { requestHead, requestJson } = require("../http");

async function readGenericServiceStatus(target, base) {
  const statusUrl = target.statusPath ? new URL(target.statusPath, target.url).href : target.url;
  const headers = target.headerName && target.headerValue ? { [target.headerName]: target.headerValue } : {};
  const result = await requestHead(statusUrl, headers).catch(async () => {
    const json = await requestJson(statusUrl, { headers });
    return { ok: true, status: 200, statusText: "OK", json };
  });

  const metrics = [];
  if (result.json && typeof result.json === "object") {
    const value = result.json.status || result.json.state || result.json.version || result.json.name;
    if (value) metrics.push({ label: "API", value: String(value).slice(0, 40) });
  }

  return {
    ...base,
    ok: result.ok,
    status: result.ok ? "online" : "warning",
    message: result.ok ? "Erreichbar" : `HTTP ${result.status || 0}`,
    metrics
  };
}

module.exports = {
  readGenericServiceStatus
};
