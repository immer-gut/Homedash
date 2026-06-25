const { requestJson } = require("../http");
const { normalizeHomeAssistantEntities } = require("../normalize");

async function readHomeAssistantStatus(target, base) {
  const headers = { Authorization: `Bearer ${target.apiKey}` };
  const apiBase = new URL(target.statusPath || "/api/", target.url).href;
  const info = await requestJson(apiBase, { headers });
  const config = await requestJson(new URL("/api/config", target.url).href, { headers }).catch(() => ({}));
  const states = await requestJson(new URL("/api/states", target.url).href, { headers }).catch(() => []);
  const entities = Array.isArray(states) ? states : [];
  const sensors = buildHomeAssistantSensors(target, entities);
  const metrics = [
    { label: "Sensoren", value: String(sensors.length) }
  ];
  if (config.version) metrics.push({ label: "Version", value: String(config.version).slice(0, 24) });

  return {
    ...base,
    ok: true,
    status: "online",
    message: config.location_name || info.message || "Home Assistant erreichbar",
    sensors,
    details: sensors.map((sensor) => ({
      label: sensor.label,
      value: sensor.value,
      online: sensor.online
    })),
    metrics
  };
}

function buildHomeAssistantSensors(target, states) {
  const stateMap = new Map(states.map((entity) => [entity.entity_id, entity]));
  return normalizeHomeAssistantEntities(target.entities).map((sensorSpec) => {
    const entity = stateMap.get(sensorSpec.entityId) || {};
    const state = String(entity.state || "unknown");
    const unit = String(entity.attributes?.unit_of_measurement || "").trim();
    return {
      entityId: sensorSpec.entityId,
      label: sensorSpec.label || entity.attributes?.friendly_name || sensorSpec.entityId.replace(/^[^.]+\./, "").replace(/_/g, " "),
      state,
      unit,
      value: unit ? `${state} ${unit}` : state,
      online: !["unavailable", "unknown"].includes(state)
    };
  });
}

module.exports = {
  readHomeAssistantStatus
};
