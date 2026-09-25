/* ============================================================================
   VIRGINIA TECH MASTER DENDROLOGY ENGINE — v6.0.0
   - Fully dynamic data hydration from data/species.json (all 1,100+ species)
   - Discards legacy v5.0.2 static arrays and hardcoded limitations
   - Cloudflare R2 bucket integration for diagnostic photos and 360 bud scans
   - Interactive 360 turntable canvas supporting drag/touch interaction
   - Draggable viewport resizer and multi-mode selection
============================================================================ */

const CLOUDFLARE_R2_BASE = "https://pub-7c0f1ea1e4264248a09ee567d8bcda6f.r2.dev";

let SPECIES_DATA = [];
let ACTIVE_POOL = [];
let QUESTIONS = [];
let CURRENT_Q = null;

let selectedModes = ['sci-to-common'];
let selectedStyles = ['quiz'];
let selectedFamilies = new Set();
let activeMode = 'sci-to-common';
let activeStyle = 'quiz';

let TOTAL_QUESTIONS = 10;
let NUM_CHOICES = 4;
let TIME_LIMIT = 15;
let timeLeft = 15;
let timerId = null;

let qIndex = 0;
let score = 0;
let streak = 0;
let answered = false;
let currentCorrect = "";

// 360 Bud Turntable State
let currentTurntableFrames = [];
let turntableIndex = 0;
let isDraggingTurntable = false;
let turntableStartX = 0;

// DOM Cache
let startScreen, quizScreen, endScreen, stats;
let promptEl, promptLabel, optionsEl, typeArea, typeInput, feedback;
let nextBtn, progressBar, timerBar, timerText;
let speciesImg, imgPlaceholder, imgLoading, imgWrap, spinBtn;
let turntableBox, turntableCanvas;

async function init() {
  cacheDOM();
  initImageResizer();
  initEventListeners();

  try {
    const res = await fetch('./data/species.json');
    SPECIES_DATA = await res.json();
    ACTIVE_POOL = [...SPECIES_DATA];
    populateFamilyFilter();
    console.log(`[VT Engine] Loaded ${SPECIES_DATA.length} species from master dataset.`);
  } catch (err) {
    console.error("Failed to load data/species.json:", err);
    promptEl.textContent = "Error loading species dataset.";
  }
}

function cacheDOM() {
  startScreen = document.getElementById('startScreen');
  quizScreen = document.getElementById('quizScreen');
  endScreen = document.getElementById('endScreen');
  stats = document.getElementById('stats');
  promptEl = document.getElementById('prompt');
  promptLabel = document.getElementById('promptLabel');
  optionsEl = document.getElementById('options');
  typeArea = document.getElementById('typeAnswerArea');
  typeInput = document.getElementById('typeAnswerInput');
  feedback = document.getElementById('feedback');
  nextBtn = document.getElementById('nextBtn');
  progressBar = document.getElementById('progressBar');
  timerBar = document.getElementById('timerBar');
  timerText = document.getElementById('timerText');
  speciesImg = document.getElementById('speciesImg');
  imgPlaceholder = document.getElementById('imgPlaceholder');
  imgLoading = document.getElementById('imgLoading');
  imgWrap = document.getElementById('imageWrap');
  spinBtn = document.getElementById('spinzamBtn');
  turntableBox = document.getElementById('turntableContainer');
  turntableCanvas = document.getElementById('turntableCanvas');
}

/* ============================================================================
   DRAGGABLE MEDIA RESIZER
============================================================================ */
function initImageResizer() {
  const handle = document.getElementById('imgResizeHandle');
  if (!handle || !imgWrap) return;

  let startY, startH;
  function onDown(e) {
    startY = e.clientY || (e.touches && e.touches[0].clientY);
    startH = imgWrap.offsetHeight;
    document.documentElement.addEventListener('pointermove', onMove);
    document.documentElement.addEventListener('pointerup', onUp);
    e.preventDefault();
  }
  function onMove(e) {
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    const newH = Math.max(80, Math.min(520, startH + (clientY - startY)));
    imgWrap.style.height = `${newH}px`;
    document.documentElement.style.setProperty('--img-h', `${newH}px`);
  }
  function onUp() {
    document.documentElement.removeEventListener('pointermove', onMove);
    document.documentElement.removeEventListener('pointerup', onUp);
  }
  handle.addEventListener('pointerdown', onDown);
}

/* ============================================================================
   DATA HYDRATION & FILTERS
============================================================================ */
function populateFamilyFilter() {
  const list = document.getElementById('familyCheckList');
  const summary = document.getElementById('familySummary');
  if (!list) return;
  list.innerHTML = '';

  const famCounts = {};
  SPECIES_DATA.forEach(s => {
    const fam = s.family || s.family_modern || 'Unknown';
    famCounts[fam] = (famCounts[fam] || 0) + 1;
  });

  const sortedFams = Object.keys(famCounts).sort();
  sortedFams.forEach(fam => {
    const row = document.createElement('div');
    row.style.padding = '3px 0';
    row.innerHTML = `
      <label style="display:flex;align-items:center;gap:8px;font-size:0.85rem;cursor:pointer;">
        <input type="checkbox" class="fam-cb" value="${fam}" />
        ${fam} (${famCounts[fam]})
      </label>
    `;
    const cb = row.querySelector('input');
    cb.addEventListener('change', () => {
      if (cb.checked) selectedFamilies.add(fam);
      else selectedFamilies.delete(fam);
      applyFamilyFilter();
    });
    list.appendChild(row);
  });

  document.getElementById('familyAllBtn')?.addEventListener('click', () => {
    selectedFamilies.clear();
    document.querySelectorAll('.fam-cb').forEach(c => c.checked = false);
    applyFamilyFilter();
  });
}

function applyFamilyFilter() {
  const summary = document.getElementById('familySummary');
  if (selectedFamilies.size > 0) {
    ACTIVE_POOL = SPECIES_DATA.filter(s => selectedFamilies.has(s.family || s.family_modern));
    if (summary) summary.textContent = `${ACTIVE_POOL.length} species selected across ${selectedFamilies.size} families`;
  } else {
    ACTIVE_POOL = [...SPECIES_DATA];
    if (summary) summary.textContent = `All Virginia Tech Species (${SPECIES_DATA.length})`;
  }
  updateStartButtonLabel();
}

function updateStartButtonLabel() {
  const btn = document.getElementById('startBtn');
  if (btn) {
    const count = Math.min(TOTAL_QUESTIONS, ACTIVE_POOL.length);
    btn.textContent = `Start ${count}-Question Quiz`;
  }
}

/* ============================================================================
   EVENT LISTENERS & CONTROLS
============================================================================ */
function initEventListeners() {
  // Settings modal
  document.getElementById('settingsBtn')?.addEventListener('click', () => {
    document.getElementById('settingsPanel')?.classList.remove('hidden');
  });
  document.getElementById('settingsBtnQuiz')?.addEventListener('click', () => {
    document.getElementById('settingsPanel')?.classList.remove('hidden');
  });
  document.getElementById('closeSettingsBtn')?.addEventListener('click', () => {
    document.getElementById('settingsPanel')?.classList.add('hidden');
  });

  // Modes
  document.querySelectorAll('#modeSelect .mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const activeCount = document.querySelectorAll('#modeSelect .mode-btn.active').length;
      if (btn.classList.contains('active') && activeCount <= 1) return;
      btn.classList.toggle('active');

      selectedModes = [];
      document.querySelectorAll('#modeSelect .mode-btn.active').forEach(b => {
        selectedModes.push(b.dataset.mode);
      });
    });
  });

  // Play styles (Quiz vs Typing)
  const qBtn = document.getElementById('playStyleQuiz');
  const tBtn = document.getElementById('playStyleTyping');
  function toggleStyle(btn, style) {
    const activeCount = document.querySelectorAll('#playStyleSelect .mode-btn.active').length;
    if (btn.classList.contains('active') && activeCount <= 1) return;
    btn.classList.toggle('active');

    selectedStyles = [];
    if (qBtn?.classList.contains('active')) selectedStyles.push('quiz');
    if (tBtn?.classList.contains('active')) selectedStyles.push('typing');
  }
  qBtn?.addEventListener('click', () => toggleStyle(qBtn, 'quiz'));
  tBtn?.addEventListener('click', () => toggleStyle(tBtn, 'typing'));

  // Question counts
  document.querySelectorAll('#countSelect .count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#countSelect .count-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      TOTAL_QUESTIONS = parseInt(btn.dataset.count, 10);
      updateStartButtonLabel();
    });
  });

  // Choice counts
  document.querySelectorAll('#choicesSelect .choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#choicesSelect .choice-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      NUM_CHOICES = parseInt(btn.dataset.choices, 10);
    });
  });

  // Time slider
  document.getElementById('timeLimitSlider')?.addEventListener('input', (e) => {
    TIME_LIMIT = parseInt(e.target.value, 10);
    document.getElementById('timeLimitLabel').textContent = `${TIME_LIMIT}s`;
  });

  // Buttons
  document.getElementById('startBtn')?.addEventListener('click', () => startQuiz(false));
  document.getElementById('ultimateBtn')?.addEventListener('click', () => startQuiz(true));
  nextBtn?.addEventListener('click', nextQuestion);
  document.getElementById('startOverBtn')?.addEventListener('click', () => startQuiz(false));
  document.getElementById('homeBtn')?.addEventListener('click', showHomeScreen);
  document.getElementById('cancelQuizBtn')?.addEventListener('click', showHomeScreen);
  document.getElementById('hintBtn')?.addEventListener('click', revealImage);

  document.getElementById('typeSubmitBtn')?.addEventListener('click', handleTypedAnswer);
  typeInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleTypedAnswer();
  });

  // 360 Turntable canvas events
  if (turntableBox) {
    turntableBox.addEventListener('pointerdown', (e) => {
      isDraggingTurntable = true;
      turntableStartX = e.clientX;
    });
    window.addEventListener('pointermove', (e) => {
      if (!isDraggingTurntable || !currentTurntableFrames.length) return;
      const deltaX = e.clientX - turntableStartX;
      if (Math.abs(deltaX) > 12) {
        const step = deltaX > 0 ? 1 : -1;
        turntableIndex = (turntableIndex + step + currentTurntableFrames.length) % currentTurntableFrames.length;
        renderTurntableFrame();
        turntableStartX = e.clientX;
      }
    });
    window.addEventListener('pointerup', () => { isDraggingTurntable = false; });
  }
}

/* ============================================================================
   QUIZ ENGINE
============================================================================ */
function startQuiz(isUltimate = false) {
  if (!ACTIVE_POOL.length) {
    alert("No species selected.");
    return;
  }

  const pool = [...ACTIVE_POOL].sort(() => 0.5 - Math.random());
  const count = isUltimate ? pool.length : Math.min(TOTAL_QUESTIONS, pool.length);
  QUESTIONS = pool.slice(0, count);

  qIndex = 0;
  score = 0;
  streak = 0;

  startScreen.classList.add('hidden');
  endScreen.classList.add('hidden');
  quizScreen.classList.remove('hidden');
  stats.classList.remove('hidden');

  renderQuestion();
}

function renderQuestion() {
  answered = false;
  feedback.classList.add('hidden');
  nextBtn.classList.add('hidden');
  turntableBox.classList.add('hidden');
  speciesImg.classList.remove('revealed');
  speciesImg.removeAttribute('src');

  activeMode = selectedModes[Math.floor(Math.random() * selectedModes.length)] || 'sci-to-common';
  activeStyle = selectedStyles[Math.floor(Math.random() * selectedStyles.length)] || 'quiz';

  CURRENT_Q = QUESTIONS[qIndex];
  if (!CURRENT_Q) return;

  // Header status
  document.getElementById('qNum').textContent = qIndex + 1;
  document.getElementById('totalQ').textContent = QUESTIONS.length;
  progressBar.style.width = `${(qIndex / QUESTIONS.length) * 100}%`;

  const commonName = CURRENT_Q.common || "Unknown";
  const sciName = CURRENT_Q.scientific || "Unknown";
  const familyName = CURRENT_Q.family || CURRENT_Q.family_modern || "Unknown";

  if (activeMode === 'common-to-sci') {
    promptLabel.textContent = "Scientific Name";
    promptEl.textContent = commonName;
    currentCorrect = sciName;
  } else if (activeMode === 'family') {
    promptLabel.textContent = "Botanical Family";
    promptEl.textContent = `${commonName} (${sciName})`;
    currentCorrect = familyName;
  } else {
    promptLabel.textContent = "Common Name";
    promptEl.textContent = sciName;
    currentCorrect = commonName;
  }

  // Hydrate visual specimen and 360 bud turntable
  loadDiagnosticMedia(CURRENT_Q);

  // Setup answer mode
  if (activeStyle === 'typing') {
    optionsEl.classList.add('hidden');
    typeArea.classList.remove('hidden');
    if (typeInput) {
      typeInput.value = '';
      typeInput.disabled = false;
      setTimeout(() => typeInput.focus(), 60);
    }
  } else {
    typeArea.classList.add('hidden');
    optionsEl.classList.remove('hidden');
    renderMultipleChoiceOptions();
  }

  startTimer();
}

function renderMultipleChoiceOptions() {
  optionsEl.innerHTML = '';
  const choices = [currentCorrect];

  const distractors = ACTIVE_POOL
    .filter(s => s.id !== CURRENT_Q.id)
    .sort(() => 0.5 - Math.random())
    .slice(0, NUM_CHOICES - 1)
    .map(s => {
      if (activeMode === 'common-to-sci') return s.scientific;
      if (activeMode === 'family') return s.family || s.family_modern;
      return s.common;
    });

  choices.push(...distractors);
  choices.sort(() => 0.5 - Math.random());

  choices.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option';
    btn.textContent = opt;
    btn.addEventListener('click', () => evaluateAnswer(btn, opt));
    optionsEl.appendChild(btn);
  });
}

function evaluateAnswer(btn, chosen) {
  if (answered) return;
  answered = true;
  stopTimer();

  optionsEl.querySelectorAll('.option').forEach(b => b.disabled = true);
  const isMatch = chosen.toLowerCase().trim() === currentCorrect.toLowerCase().trim();

  if (isMatch) {
    if (btn) btn.classList.add('correct');
    score++;
    streak++;
    feedback.textContent = "✓ Correct!";
    feedback.className = "feedback correct";
  } else {
    if (btn) btn.classList.add('wrong');
    streak = 0;
    optionsEl.querySelectorAll('.option').forEach(b => {
      if (b.textContent.toLowerCase().trim() === currentCorrect.toLowerCase().trim()) {
        b.classList.add('correct');
      }
    });
    feedback.textContent = `✗ Incorrect — Correct: ${currentCorrect}`;
    feedback.className = "feedback wrong";
  }

  feedback.classList.remove('hidden');
  revealImage();
  nextBtn.classList.remove('hidden');

  document.getElementById('score').textContent = score;
  document.getElementById('streak').textContent = streak;
}

function handleTypedAnswer() {
  if (answered || !typeInput) return;
  const val = typeInput.value.trim();
  typeInput.disabled = true;
  evaluateAnswer(null, val);
}

function nextQuestion() {
  qIndex++;
  if (qIndex < QUESTIONS.length) {
    renderQuestion();
  } else {
    showEndScreen();
  }
}

/* ============================================================================
   CLOUDFLARE R2 & 3D BUD ROTATION PIPELINE
============================================================================ */
async function loadDiagnosticMedia(species) {
  imgLoading.classList.remove('hidden');
  imgPlaceholder.style.opacity = '0.4';

  const cleanName = (species.common || "").toLowerCase().replace(/[^a-z0-9]/g, '_');
  const r2ImageFolder = `${CLOUDFLARE_R2_BASE}/${cleanName}_image`;

  // 1. Load flat diagnostic photo
  const primaryUrl = `${r2ImageFolder}/diagnostic_0.jpg`;
  speciesImg.src = primaryUrl;
  speciesImg.onload = () => { imgLoading.classList.add('hidden'); };
  speciesImg.onerror = () => {
    // Fallback to Wikipedia / iNaturalist if not yet uploaded to R2
    fetchFallbackPhoto(species.scientific);
  };

  // 2. Configure 360 bud scan
  currentTurntableFrames = [];
  const testFrame = new Image();
  const frame0Url = `${r2ImageFolder}/3d_bud_scan/frame_00.jpg`;
  testFrame.src = frame0Url;

  testFrame.onload = () => {
    // 360 bud scan confirmed on Cloudflare R2
    spinBtn.classList.remove('hidden');
    spinBtn.onclick = () => activate360Turntable(r2ImageFolder);
  };
  testFrame.onerror = () => {
    // Check if a legacy Spinzam iframe exists
    if (species.spinzam_url) {
      spinBtn.classList.remove('hidden');
      spinBtn.onclick = () => embedLegacySpinzam(species.spinzam_url);
    } else {
      spinBtn.classList.add('hidden');
    }
  };
}

function activate360Turntable(folderUrl) {
  turntableBox.classList.remove('hidden');
  speciesImg.classList.remove('revealed');
  currentTurntableFrames = [];

  // Pre-cache the 36 turntable frames
  for (let i = 0; i < 36; i++) {
    const frameNum = String(i).padStart(2, '0');
    const img = new Image();
    img.src = `${folderUrl}/3d_bud_scan/frame_${frameNum}.jpg`;
    currentTurntableFrames.push(img);
  }

  turntableIndex = 0;
  renderTurntableFrame();
}

function renderTurntableFrame() {
  if (!currentTurntableFrames.length || !turntableCanvas) return;
  const ctx = turntableCanvas.getContext('2d');
  const img = currentTurntableFrames[turntableIndex];

  if (img.complete && img.naturalWidth > 0) {
    turntableCanvas.width = img.naturalWidth;
    turntableCanvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
  } else {
    img.onload = () => {
      turntableCanvas.width = img.naturalWidth;
      turntableCanvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
    };
  }
}

function embedLegacySpinzam(url) {
  const slot = document.getElementById('imageSlot');
  if (slot) {
    slot.innerHTML = `<iframe src="${url}" width="100%" height="100%" frameborder="0" scrolling="no" style="border:none;" allowfullscreen></iframe>`;
  }
}

async function fetchFallbackPhoto(scientificName) {
  try {
    const clean = scientificName.replace(/spp\.?/i, '').trim();
    const res = await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(clean)}&per_page=1`);
    const data = await res.json();
    const taxon = data.results?.[0];

    if (taxon?.default_photo?.medium_url) {
      speciesImg.src = taxon.default_photo.medium_url;
      speciesImg.onload = () => { imgLoading.classList.add('hidden'); };
    } else {
      imgLoading.classList.add('hidden');
    }
  } catch (err) {
    imgLoading.classList.add('hidden');
  }
}

function revealImage() {
  speciesImg.classList.add('revealed');
  imgPlaceholder.style.opacity = '0';
}

/* ============================================================================
   TIMER & SCREENS
============================================================================ */
function startTimer() {
  stopTimer();
  timeLeft = TIME_LIMIT;
  updateTimerUI();
  timerId = setInterval(() => {
    timeLeft--;
    updateTimerUI();
    if (timeLeft <= 0) {
      stopTimer();
      if (!answered) evaluateAnswer(null, "");
    }
  }, 1000);
}

function stopTimer() {
  if (timerId) { clearInterval(timerId); timerId = null; }
}

function updateTimerUI() {
  if (timerText) timerText.textContent = timeLeft;
  if (timerBar) timerBar.style.width = `${(timeLeft / TIME_LIMIT) * 100}%`;
}

function showEndScreen() {
  stopTimer();
  quizScreen.classList.add('hidden');
  stats.classList.add('hidden');
  endScreen.classList.remove('hidden');

  const pct = Math.round((score / QUESTIONS.length) * 100);
  document.getElementById('endMsg').textContent = `Final Score: ${score} / ${QUESTIONS.length} (${pct}%)`;
}

function showHomeScreen() {
  stopTimer();
  quizScreen.classList.add('hidden');
  stats.classList.add('hidden');
  endScreen.classList.add('hidden');
  startScreen.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', init);
