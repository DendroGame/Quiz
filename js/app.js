/* ============================================================================
   DENDROLOGY QUIZ ENGINE — v1.0.3
   - Restored full settings panel, question counts, and choice options
   - Diagnostic photo pipeline with resilient Wikimedia & iNaturalist resolution
   - Draggable image resize bar support (pointer & touch)
   - Integrated Spinzam 3D Bud Scan modal viewer
============================================================================ */

let SPECIES = [];
let SPECIES_DATA = [];
let SPECIES_FAMILY = [];
let COMMON_TO_SCI = {};
let SCI_TO_COMMON = {};

const FAMILIES = [
  { num: 1, name: "Adoxaceae", count: 3 }, { num: 2, name: "Altingiaceae", count: 1 },
  { num: 3, name: "Anacardiaceae", count: 4 }, { num: 4, name: "Annonaceae", count: 1 },
  { num: 5, name: "Apocynaceae", count: 1 }, { num: 6, name: "Aquifoliaceae", count: 3 },
  { num: 7, name: "Araliaceae", count: 3 }, { num: 8, name: "Berberidaceae", count: 1 },
  { num: 9, name: "Betulaceae", count: 11 }, { num: 10, name: "Bignoniaceae", count: 1 },
  { num: 11, name: "Caesalpiniaceae", count: 3 }, { num: 12, name: "Cannabaceae", count: 1 },
  { num: 13, name: "Caprifoliaceae", count: 2 }, { num: 14, name: "Celastraceae", count: 2 },
  { num: 15, name: "Cornaceae", count: 5 }, { num: 16, name: "Cupressaceae", count: 4 },
  { num: 17, name: "Ebenaceae", count: 1 }, { num: 18, name: "Ericaceae", count: 9 },
  { num: 19, name: "Fabaceae", count: 5 }, { num: 20, name: "Fagaceae", count: 17 },
  { num: 21, name: "Ginkgoaceae", count: 1 }, { num: 22, name: "Hamamelidaceae", count: 1 },
  { num: 23, name: "Juglandaceae", count: 7 }, { num: 24, name: "Lauraceae", count: 2 },
  { num: 25, name: "Lythraceae", count: 1 }, { num: 26, name: "Magnoliaceae", count: 4 },
  { num: 27, name: "Mimosaceae", count: 1 }, { num: 28, name: "Moraceae", count: 2 },
  { num: 29, name: "Nyssaceae", count: 1 }, { num: 30, name: "Oleaceae", count: 3 },
  { num: 32, name: "Paulowniaceae", count: 1 }, { num: 33, name: "Pinaceae", count: 16 },
  { num: 34, name: "Platanaceae", count: 1 }, { num: 35, name: "Rosaceae", count: 14 },
  { num: 36, name: "Salicaceae", count: 7 }, { num: 37, name: "Sapindaceae", count: 10 },
  { num: 38, name: "Simaroubaceae", count: 1 }, { num: 39, name: "Taxaceae", count: 1 },
  { num: 40, name: "Tiliaceae", count: 2 }, { num: 41, name: "Ulmaceae", count: 3 },
  { num: 42, name: "Vitaceae", count: 2 }, { num: 43, name: "Grossulariaceae", count: 1 },
  { num: 44, name: "Myricaceae", count: 1 }, { num: 45, name: "Hydrangeaceae", count: 1 },
  { num: 46, name: "Smilacaceae", count: 1 }, { num: 47, name: "Staphyleaceae", count: 1 },
  { num: 48, name: "Thymelaeaceae", count: 1 }, { num: 49, name: "Elaeagnaceae", count: 1 },
  { num: 50, name: "Polygonaceae", count: 1 }
];

const QUIZ_TEST_1_SCI = ["asimina triloba","ilex opaca","robinia pseudoacacia","juglans nigra","sassafras albidum","lindera benzoin","liriodendron tulipifera","fraxinus americana","paulownia tomentosa","pinus strobus","tsuga canadensis","platanus occidentalis","acer saccharum","acer negundo","aesculus flava","parthenocissus quinquefolia","toxicodendron radicans","carpinus caroliniana","elaeagnus umbellate","reynoutria japonica"];
const QUIZ_TEST_2_SCI = ["cercis canadensis","quercus alba","quercus montana","quercus coccinea","quercus marilandica","prunus serotina","pyrus calleryana","acer platanoides","ailanthus altissima","tilia americana"];
const QUIZ_TEST_3_SCI = ["quercus rubra","magnolia acuminata","acer pensylvanicum","cornus florida","acer rubrum","quercus velutina","smilax spp.","carya cordiformis","berbis spp."];
const QUIZ_TEST_4_SCI = ["nyssa sylvatica","fagus grandifolia","pinus rigida","pinus virginiana","oxydendrum arboreum","quercus falcata","juniperus virginiana","albizia julibrissin","quercus stellata","diospyros virginiana"];
const QUIZ_TEST_5_SCI = ["malus pumila","pinus taeda","quercus phellos","hedera helix","catalpa speciosa","cornus kousa","carya glabra var.glabra","fraxinus pennsylvanica","rubus phoenicolasius","ulmus rubra","rosa multiflora","cupressocyparis leylandii","acer saccharinum"];

let TIME_LIMIT = 15;
let TOTAL = 10;
let NUM_CHOICES = 4;
let selectedSpecies = [];
let mode = 'sci-to-common';
let selectedModes = ['sci-to-common'];
let selectedStyles = ['quiz'];
let score = 0;
let streak = 0;
let qIndex = 0;
let currentCorrect = '';
let currentPair = null;
let currentSpeciesObj = null;
let questions = [];
let timerId = null;
let timeLeft = TIME_LIMIT;
let answered = false;
let hintUsedThisQ = false;

// DOM references
let startScreen, quizScreen, endScreen, stats, promptEl, promptLabel;
let optionsEl, feedback, nextBtn, progressBar, timerBar, timerText, speciesImg;
let imgPlaceholder, imgLoading, spinBtn;

function initImageResizer() {
  const handle = document.getElementById('imgResizeHandle');
  const wrap = document.getElementById('imageWrap');
  if (!handle || !wrap) return;

  let startY, startH;
  function onPointerDown(e) {
    startY = e.clientY || (e.touches && e.touches[0].clientY);
    startH = wrap.offsetHeight;
    document.documentElement.addEventListener('pointermove', onPointerMove);
    document.documentElement.addEventListener('pointerup', onPointerUp);
    e.preventDefault();
  }
  function onPointerMove(e) {
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    const newH = Math.max(60, Math.min(480, startH + (clientY - startY)));
    wrap.style.height = `${newH}px`;
    wrap.style.setProperty('--img-h', `${newH}px`);
  }
  function onPointerUp() {
    document.documentElement.removeEventListener('pointermove', onPointerMove);
    document.documentElement.removeEventListener('pointerup', onPointerUp);
  }
  handle.addEventListener('pointerdown', onPointerDown);
}

async function loadDataAndInit() {
  try {
    const res = await fetch('./data/species.json');
    SPECIES_DATA = await res.json();
    
    SPECIES = [];
    SPECIES_FAMILY = [];
    COMMON_TO_SCI = {};
    SCI_TO_COMMON = {};

    SPECIES_DATA.forEach(item => {
      SPECIES.push([item.common, item.scientific]);
      SPECIES_FAMILY.push(item.familyNum || 1);
      COMMON_TO_SCI[item.common] = item.scientific;
      SCI_TO_COMMON[item.scientific] = item.common;
    });

    initUISelectors();
    initFamilySelect();
    initSettingsAndPanels();
    initImageResizer();
  } catch (err) {
    console.error("Failed loading data/species.json:", err);
  }
}

function initUISelectors() {
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
}

function initSettingsAndPanels() {
  // Settings toggle
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
      document.querySelectorAll('#modeSelect .mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      mode = btn.dataset.mode;
      selectedModes = [mode];
    });
  });

  // Play Styles
  const quizBtn = document.getElementById('playStyleQuiz');
  const typeBtn = document.getElementById('playStyleTyping');
  quizBtn?.addEventListener('click', () => {
    quizBtn.classList.add('active');
    typeBtn.classList.remove('active');
    selectedStyles = ['quiz'];
  });
  typeBtn?.addEventListener('click', () => {
    typeBtn.classList.add('active');
    quizBtn.classList.remove('active');
    selectedStyles = ['typing'];
  });

  // Timer
  document.getElementById('timeLimitSlider')?.addEventListener('input', (e) => {
    TIME_LIMIT = parseInt(e.target.value, 10);
    document.getElementById('timeLimitLabel').textContent = TIME_LIMIT + 's';
  });

  // Counts
  document.querySelectorAll('#countSelect .count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#countSelect .count-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      TOTAL = parseInt(btn.dataset.count, 10);
      const startBtn = document.getElementById('startBtn');
      if (startBtn) startBtn.textContent = `Start ${TOTAL}-question quiz`;
    });
  });

  // Choice Counts
  document.querySelectorAll('#choicesSelect .choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#choicesSelect .choice-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      NUM_CHOICES = parseInt(btn.dataset.choices, 10);
    });
  });

  // Action Buttons
  nextBtn?.addEventListener('click', nextQuestion);
  document.getElementById('startOverBtn')?.addEventListener('click', () => window.startQuiz(false));
  document.getElementById('homeBtn')?.addEventListener('click', () => {
    endScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
  });

  document.getElementById('hintBtn')?.addEventListener('click', () => {
    hintUsedThisQ = true;
    revealImage();
  });

  document.getElementById('cancelQuizBtn')?.addEventListener('click', () => {
    stopTimer();
    quizScreen.classList.add('hidden');
    stats.classList.add('hidden');
    startScreen.classList.remove('hidden');
  });

  document.getElementById('typeSubmitBtn')?.addEventListener('click', handleTypedAnswer);
  document.getElementById('typeAnswerInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleTypedAnswer();
  });
}

function initFamilySelect() {
  const list = document.getElementById('familyCheckList');
  const summary = document.getElementById('familySummary');
  if (!list) return;
  list.innerHTML = '';

  FAMILIES.forEach(f => {
    const block = document.createElement('div');
    block.style.padding = '4px 0';
    block.innerHTML = `<label class="chk-label" style="font-size:0.85rem;">
      <input type="checkbox" class="family-cb" data-fam="${f.num}"> ${f.num}. ${f.name} (${f.count})
    </label>`;
    list.appendChild(block);
  });

  document.getElementById('familyAllBtn')?.addEventListener('click', () => {
    selectedSpecies = [];
    document.querySelectorAll('.family-cb').forEach(c => c.checked = false);
    if (summary) summary.textContent = `All species (${SPECIES.length})`;
  });

  // Presets
  const presets = [
    { id: 'quizTest1Toggle', sci: QUIZ_TEST_1_SCI },
    { id: 'quizTest2Toggle', sci: QUIZ_TEST_2_SCI },
    { id: 'quizTest3Toggle', sci: QUIZ_TEST_3_SCI },
    { id: 'quizTest4Toggle', sci: QUIZ_TEST_4_SCI },
    { id: 'quizTest5Toggle', sci: QUIZ_TEST_5_SCI }
  ];

  presets.forEach(p => {
    document.getElementById(p.id)?.addEventListener('change', () => {
      const want = new Set();
      presets.forEach(pr => {
        if (document.getElementById(pr.id)?.checked) {
          pr.sci.forEach(s => want.add(s.toLowerCase().trim()));
        }
      });
      if (want.size > 0) {
        const matches = [];
        SPECIES.forEach((pair, idx) => {
          if (want.has(pair[1].toLowerCase().trim())) matches.push(idx);
        });
        selectedSpecies = matches;
        if (summary) summary.textContent = `${matches.length} species selected (Preset active)`;
      } else {
        selectedSpecies = [];
        if (summary) summary.textContent = `All species (${SPECIES.length})`;
      }
    });
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

window.startQuiz = function() {
  const pool = selectedSpecies.length ? selectedSpecies.map(i => SPECIES[i]) : SPECIES.slice();
  questions = shuffle(pool).slice(0, Math.min(TOTAL, pool.length));
  TOTAL = questions.length;
  qIndex = 0;
  score = 0;
  streak = 0;

  startScreen.classList.add('hidden');
  endScreen.classList.add('hidden');
  quizScreen.classList.remove('hidden');
  stats.classList.remove('hidden');

  showQuestion();
};

function showQuestion() {
  feedback.classList.add('hidden');
  nextBtn.classList.add('hidden');
  optionsEl.innerHTML = '';
  answered = false;
  hintUsedThisQ = false;

  const pair = questions[qIndex];
  currentPair = pair;
  currentSpeciesObj = SPECIES_DATA.find(s => s.scientific.toLowerCase() === pair[1].toLowerCase()) || null;

  const isSciToCommon = mode === 'sci-to-common';
  currentCorrect = isSciToCommon ? pair[0] : pair[1];

  promptLabel.textContent = isSciToCommon ? 'Scientific name' : 'Common name';
  promptEl.textContent = isSciToCommon ? pair[1] : pair[0];

  document.getElementById('qNum').textContent = qIndex + 1;
  document.getElementById('totalQ').textContent = TOTAL;
  progressBar.style.width = ((qIndex / TOTAL) * 100) + '%';

  // 3D Bud Scan integration
  if (spinBtn) {
    if (currentSpeciesObj && currentSpeciesObj.spinzam_url) {
      spinBtn.classList.remove('hidden');
      spinBtn.onclick = () => {
        const slot = document.getElementById('imageSlot');
        slot.innerHTML = `
          <iframe src="${currentSpeciesObj.spinzam_url}" 
                  width="100%" height="100%" 
                  frameborder="0" scrolling="no" 
                  style="border:none;" allowfullscreen>
          </iframe>`;
      };
    } else {
      spinBtn.classList.add('hidden');
    }
  }

  // Quiz vs Typing
  const typeArea = document.getElementById('typeAnswerArea');
  const typeInput = document.getElementById('typeAnswerInput');
  if (selectedStyles.includes('typing')) {
    optionsEl.classList.add('hidden');
    typeArea.classList.remove('hidden');
    if (typeInput) {
      typeInput.value = '';
      typeInput.disabled = false;
      setTimeout(() => typeInput.focus(), 50);
    }
  } else {
    typeArea.classList.add('hidden');
    optionsEl.classList.remove('hidden');

    const choices = [currentCorrect];
    const distractorPool = SPECIES.map(p => isSciToCommon ? p[0] : p[1]).filter(n => n !== currentCorrect);
    shuffle(distractorPool).slice(0, NUM_CHOICES - 1).forEach(c => choices.push(c));

    shuffle(choices).forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'option';
      btn.textContent = opt;
      btn.addEventListener('click', () => selectAnswer(btn, opt));
      optionsEl.appendChild(btn);
    });
  }

  loadPhoto(pair[1]);
  startTimer();
}

function handleTypedAnswer() {
  if (answered) return;
  const input = document.getElementById('typeAnswerInput');
  const typed = (input?.value || '').trim();
  selectAnswer(document.createElement('div'), typed);
}

function selectAnswer(btn, chosen) {
  if (answered) return;
  answered = true;
  stopTimer();

  optionsEl.querySelectorAll('.option').forEach(o => o.disabled = true);
  const correct = chosen.toLowerCase().trim() === currentCorrect.toLowerCase().trim();

  if (correct) {
    btn.classList.add('correct');
    score++;
    streak++;
    feedback.textContent = '✓ Correct!';
    feedback.className = 'feedback correct';
  } else {
    btn.classList.add('wrong');
    streak = 0;
    optionsEl.querySelectorAll('.option').forEach(o => {
      if (o.textContent.toLowerCase().trim() === currentCorrect.toLowerCase().trim()) {
        o.classList.add('correct');
      }
    });
    feedback.textContent = `✗ Wrong — Correct: ${currentCorrect}`;
    feedback.className = 'feedback wrong';
  }

  feedback.classList.remove('hidden');
  revealImage();
  nextBtn.classList.remove('hidden');
  document.getElementById('score').textContent = score;
  document.getElementById('streak').textContent = streak;
}

function nextQuestion() {
  qIndex++;
  if (qIndex < questions.length) {
    showQuestion();
  } else {
    endQuiz();
  }
}

function endQuiz() {
  stopTimer();
  quizScreen.classList.add('hidden');
  stats.classList.add('hidden');
  endScreen.classList.remove('hidden');
  document.getElementById('endMsg').textContent = `Final Score: ${score}/${TOTAL} (${Math.round((score / TOTAL) * 100)}%)`;
}

function updateTimerDisplay() {
  if (!timerText || !timerBar) return;
  timerText.textContent = timeLeft;
  timerBar.style.width = (timeLeft / TIME_LIMIT * 100) + '%';
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

async function loadPhoto(sciName) {
  const slot = document.getElementById('imageSlot');
  if (slot && !slot.querySelector('#speciesImg')) {
    slot.innerHTML = `
      <span class="image-placeholder" id="imgPlaceholder">🌿</span>
      <span class="image-loading hidden" id="imgLoading">Loading photo…</span>
      <img id="speciesImg" alt="Species photo" />
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

  const clean = sciName.replace(/spp\.?/i, '').trim();

  try {
    const res = await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(clean)}&per_page=1`);
    const data = await res.json();
    const taxon = data.results?.[0];
    if (taxon?.default_photo?.medium_url && speciesImg) {
      speciesImg.src = taxon.default_photo.medium_url;
      speciesImg.onload = () => {
        if (imgLoading) imgLoading.classList.add('hidden');
        if (hintUsedThisQ) revealImage();
      };
      return;
    }

    // Secondary fallback
    const wiki = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(clean)}`);
    const wikiData = await wiki.json();
    if (wikiData.thumbnail?.source && speciesImg) {
      speciesImg.src = wikiData.thumbnail.source;
      speciesImg.onload = () => {
        if (imgLoading) imgLoading.classList.add('hidden');
        if (hintUsedThisQ) revealImage();
      };
      return;
    }
  } catch (e) {}

  if (imgLoading) imgLoading.classList.add('hidden');
}

function revealImage() {
  if (speciesImg && speciesImg.src) speciesImg.classList.add('revealed');
  if (imgPlaceholder) imgPlaceholder.style.opacity = '0';
}

document.addEventListener('DOMContentLoaded', loadDataAndInit);
