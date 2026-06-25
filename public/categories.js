export const categoryColors = ["#35f0ff", "#56ff8f", "#ffb238", "#ff4f7a", "#c471ff", "#4aa8ff", "#ff6f3c"];

export function compareCategoryNames(a, b) {
  return String(a).localeCompare(String(b), "de", { sensitivity: "base" });
}

export function getCategoryNames(state) {
  const seen = new Set();
  const names = [];
  for (const category of state.categories || []) {
    const name = String(category.name || "").trim();
    if (name && !seen.has(name)) {
      names.push(name);
      seen.add(name);
    }
  }
  for (const link of state.links || []) {
    if (link.category && !seen.has(link.category)) {
      names.push(link.category);
      seen.add(link.category);
    }
  }
  return names.sort(compareCategoryNames);
}

export function normalizeColor(color) {
  const value = String(color || "").trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#35f0ff";
}

export function getCategoryMeta(state, name) {
  const category = (state.categories || []).find((candidate) => candidate.name === name) || {};
  return {
    icon: category.icon || "link",
    color: normalizeColor(category.color || "#35f0ff"),
    visible: category.visible !== false
  };
}

export function isCategoryVisible(state, name) {
  return getCategoryMeta(state, name).visible !== false;
}

export function upsertCategory(state, name, createId) {
  const categoryName = String(name || "").trim();
  if (!categoryName) return "Links";
  const existing = (state.categories || []).find((category) => category.name.toLowerCase() === categoryName.toLowerCase());
  if (existing) return existing.name;
  state.categories.push({
    id: createId(),
    name: categoryName,
    icon: "link",
    color: categoryColors[state.categories.length % categoryColors.length],
    visible: true
  });
  state.categories.sort(compareCategoryNames);
  return categoryName;
}

export function createCategoryDialogController({
  elements,
  state,
  createId,
  saveData,
  showToast
}) {
  let categoryDrafts = [];

  function open() {
    categoryDrafts = getCategoryNames(state).map((name) => {
      const category = state.categories.find((candidate) => candidate.name === name);
      return {
        id: category?.id || createId(),
        originalName: name,
        name,
        icon: category?.icon || "link",
        color: normalizeColor(category?.color || "#35f0ff"),
        visible: category?.visible !== false
      };
    });
    render();
    elements.categoriesDialog.showModal();
  }

  function render(focusId = "") {
    elements.categoryEditor.replaceChildren(
      ...categoryDrafts.sort((a, b) => compareCategoryNames(a.name, b.name)).map((category) => createCategoryRow(category, focusId))
    );
  }

  function createCategoryRow(category, focusId) {
    const row = document.createElement("div");
    row.className = "category-row";
    const input = document.createElement("input");
    input.value = category.name;
    input.maxLength = 40;
    input.placeholder = "Neue Kategorie";
    input.ariaLabel = "Kategoriename";
    input.addEventListener("input", (event) => {
      category.name = event.target.value;
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        save().catch((error) => showToast(error.message));
      }
    });

    const color = document.createElement("input");
    color.type = "color";
    color.value = normalizeColor(category.color || "#35f0ff");
    color.ariaLabel = "Kategorie-Farbe";
    color.addEventListener("input", (event) => {
      category.color = event.target.value;
    });

    const visibleLabel = document.createElement("label");
    visibleLabel.className = "category-visible";
    const visible = document.createElement("input");
    visible.type = "checkbox";
    visible.checked = category.visible !== false;
    visible.addEventListener("change", (event) => {
      category.visible = event.target.checked;
    });
    const visibleText = document.createElement("span");
    visibleText.textContent = "Anzeigen";
    visibleLabel.append(visible, visibleText);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger subtle-danger";
    remove.textContent = "Löschen";
    remove.addEventListener("click", () => {
      categoryDrafts = categoryDrafts.filter((candidate) => candidate.id !== category.id);
      render();
    });

    row.append(input, color, visibleLabel, remove);
    if (category.id === focusId) {
      window.requestAnimationFrame(() => {
        input.focus();
        input.select();
      });
    }
    return row;
  }

  function add() {
    const id = createId();
    categoryDrafts.push({
      id,
      originalName: "",
      name: "",
      icon: "link",
      color: categoryColors[categoryDrafts.length % categoryColors.length],
      visible: true
    });
    render(id);
  }

  async function save() {
    const seen = new Set();
    const nextCategories = categoryDrafts
      .map((category) => ({
        id: category.id || createId(),
        originalName: category.originalName,
        name: category.name.trim(),
        icon: category.icon || "link",
        color: normalizeColor(category.color),
        visible: category.visible !== false
      }))
      .filter((category) => {
        if (!category.name || seen.has(category.name)) return false;
        seen.add(category.name);
        return true;
      });
    const renames = new Map();
    for (const category of nextCategories) {
      if (category.originalName && category.originalName !== category.name) renames.set(category.originalName, category.name);
    }
    const nextNames = new Set(nextCategories.map((category) => category.name));
    state.links = state.links.map((link) => {
      if (renames.has(link.category)) return { ...link, category: renames.get(link.category) };
      if (!nextNames.has(link.category)) return { ...link, category: "Links" };
      return link;
    });
    if (state.links.some((link) => link.category === "Links") && !nextNames.has("Links")) {
      nextCategories.push({ id: createId(), name: "Links", icon: "link", color: "#35f0ff", visible: true });
    }
    state.categories = nextCategories
      .map(({ id, name, icon, color, visible }) => ({ id, name, icon, color, visible }))
      .sort((a, b) => compareCategoryNames(a.name, b.name));
    await saveData("Kategorien gespeichert");
    elements.categoriesDialog.close();
  }

  return {
    add,
    open,
    save
  };
}
