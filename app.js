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
const WORKER_API = "https://quiz.jonathantt.workers.dev";

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
  }
};

let currentDatabase = "vt";          // which DB is currently loaded
let masterSpecies = [];              // full list after normalize
let activeSpeciesPool = [];          // subset currently selected for quizzes
let selectedIds = new Set();         // ids checked in the picker
let filteredSpecies = [];            // current search results
let fuseInstance = null;             // Fuse.js instance for fuzzy search
let budScanMap = {};                 // id → Spinzam embed URL

/**
 * Lab test lists hardcoded by scientific name. Checking a toggle in Settings
 * filters selectedIds down to matching species (or restores all if none checked).
 */
const HARDCODED_PRESETS = [
  { id: 'quizTest1Toggle', sci: ["asimina triloba","ilex opaca","robinia pseudoacacia","juglans nigra","sassafras albidum","lindera benzoin","liriodendron tulipifera","fraxinus americana","paulownia tomentosa","pinus strobus","tsuga canadensis","platanus occidentalis","acer saccharum","acer negundo","aesculus flava","parthenocissus quinquefolia","toxicodendron radicans","carpinus caroliniana","elaeagnus umbellate","reynoutria japonica"] },
  { id: 'quizTest2Toggle', sci: ["cercis canadensis","quercus alba","quercus montana","quercus coccinea","quercus marilandica","prunus serotina","pyrus calleryana","acer platanoides","ailanthus altissima","tilia americana"] },
  { id: 'quizTest3Toggle', sci: ["quercus rubra","magnolia acuminata","acer pensylvanicum","cornus florida","acer rubrum","quercus velutina","smilax spp.","carya cordiformis","berbis spp."] },
  { id: 'quizTest4Toggle', sci: ["nyssa sylvatica","fagus grandifolia","pinus rigida","pinus virginiana","oxydendrum arboreum","quercus falcata","juniperus virginiana","albizia julibrissin","quercus stellata","diospyros virginiana"] },
  { id: 'quizTest5Toggle', sci: ["malus pumila","pinus taeda","quercus phellos","hedera helix","catalpa speciosa","cornus kousa","carya glabra var.glabra","fraxinus pennsylvanica","rubus phoenicolasius","ulmus rubra","rosa multiflora","cupressocyparis leylandii","acer saccharinum"] }
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
  initSidebar();
  initQuizControls();
  initSpeciesModal();
  initImageResizer();
  initDatabaseSelector();
  
  // Non-blocking leaderboard fetch (failure is fine – user can still play)
  fetchGlobalLeaderboard().catch(() => {});

  // Load default database (VT Dendrology)
  await loadDatabase("vt");
  fetchCloudPresets().catch(() => {});
}

/* --------------------------------------------------------------------------
   3. DATABASE LOADER
   Tries listed JSON files for the chosen source, normalizes records,
   builds Fuse index, and refreshes the picker UI.
   -------------------------------------------------------------------------- */
async function loadDatabase(dbKey) {
  const db = DATABASES[dbKey] || DATABASES.vt;
  currentDatabase = dbKey;
   /* v1.0.5.M – handle live iNaturalist source */
if (db.type === "api" && dbKey === "inat") {
  const note = document.getElementById("dbStatusNote");
  if (note) note.textContent = "iNaturalist: using live taxa search + photos…";

  // Keep whatever species are already loaded (or the fallback list)
  // so the quiz still has a usable pool. Photos will prefer iNaturalist.
  if (masterSpecies.length === 0) {
    // minimal fallback so the app never starts empty
    masterSpecies = [{
      id: "1",
      common: "Red Maple",
      scientific: "Acer rubrum",
      family: "Sapindaceae",
      spinzam_url: null
    }];
  }

  selectedIds = new Set(masterSpecies.map(sp => sp.id));
  filteredSpecies = [...masterSpecies];
  activeSpeciesPool = [...masterSpecies];
  initFuzzySearch();
  renderSpeciesGrid();
  renderFamilySidebar();
  updatePoolStatus();

  if (note) note.textContent = `iNaturalist (live): ${masterSpecies.length} species ready`;
  document.querySelectorAll("#databaseSelect .mode-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.db === dbKey);
  });
  return;   // skip the normal JSON loading path
}

  const note = document.getElementById("dbStatusNote");
  if (note) note.textContent = `Loading ${db.label}…`;

  let rawData = null;

  // Try each candidate file until one succeeds
  for (const path of db.files) {
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
   /* v1.0.5.M – iNaturalist live API option */
inat: {
  label: "iNaturalist (live)",
  type: "api",          // special flag so loadDatabase knows it is not a local JSON
  files: []             // no local files
},

  // Optional bud-scan map (Spinzam embeds, VT only)
  budScanMap = {};
  if (db.budScan) {
    try {
      const res = await fetch(db.budScan);
      if (res.ok) budScanMap = await res.json();
    } catch (e) {
      console.warn("Bud scan map not loaded", e);
    }
  }

  // Fallback to hardcoded lab list if nothing loaded
  if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
    console.warn("Activating built-in preset fallback dataset.");
    const fallbackMap = new Map();
    HARDCODED_PRESETS.forEach(p => {
      p.sci.forEach(s => {
        const common = s.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        fallbackMap.set(s, {
          id: String(fallbackMap.size + 1),
          common,
          scientific: s,
          family: "Pinaceae"
        });
      });
    });
    rawData = Array.from(fallbackMap.values());
  }

  // Normalize every record into a common shape
  masterSpecies = rawData
    .map((item, idx) => {
      const scientific = (item.scientific || "").trim();
      const common = (item.common || "").trim();
      // Skip Arbor Day entries that have no usable name
      if (!scientific && !common) return null;
      if (dbKey === "arborday" && !scientific) return null; // keep only real species

      const id = item.id !== undefined ? String(item.id)
               : item.vtId !== undefined ? String(item.vtId)
               : item.arborday_id !== undefined ? String(item.arborday_id)
               : String(idx + 1);

      let spinzam = item.spinzam_url || null;
      if (!spinzam && budScanMap[id]) spinzam = budScanMap[id];
      if (!spinzam && item.vtId && budScanMap[String(item.vtId)]) {
        spinzam = budScanMap[String(item.vtId)];
      }

      return {
        id,
        common: common || scientific || "Unknown",
        scientific: scientific || common || "Unknown Species",
        family: item.family || item.family_modern || (item.familyNum ? `Family #${item.familyNum}` : "Unknown"),
        spinzam_url: spinzam
      };
    })
    .filter(Boolean);

  selectedIds = new Set(masterSpecies.map(sp => sp.id));
  filteredSpecies = [...masterSpecies];
  activeSpeciesPool = [...masterSpecies];

  initFuzzySearch();
  renderSpeciesGrid();
  renderFamilySidebar();
  updatePoolStatus();

  if (note) {
    note.textContent = `${db.label}: ${masterSpecies.length} species ready`;
  }

  // Update active button styling
  document.querySelectorAll("#databaseSelect .mode-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.db === dbKey);
  });
}

function initDatabaseSelector() {
  document.querySelectorAll("#databaseSelect .mode-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const key = btn.dataset.db;
      if (key === currentDatabase) return;
      // Visual feedback
      document.querySelectorAll("#databaseSelect .mode-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      await loadDatabase(key);
    });
  });
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

  document.getElementById('savePresetCloudBtn')?.addEventListener('click', savePresetToCloudflare);
  document.getElementById('loadPresetCloudBtn')?.addEventListener('click', loadPresetFromCloudflare);
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
        <span class="common-txt">${sp.common}</span>
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
async function savePresetToCloudflare() {
  if (selectedIds.size === 0) {
    alert("Select at least 1 species to create a preset.");
    return;
  }

  const titleInput = document.getElementById('presetTitleInput');
  const authorInput = document.getElementById('presetAuthorInput');
  const title = (titleInput?.value || '').trim() || `Preset (${selectedIds.size} species)`;
  const author = (authorInput?.value || '').trim() || 'Anonymous';

  const payload = {
    title,
    author,
    species: Array.from(selectedIds)
  };

  try {
    const res = await fetch(`${WORKER_API}/api/presets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      alert(`✓ Preset "${title}" saved to Cloudflare!`);
      if (titleInput) titleInput.value = '';
      fetchCloudPresets();
    }
  } catch (err) {
    console.error("Cloudflare preset save error:", err);
    alert("Failed to save to Cloudflare Worker. Check endpoint URL.");
  }
}

async function fetchCloudPresets() {
  const dropdown = document.getElementById('cloudPresetDropdown');
  if (!dropdown) return;

  try {
    const res = await fetch(`${WORKER_API}/api/presets`);
    if (!res.ok) return;
    const presets = await res.json();

    dropdown.innerHTML = '<option value="">-- Load from Cloudflare --</option>';
    presets.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.title} (${p.species.length} spp) — ${p.author}`;
      opt.dataset.species = JSON.stringify(p.species);
      dropdown.appendChild(opt);
    });
  } catch (err) {
    console.warn("Could not retrieve Cloudflare presets:", err);
  }
}

function loadPresetFromCloudflare() {
  const dropdown = document.getElementById('cloudPresetDropdown');
  const selOpt = dropdown?.options[dropdown.selectedIndex];
  if (!selOpt || !selOpt.dataset.species) {
    alert("Choose a preset from the dropdown first.");
    return;
  }

  try {
    const ids = JSON.parse(selOpt.dataset.species);
    selectedIds = new Set(ids.map(String));
    updatePickerUI();
    alert(`Loaded "${selOpt.textContent}"`);
  } catch (e) {
    console.error("Failed to parse preset payload:", e);
  }
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

  HARDCODED_PRESETS.forEach(p => {
    document.getElementById(p.id)?.addEventListener('change', () => {
      const want = new Set();
      HARDCODED_PRESETS.forEach(pr => {
        if (document.getElementById(pr.id)?.checked) {
          pr.sci.forEach(s => want.add(s.toLowerCase().trim()));
        }
      });

      if (want.size > 0) {
        selectedIds.clear();
        masterSpecies.forEach(sp => {
          if (want.has(sp.scientific.toLowerCase().trim())) selectedIds.add(sp.id);
        });
      } else {
        masterSpecies.forEach(sp => selectedIds.add(sp.id));
      }
      syncActivePool();
      updateBadge();
    });
  });

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
    alert("Your species selection is empty! Pick at least 2 species in the Species Picker.");
    return;
  }

  questions = shuffle(activeSpeciesPool).slice(0, Math.min(TOTAL, activeSpeciesPool.length));
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
    promptEl.textContent = sp.common;
    currentCorrect = sp.scientific;
  } else if (currentMode === 'family') {
    promptLabel.textContent = 'Botanical Family';
    promptEl.textContent = `${sp.common} (${sp.scientific})`;
    currentCorrect = sp.family;
  } else {
    promptLabel.textContent = 'Common Name';
    promptEl.textContent = sp.scientific;
    currentCorrect = sp.common;
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
      .map(item => currentMode === 'common-to-sci' ? item.scientific : (currentMode === 'family' ? item.family : item.common))
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
