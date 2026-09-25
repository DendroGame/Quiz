/* ============================================================================
   MAIN APPLICATION CONTROLLER (js/app.js)
   ---------------------------------------------------------------------------
   Connects the species database to the game engine and UI.
   Loads diagnostic photos and 3D bud scans directly from Cloudflare R2.
============================================================================ */

import { loadSpeciesPhoto, getBudScanFrameUrl } from './photo-service.js';

// State variables
let masterSpecies = [];
let activeQuizPool = [];
let currentIndex = 0;
let currentScore = 0;
let streak = 0;
let currentSpecies = null;

// DOM Elements
let startScreen, quizScreen, endScreen;
let promptEl, promptLabel, optionsEl, feedbackEl;
let photoEl, loadingEl, scoreEl, streakEl;

async function init() {
  cacheDOMElements();

  try {
    const res = await fetch('./data/species.json');
    masterSpecies = await res.json();
    console.log(`Loaded ${masterSpecies.length} species.`);
  } catch (err) {
    console.error("Failed to load data/species.json:", err);
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
}

function setupEventListeners() {
  document.getElementById('startBtn')?.addEventListener('click', startQuiz);
  document.getElementById('nextBtn')?.addEventListener('click', nextQuestion);
  document.getElementById('homeBtn')?.addEventListener('click', showStartScreen);
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
  const nextBtn = document.getElementById('nextBtn');
  if (nextBtn) nextBtn.classList.add('hidden');

  currentSpecies = activeQuizPool[currentIndex];
  if (!currentSpecies) return;

  // Set prompt (Scientific name -> choose Common name)
  if (promptLabel) promptLabel.textContent = "Scientific Name";
  if (promptEl) promptEl.textContent = currentSpecies.scientific;

  // Load the leaf/diagnostic image from your Cloudflare R2 bucket
  if (photoEl) {
    loadSpeciesPhoto(currentSpecies.common, photoEl, loadingEl);
  }

  // Generate 4 multiple-choice options
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

// Run on page load
document.addEventListener('DOMContentLoaded', init);
