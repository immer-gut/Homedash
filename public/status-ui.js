export function createStatusUiController({
  elements,
  state,
  canEdit,
  openStatusWidgetDialog
}) {
  function renderStatus() {
    const items = Array.isArray(state.status.items) ? state.status.items : [];
    elements.statusWidget.hidden = state.widgets?.statusOverview !== true;
    elements.refreshStatusButton.disabled = state.statusLoading;
    elements.refreshStatusButton.textContent = state.statusLoading ? "Lädt..." : "Aktualisieren";
    elements.statusList.replaceChildren(
      ...(items.length ? items.map(createStatusCard) : [createEmptyStatus()])
    );
    elements.statusUpdated.textContent = state.status.updatedAt
      ? `Stand ${new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date(state.status.updatedAt))}`
      : "";
  }

  function createStatusCard(item) {
    const card = document.createElement("article");
    card.className = `service-card status-overview-card is-${item.status || "offline"}`;

    const head = document.createElement("div");
    head.className = "service-head";
    const title = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = item.name;
    const type = document.createElement("span");
    type.textContent = formatStatusType(item.type);
    title.append(name, type);
    const badge = document.createElement("span");
    badge.className = "service-badge";
    badge.textContent = item.status === "online" ? "Online" : item.status === "warning" ? "Warnung" : "Offline";
    const actions = document.createElement("div");
    actions.className = "service-actions";
    actions.append(badge);
    const openUrl = item.openUrl || item.url;
    if (openUrl) {
      const open = document.createElement("a");
      open.className = "button subtle-button service-link";
      open.href = openUrl;
      open.target = "_blank";
      open.rel = "noopener noreferrer";
      open.textContent = "Öffnen";
      actions.append(open);
    }
    const editableTarget = canEdit() ? state.statusTargets.find((target) => target.id === item.id) : null;
    if (editableTarget) {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "subtle-button";
      edit.textContent = "Bearbeiten";
      edit.addEventListener("click", () => openStatusWidgetDialog(editableTarget));
      actions.append(edit);
    }
    head.append(title, actions);

    card.append(head, createLinkStatus(item, "is-widget-panel"));
    return card;
  }

  function getStatusForLink(link) {
    const items = Array.isArray(state.status.items) ? state.status.items : [];
    const linkOrigin = getUrlOrigin(link.url);
    const title = normalizeStatusMatchText(link.title);
    return items.find((item) => {
      if (item.id && item.id === link.id) return true;
      const itemOrigin = getUrlOrigin(item.url);
      if (linkOrigin && itemOrigin && linkOrigin === itemOrigin) return true;
      const itemName = normalizeStatusMatchText(item.name);
      return itemName && title && itemName === title;
    });
  }

  function createLinkStatus(status, extraClass = "") {
    const panel = document.createElement("div");
    const isHomeAssistant = status.type === "homeassistant";
    const isOverviewPanel = extraClass.split(/\s+/).includes("is-widget-panel");
    panel.className = `link-status-panel${isHomeAssistant ? " is-homeassistant" : ""}${extraClass ? ` ${extraClass}` : ""}`;
    panel.role = "button";
    panel.tabIndex = 0;
    panel.ariaLabel = `Details zu ${status.name || "Status"} anzeigen`;
    const openDetails = (event) => {
      event.preventDefault();
      event.stopPropagation();
      openStatusDetail(status);
    };
    panel.addEventListener("click", openDetails);
    panel.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") openDetails(event);
    });

    const line = document.createElement("p");
    line.className = "link-status-line";
    const dot = document.createElement("span");
    dot.className = "link-status-dot";
    const message = document.createElement("span");
    message.textContent = isHomeAssistant ? "Home" : status.message || (status.ok ? "Online" : "Offline");
    line.append(dot, message);
    if (isHomeAssistant) {
      const version = getStatusMetric(status, "Version");
      if (version) {
        const versionText = document.createElement("strong");
        versionText.className = "ha-version";
        versionText.textContent = version;
        line.append(versionText);
      }
    }

    const metrics = document.createElement("div");
    metrics.className = "link-status-metrics";
    const metricLimit = isOverviewPanel ? Number.POSITIVE_INFINITY : status.type === "proxmoxbackup" ? 8 : 5;
    const metricItems = (Array.isArray(status.metrics) ? status.metrics : [])
      .filter((metric) => String(metric.label).toLowerCase() !== "user")
      .filter((metric) => !isHomeAssistant || String(metric.label).toLowerCase() !== "version")
      .slice(0, metricLimit);
    metrics.replaceChildren(...metricItems.map((metric) => {
      const item = document.createElement("span");
      const metricKind = getStatusMetricKind(metric.label);
      if (metricKind) {
        item.className = `link-status-metric is-${metricKind}`;
        item.ariaLabel = `${metric.label} ${metric.value}`;
        const icon = document.createElement("i");
        icon.className = `metric-icon metric-icon-${metricKind}`;
        icon.ariaHidden = "true";
        const value = document.createElement("span");
        value.textContent = metric.value;
        item.append(icon, value);
      } else {
        item.textContent = `${metric.label} ${metric.value}`;
      }
      return item;
    }));

    panel.append(line);
    if (metricItems.length && !isHomeAssistant) panel.append(metrics);
    const sensors = createHomeAssistantSensors(status);
    if (sensors) panel.append(sensors);
    const details = sensors ? null : createStatusDetails(status.details);
    if (details) panel.append(details);
    if (Array.isArray(status.debug) && status.debug.length) {
      const debug = document.createElement("pre");
      debug.className = "link-status-debug";
      debug.textContent = status.debug.join("\n");
      panel.append(debug);
    }
    return panel;
  }

  function openStatusDetail(status) {
    elements.statusDetailTitle.textContent = status.name || "Status";
    const body = document.createElement("div");
    body.className = `service-card is-${status.status || "offline"}`;
    const message = document.createElement("p");
    message.className = "service-message";
    message.textContent = status.message || (status.ok ? "Erreichbar" : "Nicht erreichbar");
    const metrics = document.createElement("div");
    metrics.className = "service-metrics";
    const metricItems = Array.isArray(status.metrics) ? status.metrics : [];
    metrics.replaceChildren(
      ...(metricItems.length ? metricItems.map(createStatusMetric) : [createStatusMetric({ label: "Status", value: status.ok ? "OK" : "Fehler" })])
    );
    body.append(message, metrics);
    const details = createStatusDetails(status.details);
    if (details) body.append(details);
    if (Array.isArray(status.debug) && status.debug.length) {
      const debug = document.createElement("pre");
      debug.className = "link-status-debug";
      debug.textContent = status.debug.join("\n");
      body.append(debug);
    }
    elements.statusDetailBody.replaceChildren(body);
    elements.statusDetailDialog.showModal();
  }

  return {
    createLinkStatus,
    getStatusForLink,
    renderStatus
  };
}

function createStatusMetric(metric) {
  const item = document.createElement("span");
  item.className = "service-metric";
  const label = document.createElement("small");
  label.textContent = metric.label;
  const value = document.createElement("strong");
  value.textContent = metric.value;
  item.append(label, value);
  return item;
}

function createStatusDetails(details) {
  const detailItems = Array.isArray(details) ? details.slice(0, 6) : [];
  if (!detailItems.length) return null;
  const list = document.createElement("div");
  list.className = "status-details";
  list.replaceChildren(...detailItems.map((detail) => {
    const row = document.createElement("p");
    if (typeof detail.online === "boolean") row.classList.add(detail.online ? "is-online" : "is-offline");
    const label = document.createElement("span");
    label.className = "status-detail-name";
    if (typeof detail.online === "boolean") {
      const dot = document.createElement("i");
      dot.className = "status-detail-dot";
      dot.ariaHidden = "true";
      label.append(dot);
    }
    const name = document.createElement("span");
    name.textContent = detail.label || "Status";
    label.append(name);
    const value = document.createElement("strong");
    value.className = "status-detail-value";
    if (detail.memory) {
      const memory = document.createElement("span");
      memory.textContent = detail.memory;
      value.append(memory);
    }
    if (detail.users !== undefined && detail.users !== "") {
      const users = document.createElement("span");
      users.className = "status-detail-users";
      users.ariaLabel = `${detail.users} User`;
      const icon = document.createElement("i");
      icon.className = "user-icon";
      icon.ariaHidden = "true";
      const count = document.createElement("span");
      count.textContent = detail.users;
      users.append(icon, count);
      value.append(users);
    }
    if (!value.childElementCount) value.textContent = detail.value || "";
    row.append(label, value);
    return row;
  }));
  return list;
}

function createEmptyStatus() {
  const empty = document.createElement("p");
  empty.className = "empty-note";
  empty.textContent = "Keine Statusquellen konfiguriert";
  return empty;
}

function formatStatusType(type) {
  const names = {
    proxmox: "Proxmox",
    proxmoxbackup: "Proxmox Backup Server",
    unraid: "Unraid",
    amp: "AMP",
    homeassistant: "Home Assistant",
    basic: "Service"
  };
  return names[type] || type || "Service";
}

function getStatusMetric(status, label) {
  const metric = (Array.isArray(status.metrics) ? status.metrics : [])
    .find((candidate) => String(candidate.label).toLowerCase() === label.toLowerCase());
  return metric?.value ? String(metric.value) : "";
}

function createHomeAssistantSensors(status) {
  const sensors = Array.isArray(status.sensors) ? status.sensors : [];
  if (!sensors.length) return null;
  const list = document.createElement("div");
  list.className = "ha-sensors";
  list.replaceChildren(...sensors.map((sensor) => {
    const item = document.createElement("span");
    item.className = `ha-sensor${sensor.online === false ? " is-offline" : ""}`;
    item.title = sensor.entityId || sensor.label;
    const label = document.createElement("small");
    label.textContent = sensor.label || sensor.entityId || "Sensor";
    const value = document.createElement("strong");
    value.textContent = sensor.value || sensor.state || "-";
    item.append(label, value);
    return item;
  }));
  return list;
}

function getStatusMetricKind(label) {
  const normalized = String(label || "").toLowerCase();
  if (normalized === "server") return "server";
  if (normalized === "cpu") return "cpu";
  if (normalized === "ram" || normalized === "speicher") return "ram";
  if (normalized === "entities") return "server";
  if (normalized === "updates") return "updates";
  return "";
}

function getUrlOrigin(value) {
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return "";
  }
}

function normalizeStatusMatchText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}
