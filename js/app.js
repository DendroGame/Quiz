/* ============================================================================
   DENDROLOGY MASTER QUIZ ENGINE — v1.0.2
   - Responsive draggable image resizer (desktop & touch)
   - Working Quiz Test #1 - #5 lab presets
   - Multi-source photo loader with error handling
   - 3D Bud Scan (Spinzam) turntable integration
============================================================================ */

let SPECIES_DATA = [];
let masterPool = [];
let activeQuestions = [];
let currentIndex = 0;
let score = 0;
let streak = 0;
let currentSpecies = null;
let currentCorrect = "";
let answered = false;
let timerId = null;
let timeLeft = 15;
let TIME_LIMIT = 15;
let TOTAL_QUESTIONS = 10;
let NUM_CHOICES = 4;
let activeMode = "sci-to-common";
let activeStyle = "quiz";

// Complete Lab Presets (Scientific Names)
const LAB_PRESETS = {
  quizTest1: [
    "asimina triloba", "ilex opaca", "robinia pseudoacacia", "juglans nigra",
    "sassafras albidum", "lindera benzoin", "liriodendron tulipifera",
    "fraxinus americana", "paulownia tomentosa", "pinus strobus",
    "tsuga canadensis", "platanus occidentalis", "acer saccharum",
    "acer negundo", "aesculus flava", "parthenocissus quinquefolia",
    "toxicodendron radicans", "carpinus caroliniana", "elaeagnus umbellate",
    "reynoutria japonica"
  ],
  quizTest2: [
    "cercis canadensis", "quercus alba", "quercus montana", "quercus coccinea",
    "quercus marilandica", "prunus serotina", "pyrus calleryana",
    "acer platanoides", "ailanthus altissima", "tilia americana"
  ],
  quizTest3: [
    "quercus rubra", "magnolia acuminata", "acer pensylvanicum", "cornus florida",
    "acer rubrum", "quercus velutina", "smilax spp.", "carya cordiformis", "berbis spp."
  ],
  quizTest4: [
    "nyssa sylvatica", "fagus grandifolia", "pinus rigida", "pinus virginiana",
    "oxydendrum arboreum", "quercus falcata", "juniperus virginiana",
    "albizia julibrissin", "quercus stellata", "diospyros virginiana"
  ],
  quizTest5: [
    "malus pumila", "pinus taeda", "quercus phellos", "hedera helix",
    "catalpa speciosa", "cornus kousa", "carya glabra var.glabra",
    "fraxinus pennsylvanica", "rubus phoenicolasius", "ulmus rubra",
    "rosa multiflora", "cupressocyparis leylandii", "acer saccharinum"
  ]
};

// UI Cache
let startScreen, quizScreen, endScreen;
let promptEl, promptLabel, optionsEl, typeArea, typeInput, feedbackEl;
let photoEl, mediaBox, loaderEl, fallbackEl, spinBtn, nextBtn, progressBar, timerBar, timerText;

async function init() {
  cacheDOM();
  setupDraggableResizer();
  setupEventListeners();

  try {
    const res = await fetch('./data/species.json');
    SPECIES_DATA = await res.json();
    masterPool = [...SPECIES_DATA];
    console.log(`[v1.0.2] Loaded ${SPECIES_DATA.length} species records.`);
  } catch (err) {
    console.error("Failed loading data/species.json:", err);
  }
}

function cacheDOM() {
  startScreen = document.getElementById('startScreen');
  quizScreen = document.getElementById('quizScreen');
  endScreen = document.getElementById('endScreen');
  promptEl = document.getElementById('prompt');
  promptLabel = document.getElementById('promptLabel');
  optionsEl = document.getElementById('options');
  typeArea = document.getElementById('typeAnswerArea');
  typeInput = document.getElementById('typeAnswerInput');
  feedbackEl = document.getElementById('feedback');
  photoEl = document.getElementById('activePhoto');
  mediaBox = document.getElementById('mediaViewer');
  loaderEl = document.getElementById('mediaLoader');
  fallbackEl = document.getElementById('mediaFallback');
  spinBtn = document.getElementById('spinzamBtn');
  nextBtn = document.getElementById('nextBtn');
  progressBar = document.getElementById('progressBar');
  timerBar = document.getElementById('timerBar');
  timerText = document.getElementById('timerText');
}

/* ============================================================================
   DRAGGABLE IMAGE RESIZER (Supports Mouse & Touch)
============================================================================ */
function setupDraggableResizer() {
  const handle = document.getElementById('resizeBar');
  if (!handle || !mediaBox) return;

  let startY = 0;
  let startHeight = 0;

  function onPointerDown(e) {
    startY = e.clientY || (e.touches && e.touches[0].clientY);
    startHeight = mediaBox.offsetHeight;
    document.documentElement.addEventListener('pointermove', onPointerMove);
    document.documentElement.addEventListener('pointerup', onPointerUp);
    e.preventDefault();
  }

  function onPointerMove(e) {
    const currentY = e.clientY || (e.touches && e.touches[0].clientY);
    const deltaY = currentY - startY;
    const targetH = Math.max(70, Math.min(550, startHeight + deltaY));
    mediaBox.style.height = `${targetH}px`;
    document.documentElement.style.setProperty('--img-h', `${targetH}px`);
  }

  function onPointerUp() {
    document.documentElement.removeEventListener('pointermove', onPointerMove);
    document.documentElement.removeEventListener('pointerup', onPointerUp);
  }

  handle.addEventListener('pointerdown', onPointerDown);
}

/* ============================================================================
   EVENT LISTENERS & PRESETS
============================================================================ */
function setupEventListeners() {
  // Mode selection
  document.querySelectorAll('#modeSelect .mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#modeSelect .mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeMode = btn.dataset.mode || 'sci-to-common';
    });
  });

  // Input style selection
  document.querySelectorAll('#playStyleSelect .mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#playStyleSelect .mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeStyle = btn.id === 'playStyleTyping' ? 'typing' : 'quiz';
    });
  });

  // Question count buttons
  document.querySelectorAll('#countSelect .count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#countSelect .count-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      TOTAL_QUESTIONS = parseInt(btn.dataset.count, 10);
      const startBtn = document.getElementById('startBtn');
      if (startBtn) startBtn.textContent = `Start ${TOTAL_QUESTIONS}-Question Quiz`;
    });
  });

  // Presets Checkboxes (Quiz Tests 1-5)
  const presetKeys = ['quizTest1', 'quizTest2', 'quizTest3', 'quizTest4', 'quizTest5'];
  presetKeys.forEach((key, idx) => {
    const cb = document.getElementById(`quizTest${idx + 1}Toggle`);
    if (cb) {
      cb.addEventListener('change', updateActivePresetFilter);
    }
  });

  // Action buttons
  document.getElementById('startBtn')?.addEventListener('click', () => startQuiz());
  nextBtn?.addEventListener('click', nextQuestion);
  document.getElementById('startOverBtn')?.addEventListener('click', () => startQuiz());
  document.getElementById('homeBtn')?.addEventListener('click', showHomeScreen);
  document.getElementById('cancelQuizBtn')?.addEventListener('click', showHomeScreen);
  document.getElementById('typeSubmitBtn')?.addEventListener('click', handleTypedAnswer);
  typeInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleTypedAnswer();
  });
}

function updateActivePresetFilter() {
  const chosenSci = new Set();
  const presetKeys = ['quizTest1', 'quizTest2', 'quizTest3', 'quizTest4', 'quizTest5'];

  presetKeys.forEach((key, idx) => {
    const cb = document.getElementById(`quizTest${idx + 1}Toggle`);
    if (cb && cb.checked) {
      LAB_PRESETS[key].forEach(name => chosenSci.add(name.toLowerCase().trim()));
    }
  });

  if (chosenSci.size > 0) {
    masterPool = SPECIES_DATA.filter(sp => chosenSci.has(sp.scientific.toLowerCase().trim()));
    console.log(`[Presets Active] Pool reduced to ${masterPool.length} target species.`);
  } else {
    masterPool = [...SPECIES_DATA];
    console.log(`[Presets Cleared] Master pool restored to all ${masterPool.length} species.`);
  }

  const startBtn = document.getElementById('startBtn');
  if (startBtn) {
    const count = Math.min(TOTAL_QUESTIONS, masterPool.length);
    startBtn.textContent = `Start ${count}-Question Quiz`;
  }
}

/* ============================================================================
   QUIZ ENGINE
============================================================================ */
function startQuiz() {
  if (!masterPool.length) {
    alert("No species found matching the current presets.");
    return;
  }

  const pool = [...masterPool].sort(() => 0.5 - Math.random());
  activeQuestions = pool.slice(0, Math.min(TOTAL_QUESTIONS, pool.length));
  currentIndex = 0;
  score = 0;
  streak = 0;

  document.getElementById('score').textContent = '0';
  document.getElementById('streak').textContent = '0';

  startScreen.classList.add('hidden');
  endScreen.classList.add('hidden');
  quizScreen.classList.remove('hidden');

  renderQuestion();
}

function renderQuestion() {
  answered = false;
  feedbackEl?.classList.add('hidden');
  nextBtn?.classList.add('hidden');
  if (typeArea) typeArea.classList.add('hidden');
  if (optionsEl) optionsEl.classList.remove('hidden');

  currentSpecies = activeQuestions[currentIndex];
  if (!currentSpecies) return;

  // Header progress
  document.getElementById('qNum').textContent = currentIndex + 1;
  document.getElementById('totalQ').textContent = activeQuestions.length;
  if (progressBar) {
    progressBar.style.width = `${((currentIndex) / activeQuestions.length) * 100}%`;
  }

  // Set prompt text
  if (activeMode === 'common-to-sci') {
    promptLabel.textContent = "Scientific Name";
    promptEl.textContent = currentSpecies.common;
    currentCorrect = currentSpecies.scientific;
  } else if (activeMode === 'family') {
    promptLabel.textContent = "Botanical Family";
    promptEl.textContent = `${currentSpecies.common} (${currentSpecies.scientific})`;
    currentCorrect = currentSpecies.family || "Unknown Family";
  } else {
    promptLabel.textContent = "Common Name";
    promptEl.textContent = currentSpecies.scientific;
    currentCorrect = currentSpecies.common;
  }

  // Reset Photo & 3D Scan Button
  resetMediaStage();
  loadDiagnosticPhoto(currentSpecies.scientific);

  // Configure 3D Bud Scan button if Spinzam scan exists
  if (spinBtn) {
    if (currentSpecies.spinzam_url) {
      spinBtn.classList.remove('hidden');
      spinBtn.onclick = () => embed3DViewer(currentSpecies.spinzam_url);
    } else {
      spinBtn.classList.add('hidden');
    }
  }

  // Multiple Choice or Typing
  if (activeStyle === 'typing') {
    optionsEl.classList.add('hidden');
    typeArea.classList.remove('hidden');
    if (typeInput) {
      typeInput.value = '';
      typeInput.disabled = false;
      setTimeout(() => typeInput.focus(), 60);
    }
  } else {
    generateMultipleChoiceOptions();
  }

  startTimer();
}

function generateMultipleChoiceOptions() {
  optionsEl.innerHTML = '';
  const distractors = masterPool
    .filter(s => s.id !== currentSpecies.id)
    .sort(() => 0.5 - Math.random())
    .slice(0, NUM_CHOICES - 1)
    .map(s => {
      if (activeMode === 'common-to-sci') return s.scientific;
      if (activeMode === 'family') return s.family || 'Pinaceae';
      return s.common;
    });

  const choices = [currentCorrect, ...distractors].sort(() => 0.5 - Math.random());

  choices.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option';
    btn.textContent = opt;
    btn.addEventListener('click', () => evaluateAnswer(btn, opt));
    optionsEl.appendChild(btn);
  });
}

function evaluateAnswer(btn, selectedChoice) {
  if (answered) return;
  answered = true;
  stopTimer();

  optionsEl?.querySelectorAll('.option').forEach(b => b.disabled = true);
  const isMatch = selectedChoice.toLowerCase().trim() === currentCorrect.toLowerCase().trim();

  if (isMatch) {
    if (btn) btn.classList.add('correct');
    score++;
    streak++;
    feedbackEl.textContent = "✓ Correct!";
    feedbackEl.className = "feedback-banner correct";
  } else {
    if (btn) btn.classList.add('wrong');
    streak = 0;
    optionsEl?.querySelectorAll('.option').forEach(b => {
      if (b.textContent.toLowerCase().trim() === currentCorrect.toLowerCase().trim()) {
        b.classList.add('correct');
      }
    });
    feedbackEl.textContent = `✗ Incorrect — Correct Answer: ${currentCorrect}`;
    feedbackEl.className = "feedback-banner wrong";
  }

  document.getElementById('score').textContent = score;
  document.getElementById('streak').textContent = streak;
  feedbackEl.classList.remove('hidden');

  // Reveal Photo Fully
  if (photoEl) photoEl.classList.add('revealed');
  if (fallbackEl) fallbackEl.style.display = 'none';

  if (nextBtn) {
    nextBtn.textContent = (currentIndex + 1 >= activeQuestions.length) ? "Finish Quiz" : "Next Question →";
    nextBtn.classList.remove('hidden');
  }
}

function handleTypedAnswer() {
  if (answered || !typeInput) return;
  const typed = typeInput.value.trim();
  typeInput.disabled = true;
  evaluateAnswer(null, typed);
}

function nextQuestion() {
  currentIndex++;
  if (currentIndex < activeQuestions.length) {
    renderQuestion();
  } else {
    showEndScreen();
  }
}

/* ============================================================================
   PHOTO & 3D SCAN HANDLER
============================================================================ */
function resetMediaStage() {
  const stage = document.getElementById('imageStage');
  if (!stage) return;

  // Restore regular image elements if iframe was active
  if (!stage.querySelector('img')) {
    stage.innerHTML = `
      <img id="activePhoto" alt="Diagnostic woody specimen" class="specimen-img">
      <div id="mediaLoader" class="loader-spinner"></div>
      <div id="mediaFallback" class="fallback-note">Loading diagnostic photo...</div>
    `;
    cacheDOM();
  }

  if (photoEl) {
    photoEl.classList.remove('revealed');
    photoEl.removeAttribute('src');
    photoEl.style.display = 'none';
  }
  if (loaderEl) loaderEl.classList.remove('hidden');
  if (fallbackEl) {
    fallbackEl.style.display = 'block';
    fallbackEl.textContent = "Photo will reveal on submit";
  }
}

async function loadDiagnosticPhoto(scientificName) {
  const cleanName = scientificName.replace(/spp\.?/i, '').trim();

  try {
    // 1. Direct fetch from iNaturalist Research API
    const res = await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(cleanName)}&per_page=1`);
    const data = await res.json();
    const taxon = data.results?.[0];

    if (taxon && taxon.default_photo && taxon.default_photo.medium_url) {
      photoEl.src = taxon.default_photo.medium_url;
      photoEl.onload = () => {
        if (loaderEl) loaderEl.classList.add('hidden');
        photoEl.style.display = 'block';
      };
      return;
    }

    // 2. Wikimedia Commons fallback
    const wikiRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanName)}`);
    const wikiData = await wikiRes.json();
    if (wikiData.thumbnail && wikiData.thumbnail.source) {
      photoEl.src = wikiData.thumbnail.source;
      photoEl.onload = () => {
        if (loaderEl) loaderEl.classList.add('hidden');
        photoEl.style.display = 'block';
      };
      return;
    }

    throw new Error("No photo found in registry");
  } catch (err) {
    if (loaderEl) loaderEl.classList.add('hidden');
    if (fallbackEl) {
      fallbackEl.textContent = `No diagnostic photo available for ${cleanName}`;
      fallbackEl.style.display = 'block';
    }
  }
}

function embed3DViewer(url) {
  const stage = document.getElementById('imageStage');
  if (!stage) return;
  stage.innerHTML = `
    <iframe src="${url}" 
            width="100%" 
            height="100%" 
            frameborder="0" 
            scrolling="no" 
            style="border-radius:10px; border:none; width:100%; height:100%; min-height:160px;" 
            allowfullscreen>
    </iframe>`;
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
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function updateTimerUI() {
  if (timerText) timerText.textContent = timeLeft;
  if (timerBar) timerBar.style.width = `${(timeLeft / TIME_LIMIT) * 100}%`;
}

function showEndScreen() {
  stopTimer();
  quizScreen?.classList.add('hidden');
  endScreen?.classList.remove('hidden');

  const pct = Math.round((score / activeQuestions.length) * 100);
  const msg = document.getElementById('endMsg');
  if (msg) msg.textContent = `Final Score: ${score} / ${activeQuestions.length} (${pct}%)`;
}

function showHomeScreen() {
  stopTimer();
  quizScreen?.classList.add('hidden');
  endScreen?.classList.add('hidden');
  startScreen?.classList.remove('hidden');
}

// Bootstrap
document.addEventListener('DOMContentLoaded', init);
