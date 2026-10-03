/* ============================================================================
   VIRGINIA TECH MASTER DENDROLOGY ENGINE — app.js
   Purpose: Entire quiz logic – data loading, settings, species picker,
            game loop, leaderboard, image loading, timer.
   Sections (search for these banners to jump to a feature):
     1. CONFIG & GLOBAL STATE
     2. INIT / BOOTSTRAP
     3. DATABASE LOADER
     4. DOM CACHE
     5. FUZZY SEARCH & SPECIES PICKER MODAL
     6. CLOUDFLARE PRESETS
     7. QUIZ SETTINGS SIDEBAR & CONTROLS
     8. GAME LIFECYCLE (launch / showQuestion / answer / next / end)
     9. LEADERBOARD
    10. TIMER
    11. IMAGE LOADER & RESIZER
============================================================================ */

/* --------------------------------------------------------------------------
   1. CONFIG & GLOBAL STATE
   Constants and mutable state shared across the whole app.
   -------------------------------------------------------------------------- */

/** Public R2 base for diagnostic photos (used by loadPhoto) */
const CLOUDFLARE_R2_BASE = "https://pub-7c8f1ea1e424248a09ee567dfbcdedf.r2.dev";
/** Cloudflare Worker that stores leaderboard + presets in KV */
/* v1.0.7.M – corrected Worker URL */
const WORKER_API = "https://quiz-api.jonathantate-ent.workers.dev";

/**
 * Available species databases. Each entry lists JSON files to try (first
 * success wins) and an optional bud-scan map (Spinzam URLs keyed by id).
 * Files are expected next to index.html (or under data/).
 */
const DATABASES = {
  vt: {
    label: "VT Dendrology",
    files: ["./VTDendroSpecies.json", "./species.json"],
    budScan: "./VTBudScan.json"
  },
  osu: {
    label: "OSU",
    files: ["./OSUspecies.json"]
  },
  arborday: {
    label: "Arbor Day",
    files: ["./Arbor_DaySpecies.json"]
  },
  /* v1.0.5.M – iNaturalist live API option */
  inat: {
    label: "iNaturalist (live)",
    type: "api",
    files: []
  }
};

let currentDatabase = "vt";          // primary label for status text
let masterSpecies = [];              // full list after normalize
let activeSpeciesPool = [];          // subset currently selected for quizzes
let selectedIds = new Set();         // ids checked in the picker
let filteredSpecies = [];            // current search results
let fuseInstance = null;             // Fuse.js instance for fuzzy search
let budScanMap = {};                 // id → Spinzam embed URL

/* v1.0.9.M – database priority (top first). enabled flags + order persisted */
let dbPriority = [
  { key: "vt", enabled: true },
  { key: "osu", enabled: false },
  { key: "arborday", enabled: false },
  { key: "inat", enabled: false }
];

/* v1.0.9.M – active cloud preset being edited + per-preset common-name overrides */
let activePresetId = null;
let activePresetMeta = null;         // { id, title, author, species, aliases }
let presetAliases = {};              // id → common name override for active preset
let cloudPresetsCache = [];          // last fetched preset list

/** Tiny offline fallback if no JSON files load */
const FALLBACK_SCI = [
  "acer rubrum","acer saccharum","quercus alba","pinus strobus","fagus grandifolia"
];

/* --- Quiz configuration (mutated by Settings sidebar) --- */
let TIME_LIMIT = 15;                 // seconds per question
let TOTAL = 10;                     // questions per run
let NUM_CHOICES = 4;                 // multiple-choice options
let playerName = '';
let isGuest = false;

let selectedModes = ['sci-to-common']; // active quiz modes (can be multi)
let selectedStyles = ['quiz'];         // 'quiz' | 'typing'
let currentMode = 'sci-to-common';     // mode chosen for the current question
let typeAnswerMode = false;            // true when current Q is typing style

/* --- Per-round state --- */
let score = 0;
let streak = 0;
let qIndex = 0;
let currentCorrect = '';             // the correct answer string for this Q
let questions = [];                  // shuffled slice of activeSpeciesPool
let timerId = null;
let timeLeft = TIME_LIMIT;
let answered = false;
let hintUsedThisQ = false;

/* --- Cached DOM nodes (filled by cacheDOM) --- */
let startScreen, quizScreen, endScreen, stats, promptEl, promptLabel;
let optionsEl, feedback, nextBtn, progressBar, timerBar, timerText, speciesImg;
let imgPlaceholder, imgLoading, spinBtn, settingsSidebar, sidebarBackdrop;

/* --------------------------------------------------------------------------
   2. INIT / BOOTSTRAP
   Entry point: wire everything, load default DB, fetch leaderboard.
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', initApplication);

async function initApplication() {
  cacheDOM();
  loadDbPriorityFromStorage();
  initSidebar();
  initQuizControls();
  initSpeciesModal();
  initImageResizer();
  initDbPriorityUI();
  initAliasModal();
  
  // Non-blocking leaderboard fetch (failure is fine – user can still play)
  fetchGlobalLeaderboard().catch(() => {});

  // Load databases in priority order (merged)
  await reloadFromPriority();
  fetchCloudPresets().catch(() => {});
}

/* --------------------------------------------------------------------------
   3. DATABASE LOADER + PRIORITY LIST (v1.0.9.M)
   Merges enabled sources in priority order (first wins on same scientific name).
   -------------------------------------------------------------------------- */

function loadDbPriorityFromStorage() {
  try {
    const raw = localStorage.getItem("dendro_db_priority");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) dbPriority = parsed;
    }
  } catch (e) {}
}

function saveDbPriorityToStorage() {
  try {
    localStorage.setItem("dendro_db_priority", JSON.stringify(dbPriority));
  } catch (e) {}
}

/* v1.0.11.M – reorderable priority: top = first source pulled */
function initDbPriorityUI() {
  renderDbPriorityList();
}

function renderDbPriorityList() {
  const list = document.getElementById("dbPriorityList");
  if (!list) return;
  list.innerHTML = "";
  dbPriority.forEach((entry, idx) => {
    const db = DATABASES[entry.key];
    if (!db) return;
    const row = document.createElement("div");
    row.className = "db-priority-row";
    row.draggable = true;
    row.dataset.idx = String(idx);
    row.innerHTML = `
      <span class="db-handle" title="Drag to reorder">⠿</span>
      <span class="db-rank">${idx + 1}</span>
      <input type="checkbox" data-key="${entry.key}" ${entry.enabled ? "checked" : ""} title="Include this source">
      <span class="db-label">${db.label}</span>
      <button type="button" class="db-move" data-dir="up" data-idx="${idx}" ${idx === 0 ? "disabled" : ""}>▲</button>
      <button type="button" class="db-move" data-dir="down" data-idx="${idx}" ${idx === dbPriority.length - 1 ? "disabled" : ""}>▼</button>
    `;
    row.querySelector('input[type="checkbox"]').addEventListener("change", async (e) => {
      entry.enabled = e.target.checked;
      saveDbPriorityToStorage();
      await reloadFromPriority();
    });
    row.querySelectorAll(".db-move").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const i = parseInt(btn.dataset.idx, 10);
        const dir = btn.dataset.dir;
        const j = dir === "up" ? i - 1 : i + 1;
        if (j < 0 || j >= dbPriority.length) return;
        const tmp = dbPriority[i];
        dbPriority[i] = dbPriority[j];
        dbPriority[j] = tmp;
        saveDbPriorityToStorage();
        renderDbPriorityList();
        await reloadFromPriority();
      });
    });
    row.addEventListener("dragstart", (e) => {
      row.classList.add("dragging");
      e.dataTransfer.setData("text/plain", String(idx));
      e.dataTransfer.effectAllowed = "move";
    });
    row.addEventListener("dragend", () => row.classList.remove("dragging"));
    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      row.classList.add("drag-over");
    });
    row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
    row.addEventListener("drop", async (e) => {
      e.preventDefault();
      row.classList.remove("drag-over");
      const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
      const to = idx;
      if (Number.isNaN(from) || from === to) return;
      const item = dbPriority.splice(from, 1)[0];
      dbPriority.splice(to, 0, item);
      saveDbPriorityToStorage();
      renderDbPriorityList();
      await reloadFromPriority();
    });
    list.appendChild(row);
  });
}

function normalizeRecord(item, idx, sourceKey, localBudMap) {
  const scientific = (item.scientific || "").trim();
  const common = (item.common || "").trim();
  if (!scientific && !common) return null;
  if (sourceKey === "arborday" && !scientific) return null;

  const id = item.id !== undefined ? String(item.id)
           : item.vtId !== undefined ? String(item.vtId)
           : item.arborday_id !== undefined ? String(item.arborday_id)
           : `${sourceKey}-${idx + 1}`;

  let spinzam = item.spinzam_url || null;
  if (!spinzam && localBudMap[id]) spinzam = localBudMap[id];
  if (!spinzam && item.vtId && localBudMap[String(item.vtId)]) {
    spinzam = localBudMap[String(item.vtId)];
  }

  return {
    id,
    common: common || scientific || "Unknown",
    scientific: scientific || common || "Unknown Species",
    family: item.family || item.family_modern || (item.familyNum ? `Family #${item.familyNum}` : "Unknown"),
    spinzam_url: spinzam,
    source: sourceKey
  };
}

async function fetchRawForDb(dbKey) {
  const db = DATABASES[dbKey];
  if (!db) return { rows: [], bud: {} };
  if (db.type === "api") return { rows: [], bud: {} }; // iNaturalist = photos only for now

  let rawData = null;
  for (const path of (db.files || [])) {
    try {
      const res = await fetch(path);
      if (res.ok) {
        rawData = await res.json();
        break;
      }
    } catch (e) {
      console.warn("Failed to load", path, e);
    }
  }

  let bud = {};
  if (db.budScan) {
    try {
      const res = await fetch(db.budScan);
      if (res.ok) bud = await res.json();
    } catch (e) {}
  }
  return { rows: Array.isArray(rawData) ? rawData : [], bud };
}

async function reloadFromPriority() {
  const note = document.getElementById("dbStatusNote");
  if (note) note.textContent = "Loading databases by priority…";

  const merged = new Map(); // scientific lower → record (first wins)
  const idSeen = new Set();
  budScanMap = {};
  const enabledKeys = dbPriority.filter(e => e.enabled).map(e => e.key);
  if (!enabledKeys.length) {
    enabledKeys.push("vt");
  }

  for (const key of enabledKeys) {
    const { rows, bud } = await fetchRawForDb(key);
    Object.assign(budScanMap, bud);
    rows.forEach((item, idx) => {
      const rec = normalizeRecord(item, idx, key, bud);
      if (!rec) return;
      const sciKey = rec.scientific.toLowerCase();
      if (merged.has(sciKey)) return; // higher priority already claimed
      // ensure unique id across sources
      let id = rec.id;
      if (idSeen.has(id)) id = `${key}-${id}`;
      idSeen.add(id);
      rec.id = id;
      merged.set(sciKey, rec);
    });
  }

  masterSpecies = Array.from(merged.values());

  if (!masterSpecies.length) {
    masterSpecies = FALLBACK_SCI.map((s, i) => ({
      id: String(i + 1),
      common: s.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      scientific: s,
      family: "Unknown",
      spinzam_url: null,
      source: "fallback"
    }));
  }

  // Apply active preset aliases to display names
  applyAliasesToMaster();

  /* v1.0.12.M – keep prior selection when possible; warn if species missing from DBs */
  const prevSelected = selectedIds.size ? new Set(selectedIds) : null;
  const masterIdSet = new Set(masterSpecies.map(sp => sp.id));

  if (prevSelected && prevSelected.size) {
    const stillThere = [...prevSelected].filter(id => masterIdSet.has(id));
    const missing = [...prevSelected].filter(id => !masterIdSet.has(id));
    selectedIds = stillThere.length ? new Set(stillThere) : new Set(masterSpecies.map(sp => sp.id));
    if (missing.length) {
      warnMissingSpecies(missing, "After changing database priority");
    }
  } else {
    selectedIds = new Set(masterSpecies.map(sp => sp.id));
  }

  filteredSpecies = [...masterSpecies];
  activeSpeciesPool = masterSpecies.filter(sp => selectedIds.has(sp.id));
  currentDatabase = enabledKeys[0] || "vt";

  initFuzzySearch();
  renderSpeciesGrid();
  renderFamilySidebar();
  updatePoolStatus();

  if (note) {
    const labels = enabledKeys.map(k => DATABASES[k]?.label || k).join(" → ");
    note.textContent = `${masterSpecies.length} species (${labels})`;
  }
}

/** v1.0.12.M – warn when selected / preset species are not in enabled databases */
function warnMissingSpecies(missingIds, context) {
  if (!missingIds || !missingIds.length) return;
  const sample = missingIds.slice(0, 8).join(", ");
  const more = missingIds.length > 8 ? ` (+${missingIds.length - 8} more)` : "";
  const msg =
    `${context || "Warning"}:\n\n` +
    `${missingIds.length} selected species(s) are not in the enabled database(s).\n` +
    `Missing id(s): ${sample}${more}\n\n` +
    `Try enabling more sources in Database priority (Settings), or remove them from the preset.`;
  alert(msg);
  const status = document.getElementById("poolStatusSubtitle");
  if (status) {
    status.textContent = `⚠ ${missingIds.length} species missing from current databases`;
    status.style.color = "#d4a742";
  }
}

function findMissingFromMaster(ids) {
  const masterIdSet = new Set(masterSpecies.map(sp => sp.id));
  return (ids || []).map(String).filter(id => !masterIdSet.has(id));
}

function applyAliasesToMaster() {
  if (!presetAliases || !Object.keys(presetAliases).length) return;
  masterSpecies.forEach(sp => {
    if (presetAliases[sp.id]) sp.common = presetAliases[sp.id];
  });
}

function displayCommon(sp) {
  if (presetAliases && presetAliases[sp.id]) return presetAliases[sp.id];
  return sp.common;
}

/* --------------------------------------------------------------------------
   4. DOM CACHE
   Grabs frequently used elements once so we avoid repeated getElementById.
   -------------------------------------------------------------------------- */
function cacheDOM() {
  startScreen = document.getElementById('startScreen');
  quizScreen = document.getElementById('quizScreen');
  endScreen = document.getElementById('endScreen');
  stats = document.getElementById('stats');
  promptEl = document.getElementById('prompt');
  promptLabel = document.getElementById('promptLabel');
  optionsEl = document.getElementById('options');
  feedback = document.getElementById('feedback');
  nextBtn = document.getElementById('nextBtn');
  progressBar = document.getElementById('progressBar');
  timerBar = document.getElementById('timerBar');
  timerText = document.getElementById('timerText');
  speciesImg = document.getElementById('speciesImg');
  imgPlaceholder = document.getElementById('imgPlaceholder');
  imgLoading = document.getElementById('imgLoading');
  spinBtn = document.getElementById('spinzamBtn');
  settingsSidebar = document.getElementById('settingsSidebar');
  sidebarBackdrop = document.getElementById('sidebarBackdrop');
}

/* ============================================================================
   FORGIVING FUZZY SEARCH (FUSE.JS) & PICKER MODAL
============================================================================ */

/* --------------------------------------------------------------------------
   5. FUZZY SEARCH & SPECIES PICKER MODAL
   Fuse.js setup, modal open/close, search debounce, bulk select,
   family sidebar, grid render, active-pool sync.
   -------------------------------------------------------------------------- */
function initFuzzySearch() {
  if (typeof Fuse === 'undefined') {
    console.warn("Fuse.js not loaded, search will fall back to exact matching.");
    return;
  }
  const options = {
    keys: [
      { name: 'common', weight: 0.5 },
      { name: 'scientific', weight: 0.35 },
      { name: 'family', weight: 0.15 }
    ],
    threshold: 0.42,
    distance: 100,
    minMatchCharLength: 2,
    ignoreLocation: true
  };
  fuseInstance = new Fuse(masterSpecies, options);
}

function initSpeciesModal() {
  const modal = document.getElementById('speciesModal');
  const backdrop = document.getElementById('speciesModalBackdrop');
  const openBtn = document.getElementById('openSpeciesModalBtn');
  const closeBtn = document.getElementById('closeSpeciesModalBtn');
  const searchInput = document.getElementById('speciesSearchInput');
  const clearBtn = document.getElementById('clearSearchBtn');

  const openModal = () => {
    modal?.classList.remove('hidden');
    backdrop?.classList.remove('hidden');
    renderSpeciesGrid();
  };

  const closeModal = () => {
    modal?.classList.add('hidden');
    backdrop?.classList.add('hidden');
    syncActivePool();
  };

  openBtn?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);

  let debounceTimer;
  searchInput?.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const q = e.target.value.trim();
      if (!q) {
        filteredSpecies = [...masterSpecies];
      } else if (fuseInstance) {
        filteredSpecies = fuseInstance.search(q).map(res => res.item);
      } else {
        filteredSpecies = masterSpecies.filter(sp => 
          sp.common.toLowerCase().includes(q.toLowerCase()) || 
          sp.scientific.toLowerCase().includes(q.toLowerCase())
        );
      }
      renderSpeciesGrid();
    }, 120);
  });

  clearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    filteredSpecies = [...masterSpecies];
    renderSpeciesGrid();
  });

  document.getElementById('selectAllFilteredBtn')?.addEventListener('click', () => {
    filteredSpecies.forEach(sp => selectedIds.add(sp.id));
    updatePickerUI();
  });

  document.getElementById('deselectAllBtn')?.addEventListener('click', () => {
    selectedIds.clear();
    updatePickerUI();
  });

  document.getElementById('invertSelectionBtn')?.addEventListener('click', () => {
    masterSpecies.forEach(sp => {
      if (selectedIds.has(sp.id)) selectedIds.delete(sp.id);
      else selectedIds.add(sp.id);
    });
    updatePickerUI();
  });

  document.getElementById('savePresetCloudBtn')?.addEventListener('click', () => savePresetToCloudflare(false));
  document.getElementById('updatePresetCloudBtn')?.addEventListener('click', () => savePresetToCloudflare(true));
  document.getElementById('addSpeciesBtn')?.addEventListener('click', addCustomSpecies);
}

function renderSpeciesGrid() {
  const grid = document.getElementById('speciesResultGrid');
  if (!grid) return;
  grid.innerHTML = '';

  if (filteredSpecies.length === 0) {
    grid.innerHTML = '<div class="no-matches">No species found matching query.</div>';
    return;
  }

  const displaySlice = filteredSpecies.slice(0, 250);
  displaySlice.forEach(sp => {
    const label = document.createElement('label');
    label.className = 'species-card-label';
    const checked = selectedIds.has(sp.id);

    label.innerHTML = `
      <input type="checkbox" data-id="${sp.id}" ${checked ? 'checked' : ''}>
      <div class="name-block">
        <span class="common-txt">${displayCommon(sp)}</span>
        <span class="sci-txt"><em>${sp.scientific}</em> (${sp.family})</span>
      </div>
    `;

    label.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) selectedIds.add(sp.id);
      else selectedIds.delete(sp.id);
      updateBadge();
    });

    grid.appendChild(label);
  });

  if (filteredSpecies.length > 250) {
    const hint = document.createElement('div');
    hint.className = 'search-more-hint';
    hint.textContent = `Showing 250 of ${filteredSpecies.length} matches. Type more characters to narrow results.`;
    grid.appendChild(hint);
  }

  updateBadge();
}

function renderFamilySidebar() {
  const container = document.getElementById('familyListItems');
  if (!container) return;

  const familyGroups = {};
  masterSpecies.forEach(sp => {
    familyGroups[sp.family] = familyGroups[sp.family] || [];
    familyGroups[sp.family].push(sp.id);
  });

  container.innerHTML = '';
  Object.keys(familyGroups).sort().forEach(fam => {
    const ids = familyGroups[fam];
    const row = document.createElement('div');
    row.className = 'fam-sidebar-item';
    row.innerHTML = `
      <span class="fam-name" title="${fam}">${fam} (${ids.length})</span>
      <button type="button" class="fam-btn-add" title="Add all in ${fam}">+ All</button>
    `;

    row.querySelector('.fam-name').addEventListener('click', () => {
      const searchInput = document.getElementById('speciesSearchInput');
      if (searchInput) searchInput.value = fam;
      filteredSpecies = fuseInstance ? fuseInstance.search(fam).map(r => r.item) : masterSpecies.filter(s => s.family === fam);
      renderSpeciesGrid();
    });

    row.querySelector('.fam-btn-add').addEventListener('click', (e) => {
      e.stopPropagation();
      ids.forEach(id => selectedIds.add(id));
      updatePickerUI();
    });

    container.appendChild(row);
  });
}

function updatePickerUI() {
  renderSpeciesGrid();
  updateBadge();
}

function updateBadge() {
  const badge = document.getElementById('selectedCountBadge');
  if (badge) badge.textContent = `${selectedIds.size} of ${masterSpecies.length} selected`;
}

function syncActivePool() {
  activeSpeciesPool = masterSpecies.filter(sp => selectedIds.has(sp.id));
  updatePoolStatus();
}

function updatePoolStatus() {
  const status = document.getElementById('poolStatusSubtitle');
  if (status) {
    status.textContent = `${activeSpeciesPool.length} of ${masterSpecies.length} Species Selected for Testing`;
  }
}

/* ============================================================================
   CLOUDFLARE KV PRESETS SYNC
============================================================================ */

/* --------------------------------------------------------------------------
   6. CLOUDFLARE PRESETS
   Save current selection to Worker KV and load any saved preset back into
   the picker. Requires WORKER_API to be reachable.
   -------------------------------------------------------------------------- */
/* v1.0.9.M – presets with ⋮ menu, update, aliases, add-species */
async function savePresetToCloudflare(isUpdate) {
  if (selectedIds.size === 0) {
    alert("Select at least 1 species to create a preset.");
    return;
  }

  const titleInput = document.getElementById('presetTitleInput');
  const authorInput = document.getElementById('presetAuthorInput');
  let title = (titleInput?.value || '').trim();
  const author = (authorInput?.value || '').trim() || 'Anonymous';
  if (!title && isUpdate && activePresetMeta) title = activePresetMeta.title;
  if (!title) title = `Preset (${selectedIds.size} species)`;

  const payload = {
    title,
    author,
    species: Array.from(selectedIds),
    aliases: { ...presetAliases }
  };
  if (isUpdate && activePresetId) payload.id = activePresetId;

  try {
    const res = await fetch(`${WORKER_API}/api/presets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      alert(isUpdate ? `✓ Preset "${title}" updated.` : `✓ Preset "${title}" saved.`);
      if (data.preset?.id) {
        activePresetId = data.preset.id;
        activePresetMeta = data.preset;
      }
      // Keep local alias map keyed by preset id
      try {
        const all = JSON.parse(localStorage.getItem("dendro_preset_aliases") || "{}");
        all[activePresetId || title] = { ...presetAliases };
        localStorage.setItem("dendro_preset_aliases", JSON.stringify(all));
      } catch (e) {}
      fetchCloudPresets();
      updateUpdateBtnVisibility();
    } else {
      alert("Save failed. Try again.");
    }
  } catch (err) {
    console.error("Cloudflare preset save error:", err);
    alert("Failed to save to Cloudflare Worker.");
  }
}

async function fetchCloudPresets() {
  const list = document.getElementById("cloudPresetList");
  if (!list) return;

  try {
    const res = await fetch(`${WORKER_API}/api/presets`);
    if (!res.ok) throw new Error("bad status");
    const presets = await res.json();
    cloudPresetsCache = Array.isArray(presets) ? presets : [];
    renderCloudPresetList();
  } catch (err) {
    console.warn("Could not retrieve Cloudflare presets:", err);
    list.innerHTML = '<div class="lb-loading">Cloud presets offline</div>';
  }
}

function renderCloudPresetList() {
  const list = document.getElementById("cloudPresetList");
  if (!list) return;
  if (!cloudPresetsCache.length) {
    list.innerHTML = '<div class="lb-loading">No presets yet — select species and Save as new</div>';
    return;
  }
  list.innerHTML = "";
  cloudPresetsCache.forEach(p => {
    const row = document.createElement("div");
    row.className = "preset-row" + (p.id === activePresetId ? " active-preset" : "");
    row.innerHTML = `
      <div class="preset-row-info">
        <div class="preset-row-title">${p.title || "Untitled"}</div>
        <div class="preset-row-meta">${(p.species || []).length} spp · ${p.author || "Anon"}</div>
      </div>
      <button type="button" class="preset-menu-btn" title="Options">⋮</button>
      <div class="preset-menu">
        <button type="button" data-act="load">Load</button>
        <button type="button" data-act="edit">Edit preset</button>
        <button type="button" data-act="alias">Edit common names</button>
      </div>
    `;
    const menuBtn = row.querySelector(".preset-menu-btn");
    const menu = row.querySelector(".preset-menu");
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      document.querySelectorAll(".preset-menu.open").forEach(m => {
        if (m !== menu) m.classList.remove("open");
      });
      menu.classList.toggle("open");
    });
    menu.querySelectorAll("button").forEach(b => {
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.classList.remove("open");
        const act = b.dataset.act;
        if (act === "load") applyCloudPreset(p, false);
        if (act === "edit") applyCloudPreset(p, true);
        if (act === "alias") openAliasEditor(p);
      });
    });
    list.appendChild(row);
  });
}

function applyCloudPreset(p, forEdit) {
  activePresetId = p.id;
  activePresetMeta = p;
  const wanted = (p.species || []).map(String);
  const missing = findMissingFromMaster(wanted);
  const found = wanted.filter(id => !missing.includes(id));
  selectedIds = new Set(found.length ? found : wanted);
  // Load aliases from preset payload or localStorage
  presetAliases = {};
  if (p.aliases && typeof p.aliases === "object") {
    presetAliases = { ...p.aliases };
  } else {
    try {
      const all = JSON.parse(localStorage.getItem("dendro_preset_aliases") || "{}");
      if (all[p.id]) presetAliases = { ...all[p.id] };
    } catch (e) {}
  }
  applyAliasesToMaster();
  updatePickerUI();
  syncActivePool();
  const titleInput = document.getElementById("presetTitleInput");
  const authorInput = document.getElementById("presetAuthorInput");
  if (titleInput) titleInput.value = p.title || "";
  if (authorInput) authorInput.value = p.author || "";
  updateUpdateBtnVisibility();
  renderCloudPresetList();
  if (missing.length) {
    warnMissingSpecies(missing, `Preset "${p.title}"`);
  }
  if (forEdit) {
    alert(`Editing "${p.title}". ${found.length} of ${wanted.length} species found. Change selection, then click Update preset.`);
  } else if (!missing.length) {
    alert(`Loaded "${p.title}" (${selectedIds.size} species).`);
  }
}

function updateUpdateBtnVisibility() {
  const btn = document.getElementById("updatePresetCloudBtn");
  if (!btn) return;
  if (activePresetId) btn.classList.remove("hidden");
  else btn.classList.add("hidden");
}

function addCustomSpecies() {
  const common = (document.getElementById("addCommonInput")?.value || "").trim();
  const scientific = (document.getElementById("addSciInput")?.value || "").trim();
  const family = (document.getElementById("addFamilyInput")?.value || "").trim() || "Unknown";
  if (!common && !scientific) {
    alert("Enter at least a common or scientific name.");
    return;
  }
  const id = "custom-" + Date.now();
  const rec = {
    id,
    common: common || scientific,
    scientific: scientific || common,
    family,
    spinzam_url: null,
    source: "custom"
  };
  // Avoid duplicate scientific
  const exists = masterSpecies.find(s => s.scientific.toLowerCase() === rec.scientific.toLowerCase());
  if (exists) {
    selectedIds.add(exists.id);
    updatePickerUI();
    syncActivePool();
    alert(`Already in list — selected "${displayCommon(exists)}".`);
    return;
  }
  masterSpecies.push(rec);
  selectedIds.add(id);
  filteredSpecies = [...masterSpecies];
  initFuzzySearch();
  updatePickerUI();
  syncActivePool();
  renderFamilySidebar();
  document.getElementById("addCommonInput").value = "";
  document.getElementById("addSciInput").value = "";
  document.getElementById("addFamilyInput").value = "";
  alert(`Added "${rec.common}". Save/Update the preset to keep it.`);
}

function initAliasModal() {
  document.getElementById("closeAliasModalBtn")?.addEventListener("click", closeAliasModal);
  document.getElementById("cancelAliasBtn")?.addEventListener("click", closeAliasModal);
  document.getElementById("aliasModalBackdrop")?.addEventListener("click", closeAliasModal);
  document.getElementById("saveAliasesBtn")?.addEventListener("click", saveAliasEdits);
  document.addEventListener("click", () => {
    document.querySelectorAll(".preset-menu.open").forEach(m => m.classList.remove("open"));
  });
}

function openAliasEditor(p) {
  applyCloudPreset(p, true);
  const modal = document.getElementById("aliasModal");
  const backdrop = document.getElementById("aliasModalBackdrop");
  const list = document.getElementById("aliasList");
  const sub = document.getElementById("aliasModalSubtitle");
  if (sub) sub.textContent = `Overrides for "${p.title}" only.`;
  list.innerHTML = "";
  const ids = (p.species || []).map(String);
  ids.forEach(id => {
    const sp = masterSpecies.find(s => s.id === id);
    const row = document.createElement("div");
    row.className = "alias-row";
    const current = presetAliases[id] || (sp ? sp.common : "");
    row.innerHTML = `
      <span class="sci">${sp ? sp.scientific : id}</span>
      <input type="text" data-id="${id}" value="${(current || "").replace(/"/g, "&quot;")}" placeholder="Common name">
    `;
    list.appendChild(row);
  });
  modal?.classList.remove("hidden");
  backdrop?.classList.remove("hidden");
}

function closeAliasModal() {
  document.getElementById("aliasModal")?.classList.add("hidden");
  document.getElementById("aliasModalBackdrop")?.classList.add("hidden");
}

function saveAliasEdits() {
  const list = document.getElementById("aliasList");
  list?.querySelectorAll("input[data-id]").forEach(inp => {
    const v = inp.value.trim();
    if (v) presetAliases[inp.dataset.id] = v;
    else delete presetAliases[inp.dataset.id];
  });
  applyAliasesToMaster();
  updatePickerUI();
  try {
    const all = JSON.parse(localStorage.getItem("dendro_preset_aliases") || "{}");
    if (activePresetId) all[activePresetId] = { ...presetAliases };
    localStorage.setItem("dendro_preset_aliases", JSON.stringify(all));
  } catch (e) {}
  closeAliasModal();
  alert("Common names updated for this preset. Click Update preset to sync to Cloudflare.");
}

/* ============================================================================
   QUIZ CONTROLS & BINDINGS
============================================================================ */

/* --------------------------------------------------------------------------
   7. QUIZ SETTINGS SIDEBAR & CONTROLS
   Open/close sidebar, mode/style/count/choices/timer toggles,
   hardcoded lab-preset checkboxes, Start/Guest/Ultimate buttons.
   -------------------------------------------------------------------------- */
function initSidebar() {
  const openSidebar = () => {
    settingsSidebar?.classList.add('open');
    sidebarBackdrop?.classList.remove('hidden');
  };
  const closeSidebar = () => {
    settingsSidebar?.classList.remove('open');
    sidebarBackdrop?.classList.add('hidden');
  };

  document.getElementById('settingsBtn')?.addEventListener('click', openSidebar);
  document.getElementById('settingsBtnQuiz')?.addEventListener('click', openSidebar);
  document.getElementById('closeSidebarBtn')?.addEventListener('click', closeSidebar);
  sidebarBackdrop?.addEventListener('click', closeSidebar);
}

function initQuizControls() {
  document.querySelectorAll('#modeSelect .mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const allBtns = document.querySelectorAll('#modeSelect .mode-btn');
      if (btn.classList.contains('active') && document.querySelectorAll('#modeSelect .mode-btn.active').length <= 1) return;
      btn.classList.toggle('active');
      selectedModes = [];
      allBtns.forEach(b => { if (b.classList.contains('active')) selectedModes.push(b.dataset.mode); });
    });
  });

  const quizBtn = document.getElementById('playStyleQuiz');
  const typeBtn = document.getElementById('playStyleTyping');
  const toggleStyle = (btn) => {
    if (btn.classList.contains('active') && document.querySelectorAll('#playStyleSelect .mode-btn.active').length <= 1) return;
    btn.classList.toggle('active');
    selectedStyles = [];
    if (quizBtn?.classList.contains('active')) selectedStyles.push('quiz');
    if (typeBtn?.classList.contains('active')) selectedStyles.push('typing');
  };
  quizBtn?.addEventListener('click', () => toggleStyle(quizBtn));
  typeBtn?.addEventListener('click', () => toggleStyle(typeBtn));

  document.querySelectorAll('#countSelect .count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#countSelect .count-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      TOTAL = parseInt(btn.dataset.count, 10);
      const startBtn = document.getElementById('startBtn');
      if (startBtn) startBtn.textContent = `Start ${TOTAL}-Question Quiz`;
    });
  });

  document.querySelectorAll('#choicesSelect .choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#choicesSelect .choice-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      NUM_CHOICES = parseInt(btn.dataset.choices, 10);
    });
  });

  document.getElementById('timeLimitSlider')?.addEventListener('input', (e) => {
    TIME_LIMIT = parseInt(e.target.value, 10);
    const label = document.getElementById('timeLimitLabel');
    if (label) label.textContent = TIME_LIMIT + 's';
  });

  /* v1.0.9.M – hardcoded Quiz Test #1–5 removed from UI */

  document.getElementById('startBtn')?.addEventListener('click', () => {
    const input = document.getElementById('playerName');
    const entered = (input?.value || '').trim();
    if (!entered) {
      alert("Please enter a player name to record your score, or choose 'Play as Guest'!");
      input?.focus();
      return;
    }
    playerName = entered;
    isGuest = false;
    launchGame();
  });

  document.getElementById('guestBtn')?.addEventListener('click', () => {
    playerName = "Guest";
    isGuest = true;
    launchGame();
  });

  document.getElementById('ultimateBtn')?.addEventListener('click', () => {
    const input = document.getElementById('playerName');
    playerName = (input?.value || '').trim() || 'Champion';
    isGuest = false;
    TOTAL = activeSpeciesPool.length;
    launchGame();
  });

  document.getElementById('refreshLbBtn')?.addEventListener('click', fetchGlobalLeaderboard);
  nextBtn?.addEventListener('click', nextQuestion);
  document.getElementById('startOverBtn')?.addEventListener('click', launchGame);
  document.getElementById('homeBtn')?.addEventListener('click', () => {
    endScreen?.classList.add('hidden');
    startScreen?.classList.remove('hidden');
    fetchGlobalLeaderboard();
  });

  document.getElementById('hintBtn')?.addEventListener('click', () => {
    hintUsedThisQ = true;
    revealImage();
  });

  document.getElementById('cancelQuizBtn')?.addEventListener('click', () => {
    stopTimer();
    quizScreen?.classList.add('hidden');
    stats?.classList.add('hidden');
    startScreen?.classList.remove('hidden');
    fetchGlobalLeaderboard();
  });

  document.getElementById('typeSubmitBtn')?.addEventListener('click', handleTypedAnswer);
  document.getElementById('typeAnswerInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleTypedAnswer();
  });
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ============================================================================
   GAME LIFECYCLE
============================================================================ */

/* --------------------------------------------------------------------------
   8. GAME LIFECYCLE
   launchGame → showQuestion → selectAnswer / handleTypedAnswer → nextQuestion
   → endQuiz. Also contains the Fisher-Yates shuffle helper.
   -------------------------------------------------------------------------- */
function launchGame() {
  syncActivePool();
  if (activeSpeciesPool.length === 0) {
    alert("Your species selection is empty! Pick at least 2 species in the Species Picker.\n\nIf you loaded a preset, those species may be missing from the enabled databases — check Settings → Database priority.");
    return;
  }

  /* v1.0.12.M – warn if selection includes ids not in current master list */
  const missing = findMissingFromMaster([...selectedIds]);
  if (missing.length) {
    warnMissingSpecies(missing, "Before starting quiz");
  }

  /* v1.0.10.M – allow repeats when question count > pool size */
  const pool = [...activeSpeciesPool];
  const want = Math.max(1, TOTAL);
  questions = [];
  while (questions.length < want) {
    const batch = shuffle(pool);
    for (const sp of batch) {
      if (questions.length >= want) break;
      // avoid back-to-back same species when pool has 2+
      if (pool.length > 1 && questions.length && questions[questions.length - 1].id === sp.id) continue;
      questions.push(sp);
    }
    // safety: single-species pool
    if (pool.length === 1) {
      while (questions.length < want) questions.push(pool[0]);
      break;
    }
  }
  TOTAL = questions.length;
  qIndex = 0;
  score = 0;
  streak = 0;

  startScreen?.classList.add('hidden');
  endScreen?.classList.add('hidden');
  quizScreen?.classList.remove('hidden');
  stats?.classList.remove('hidden');

  showQuestion();
}

function showQuestion() {
  feedback?.classList.add('hidden');
  nextBtn?.classList.add('hidden');
  if (optionsEl) optionsEl.innerHTML = '';
  answered = false;
  hintUsedThisQ = false;

  currentMode = selectedModes[Math.floor(Math.random() * selectedModes.length)] || 'sci-to-common';
  const activeStyle = selectedStyles[Math.floor(Math.random() * selectedStyles.length)] || 'quiz';
  typeAnswerMode = (activeStyle === 'typing');

  const sp = questions[qIndex];

  if (currentMode === 'common-to-sci') {
    promptLabel.textContent = 'Scientific Name';
    promptEl.textContent = displayCommon(sp);
    currentCorrect = sp.scientific;
  } else if (currentMode === 'family') {
    promptLabel.textContent = 'Botanical Family';
    promptEl.textContent = `${displayCommon(sp)} (${sp.scientific})`;
    currentCorrect = sp.family;
  } else {
    promptLabel.textContent = 'Common Name';
    promptEl.textContent = sp.scientific;
    currentCorrect = displayCommon(sp);
  }

  document.getElementById('qNum').textContent = qIndex + 1;
  document.getElementById('totalQ').textContent = TOTAL;
  if (progressBar) progressBar.style.width = ((qIndex / TOTAL) * 100) + '%';

  if (spinBtn) {
    if (sp.spinzam_url) {
      spinBtn.classList.remove('hidden');
      spinBtn.onclick = () => {
        const slot = document.getElementById('imageSlot');
        if (slot) {
          slot.innerHTML = `<iframe src="${sp.spinzam_url}" width="100%" height="100%" frameborder="0" scrolling="no" style="border:none;" allowfullscreen></iframe>`;
        }
      };
    } else {
      spinBtn.classList.add('hidden');
    }
  }

  const typeArea = document.getElementById('typeAnswerArea');
  const typeInput = document.getElementById('typeAnswerInput');

  if (typeAnswerMode) {
    optionsEl?.classList.add('hidden');
    typeArea?.classList.remove('hidden');
    if (typeInput) {
      typeInput.value = '';
      typeInput.disabled = false;
      setTimeout(() => typeInput.focus(), 60);
    }
  } else {
    typeArea?.classList.add('hidden');
    optionsEl?.classList.remove('hidden');

    let choices = [currentCorrect];
    const distractorPool = masterSpecies
      .map(item => currentMode === 'common-to-sci' ? item.scientific : (currentMode === 'family' ? item.family : displayCommon(item)))
      .filter((v, i, self) => v !== currentCorrect && self.indexOf(v) === i);

    shuffle(distractorPool).slice(0, NUM_CHOICES - 1).forEach(c => choices.push(c));

    shuffle(choices).forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'option';
      btn.textContent = opt;
      btn.addEventListener('click', () => selectAnswer(btn, opt));
      optionsEl?.appendChild(btn);
    });
  }

  loadPhoto(sp);
  startTimer();
}

function handleTypedAnswer() {
  if (answered) return;
  const input = document.getElementById('typeAnswerInput');
  selectAnswer(document.createElement('div'), (input?.value || '').trim());
}

function selectAnswer(btn, chosen) {
  if (answered) return;
  answered = true;
  stopTimer();

  optionsEl?.querySelectorAll('.option').forEach(o => o.disabled = true);
  const isMatch = chosen.toLowerCase().trim() === currentCorrect.toLowerCase().trim();

  if (isMatch) {
    btn.classList.add('correct');
    score++;
    streak++;
    if (feedback) {
      feedback.textContent = '✓ Correct!';
      feedback.className = 'feedback correct';
    }
  } else {
    btn.classList.add('wrong');
    streak = 0;
    optionsEl?.querySelectorAll('.option').forEach(o => {
      if (o.textContent.toLowerCase().trim() === currentCorrect.toLowerCase().trim()) {
        o.classList.add('correct');
      }
    });
    if (feedback) {
      feedback.textContent = `✗ Wrong — Correct: ${currentCorrect}`;
      feedback.className = 'feedback wrong';
    }
  }

  feedback?.classList.remove('hidden');
  revealImage();
  nextBtn?.classList.remove('hidden');
  const scoreEl = document.getElementById('score');
  const streakEl = document.getElementById('streak');
  if (scoreEl) scoreEl.textContent = score;
  if (streakEl) streakEl.textContent = streak;
}

function nextQuestion() {
  qIndex++;
  if (qIndex < questions.length) {
    showQuestion();
  } else {
    endQuiz();
  }
}

/* ============================================================================
   CLOUDFLARE KV LEADERBOARD
============================================================================ */

/* --------------------------------------------------------------------------
   9. LEADERBOARD (Cloudflare KV)
   endQuiz posts the score; fetchGlobalLeaderboard paints the Hall of Fame.
   -------------------------------------------------------------------------- */
async function endQuiz() {
  stopTimer();
  quizScreen?.classList.add('hidden');
  stats?.classList.add('hidden');
  endScreen?.classList.remove('hidden');

  const pct = Math.round((score / TOTAL) * 100) || 0;
  const msgEl = document.getElementById('endMsg');
  const kvNotice = document.getElementById('endKvStatus');

  if (msgEl) msgEl.textContent = `Final Score: ${score}/${TOTAL} (${pct}%)`;

  if (isGuest) {
    if (kvNotice) {
      kvNotice.className = "kv-notice guest";
      kvNotice.textContent = "Played as Guest: Score not recorded to Cloudflare Global Hall of Fame.";
      kvNotice.classList.remove('hidden');
    }
  } else if (WORKER_API) {
    if (kvNotice) {
      kvNotice.className = "kv-notice";
      kvNotice.textContent = "Transmitting score to Cloudflare KV...";
      kvNotice.classList.remove('hidden');
    }

    try {
      const payload = {
        player: playerName,
        score,
        total: TOTAL,
        mode: currentMode
      };

      const res = await fetch(`${WORKER_API}/api/leaderboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok && kvNotice) {
        kvNotice.className = "kv-notice success";
        kvNotice.textContent = "✓ Score recorded to Cloudflare Global Hall of Fame!";
      }
    } catch (e) {
      if (kvNotice) {
        kvNotice.className = "kv-notice guest";
        kvNotice.textContent = "Could not sync score to Cloudflare (Network error).";
      }
    }
  }
}

async function fetchGlobalLeaderboard() {
  const listEl = document.getElementById('leaderboardList');
  if (!listEl) return;

  if (!WORKER_API) {
    listEl.innerHTML = '<div class="lb-loading">No Cloudflare Worker URL configured.</div>';
    return;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${WORKER_API}/api/leaderboard`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error("Leaderboard unreachable");
    const data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
      listEl.innerHTML = '';
      data.slice(0, 10).forEach((entry, i) => {
        const row = document.createElement('div');
        row.className = 'lb-row';
        const pct = Math.round((entry.score / entry.total) * 100);
        row.innerHTML = `
          <span class="lb-rank">#${i + 1}</span>
          <span class="lb-name">${entry.player || 'Player'}</span>
          <span class="lb-score">${entry.score}/${entry.total} (${pct}%)</span>
        `;
        listEl.appendChild(row);
      });
    } else {
      listEl.innerHTML = '<div class="lb-loading">No scores recorded yet. Be the first!</div>';
    }
  } catch (err) {
    listEl.innerHTML = '<div class="lb-loading">Cloudflare KV offline. You can still play!</div>';
  }
}

/* --------------------------------------------------------------------------
   10. TIMER
   startTimer / stopTimer / updateTimerDisplay – auto-submits empty answer
   when time hits zero.
   -------------------------------------------------------------------------- */
function updateTimerDisplay() {
  if (timerText) timerText.textContent = timeLeft;
  if (timerBar) timerBar.style.width = (timeLeft / TIME_LIMIT * 100) + '%';
}

function stopTimer() {
  if (timerId) { clearInterval(timerId); timerId = null; }
}

function startTimer() {
  stopTimer();
  timeLeft = TIME_LIMIT;
  updateTimerDisplay();
  timerId = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      stopTimer();
      if (!answered) selectAnswer(document.createElement('div'), '');
    }
  }, 1000);
}

/* ============================================================================
   IMAGE LOADER & RESIZER
============================================================================ */

/* --------------------------------------------------------------------------
   11. IMAGE LOADER & RESIZER
   Tries R2 diagnostic photo first, falls back to iNaturalist, reveals on
   hint or after answer. initImageResizer lets the user drag the image height.
   -------------------------------------------------------------------------- */
async function loadPhoto(sp) {
  const slot = document.getElementById('imageSlot');
  if (slot && !slot.querySelector('#speciesImg')) {
    slot.innerHTML = `
      <span class="image-placeholder" id="imgPlaceholder">🌿</span>
      <span class="image-loading hidden" id="imgLoading">Loading specimen…</span>
      <img id="speciesImg" alt="Woody specimen diagnostic photo" />
    `;
    speciesImg = document.getElementById('speciesImg');
    imgPlaceholder = document.getElementById('imgPlaceholder');
    imgLoading = document.getElementById('imgLoading');
  }

  if (speciesImg) {
    speciesImg.classList.remove('revealed');
    speciesImg.removeAttribute('src');
  }
  if (imgPlaceholder) imgPlaceholder.style.opacity = '0.4';
  if (imgLoading) imgLoading.classList.remove('hidden');

  const commonSlug = sp.common.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const sciClean = sp.scientific.replace(/spp\.?/i, '').trim();

  // Primary: Cloudflare R2
  const r2Url = `${CLOUDFLARE_R2_BASE}/${commonSlug}_image/${commonSlug}_leaf_image.jpg`;
  const imgTest = new Image();
  imgTest.src = r2Url;

  imgTest.onload = () => {
    if (speciesImg) {
      speciesImg.src = r2Url;
      if (imgLoading) imgLoading.classList.add('hidden');
      if (hintUsedThisQ) revealImage();
    }
  };

  imgTest.onerror = async () => {
    // Secondary: iNaturalist Lookup
    try {
      const res = await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(sciClean)}&per_page=1`);
      const data = await res.json();
      const taxon = data.results?.[0];
      if (taxon?.default_photo?.medium_url && speciesImg) {
        speciesImg.src = taxon.default_photo.medium_url;
        if (imgLoading) imgLoading.classList.add('hidden');
        if (hintUsedThisQ) revealImage();
        return;
      }
    } catch (e) {}

    if (imgLoading) imgLoading.classList.add('hidden');
  };
}

function revealImage() {
  if (speciesImg && speciesImg.src) speciesImg.classList.add('revealed');
  if (imgPlaceholder) imgPlaceholder.style.opacity = '0';
}

function initImageResizer() {
  const handle = document.getElementById('imgResizeHandle');
  const wrap = document.getElementById('imageWrap');
  if (!handle || !wrap) return;

  let startY, startH;
  const onPointerDown = (e) => {
    startY = e.clientY || (e.touches && e.touches[0].clientY);
    startH = wrap.offsetHeight;
    document.documentElement.addEventListener('pointermove', onPointerMove);
    document.documentElement.addEventListener('pointerup', onPointerUp);
    e.preventDefault();
  };
  const onPointerMove = (e) => {
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    const newH = Math.max(90, Math.min(500, startH + (clientY - startY)));
    wrap.style.height = `${newH}px`;
  };
  const onPointerUp = () => {
    document.documentElement.removeEventListener('pointermove', onPointerMove);
    document.documentElement.removeEventListener('pointerup', onPointerUp);
  };
  handle.addEventListener('pointerdown', onPointerDown);
}
