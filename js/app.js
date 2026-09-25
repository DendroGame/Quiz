/* ============================================================================
   DENDROLOGY QUIZ — COMPLETE MODULAR CONTROLLER (js/app.js)
   ============================================================================ */

let SPECIES = [];
let FAMILIES = [];
let SPECIES_FAMILY = [];

let TIME_LIMIT = 15;
let TOTAL = 10;
let preferredQuizLength = 10;
let NUM_CHOICES = 4;
let PIC_APPEAR_AT = 5;
let selectedSpecies = [];
let mode = 'sci-to-common';
let selectedModes = ['sci-to-common'];
let selectedStyles = ['quiz'];
let selectedIdentifyAnswers = ['common'];
let identifyAnswerForm = 'common';
let IDENTIFY_PHOTO_COUNT = 10;
let questionModes = [];
let questionTypeAnswer = [];
let questionIdentifyForm = [];
let score = 0;
let streak = 0;
let qIndex = 0;
let currentCorrect = '';
let currentPair = null;
let questions = [];
let missed = [];
let answeredAfterPicTime = [];
let hintUsedThisQ = false;
let photoLoadGen = 0;
let quizStartTime = null;
let isGuest = false;
let playerName = '';
let isUltimate = false;
let isRetry = false;
let lastStartMode = false;
let noPictures = false;
let speakEnabled = false;
let SPEAK_DETAIL = 2;
let showPronunciations = false;
let showFamilyNames = false;
let showOptionMatches = true;
let showOptionFamilies = false;
let optionsFromPoolOnly = false;
let typeAnswerMode = false;
let typeTimerOff = false;
let typeSuggest = true;
let typeHalfCreditPending = false;
let typeRetakeUsed = false;
let typePendingRevealOrRetake = false;
let flashLookalikes = false;
let flashInfinite = false;
let timerId = null;
let timeLeft = TIME_LIMIT;
let answered = false;

// UI Elements
let modeBtns, startScreen, quizScreen, endScreen, stats;
let promptEl, promptLabel, optionsEl, feedback, nextBtn;
let progressBar, timerBar, timerText, speciesImg, imgPlaceholder, imgLoading, imgCredit;

document.addEventListener('DOMContentLoaded', async () => {
  await loadDatabase();
  initUI();
});

async function loadDatabase() {
  try {
    const res = await fetch('./data/species.json');
    const data = await res.json();
    
    SPECIES = data.map(item => [item.common, item.scientific]);
    SPECIES_FAMILY = data.map(item => item.familyNum || 1);
    
    FAMILIES = [
      { num: 1, name: "Adoxaceae", count: 3 },
      { num: 2, name: "Altingiaceae", count: 1 },
      { num: 20, name: "Fagaceae", count: 17 },
      { num: 33, name: "Pinaceae", count: 16 },
      { num: 37, name: "Sapindaceae", count: 10 }
    ];
  } catch (err) {
    console.error("Failed to load species.json:", err);
  }
}

function initUI() {
  modeBtns = document.querySelectorAll('#modeSelect .mode-btn');
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
  imgCredit = document.getElementById('imgCredit');

  setupListeners();
  setupImageResizer();
}

function setupListeners() {
  const startBtn = document.getElementById('startBtn');
  if (startBtn) startBtn.addEventListener('click', () => startQuiz(false));

  const guestBtn = document.getElementById('guestBtn');
  if (guestBtn) guestBtn.addEventListener('click', () => startQuiz(true));

  const ultimateBtn = document.getElementById('ultimateBtn');
  if (ultimateBtn) ultimateBtn.addEventListener('click', () => startQuiz('ultimate'));

  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  if (settingsBtn && settingsPanel) {
    settingsBtn.addEventListener('click', () => settingsPanel.classList.remove('hidden'));
  }

  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  if (closeSettingsBtn && settingsPanel) {
    closeSettingsBtn.addEventListener('click', () => settingsPanel.classList.add('hidden'));
  }

  const hintBtn = document.getElementById('hintBtn');
  if (hintBtn) {
    hintBtn.addEventListener('click', () => {
      hintUsedThisQ = true;
      if (currentPair) {
        speciesImg.src = `https://images.weserv.nl/?url=commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(currentPair[1])}`;
        speciesImg.classList.add('revealed');
        if (imgPlaceholder) imgPlaceholder.style.opacity = '0';
      }
    });
  }
}

function setupImageResizer() {
  const handle = document.getElementById('imgResizeHandle');
  const imageWrap = document.getElementById('imageWrap');
  if (!handle || !imageWrap) return;

  let isResizing = false;
  let startY = 0;
  let startHeight = 180;

  handle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startY = e.clientY;
    startHeight = imageWrap.offsetHeight;
    document.body.style.userSelect = 'none';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const dy = e.clientY - startY;
    const newHeight = Math.max(90, Math.min(400, startHeight + dy));
    imageWrap.style.height = newHeight + 'px';
  });

  window.addEventListener('mouseup', () => {
    isResizing = false;
    document.body.style.userSelect = '';
  });
}

function startQuiz(modeArg) {
  lastStartMode = modeArg;
  isUltimate = (modeArg === 'ultimate');
  isGuest = !!modeArg && modeArg !== 'ultimate';
  
  const nameInput = document.getElementById('playerName');
  playerName = nameInput ? nameInput.value.trim() : '';

  questions = pickQuestions();
  if (!questions.length) {
    alert('Please select at least one species or family!');
    return;
  }

  TOTAL = isUltimate ? questions.length : preferredQuizLength;
  if (questions.length > TOTAL) questions = questions.slice(0, TOTAL);

  assignQuestionMeta();
  qIndex = 0;
  score = 0;
  streak = 0;
  missed = [];

  startScreen.classList.add('hidden');
  endScreen.classList.add('hidden');
  quizScreen.classList.remove('hidden');
  stats.classList.remove('hidden');
  document.body.classList.add('in-quiz');

  showQuestion();
}

function poolForFamily() {
  if (!selectedSpecies.length) return SPECIES.slice();
  const pool = [];
  selectedSpecies.forEach(i => {
    if (SPECIES[i]) pool.push(SPECIES[i]);
  });
  return pool.length ? pool : SPECIES.slice();
}

function pickQuestions() {
  const pool = poolForFamily();
  if (!pool.length) return [];
  const out = [];
  let bag = [...pool].sort(() => Math.random() - 0.5);
  while (out.length < TOTAL && bag.length) {
    out.push(bag.pop());
  }
  return out;
}

function assignQuestionMeta() {
  questionModes = [];
  questionTypeAnswer = [];
  for (let i = 0; i < questions.length; i++) {
    questionModes.push(selectedModes[0] || 'sci-to-common');
    questionTypeAnswer.push(selectedStyles.includes('typing') && !selectedStyles.includes('quiz'));
  }
}

function applyQuestionMeta(index) {
  mode = questionModes[index] || 'sci-to-common';
  typeAnswerMode = questionTypeAnswer[index] || false;
}

function showQuestion() {
  feedback.classList.add('hidden');
  nextBtn.classList.add('hidden');
  optionsEl.innerHTML = '';
  answered = false;
  hintUsedThisQ = false;

  applyQuestionMeta(qIndex);

  const pair = questions[qIndex];
  currentPair = pair;

  if (speciesImg) {
    speciesImg.classList.remove('revealed');
    speciesImg.removeAttribute('src');
    if (imgPlaceholder) imgPlaceholder.style.opacity = '0.45';
  }

  if (mode === 'sci-to-common') {
    promptLabel.textContent = 'Scientific name';
    promptEl.textContent = pair[1];
    currentCorrect = pair[0];
  } else {
    promptLabel.textContent = 'Common name';
    promptEl.textContent = pair[0];
    currentCorrect = pair[1];
  }

  if (typeAnswerMode) {
    optionsEl.classList.add('hidden');
    document.getElementById('typeAnswerArea')?.classList.remove('hidden');
  } else {
    document.getElementById('typeAnswerArea')?.classList.add('hidden');
    optionsEl.classList.remove('hidden');

    const opts = getOptions(pair);
    opts.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'option';
      btn.textContent = opt;
      btn.dataset.value = opt;
      btn.addEventListener('click', () => selectAnswer(btn, opt));
      optionsEl.appendChild(btn);
    });
  }

  document.getElementById('qNum').textContent = qIndex + 1;
  document.getElementById('totalQ').textContent = TOTAL;
  progressBar.style.width = ((qIndex / TOTAL) * 100) + '%';

  startTimer();
}

function getOptions(correctPair) {
  const isSciToCommon = mode === 'sci-to-common';
  const correctAnswer = isSciToCommon ? correctPair[0] : correctPair[1];
  const pool = SPECIES.filter(p => (isSciToCommon ? p[0] : p[1]) !== correctAnswer);
  const distractors = [...pool].sort(() => Math.random() - 0.5).slice(0, NUM_CHOICES - 1).map(p => isSciToCommon ? p[0] : p[1]);
  return [correctAnswer, ...distractors].sort(() => Math.random() - 0.5);
}

function selectAnswer(btn, chosen) {
  if (answered) return;
  answered = true;
  stopTimer();

  const allOpts = optionsEl.querySelectorAll('.option');
  allOpts.forEach(o => o.disabled = true);

  const isCorrect = chosen === currentCorrect;
  if (isCorrect) {
    btn.classList.add('correct');
    score++;
    streak++;
    feedback.textContent = '✓ Correct!';
    feedback.className = 'feedback correct';
  } else {
    btn.classList.add('wrong');
    streak = 0;
    allOpts.forEach(o => {
      if (o.dataset.value === currentCorrect) o.classList.add('correct');
    });
    feedback.textContent = `✗ Wrong — Correct: ${currentCorrect}`;
    feedback.className = 'feedback wrong';
  }

  feedback.classList.remove('hidden');
  nextBtn.classList.remove('hidden');

  document.getElementById('score').textContent = score;
  document.getElementById('streak').textContent = streak;
}

nextBtn.addEventListener('click', () => {
  qIndex++;
  if (qIndex < questions.length) {
    showQuestion();
  } else {
    showEndScreen();
  }
});

function showEndScreen() {
  quizScreen.classList.add('hidden');
  stats.classList.add('hidden');
  document.body.classList.remove('in-quiz');
  endScreen.classList.remove('hidden');

  const endMsg = document.getElementById('endMsg');
  if (endMsg) {
    endMsg.textContent = `You scored ${score} out of ${TOTAL}!`;
  }
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
      if (!answered) handleTimeout();
    }
  }, 1000);
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function updateTimerDisplay() {
  if (timerText) timerText.textContent = timeLeft;
  if (timerBar) {
    const pct = (timeLeft / TIME_LIMIT) * 100;
    timerBar.style.width = pct + '%';
  }
}

function handleTimeout() {
  answered = true;
  feedback.textContent = `⏱ Time's up — Correct: ${currentCorrect}`;
  feedback.className = 'feedback wrong';
  feedback.classList.remove('hidden');
  nextBtn.classList.remove('hidden');
}
