import {
  categoryColors,
  createCategoryDialogController,
  getCategoryMeta as getCategoryMetaForState,
  getCategoryNames as getCategoryNamesForState,
  isCategoryVisible as isCategoryVisibleForState,
  normalizeColor,
  upsertCategory
} from "./categories.js";
import { createStatusUiController } from "./status-ui.js";

const state = {
  setupComplete: true,
  title: "Homedash",
  subtitle: "",
  theme: "retro",
  activeProfileId: "default",
  profiles: [],
  categories: [],
  links: [],
  statusTargets: [],
  widgets: { clock: true, notes: [], statusOverview: false, linkStats: false, weather: { enabled: false, label: "Zuhause", latitude: "", longitude: "" }, dateCountdown: { enabled: false, items: [] } },
  preferences: { startpageMode: true, shareMode: false, showCategoryCounts: false, compactCategoryLayout: false, showLinkStatus: true, showNotes: true, showZoraInbox: true, openLinksInNewTab: true },
  auth: { enabled: false, authenticated: true },
  status: { configured: 0, updatedAt: "", items: [] },
  weather: { enabled: false },
  zoraInbox: { items: [], loading: false, message: "" },
  app: { name: "Homedash", version: "" },
  statusLoading: false,
  weatherLoading: false,
  query: ""
};

const elements = {
  title: document.querySelector("#pageTitle"),
  subtitle: document.querySelector("#pageSubtitle"),
  appVersion: document.querySelector("#appVersion"),
  date: document.querySelector("#dateLabel"),
  time: document.querySelector("#timeLabel"),
  groups: document.querySelector("#groups"),
  empty: document.querySelector("#emptyState"),
  locked: document.querySelector("#lockedState"),
  search: document.querySelector("#searchInput"),
  searchPanel: document.querySelector("#searchPanel"),
  addButton: document.querySelector("#addButton"),
  addWidgetButton: document.querySelector("#addWidgetButton"),
  newNoteButton: document.querySelector("#newNoteButton"),
  newZoraInboxButton: document.querySelector("#newZoraInboxButton"),
  settingsButton: document.querySelector("#settingsButton"),
  adminButton: document.querySelector("#adminButton"),
  profileSelect: document.querySelector("#profileSelect"),
  newProfileButton: document.querySelector("#newProfileButton"),
  deleteProfileButton: document.querySelector("#deleteProfileButton"),
  themeSelect: document.querySelector("#themeSelect"),
  widgets: document.querySelector("#widgets"),
  bottomWidgets: document.querySelector("#bottomWidgets"),
  weatherWidget: document.querySelector("#weatherWidget"),
  weatherLabel: document.querySelector("#weatherLabel"),
  weatherBody: document.querySelector("#weatherBody"),
  refreshWeatherButton: document.querySelector("#refreshWeatherButton"),
  statusWidget: document.querySelector("#statusWidget"),
  statusList: document.querySelector("#statusList"),
  statusUpdated: document.querySelector("#statusUpdated"),
  refreshStatusButton: document.querySelector("#refreshStatusButton"),
  dateCountdownWidget: document.querySelector("#dateCountdownWidget"),
  statsWidget: document.querySelector("#statsWidget"),
  statsList: document.querySelector("#statsList"),
  dateCountdownList: document.querySelector("#dateCountdownList"),
  notesWidget: document.querySelector("#notesWidget"),
  notesList: document.querySelector("#notesList"),
  noteInput: document.querySelector("#noteInput"),
  addNoteButton: document.querySelector("#addNoteButton"),
  zoraInboxWidget: document.querySelector("#zoraInboxWidget"),
  zoraInboxList: document.querySelector("#zoraInboxList"),
  zoraInboxInput: document.querySelector("#zoraInboxInput"),
  addZoraInboxButton: document.querySelector("#addZoraInboxButton"),
  refreshZoraInboxButton: document.querySelector("#refreshZoraInboxButton"),
  setupDialog: document.querySelector("#setupDialog"),
  setupForm: document.querySelector("#setupForm"),
  setupTitle: document.querySelector("#setupTitle"),
  setupProfileName: document.querySelector("#setupProfileName"),
  setupPassword: document.querySelector("#setupPassword"),
  completeSetupButton: document.querySelector("#completeSetupButton"),
  editorDialog: document.querySelector("#editorDialog"),
  statusWidgetDialog: document.querySelector("#statusWidgetDialog"),
  settingsDialog: document.querySelector("#settingsDialog"),
  categoriesDialog: document.querySelector("#categoriesDialog"),
  categoriesForm: document.querySelector("#categoriesForm"),
  profileDialog: document.querySelector("#profileDialog"),
  importDialog: document.querySelector("#importDialog"),
  adminDialog: document.querySelector("#adminDialog"),
  adminPassword: document.querySelector("#adminPassword"),
  adminSubmitButton: document.querySelector("#adminSubmitButton"),
  dialogTitle: document.querySelector("#dialogTitle"),
  linkForm: document.querySelector("#linkForm"),
  linkId: document.querySelector("#linkId"),
  linkTitle: document.querySelector("#linkTitle"),
  linkUrl: document.querySelector("#linkUrl"),
  linkCategory: document.querySelector("#linkCategory"),
  newLinkCategoryLabel: document.querySelector("#newLinkCategoryLabel"),
  newLinkCategory: document.querySelector("#newLinkCategory"),
  linkNote: document.querySelector("#linkNote"),
  linkStatusEnabled: document.querySelector("#linkStatusEnabled"),
  linkStatusFields: document.querySelector("#linkStatusFields"),
  linkStatusType: document.querySelector("#linkStatusType"),
  linkStatusUrl: document.querySelector("#linkStatusUrl"),
  linkStatusOpenUrl: document.querySelector("#linkStatusOpenUrl"),
  linkStatusTokenId: document.querySelector("#linkStatusTokenId"),
  linkStatusTokenSecret: document.querySelector("#linkStatusTokenSecret"),
  linkStatusApiKey: document.querySelector("#linkStatusApiKey"),
  linkStatusEntities: document.querySelector("#linkStatusEntities"),
  linkStatusUsername: document.querySelector("#linkStatusUsername"),
  linkStatusPassword: document.querySelector("#linkStatusPassword"),
  linkStatusPath: document.querySelector("#linkStatusPath"),
  linkStatusDebug: document.querySelector("#linkStatusDebug"),
  toggleSecretFieldsButton: document.querySelector("#toggleSecretFieldsButton"),
  deleteButton: document.querySelector("#deleteButton"),
  saveLinkButton: document.querySelector("#saveLinkButton"),
  testLinkButton: document.querySelector("#testLinkButton"),
  linkStatus: document.querySelector("#linkStatus"),
  statusWidgetForm: document.querySelector("#statusWidgetForm"),
  statusWidgetDialogTitle: document.querySelector("#statusWidgetDialogTitle"),
  statusTargetId: document.querySelector("#statusTargetId"),
  statusTargetName: document.querySelector("#statusTargetName"),
  deleteStatusTargetButton: document.querySelector("#deleteStatusTargetButton"),
  saveStatusTargetButton: document.querySelector("#saveStatusTargetButton"),
  settingsForm: document.querySelector("#settingsForm"),
  settingsTitle: document.querySelector("#settingsTitle"),
  settingsSubtitle: document.querySelector("#settingsSubtitle"),
  settingShowCategoryCounts: document.querySelector("#settingShowCategoryCounts"),
  settingCompactCategoryLayout: document.querySelector("#settingCompactCategoryLayout"),
  settingShowLinkStatus: document.querySelector("#settingShowLinkStatus"),
  settingShowNotes: document.querySelector("#settingShowNotes"),
  settingShowZoraInbox: document.querySelector("#settingShowZoraInbox"),
  settingOpenLinksInNewTab: document.querySelector("#settingOpenLinksInNewTab"),
  settingStartpageMode: document.querySelector("#settingStartpageMode"),
  settingShareMode: document.querySelector("#settingShareMode"),
  settingShowStatsWidget: document.querySelector("#settingShowStatsWidget"),
  settingShowStatusWidget: document.querySelector("#settingShowStatusWidget"),
  settingShowWeatherWidget: document.querySelector("#settingShowWeatherWidget"),
  settingShowDateWidget: document.querySelector("#settingShowDateWidget"),
  dateSettings: document.querySelector("#dateSettings"),
  dateCountdownEditor: document.querySelector("#dateCountdownEditor"),
  addDateCountdownButton: document.querySelector("#addDateCountdownButton"),
  weatherSettings: document.querySelector("#weatherSettings"),
  settingWeatherLabel: document.querySelector("#settingWeatherLabel"),
  settingWeatherLatitude: document.querySelector("#settingWeatherLatitude"),
  settingWeatherLongitude: document.querySelector("#settingWeatherLongitude"),
  settingsCategoriesButton: document.querySelector("#settingsCategoriesButton"),
  createDemoButton: document.querySelector("#createDemoButton"),
  settingsBookmarkImportButton: document.querySelector("#settingsBookmarkImportButton"),
  settingsImportButton: document.querySelector("#settingsImportButton"),
  settingsBackupButton: document.querySelector("#settingsBackupButton"),
  settingsRestoreButton: document.querySelector("#settingsRestoreButton"),
  saveSettingsButton: document.querySelector("#saveSettingsButton"),
  categoryEditor: document.querySelector("#categoryEditor"),
  addCategoryButton: document.querySelector("#addCategoryButton"),
  saveCategoriesButton: document.querySelector("#saveCategoriesButton"),
  profileName: document.querySelector("#profileName"),
  saveProfileButton: document.querySelector("#saveProfileButton"),
  importFile: document.querySelector("#importFile"),
  importMode: document.querySelector("#importMode"),
  importDialogTitle: document.querySelector("#importDialogTitle"),
  importText: document.querySelector("#importText"),
  runImportButton: document.querySelector("#runImportButton"),
  commandDialog: document.querySelector("#commandDialog"),
  commandForm: document.querySelector("#commandForm"),
  commandInput: document.querySelector("#commandInput"),
  commandResults: document.querySelector("#commandResults"),
  statusDetailDialog: document.querySelector("#statusDetailDialog"),
  statusDetailTitle: document.querySelector("#statusDetailTitle"),
  statusDetailBody: document.querySelector("#statusDetailBody"),
  toast: document.querySelector("#toast")
};

let linkMetadataTimer = null;
let linkMetadataAbort = null;
let compactLayoutTimer = null;
let dateCountdownDrafts = [];

const widgetRegistry = [
  { id: "weather", render: renderWeather, isHidden: () => elements.weatherWidget.hidden },
  { id: "statusOverview", render: renderStatus, isHidden: () => elements.statusWidget.hidden },
  { id: "linkStats", render: renderStatsWidget, isHidden: () => elements.statsWidget.hidden },
  { id: "dateCountdown", render: renderDateCountdowns, isHidden: () => elements.dateCountdownWidget.hidden },
  { id: "notes", render: renderNotesWidget, isHidden: () => elements.notesWidget.hidden },
  { id: "zoraInbox", render: renderZoraInboxWidget, isHidden: () => elements.zoraInboxWidget.hidden }
];

const widgetSettingsRegistry = [
  {
    id: "linkStats",
    load: () => {
      elements.settingShowStatsWidget.checked = state.widgets?.linkStats === true;
    },
    save: (widgets) => {
      widgets.linkStats = elements.settingShowStatsWidget.checked;
    }
  },
  {
    id: "statusOverview",
    load: () => {
      elements.settingShowStatusWidget.checked = state.widgets?.statusOverview === true;
    },
    save: (widgets) => {
      widgets.statusOverview = elements.settingShowStatusWidget.checked;
    }
  },
  {
    id: "weather",
    load: () => {
      elements.settingShowWeatherWidget.checked = state.widgets?.weather?.enabled === true;
      elements.settingWeatherLabel.value = state.widgets?.weather?.label || "Zuhause";
      elements.settingWeatherLatitude.value = state.widgets?.weather?.latitude || "";
      elements.settingWeatherLongitude.value = state.widgets?.weather?.longitude || "";
      renderWeatherSettings();
    },
    save: (widgets) => {
      widgets.weather = {
        ...(state.widgets?.weather || {}),
        enabled: elements.settingShowWeatherWidget.checked,
        label: elements.settingWeatherLabel.value.trim() || "Zuhause",
        latitude: elements.settingWeatherLatitude.value.trim(),
        longitude: elements.settingWeatherLongitude.value.trim()
      };
    }
  },
  {
    id: "dateCountdown",
    load: () => {
      elements.settingShowDateWidget.checked = state.widgets?.dateCountdown?.enabled === true;
      dateCountdownDrafts = getDateCountdownItems(state.widgets?.dateCountdown);
      if (!dateCountdownDrafts.length) dateCountdownDrafts = [{ id: createId(), label: "Datum", date: "" }];
      renderDateSettings();
    },
    save: (widgets) => {
      widgets.dateCountdown = {
        ...(state.widgets?.dateCountdown || {}),
        enabled: elements.settingShowDateWidget.checked,
        items: dateCountdownDrafts
          .map(normalizeDateCountdownItem)
          .filter((item) => item.label || item.date)
      };
    }
  }
];

function activeProfile() {
  return state.profiles.find((profile) => profile.id === state.activeProfileId) || state.profiles[0] || {
    id: "default",
    name: "Start",
    categories: [],
    links: [],
    statusTargets: []
  };
}

function canEdit() {
  return !state.auth?.enabled || state.auth?.authenticated;
}

function updateClock() {
  const now = new Date();
  const time = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(now);
  elements.time.textContent = time;
  elements.date.textContent = new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long"
  }).format(now);
}

async function loadData() {
  const response = await fetch("/api/homedash");
  if (!response.ok) throw new Error("Startseite konnte nicht geladen werden.");
  Object.assign(state, await response.json());
  syncActiveProfileAliases();
  render();
  if (!state.setupComplete) elements.setupDialog.showModal();
  loadStatus().catch(() => {});
  loadWeather().catch(() => {});
  loadZoraInbox().catch(() => {});
}

function syncActiveProfileAliases() {
  const profile = activeProfile();
  state.categories = profile.categories || [];
  state.links = profile.links || [];
  state.statusTargets = profile.statusTargets || [];
}

async function saveData(message = "Gespeichert") {
  if (!canEdit()) {
    openAdminDialog();
    return;
  }
  syncProfileFromAliases();
  const response = await fetch("/api/homedash", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schemaVersion: state.schemaVersion || 6,
      setupComplete: state.setupComplete,
      title: state.title,
      subtitle: state.subtitle,
      theme: state.theme,
      activeProfileId: state.activeProfileId,
      widgets: state.widgets,
      preferences: state.preferences,
      profiles: state.profiles
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Speichern fehlgeschlagen.");
  }

  Object.assign(state, await response.json());
  syncActiveProfileAliases();
  render();
  showToast(message);
}

async function loadStatus() {
  state.statusLoading = true;
  renderStatus();
  try {
    const response = await fetch("/api/status");
    if (!response.ok) throw new Error("Status konnte nicht geladen werden");
    state.status = await response.json();
  } finally {
    state.statusLoading = false;
    renderStatus();
    renderStatsWidget();
    renderGroups();
  }
}

async function loadWeather() {
  if (state.widgets?.weather?.enabled !== true) {
    state.weather = { enabled: false };
    renderWeather();
    return;
  }
  state.weatherLoading = true;
  renderWeather();
  try {
    const response = await fetch("/api/weather");
    if (!response.ok) throw new Error("Wetter konnte nicht geladen werden");
    state.weather = await response.json();
  } finally {
    state.weatherLoading = false;
    renderWeather();
  }
}

async function loadZoraInbox() {
  if (state.preferences?.showZoraInbox === false) {
    state.zoraInbox = { items: [], loading: false, message: "" };
    renderZoraInboxWidget();
    return;
  }
  if (!canEdit()) {
    state.zoraInbox = { items: [], loading: false, message: "Admin gesperrt" };
    renderZoraInboxWidget();
    return;
  }
  state.zoraInbox = { ...(state.zoraInbox || {}), loading: true, message: "" };
  renderZoraInboxWidget();
  try {
    const response = await fetch("/api/zora-inbox?status=new");
    if (!response.ok) throw new Error("Zora Inbox konnte nicht geladen werden");
    const payload = await response.json();
    state.zoraInbox = { items: Array.isArray(payload.items) ? payload.items : [], loading: false, message: "" };
  } catch (error) {
    state.zoraInbox = { items: [], loading: false, message: error.message };
  } finally {
    renderZoraInboxWidget();
  }
}

function syncProfileFromAliases() {
  const index = state.profiles.findIndex((profile) => profile.id === state.activeProfileId);
  const nextProfile = {
    ...activeProfile(),
    categories: state.categories,
    links: state.links,
    statusTargets: state.statusTargets
  };
  if (index >= 0) state.profiles.splice(index, 1, nextProfile);
  else state.profiles.push(nextProfile);
}

function render() {
  document.title = state.title || "Homedash";
  document.body.dataset.theme = state.theme || "retro";
  elements.title.textContent = state.title;
  elements.subtitle.textContent = state.subtitle;
  elements.appVersion.textContent = state.app?.version ? `v${state.app.version}` : "";
  elements.themeSelect.value = state.theme || "retro";
  renderAdminState();
  renderProfiles();
  renderCategoryList();
  renderSearch();
  renderWidgets();
  renderGroups();
}

function renderAdminState() {
  const editable = canEdit();
  document.body.classList.toggle("is-locked", !editable);
  document.body.classList.toggle("is-startpage-mode", state.preferences?.startpageMode !== false);
  document.body.classList.toggle("is-share-mode", state.preferences?.shareMode === true);
  elements.locked.hidden = editable || state.preferences?.shareMode === true;
  elements.adminButton.textContent = state.auth?.enabled ? (editable ? "Admin offen" : "Admin gesperrt") : "Admin aus";
  elements.adminButton.classList.toggle("is-unlocked", editable);
  elements.adminButton.setAttribute("aria-pressed", String(editable));
}

function renderProfiles() {
  elements.profileSelect.replaceChildren(
    ...state.profiles
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }))
      .map((profile) => {
        const option = document.createElement("option");
        option.value = profile.id;
        option.textContent = profile.name;
        return option;
      })
  );
  elements.profileSelect.value = state.activeProfileId;
  elements.deleteProfileButton.disabled = state.profiles.length <= 1 || !canEdit();
}

function renderWidgets() {
  widgetRegistry.forEach((widget) => widget.render());
  elements.widgets.hidden = [elements.dateCountdownWidget, elements.statusWidget, elements.statsWidget].every((widget) => widget.hidden);
  elements.bottomWidgets.hidden = [elements.notesWidget, elements.zoraInboxWidget].every((widget) => widget.hidden);
}

function renderNotesWidget() {
  const notes = getNotes();
  const notesHidden = state.preferences?.showNotes === false || (!notes.length && !state.noteComposerOpen);
  elements.notesWidget.hidden = notesHidden;
  if (notesHidden) return;
  elements.noteInput.disabled = !canEdit();
  elements.addNoteButton.disabled = !canEdit();
  elements.notesList.replaceChildren(...notes.map(createNoteCard));
}

function renderZoraInboxWidget() {
  const hidden = state.preferences?.showZoraInbox === false;
  elements.zoraInboxWidget.hidden = hidden;
  if (hidden) return;
  const editable = canEdit();
  const inbox = state.zoraInbox || {};
  const items = Array.isArray(inbox.items) ? inbox.items : [];
  elements.zoraInboxInput.disabled = !editable || inbox.loading;
  elements.addZoraInboxButton.disabled = !editable || inbox.loading;
  elements.refreshZoraInboxButton.disabled = !editable || inbox.loading;

  if (!editable) {
    elements.zoraInboxList.replaceChildren(createInboxMessage("Admin entsperren"));
    return;
  }
  if (inbox.loading) {
    elements.zoraInboxList.replaceChildren(createInboxMessage("Wird geladen"));
    return;
  }
  if (inbox.message) {
    elements.zoraInboxList.replaceChildren(createInboxMessage(inbox.message));
    return;
  }
  elements.zoraInboxList.replaceChildren(...(items.length ? items.map(createZoraInboxCard) : [createInboxMessage("Keine offenen Gedanken")]));
}

function renderDateCountdowns() {
  const config = state.widgets?.dateCountdown || {};
  const items = getDateCountdownItems(config);
  elements.dateCountdownWidget.hidden = config.enabled !== true || !items.length;
  if (elements.dateCountdownWidget.hidden) {
    elements.dateCountdownList.replaceChildren();
    return;
  }
  elements.dateCountdownList.replaceChildren(...items.map(createDateCountdownCard));
}

function createDateCountdownCard(item) {
  const result = calculateDateCountdown(item.date);
  const card = document.createElement("article");
  card.className = "date-countdown-card";
  const label = document.createElement("span");
  label.className = "date-countdown-label";
  label.textContent = item.label || "Datum";
  const value = document.createElement("strong");
  value.className = "date-countdown-value";
  value.textContent = result.value;
  const text = document.createElement("span");
  text.className = "date-countdown-text";
  text.textContent = result.text;
  const date = document.createElement("small");
  date.textContent = result.dateLabel;
  card.append(label, value, text, date);
  return card;
}

function renderWeather() {
  const enabled = state.widgets?.weather?.enabled === true;
  elements.weatherWidget.hidden = !enabled;
  if (!enabled) return;
  elements.refreshWeatherButton.disabled = state.weatherLoading;
  elements.refreshWeatherButton.textContent = state.weatherLoading ? "..." : "↻";
  elements.weatherLabel.textContent = state.widgets.weather.label || "Wetter";
  const weather = state.weather || {};
  if (state.weatherLoading && !weather.ok) {
    elements.weatherBody.replaceChildren(createWeatherMessage("Wetter wird geladen"));
    return;
  }
  if (!weather.ok) {
    elements.weatherBody.replaceChildren(createWeatherMessage(weather.message || "Noch keine Wetterdaten"));
    return;
  }

  const temp = document.createElement("strong");
  temp.className = "weather-temp";
  temp.textContent = `${weather.temperature ?? "-"}°`;
  const condition = document.createElement("p");
  condition.className = "weather-condition";
  condition.textContent = weather.condition || "Wetter";
  const metrics = document.createElement("div");
  metrics.className = "weather-metrics";
  const values = [
    ["Hoch/Tief", weather.high !== null && weather.low !== null ? `${weather.high}°/${weather.low}°` : "-"],
    ["Regen", weather.rainChance !== null ? `${weather.rainChance}%` : "-"],
    ["Feuchte", weather.humidity !== null ? `${weather.humidity}%` : "-"]
  ];
  metrics.replaceChildren(...values.map(([label, value]) => {
    const item = document.createElement("span");
    const small = document.createElement("small");
    small.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = value;
    item.append(small, strong);
    return item;
  }));
  const summary = document.createElement("div");
  summary.className = "weather-summary";
  summary.append(temp, condition);
  elements.weatherBody.replaceChildren(summary, metrics);
}

function createWeatherMessage(message) {
  const item = document.createElement("p");
  item.className = "empty-note";
  item.textContent = message;
  return item;
}

function calculateDateCountdown(value) {
  const parsed = parseDateOnly(value);
  if (!parsed) {
    return {
      value: "-",
      text: "Datum fehlt",
      dateLabel: "In den Einstellungen ein Datum eintragen"
    };
  }
  const today = startOfLocalDay(new Date());
  const target = startOfLocalDay(parsed);
  const days = Math.round((target.getTime() - today.getTime()) / 86400000);
  const absoluteDays = Math.abs(days);
  const dateLabel = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "long", year: "numeric" }).format(target);
  if (days === 0) {
    return { value: "Heute", text: "ist das Datum", dateLabel };
  }
  return {
    value: String(absoluteDays),
    text: days > 0 ? `Tag${absoluteDays === 1 ? "" : "e"} bis dahin` : `Tag${absoluteDays === 1 ? "" : "e"} seitdem`,
    dateLabel
  };
}

function getDateCountdownItems(config = state.widgets?.dateCountdown || {}) {
  const items = Array.isArray(config.items) ? config.items : [];
  const normalized = items
    .map(normalizeDateCountdownItem)
    .filter((item) => item.label || item.date);
  if (normalized.length) return normalized;
  const legacy = normalizeDateCountdownItem(config);
  return legacy.label || legacy.date ? [legacy] : [];
}

function normalizeDateCountdownItem(item = {}) {
  return {
    id: item.id || createId(),
    label: String(item.label || "").trim().slice(0, 40),
    date: String(item.date || "").trim()
  };
}

function parseDateOnly(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function renderStatus() {
  statusUi.renderStatus();
}

function renderStatsWidget() {
  elements.statsWidget.hidden = state.widgets?.linkStats !== true;
  if (elements.statsWidget.hidden) return;
  const online = (state.status.items || []).filter((item) => item.status === "online").length;
  const configured = (state.status.items || []).length;
  const stats = [
    { label: "Links", value: state.links.length },
    { label: "Kategorien", value: getCategoryNames().length },
    { label: "Status online", value: configured ? `${online}/${configured}` : "0" }
  ];
  elements.statsList.replaceChildren(...stats.map((stat) => {
    const item = document.createElement("span");
    const value = document.createElement("strong");
    value.textContent = stat.value;
    const label = document.createElement("small");
    label.textContent = stat.label;
    item.append(value, label);
    return item;
  }));
}

function renderSearch() {
  elements.searchPanel.hidden = false;
}

function getNotes() {
  const notes = Array.isArray(state.widgets.notes) ? state.widgets.notes : [];
  if (!notes.length && state.widgets.quickNote) {
    return [{ id: createId(), text: state.widgets.quickNote }];
  }
  return notes;
}

function createNoteCard(note) {
  const card = document.createElement("div");
  card.className = "note-card";
  const text = document.createElement("p");
  text.textContent = note.text;
  const remove = document.createElement("button");
  remove.className = "icon-button admin-only";
  remove.type = "button";
  remove.textContent = "x";
  remove.ariaLabel = "Notiz löschen";
  remove.addEventListener("click", async () => {
    const nextNotes = getNotes().filter((candidate) => candidate.id !== note.id);
    state.widgets.notes = nextNotes;
    if (!nextNotes.length) state.noteComposerOpen = false;
    await saveData("Notiz gelöscht");
  });
  card.append(text, remove);
  return card;
}

function createZoraInboxCard(item) {
  const card = document.createElement("article");
  card.className = "zora-inbox-card";
  const text = document.createElement("p");
  text.textContent = item.text || "";
  const meta = document.createElement("small");
  meta.textContent = formatInboxDate(item.createdAt);
  const actions = document.createElement("div");
  actions.className = "zora-inbox-actions";
  const done = document.createElement("button");
  done.type = "button";
  done.textContent = "Erledigt";
  done.addEventListener("click", () => markZoraInboxProcessed(item.id).catch((error) => showToast(error.message)));
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "danger subtle-danger";
  remove.textContent = "Loeschen";
  remove.addEventListener("click", () => deleteZoraInboxItem(item.id).catch((error) => showToast(error.message)));
  actions.append(done, remove);
  card.append(text, meta, actions);
  return card;
}

function createInboxMessage(message) {
  const item = document.createElement("p");
  item.className = "empty-note";
  item.textContent = message;
  return item;
}

function formatInboxDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Gerade eben";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function renderCategoryList() {
  elements.linkCategory.replaceChildren(
    ...getCategoryNames().map((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      return option;
    }),
    createOption("__new_category__", "+ Neue Kategorie")
  );
  renderNewLinkCategory();
}

function createOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function renderNewLinkCategory() {
  const isNewCategory = elements.linkCategory.value === "__new_category__";
  elements.newLinkCategoryLabel.hidden = !isNewCategory;
  elements.newLinkCategory.required = isNewCategory;
  if (!isNewCategory) elements.newLinkCategory.value = "";
}

function renderGroups() {
  const query = state.query.trim().toLowerCase();
  const compactLayout = state.preferences?.compactCategoryLayout === true;
  elements.groups.classList.toggle("is-compact", compactLayout);
  const links = state.links.filter((link) => {
    if (!isCategoryVisible(link.category || "Links")) return false;
    const haystack = `${link.title} ${link.category} ${link.note}`.toLowerCase();
    return !query || haystack.includes(query);
  });
  const grouped = links.reduce((groups, link) => {
    const category = link.category || "Links";
    groups.set(category, [...(groups.get(category) || []), link]);
    return groups;
  }, new Map());
  if (!query) {
    for (const category of getCategoryNames()) {
      if (!isCategoryVisible(category)) continue;
      if (!grouped.has(category)) grouped.set(category, []);
    }
  }

  const sections = [...grouped.entries()].sort(([a], [b]) => compareNames(a, b)).map(([category, groupLinks]) => createGroupSection(category, groupLinks));
  elements.groups.replaceChildren(...(compactLayout ? packCompactGroups(sections) : sections.map(({ section }) => section)));
  elements.empty.hidden = links.length > 0 || !query;
}

function createGroupSection(category, groupLinks) {
  const meta = getCategoryMeta(category);
  const section = document.createElement("article");
  section.className = "group";
  section.style.setProperty("--category-color", meta.color);
  const heading = document.createElement("h2");
  const icon = document.createElement("span");
  icon.className = `category-icon is-${meta.icon}`;
  icon.ariaHidden = "true";
  const text = document.createElement("span");
  text.textContent = state.preferences?.showCategoryCounts ? `${category} (${groupLinks.length})` : category;
  heading.append(icon, text);
  const list = document.createElement("div");
  list.className = "link-list";
  if (groupLinks.length) {
    list.replaceChildren(...groupLinks.slice().sort((a, b) => compareNames(a.title, b.title)).map(createLinkCard));
  } else {
    const empty = document.createElement("p");
    empty.className = "empty-category";
    empty.textContent = "Noch leer";
    list.append(empty);
  }
  section.append(heading, list);
  return {
    section
  };
}

function packCompactGroups(groups) {
  if (!groups.length) {
    elements.groups.style.setProperty("--compact-columns", 1);
    return [];
  }
  const width = elements.groups.clientWidth || document.documentElement.clientWidth || window.innerWidth;
  const targetWidth = width >= 1900 ? 270 : 300;
  const desiredColumns = Math.max(1, Math.min(groups.length, Math.floor((width + 14) / (targetWidth + 14))));
  const groupsPerColumn = Math.ceil(groups.length / desiredColumns);
  const columnCount = Math.ceil(groups.length / groupsPerColumn);
  elements.groups.style.setProperty("--compact-columns", columnCount);
  const columns = Array.from({ length: columnCount }, () => document.createElement("div"));
  columns.forEach((column) => {
    column.className = "group-column";
  });
  groups.forEach((group, index) => {
    columns[Math.floor(index / groupsPerColumn)].append(group.section);
  });
  return columns;
}

function compareNames(a, b) {
  return String(a).localeCompare(String(b), "de", { sensitivity: "base" });
}

function getCategoryNames() {
  return getCategoryNamesForState(state);
}

function getCategoryMeta(name) {
  return getCategoryMetaForState(state, name);
}

function isCategoryVisible(name) {
  return isCategoryVisibleForState(state, name);
}

function createLinkCard(link) {
  const wrapper = document.createElement("div");
  wrapper.className = "link-card";
  wrapper.style.setProperty("--category-color", getCategoryMeta(link.category || "Links").color);
  const status = state.preferences?.showLinkStatus === false ? null : getStatusForLink(link);
  if (status) wrapper.classList.add(`has-status`, `is-${status.status || "offline"}`);
  const anchor = document.createElement("a");
  anchor.href = link.url;
  if (state.preferences?.openLinksInNewTab !== false) {
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
  }

  const title = document.createElement("p");
  title.className = "link-title";
  const icon = document.createElement("img");
  icon.className = "favicon";
  icon.alt = "";
  icon.loading = "lazy";
  icon.decoding = "async";
  icon.src = `/api/favicon?url=${encodeURIComponent(link.url)}`;
  const titleText = document.createElement("span");
  titleText.textContent = link.title;
  title.append(icon, titleText);

  anchor.append(title);
  if (link.note) {
    const note = document.createElement("p");
    note.className = "link-note";
    note.textContent = link.note;
    anchor.append(note);
  }
  if (status) anchor.append(createLinkStatus(status));
  anchor.className = "link-content";

  const edit = document.createElement("button");
  edit.className = "edit-link admin-only";
  edit.type = "button";
  edit.textContent = "...";
  edit.ariaLabel = `${link.title} bearbeiten`;
  edit.addEventListener("click", () => openLinkDialog(link));
  wrapper.append(anchor, edit);
  return wrapper;
}

function getStatusForLink(link) {
  return statusUi.getStatusForLink(link);
}

function createLinkStatus(status, extraClass = "") {
  return statusUi.createLinkStatus(status, extraClass);
}

function normalizeMatchText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function openLinkDialog(link = null) {
  if (!canEdit()) return openAdminDialog();
  elements.dialogTitle.textContent = link ? "Link bearbeiten" : "Link hinzufügen";
  elements.linkId.value = link?.id || "";
  elements.linkTitle.value = link?.title || "";
  elements.linkTitle.dataset.autoTitle = link ? "false" : "true";
  elements.linkUrl.value = link?.url || "";
  renderCategoryList();
  elements.linkCategory.value = link?.category || getCategoryNames()[0] || "Links";
  renderNewLinkCategory();
  elements.linkCategory.dataset.autoCategory = link ? "false" : "true";
  elements.linkNote.value = link?.note || "";
  setLinkStatus("idle", "Nicht getestet");
  elements.deleteButton.hidden = !link;
  elements.editorDialog.showModal();
  elements.linkUrl.focus();
}

function openStatusWidgetDialog(target = null) {
  if (!canEdit()) return openAdminDialog();
  elements.statusWidgetDialogTitle.textContent = target ? "Widget bearbeiten" : "Widget hinzufügen";
  elements.statusTargetId.value = target?.id || "";
  elements.statusTargetName.value = target?.name || "";
  setStatusWidgetForm(target || { enabled: true });
  elements.deleteStatusTargetButton.hidden = !target;
  elements.statusWidgetDialog.showModal();
  elements.statusTargetName.focus();
}

const statusUi = createStatusUiController({
  elements,
  state,
  canEdit,
  openStatusWidgetDialog
});

function setStatusWidgetForm(widget = {}) {
  elements.linkStatusEnabled.checked = widget?.enabled !== false;
  elements.linkStatusType.value = widget?.type || "basic";
  elements.linkStatusUrl.value = widget?.url || "";
  elements.linkStatusOpenUrl.value = widget?.openUrl || "";
  elements.linkStatusTokenId.value = widget?.tokenId || "";
  elements.linkStatusTokenSecret.value = widget?.tokenSecret || "";
  elements.linkStatusApiKey.value = widget?.apiKey || "";
  elements.linkStatusEntities.value = Array.isArray(widget?.entities)
    ? widget.entities.map(formatHomeAssistantEntitySpec).join(", ")
    : widget?.entities || "";
  elements.linkStatusUsername.value = widget?.username || "";
  elements.linkStatusPassword.value = widget?.password || "";
  elements.linkStatusTokenSecret.type = "password";
  elements.linkStatusApiKey.type = "password";
  elements.linkStatusPassword.type = "password";
  elements.toggleSecretFieldsButton.textContent = "Zugangsdaten anzeigen";
  elements.linkStatusPath.value = widget?.statusPath || "";
  elements.linkStatusDebug.checked = widget?.debug === true;
  renderLinkStatusFields();
}

function renderLinkStatusFields() {
  const enabled = elements.linkStatusEnabled.checked;
  const type = elements.linkStatusType.value || "basic";
  elements.linkStatusFields.hidden = !enabled;
  elements.linkStatusUrl.required = enabled;
  elements.linkStatusFields.querySelectorAll("[data-status-field]").forEach((field) => {
    field.hidden = !field.dataset.statusField.split(/\s+/).includes(type);
  });
}

function formatHomeAssistantEntitySpec(entity) {
  if (typeof entity === "string") return entity;
  const entityId = entity?.entityId || entity?.id || "";
  const label = entity?.label || entity?.name || "";
  return label ? `${entityId}=${label}` : entityId;
}

function toggleSecretFields() {
  const secretInputs = [elements.linkStatusTokenSecret, elements.linkStatusApiKey, elements.linkStatusPassword];
  const reveal = secretInputs.some((input) => input.type === "password");
  secretInputs.forEach((input) => {
    input.type = reveal ? "text" : "password";
  });
  elements.toggleSecretFieldsButton.textContent = reveal ? "Zugangsdaten verbergen" : "Zugangsdaten anzeigen";
}

function collectStatusWidgetForm() {
  return {
    enabled: elements.linkStatusEnabled.checked,
    type: elements.linkStatusType.value,
    url: normalizeUrl(elements.linkStatusUrl.value),
    openUrl: normalizeUrl(elements.linkStatusOpenUrl.value),
    tokenId: elements.linkStatusTokenId.value.trim(),
    tokenSecret: elements.linkStatusTokenSecret.value.trim(),
    apiKey: elements.linkStatusApiKey.value.trim(),
    entities: elements.linkStatusEntities.value.trim(),
    username: elements.linkStatusUsername.value.trim(),
    password: elements.linkStatusPassword.value,
    statusPath: elements.linkStatusPath.value.trim(),
    debug: elements.linkStatusDebug.checked
  };
}

async function saveStatusTarget() {
  if (!elements.statusWidgetForm.reportValidity()) return;
  const target = {
    ...collectStatusWidgetForm(),
    id: elements.statusTargetId.value || createId(),
    name: elements.statusTargetName.value.trim() || "Status"
  };
  if (target.enabled && !target.url) throw new Error("Status-URL fehlt");
  const existingIndex = state.statusTargets.findIndex((candidate) => candidate.id === target.id);
  if (existingIndex >= 0) state.statusTargets.splice(existingIndex, 1, target);
  else state.statusTargets.push(target);
  state.widgets = {
    ...(state.widgets || {}),
    statusOverview: true
  };
  await saveData("Widget gespeichert");
  elements.statusWidgetDialog.close();
  loadStatus().catch(() => {});
}

async function deleteStatusTarget() {
  const id = elements.statusTargetId.value;
  state.statusTargets = state.statusTargets.filter((target) => target.id !== id);
  await saveData("Widget gelöscht");
  elements.statusWidgetDialog.close();
  loadStatus().catch(() => {});
}

function openSettingsDialog() {
  if (!canEdit()) return openAdminDialog();
  elements.settingsTitle.value = state.title;
  elements.settingsSubtitle.value = state.subtitle;
  elements.themeSelect.value = state.theme || "retro";
  elements.settingShowCategoryCounts.checked = state.preferences?.showCategoryCounts === true;
  elements.settingCompactCategoryLayout.checked = state.preferences?.compactCategoryLayout === true;
  elements.settingShowLinkStatus.checked = state.preferences?.showLinkStatus !== false;
  elements.settingShowNotes.checked = state.preferences?.showNotes !== false;
  elements.settingShowZoraInbox.checked = state.preferences?.showZoraInbox !== false;
  elements.settingOpenLinksInNewTab.checked = state.preferences?.openLinksInNewTab !== false;
  elements.settingStartpageMode.checked = state.preferences?.startpageMode !== false;
  elements.settingShareMode.checked = state.preferences?.shareMode === true;
  loadWidgetSettings();
  elements.settingsDialog.showModal();
}

function loadWidgetSettings() {
  widgetSettingsRegistry.forEach((widget) => widget.load());
}

function renderWeatherSettings() {
  elements.weatherSettings.hidden = !elements.settingShowWeatherWidget.checked;
}

function renderDateSettings() {
  elements.dateSettings.hidden = !elements.settingShowDateWidget.checked;
  renderDateCountdownEditor();
}

function renderDateCountdownEditor() {
  elements.dateCountdownEditor.replaceChildren(...dateCountdownDrafts.map((item) => {
    const row = document.createElement("div");
    row.className = "date-countdown-row";
    const label = document.createElement("input");
    label.value = item.label || "";
    label.maxLength = 40;
    label.placeholder = "Urlaub, Wartung, Geburtstag";
    label.ariaLabel = "Titel";
    label.addEventListener("input", (event) => {
      item.label = event.target.value;
    });
    const date = document.createElement("input");
    date.type = "date";
    date.value = item.date || "";
    date.ariaLabel = "Datum";
    date.addEventListener("input", (event) => {
      item.date = event.target.value;
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-button";
    remove.textContent = "x";
    remove.ariaLabel = "Datum entfernen";
    remove.disabled = dateCountdownDrafts.length <= 1;
    remove.addEventListener("click", () => {
      dateCountdownDrafts = dateCountdownDrafts.filter((candidate) => candidate.id !== item.id);
      if (!dateCountdownDrafts.length) dateCountdownDrafts = [{ id: createId(), label: "Datum", date: "" }];
      renderDateCountdownEditor();
    });
    row.append(label, date, remove);
    return row;
  }));
}

function openNoteComposer() {
  if (!canEdit()) return openAdminDialog();
  state.preferences = {
    ...(state.preferences || {}),
    showNotes: true
  };
  state.noteComposerOpen = true;
  elements.settingsDialog.close();
  renderWidgets();
  window.requestAnimationFrame(() => elements.noteInput.focus());
}

function openZoraInboxComposer() {
  if (!canEdit()) return openAdminDialog();
  state.preferences = {
    ...(state.preferences || {}),
    showZoraInbox: true
  };
  renderWidgets();
  window.requestAnimationFrame(() => elements.zoraInboxInput.focus());
}

async function saveZoraInboxNote() {
  if (!canEdit()) return openAdminDialog();
  const text = elements.zoraInboxInput.value.trim();
  if (!text) return;
  const response = await fetch("/api/zora-inbox", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, source: "homedash" })
  });
  if (!response.ok) throw new Error((await response.json()).error || "Zora Inbox konnte nicht gespeichert werden");
  elements.zoraInboxInput.value = "";
  await loadZoraInbox();
  showToast("Gedanke gespeichert");
}

async function markZoraInboxProcessed(id) {
  if (!canEdit()) return openAdminDialog();
  const response = await fetch(`/api/zora-inbox/${encodeURIComponent(id)}/processed`, { method: "POST" });
  if (!response.ok) throw new Error((await response.json()).error || "Eintrag konnte nicht markiert werden");
  await loadZoraInbox();
  showToast("Eintrag erledigt");
}

async function deleteZoraInboxItem(id) {
  if (!canEdit()) return openAdminDialog();
  const response = await fetch(`/api/zora-inbox/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) throw new Error((await response.json()).error || "Eintrag konnte nicht geloescht werden");
  await loadZoraInbox();
  showToast("Eintrag geloescht");
}

function upsertCategoryFromLink(name) {
  return upsertCategory(state, name, createId);
}

const categoryDialog = createCategoryDialogController({
  elements,
  state,
  createId,
  saveData,
  showToast
});

function openCategoriesDialog() {
  if (!canEdit()) return openAdminDialog();
  categoryDialog.open();
}

function addCategory() {
  categoryDialog.add();
}

function saveCategories() {
  return categoryDialog.save();
}

function selectedLinkCategory() {
  if (elements.linkCategory.value !== "__new_category__") return elements.linkCategory.value.trim() || "Links";
  return upsertCategoryFromLink(elements.newLinkCategory.value);
}

function chooseLinkCategory(categoryName) {
  const name = String(categoryName || "").trim();
  if (!name) return;
  const existing = getCategoryNames().find((category) => category.toLowerCase() === name.toLowerCase());
  if (existing) {
    elements.linkCategory.value = existing;
    renderNewLinkCategory();
    return;
  }
  elements.linkCategory.value = "__new_category__";
  elements.newLinkCategory.value = name;
  renderNewLinkCategory();
}

async function saveLink() {
  if (!elements.linkForm.reportValidity()) return;
  const url = normalizeUrl(elements.linkUrl.value);
  const link = {
    id: elements.linkId.value || createId(),
    title: elements.linkTitle.value.trim() || titleFromUrl(url),
    url,
    category: selectedLinkCategory(),
    note: elements.linkNote.value.trim()
  };
  const existingIndex = state.links.findIndex((candidate) => candidate.id === link.id);
  if (existingIndex >= 0) state.links.splice(existingIndex, 1, link);
  else state.links.push(link);
  await saveData("Link gespeichert");
  elements.editorDialog.close();
  loadStatus().catch(() => {});
}

function scheduleLinkMetadataLookup() {
  window.clearTimeout(linkMetadataTimer);
  if (!elements.editorDialog.open || elements.linkId.value) return;
  linkMetadataTimer = window.setTimeout(() => lookupLinkMetadata().catch((error) => {
    if (error.name !== "AbortError") setLinkStatus("bad", "Keine Seitendaten");
  }), 650);
}

async function lookupLinkMetadata() {
  const url = normalizeUrl(elements.linkUrl.value || "");
  if (!url || !parseHttpLink(url)) return;
  linkMetadataAbort?.abort();
  linkMetadataAbort = new AbortController();
  setLinkStatus("checking", "Hole Titel...");
  const response = await fetch(`/api/link-metadata?url=${encodeURIComponent(url)}`, { signal: linkMetadataAbort.signal });
  const metadata = await response.json();
  if (metadata.title && (elements.linkTitle.dataset.autoTitle === "true" || !elements.linkTitle.value.trim())) {
    elements.linkTitle.value = metadata.title;
    elements.linkTitle.dataset.autoTitle = "true";
  }
  if (metadata.suggestedCategory && elements.linkCategory.dataset.autoCategory === "true") {
    chooseLinkCategory(metadata.suggestedCategory);
  }
  if (!metadata.title) {
    setLinkStatus("bad", metadata.message || "Titel nicht gefunden");
    return;
  }
  setLinkStatus(metadata.message ? "idle" : "good", metadata.suggestedCategory ? `Vorschlag: ${metadata.suggestedCategory}` : "Titel gefunden");
}

async function deleteLink() {
  state.links = state.links.filter((link) => link.id !== elements.linkId.value);
  await saveData("Link gelöscht");
  elements.editorDialog.close();
}

async function testLink() {
  const url = normalizeUrl(elements.linkUrl.value || "");
  if (!url) return setLinkStatus("bad", "Keine URL");
  setLinkStatus("idle", "Teste...");
  const response = await fetch(`/api/link-status?url=${encodeURIComponent(url)}`);
  const result = await response.json();
  setLinkStatus(result.ok ? "good" : "bad", result.ok ? `OK ${result.status}` : `Fehler ${result.status || ""}`.trim());
}

function setLinkStatus(kind, text) {
  elements.linkStatus.className = `status-pill is-${kind}`;
  elements.linkStatus.textContent = text;
}

function parseHttpLink(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function titleFromUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.hostname.replace(/^www\./i, "").split(".")[0] || "Link";
  } catch {
    return "Link";
  }
}

async function saveSettings() {
  if (!elements.settingsForm.reportValidity()) return;
  state.title = elements.settingsTitle.value.trim();
  state.subtitle = elements.settingsSubtitle.value.trim();
  state.theme = elements.themeSelect.value || "retro";
  state.preferences = {
    ...(state.preferences || {}),
    showCategoryCounts: elements.settingShowCategoryCounts.checked,
    compactCategoryLayout: elements.settingCompactCategoryLayout.checked,
    showLinkStatus: elements.settingShowLinkStatus.checked,
    showNotes: elements.settingShowNotes.checked,
    showZoraInbox: elements.settingShowZoraInbox.checked,
    openLinksInNewTab: elements.settingOpenLinksInNewTab.checked,
    startpageMode: elements.settingStartpageMode.checked,
    shareMode: elements.settingShareMode.checked
  };
  state.widgets = collectWidgetSettings();
  await saveData("Einstellungen gespeichert");
  elements.settingsDialog.close();
  loadWeather().catch(() => {});
  loadZoraInbox().catch(() => {});
}

function collectWidgetSettings() {
  const widgets = { ...(state.widgets || {}) };
  widgetSettingsRegistry.forEach((widget) => widget.save(widgets));
  return widgets;
}

function openProfileDialog() {
  if (!canEdit()) return openAdminDialog();
  elements.profileName.value = "";
  elements.profileDialog.showModal();
}

async function saveProfile() {
  const name = elements.profileName.value.trim();
  if (!name) return;
  const id = createId();
  state.profiles.push({ id, name, categories: [{ id: createId(), name: "Links", icon: "link", color: "#35f0ff", visible: true }], links: [], statusTargets: [] });
  state.activeProfileId = id;
  syncActiveProfileAliases();
  await saveData("Profil erstellt");
  elements.profileDialog.close();
}

async function deleteProfile() {
  if (!canEdit() || state.profiles.length <= 1) return;
  const current = activeProfile();
  if (!window.confirm(`Profil "${current.name}" wirklich löschen?`)) return;
  state.profiles = state.profiles.filter((profile) => profile.id !== current.id);
  state.activeProfileId = state.profiles[0].id;
  syncActiveProfileAliases();
  await saveData("Profil gelöscht");
}

async function createDemoProfile() {
  if (!canEdit()) return openAdminDialog();
  const existing = state.profiles.find((profile) => profile.id === "demo");
  if (existing && !window.confirm("Demo-Profil neu erstellen und vorhandene Demo-Daten ersetzen?")) return;
  const demoProfile = {
    id: "demo",
    name: "Demo",
    categories: [
      { id: createId(), name: "Business", icon: "briefcase", color: "#ffb238", visible: true },
      { id: createId(), name: "Gameserver", icon: "game", color: "#56ff8f", visible: true },
      { id: createId(), name: "Netzwerk", icon: "network", color: "#35f0ff", visible: true },
      { id: createId(), name: "Medien", icon: "media", color: "#4aa8ff", visible: true }
    ],
    statusTargets: [
      { id: createId(), name: "AMP Panel", enabled: true, type: "basic", url: "https://example.com/amp", statusPath: "" }
    ],
    links: [
      createDemoLink("Rechnungstool", "https://example.com/business", "Business", "Demo-Link ohne private Daten"),
      createDemoLink("AMP Panel", "https://example.com/amp", "Gameserver", "Status-Widget kann hier gepflegt werden"),
      createDemoLink("Router", "https://example.com/router", "Netzwerk", ""),
      createDemoLink("Medienserver", "https://example.com/media", "Medien", "")
    ]
  };
  state.profiles = state.profiles.filter((profile) => profile.id !== "demo");
  state.profiles.push(demoProfile);
  state.activeProfileId = "demo";
  syncActiveProfileAliases();
  await saveData("Demo-Profil erstellt");
  elements.settingsDialog.close();
}

function createDemoLink(title, url, category, note) {
  return {
    id: createId(),
    title,
    url,
    category,
    note
  };
}

function openImportDialog(mode = "json") {
  if (!canEdit()) return openAdminDialog();
  const config = {
    json: {
      title: "Importieren",
      button: "Importieren",
      accept: "application/json,.json",
      placeholder: "{\"profiles\":[...]}"
    },
    restore: {
      title: "Backup wiederherstellen",
      button: "Wiederherstellen",
      accept: "application/json,.json",
      placeholder: "{\"profiles\":[...]}"
    },
    bookmarks: {
      title: "Browser-Bookmarks importieren",
      button: "Bookmarks importieren",
      accept: "text/html,.html,.htm",
      placeholder: "<!DOCTYPE NETSCAPE-Bookmark-file-1>"
    }
  }[mode] || {};
  elements.importMode.value = mode;
  elements.importDialogTitle.textContent = config.title || "Importieren";
  elements.importFile.accept = config.accept || "application/json,.json";
  elements.importText.placeholder = config.placeholder || "";
  elements.runImportButton.textContent = config.button || "Importieren";
  elements.importFile.value = "";
  elements.importText.value = "";
  elements.importDialog.showModal();
}

function downloadBackup() {
  if (!canEdit()) return openAdminDialog();
  const link = document.createElement("a");
  link.href = "/api/homedash/export";
  link.download = "homedash.json";
  document.body.append(link);
  link.click();
  link.remove();
}

async function runImport() {
  let text = elements.importText.value.trim();
  if (!text && elements.importFile.files[0]) text = await elements.importFile.files[0].text();
  const mode = elements.importMode.value || "json";
  if (!text) return showToast(mode === "bookmarks" ? "Keine Bookmark-Daten" : "Keine JSON-Daten");
  if (mode === "bookmarks") {
    const count = await importBookmarks(text);
    elements.importDialog.close();
    showToast(`${count} Bookmarks importiert`);
    return;
  }
  if (mode === "restore" && !window.confirm("Backup wirklich wiederherstellen? Die aktuelle Konfiguration wird ersetzt.")) return;
  const response = await fetch("/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: text
  });
  if (!response.ok) throw new Error((await response.json()).error || "Import fehlgeschlagen");
  Object.assign(state, await response.json());
  syncActiveProfileAliases();
  render();
  elements.importDialog.close();
  showToast("Importiert");
}

async function importBookmarks(html) {
  const bookmarks = parseBookmarkHtml(html);
  if (!bookmarks.length) throw new Error("Keine Bookmarks gefunden");
  const knownCategories = new Set(getCategoryNames());
  const knownLinks = new Set(state.links.map((link) => `${normalizeUrl(link.url)}::${normalizeMatchText(link.title)}`));
  const nextLinks = [];
  for (const bookmark of bookmarks) {
    const title = bookmark.title.trim();
    const url = normalizeUrl(bookmark.url);
    const category = bookmark.category || "Bookmarks";
    if (!title || !url) continue;
    const key = `${url}::${normalizeMatchText(title)}`;
    if (knownLinks.has(key)) continue;
    knownLinks.add(key);
    knownCategories.add(category);
    nextLinks.push({
      id: createId(),
      title,
      url,
      category,
      note: ""
    });
  }
  if (!nextLinks.length) throw new Error("Keine neuen Bookmarks gefunden");
  state.categories = [...knownCategories].map((name) => {
    const existing = state.categories.find((category) => category.name === name);
    return existing || { id: createId(), name, icon: "link", color: categoryColors[state.categories.length % categoryColors.length], visible: true };
  }).sort((a, b) => compareNames(a.name, b.name));
  state.links = [...state.links, ...nextLinks];
  await saveData("Bookmarks importiert");
  return nextLinks.length;
}

function parseBookmarkHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const root = doc.querySelector("dl") || doc.body;
  const bookmarks = [];
  const visit = (node, category = "Bookmarks") => {
    let child = node.firstElementChild;
    while (child) {
      if (child.tagName === "DT") {
        const heading = child.querySelector(":scope > h3");
        const link = child.querySelector(":scope > a");
        if (heading) {
          const nextCategory = heading.textContent.trim() || category;
          const nested = child.querySelector(":scope > dl") || (child.nextElementSibling?.tagName === "DL" ? child.nextElementSibling : null);
          if (nested) visit(nested, nextCategory);
        } else if (link) {
          const href = link.getAttribute("href") || "";
          if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) {
            bookmarks.push({ title: link.textContent || href, url: href, category });
          }
        }
      } else if (child.tagName === "DL") {
        visit(child, category);
      }
      child = child.nextElementSibling;
    }
  };
  visit(root);
  return bookmarks;
}

async function completeSetup() {
  if (!elements.setupForm.reportValidity()) return;
  const response = await fetch("/api/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: elements.setupTitle.value.trim(),
      profileName: elements.setupProfileName.value.trim(),
      password: elements.setupPassword.value,
      categories: ["Links"],
      theme: state.theme || "retro"
    })
  });
  if (!response.ok) throw new Error((await response.json()).error || "Setup fehlgeschlagen");
  Object.assign(state, await response.json());
  state.auth = { ...(state.auth || {}), authenticated: true };
  syncActiveProfileAliases();
  render();
  elements.setupDialog.close();
  showToast("Homedash eingerichtet");
}

async function toggleAdmin() {
  if (state.auth?.enabled && state.auth?.authenticated) {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    state.auth = await response.json();
    await loadData();
    showToast("Admin gesperrt");
    return;
  }
  openAdminDialog();
}

async function toggleAdminShortcut() {
  if (state.auth?.enabled && state.auth?.authenticated) {
    await toggleAdmin();
    return;
  }
  const response = await fetch("/api/auth/shortcut", { method: "POST" });
  if (!response.ok) throw new Error("Admin-Shortcut fehlgeschlagen");
  state.auth = await response.json();
  await loadData();
  showToast("Admin per Shortcut entsperrt");
}

function openAdminDialog() {
  if (!state.auth?.enabled) return;
  elements.adminPassword.value = "";
  elements.adminDialog.showModal();
}

async function submitAdmin() {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: elements.adminPassword.value })
  });
  if (!response.ok) throw new Error("Passwort stimmt nicht");
  state.auth = await response.json();
  elements.adminDialog.close();
  await loadData();
  showToast("Admin entsperrt");
}

function normalizeUrl(url) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.setTimeout(() => elements.toast.classList.remove("show"), 1600);
}

function openCommandPalette() {
  elements.commandInput.value = state.query || "";
  renderCommandResults();
  elements.commandDialog.showModal();
  window.requestAnimationFrame(() => elements.commandInput.focus());
}

function renderCommandResults() {
  const query = elements.commandInput.value.trim();
  const results = getCommandResults(query);
  if (!results.length) {
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent = query ? "Keine Treffer" : "Tippe, um Links zu suchen";
    elements.commandResults.replaceChildren(empty);
    return;
  }
  elements.commandResults.replaceChildren(...results.map((result, index) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "command-result";
    row.dataset.index = String(index);
    const title = document.createElement("strong");
    title.textContent = result.title;
    const meta = document.createElement("span");
    meta.textContent = result.meta;
    row.append(title, meta);
    row.addEventListener("click", () => activateCommandResult(result));
    return row;
  }));
}

function getCommandResults(query) {
  const normalized = query.toLowerCase();
  const matches = state.links
    .filter((link) => {
      const haystack = `${link.title} ${link.category} ${link.note}`.toLowerCase();
      return !normalized || haystack.includes(normalized);
    })
    .slice()
    .sort((a, b) => compareNames(a.title, b.title))
    .slice(0, 8)
    .map((link) => ({ type: "link", title: link.title, meta: link.category || "Link", url: link.url }));
  if (!normalized) return matches;
  const categories = getCategoryNames()
    .filter((category) => category.toLowerCase().includes(normalized))
    .slice(0, 4)
    .map((category) => ({ type: "category", title: category, meta: "Kategorie" }));
  const notes = getNotes()
    .filter((note) => note.text.toLowerCase().includes(normalized))
    .slice(0, 3)
    .map((note) => ({ type: "note", title: note.text.slice(0, 70), meta: "Notiz" }));
  return [...matches, ...categories, ...notes].slice(0, 9);
}

function activateCommandResult(result) {
  if (result.type === "link" && result.url) {
    const target = state.preferences?.openLinksInNewTab === false ? "_self" : "_blank";
    window.open(result.url, target, target === "_blank" ? "noopener,noreferrer" : undefined);
  } else {
    state.query = result.title;
    elements.search.value = result.title;
    renderSearch();
    renderGroups();
  }
  elements.commandDialog.close();
}

elements.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderGroups();
});
elements.search.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
});
elements.addButton.addEventListener("click", () => openLinkDialog());
elements.addWidgetButton.addEventListener("click", () => openStatusWidgetDialog());
elements.settingsButton.addEventListener("click", openSettingsDialog);
elements.newNoteButton.addEventListener("click", openNoteComposer);
elements.newZoraInboxButton.addEventListener("click", openZoraInboxComposer);
elements.settingsCategoriesButton.addEventListener("click", () => {
  elements.settingsDialog.close();
  openCategoriesDialog();
});
elements.settingsImportButton.addEventListener("click", () => {
  elements.settingsDialog.close();
  openImportDialog("json");
});
elements.settingsBookmarkImportButton.addEventListener("click", () => {
  elements.settingsDialog.close();
  openImportDialog("bookmarks");
});
elements.createDemoButton.addEventListener("click", () => createDemoProfile().catch((error) => showToast(error.message)));
elements.settingShowWeatherWidget.addEventListener("change", renderWeatherSettings);
elements.settingShowDateWidget.addEventListener("change", renderDateSettings);
elements.addDateCountdownButton.addEventListener("click", () => {
  dateCountdownDrafts.push({ id: createId(), label: "", date: "" });
  renderDateCountdownEditor();
});
elements.settingsBackupButton.addEventListener("click", downloadBackup);
elements.settingsRestoreButton.addEventListener("click", () => {
  elements.settingsDialog.close();
  openImportDialog("restore");
});
elements.refreshStatusButton.addEventListener("click", () => loadStatus().catch((error) => showToast(error.message)));
elements.refreshWeatherButton.addEventListener("click", () => loadWeather().catch((error) => showToast(error.message)));
elements.adminButton.addEventListener("click", () => toggleAdmin().catch((error) => showToast(error.message)));
elements.saveLinkButton.addEventListener("click", () => saveLink().catch((error) => showToast(error.message)));
elements.linkForm.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  saveLink().catch((error) => showToast(error.message));
});
elements.deleteButton.addEventListener("click", () => deleteLink().catch((error) => showToast(error.message)));
elements.testLinkButton.addEventListener("click", () => testLink().catch((error) => setLinkStatus("bad", error.message)));
elements.linkUrl.addEventListener("input", scheduleLinkMetadataLookup);
elements.linkUrl.addEventListener("blur", () => lookupLinkMetadata().catch((error) => {
  if (error.name !== "AbortError") setLinkStatus("bad", "Keine Seitendaten");
}));
elements.linkTitle.addEventListener("input", () => {
  elements.linkTitle.dataset.autoTitle = "false";
});
elements.linkCategory.addEventListener("change", () => {
  elements.linkCategory.dataset.autoCategory = "false";
  renderNewLinkCategory();
  if (elements.linkCategory.value === "__new_category__") elements.newLinkCategory.focus();
});
elements.linkStatusEnabled.addEventListener("change", renderLinkStatusFields);
elements.linkStatusType.addEventListener("change", renderLinkStatusFields);
elements.toggleSecretFieldsButton.addEventListener("click", toggleSecretFields);
elements.saveStatusTargetButton.addEventListener("click", () => saveStatusTarget().catch((error) => showToast(error.message)));
elements.statusWidgetForm.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  saveStatusTarget().catch((error) => showToast(error.message));
});
elements.deleteStatusTargetButton.addEventListener("click", () => deleteStatusTarget().catch((error) => showToast(error.message)));
elements.saveSettingsButton.addEventListener("click", () => saveSettings().catch((error) => showToast(error.message)));
elements.addCategoryButton.addEventListener("click", addCategory);
elements.saveCategoriesButton.addEventListener("click", () => saveCategories().catch((error) => showToast(error.message)));
elements.categoriesForm.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  saveCategories().catch((error) => showToast(error.message));
});
elements.newProfileButton.addEventListener("click", openProfileDialog);
elements.saveProfileButton.addEventListener("click", () => saveProfile().catch((error) => showToast(error.message)));
elements.deleteProfileButton.addEventListener("click", () => deleteProfile().catch((error) => showToast(error.message)));
elements.profileSelect.addEventListener("change", async (event) => {
  state.activeProfileId = event.target.value;
  syncActiveProfileAliases();
  await saveData("Profil gewechselt");
});
elements.addNoteButton.addEventListener("click", async () => {
  if (!canEdit()) return openAdminDialog();
  const text = elements.noteInput.value.trim();
  if (!text) return;
  state.widgets.notes = [...getNotes(), { id: createId(), text }];
  delete state.widgets.quickNote;
  state.noteComposerOpen = false;
  elements.noteInput.value = "";
  await saveData("Notiz gespeichert");
});
elements.addZoraInboxButton.addEventListener("click", () => saveZoraInboxNote().catch((error) => showToast(error.message)));
elements.refreshZoraInboxButton.addEventListener("click", () => loadZoraInbox().catch((error) => showToast(error.message)));
elements.zoraInboxInput.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    saveZoraInboxNote().catch((error) => showToast(error.message));
  }
});
elements.runImportButton.addEventListener("click", () => runImport().catch((error) => showToast(error.message)));
elements.completeSetupButton.addEventListener("click", () => completeSetup().catch((error) => showToast(error.message)));
elements.adminSubmitButton.addEventListener("click", () => submitAdmin().catch((error) => showToast(error.message)));
elements.commandInput.addEventListener("input", renderCommandResults);
elements.commandForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const first = getCommandResults(elements.commandInput.value.trim())[0];
  if (first) activateCommandResult(first);
});
document.addEventListener("keydown", (event) => {
  const target = event.target;
  const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
  const openDialog = document.querySelector("dialog[open]");
  if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "l") {
    event.preventDefault();
    toggleAdminShortcut().catch((error) => showToast(error.message));
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (!openDialog || openDialog === elements.commandDialog) openCommandPalette();
    return;
  }
  if (event.key === "/" && !isTyping && !openDialog) {
    event.preventDefault();
    renderSearch();
    elements.search.focus();
  }
});
window.addEventListener("resize", () => {
  if (state.preferences?.compactCategoryLayout !== true) return;
  window.clearTimeout(compactLayoutTimer);
  compactLayoutTimer = window.setTimeout(renderGroups, 120);
});

updateClock();
window.setInterval(updateClock, 1000);
window.setInterval(() => loadStatus().catch(() => {}), 60000);
window.setInterval(() => loadWeather().catch(() => {}), 15 * 60 * 1000);
loadData().catch((error) => showToast(error.message));
