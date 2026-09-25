/* ============================================================================
   APP CONTROLLER WITH PHASE 1 MEDIA ENGINE (js/app.js)
============================================================================ */

import { getDiagnosticPhotoUrl, getBudScanFrameUrl, formatSpeciesSlug } from './photo-service.js';

let masterSpecies = [];
let activeQuizPool = [];
let currentIndex = 0;
let currentScore = 0;
let streak = 0;
let currentSpecies = null;
let currentPart = "leaf";
let current360Frame = 0;

// DOM Elements
let startScreen, quizScreen, endScreen;
let promptEl, promptLabel, optionsEl, feedbackEl;
let photoEl, loadingEl, scoreEl, streakEl;
let mediaWrap, resizeHandle, partTabs, turntablePanel, frameSlider, frameLabel;

async function init() {
  cacheDOMElements();
  initResizeHandler();
  initTurntableInteraction();
  initPartTabs();

  try {
    const res = await fetch('./data/species.json');
    masterSpecies = await res.json();
  } catch (err) {
    console.error("Failed loading species.json:", err);
    return;
  }

  setupEventListeners();
}

function cacheDOMElements() {
  startScreen = document.getElementById('startScreen');
  quizScreen = document.getElementById('quizScreen');
  endScreen = document.getElementById('endScreen');
  promptEl = document.getElementById('prompt');
  promptLabel = document.getElementById('promptLabel');
  optionsEl = document.getElementById('options');
  feedbackEl = document.getElementById('feedback');
  photoEl = document.getElementById('speciesImg');
  loadingEl = document.getElementById('imgLoading');
  scoreEl = document.getElementById('score');
  streakEl = document.getElementById('streak');
  mediaWrap = document.getElementById('mediaWrap');
  resizeHandle = document.getElementById('resizeHandle');
  partTabs = document.getElementById('partTabs');
  turntablePanel = document.getElementById('turntablePanel');
  frameSlider = document.getElementById('frameSlider');
  frameLabel = document.getElementById('frameLabel');
}

function setupEventListeners() {
  document.getElementById('startBtn')?.addEventListener('click', startQuiz);
  document.getElementById('nextBtn')?.addEventListener('click', nextQuestion);
  document.getElementById('homeBtn')?.addEventListener('click', showStartScreen);
}

// 1. Draggable Vertical Resizer Handle
function initResizeHandler() {
  if (!resizeHandle || !mediaWrap) return;
  let startY, startH;

  const onPointerMove = (e) => {
    const clientY = e.clientY ?? (e.touches && e.touches[0].clientY);
    const newH = Math.max(120, Math.min(520, startH + (clientY - startY)));
    mediaWrap.style.height = `${newH}px`;
  };

  const onPointerUp = () => {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
  };

  resizeHandle.addEventListener('pointerdown', (e) => {
    startY = e.clientY ?? (e.touches && e.touches[0].clientY);
    startH = mediaWrap.offsetHeight;
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    e.preventDefault();
  });
}

// 2. Diagnostic Part Tabs
function initPartTabs() {
  partTabs?.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      partTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPart = btn.dataset.part;
      loadActiveMedia();
    });
  });
}

// 3. 360 Bud Turntable Slider & Drag-to-Spin
function initTurntableInteraction() {
  if (!frameSlider) return;

  frameSlider.addEventListener('input', (e) => {
    current360Frame = parseInt(e.target.value, 10);
    renderTurntableFrame();
  });

  // Touch and mouse horizontal drag spinning inside media box
  let dragStartX = 0;
  let dragStartFrame = 0;
  let isDragging = false;

  mediaWrap?.addEventListener('pointerdown', (e) => {
    if (currentPart !== '360') return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartFrame = current360Frame;
  });

  window.addEventListener('pointermove', (e) => {
    if (!isDragging || currentPart !== '360') return;
    const dx = e.clientX - dragStartX;
    const frameDelta = Math.floor(dx / 10); // 10px per frame sensitivity
    current360Frame = (dragStartFrame + frameDelta) % 36;
    if (current360Frame < 0) current360Frame += 36;
    frameSlider.value = current360Frame;
    renderTurntableFrame();
  });

  window.addEventListener('pointerup', () => { isDragging = false; });
}

function renderTurntableFrame() {
  if (!currentSpecies) return;
  photoEl.src = getBudScanFrameUrl(currentSpecies.common, current360Frame);
  if (frameLabel) frameLabel.textContent = `${String(current360Frame + 1).padStart(2, '0')}/36`;
}

function loadActiveMedia() {
  if (!currentSpecies || !photoEl) return;

  if (currentPart === '360') {
    turntablePanel?.classList.remove('hidden');
    current360Frame = 0;
    if (frameSlider) frameSlider.value = 0;
    renderTurntableFrame();
    return;
  }

  turntablePanel?.classList.add('hidden');
  loadingEl?.classList.remove('hidden');
  photoEl.classList.add('hidden');

  photoEl.src = getDiagnosticPhotoUrl(currentSpecies.common, currentPart);
  photoEl.onload = () => {
    loadingEl?.classList.add('hidden');
    photoEl.classList.remove('hidden');
  };
  photoEl.onerror = () => {
    // If specific part image is missing, fallback to leaf
    if (currentPart !== 'leaf') {
      photoEl.src = getDiagnosticPhotoUrl(currentSpecies.common, 'leaf');
    } else {
      loadingEl?.classList.add('hidden');
    }
  };
}

function startQuiz() {
  activeQuizPool = [...masterSpecies].sort(() => 0.5 - Math.random()).slice(0, 10);
  currentIndex = 0;
  currentScore = 0;
  streak = 0;

  if (scoreEl) scoreEl.textContent = '0';
  if (streakEl) streakEl.textContent = '0';

  startScreen?.classList.add('hidden');
  endScreen?.classList.add('hidden');
  quizScreen?.classList.remove('hidden');

  renderQuestion();
}

function renderQuestion() {
  feedbackEl?.classList.add('hidden');
  document.getElementById('nextBtn')?.classList.add('hidden');

  currentSpecies = activeQuizPool[currentIndex];
  if (!currentSpecies) return;

  if (promptLabel) promptLabel.textContent = "Scientific Name";
  if (promptEl) promptEl.textContent = currentSpecies.scientific;

  // Reset to leaf tab at start of each question
  currentPart = "leaf";
  partTabs?.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.part === 'leaf');
  });

  loadActiveMedia();

  // Answer Choices
  if (optionsEl) {
    optionsEl.innerHTML = '';
    const distractors = masterSpecies
      .filter(s => s.id !== currentSpecies.id)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map(s => s.common);

    const choices = [currentSpecies.common, ...distractors].sort(() => 0.5 - Math.random());

    choices.forEach(choice => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = choice;
      btn.addEventListener('click', () => handleAnswer(btn, choice));
      optionsEl.appendChild(btn);
    });
  }
}

function handleAnswer(btn, selectedChoice) {
  const isCorrect = selectedChoice === currentSpecies.common;
  const buttons = optionsEl?.querySelectorAll('button');
  buttons?.forEach(b => b.disabled = true);

  if (isCorrect) {
    btn.classList.add('correct');
    currentScore++;
    streak++;
    if (feedbackEl) {
      feedbackEl.textContent = "✓ Correct!";
      feedbackEl.className = "feedback correct";
    }
  } else {
    btn.classList.add('wrong');
    streak = 0;
    buttons?.forEach(b => {
      if (b.textContent === currentSpecies.common) b.classList.add('correct');
    });
    if (feedbackEl) {
      feedbackEl.textContent = `✗ Incorrect — Correct answer: ${currentSpecies.common}`;
      feedbackEl.className = "feedback wrong";
    }
  }

  if (scoreEl) scoreEl.textContent = currentScore;
  if (streakEl) streakEl.textContent = streak;
  feedbackEl?.classList.remove('hidden');

  const nextBtn = document.getElementById('nextBtn');
  if (nextBtn) {
    nextBtn.textContent = (currentIndex + 1 >= activeQuizPool.length) ? "Finish Quiz" : "Next Question →";
    nextBtn.classList.remove('hidden');
  }
}

function nextQuestion() {
  currentIndex++;
  if (currentIndex < activeQuizPool.length) {
    renderQuestion();
  } else {
    showEndScreen();
  }
}

function showEndScreen() {
  quizScreen?.classList.add('hidden');
  endScreen?.classList.remove('hidden');

  const finalMsg = document.getElementById('endMsg');
  if (finalMsg) {
    const pct = Math.round((currentScore / activeQuizPool.length) * 100);
    finalMsg.textContent = `Score: ${currentScore}/${activeQuizPool.length} (${pct}%)`;
  }
}

function showStartScreen() {
  endScreen?.classList.add('hidden');
  quizScreen?.classList.add('hidden');
  startScreen?.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', init);
