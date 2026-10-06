import { generateQuestions, TABLES } from "./question-generator.js";
import { TimedQuestionCycle } from "./timed-question-cycle.js";

const ANSWER_MS = 6000;
const PAUSE_MS = 3000;
const MOCK_WARMUP_COUNT = 3;
const MOCK_QUESTION_COUNT = 25;

const screens = [...document.querySelectorAll(".screen")];
const homeScreen = document.querySelector("#home-screen");
const mockIntroScreen = document.querySelector("#mock-intro-screen");
const practiceSetupScreen = document.querySelector("#practice-setup-screen");
const gameScreen = document.querySelector("#game-screen");
const mockReadyScreen = document.querySelector("#mock-ready-screen");
const resultsScreen = document.querySelector("#results-screen");
const practiceSummaryScreen = document.querySelector("#practice-summary-screen");
const answerForm = document.querySelector("#answer-form");
const answerInput = document.querySelector("#answer-input");
const feedback = document.querySelector("#feedback");
const keypad = document.querySelector("#keypad");
const timerReadout = document.querySelector("#timer-readout");
const timerTrack = document.querySelector("#timer-track");
const gameStatus = document.querySelector("#game-status");

const state = {
  mode: null,
  stage: null,
  questions: [],
  index: 0,
  answers: [],
  selectedTables: [],
  timedPractice: false,
  practiceCorrect: 0,
  practiceAttempted: 0,
  acceptingAnswer: false,
};

const cycle = new TimedQuestionCycle({
  answerMs: ANSWER_MS,
  pauseMs: PAUSE_MS,
  onTick: updateTimer,
  onAnswerEnd: handleTimedAnswerEnd,
  onPauseEnd: advanceMockQuestion,
});

function showScreen(screen, { focus = true } = {}) {
  cycle.cancel();
  screens.forEach((item) => { item.hidden = item !== screen; });
  document.body.classList.toggle("is-playing", screen === gameScreen);
  window.scrollTo(0, 0);

  const titles = {
    "home-screen": "Times Table Trail",
    "mock-intro-screen": "Mock MTC · Times Table Trail",
    "practice-setup-screen": "Practice tables · Times Table Trail",
    "game-screen": "Question · Times Table Trail",
    "mock-ready-screen": "Warm-up complete · Times Table Trail",
    "results-screen": "Mock results · Times Table Trail",
    "practice-summary-screen": "Practice complete · Times Table Trail",
  };
  document.title = titles[screen.id] ?? "Times Table Trail";

  if (focus) {
    requestAnimationFrame(() => screen.querySelector("h1")?.focus());
  }
}

function createTableOptions() {
  const container = document.querySelector("#table-options");
  for (const table of TABLES) {
    const label = document.createElement("label");
    label.className = "table-option";
    label.innerHTML = `<input type="checkbox" name="table" value="${table}" aria-describedby="table-error"><span>${table}</span>`;
    container.append(label);
  }
}

function selectedTableValues() {
  return [...document.querySelectorAll('input[name="table"]:checked')].map((input) => Number(input.value));
}

function syncAllTablesCheckbox() {
  const checkedCount = selectedTableValues().length;
  const allTables = document.querySelector("#all-tables");
  allTables.checked = checkedCount === TABLES.length;
  allTables.indeterminate = checkedCount > 0 && checkedCount < TABLES.length;
}

function resetGameUi() {
  answerInput.value = "";
  answerInput.disabled = false;
  document.querySelector("#submit-answer").disabled = false;
  keypad.querySelectorAll("button").forEach((button) => { button.disabled = false; });
  answerForm.hidden = false;
  keypad.hidden = false;
  feedback.hidden = true;
  gameStatus.textContent = "";
  document.querySelector("#timer-label").textContent = "Time to answer";
}

function startMock() {
  const fullSet = generateQuestions(MOCK_WARMUP_COUNT + MOCK_QUESTION_COUNT, TABLES);
  state.mode = "mock";
  state.stage = "warmup";
  state.questions = fullSet.slice(0, MOCK_WARMUP_COUNT);
  state.scoredQuestions = fullSet.slice(MOCK_WARMUP_COUNT);
  state.index = 0;
  state.answers = [];
  renderQuestion();
}

function startScoredMock() {
  state.stage = "scored";
  state.questions = state.scoredQuestions;
  state.index = 0;
  state.answers = [];
  renderQuestion();
}

function startPractice(tables, timed) {
  state.mode = "practice";
  state.stage = "practice";
  state.selectedTables = tables;
  state.timedPractice = timed;
  state.questions = generateQuestions(1, tables);
  state.index = 0;
  state.practiceCorrect = 0;
  state.practiceAttempted = 0;
  renderQuestion();
}

function currentQuestion() {
  return state.questions[state.index];
}

function renderQuestion() {
  const question = currentQuestion();
  if (!question) return;

  resetGameUi();
  state.acceptingAnswer = true;
  document.querySelector("#question-text").textContent = `${question.left} × ${question.right}`;
  document.querySelector("#game-mode").textContent = state.stage === "warmup" ? "Warm-up" : state.stage === "scored" ? "Mock MTC" : "Practice tables";
  document.querySelector("#game-progress").textContent = state.mode === "mock"
    ? `Question ${state.index + 1} of ${state.questions.length}`
    : `${state.practiceCorrect} correct from ${state.practiceAttempted} answered`;
  document.querySelector("#end-practice").hidden = state.mode !== "practice";

  const isTimed = state.mode === "mock" || state.timedPractice;
  timerReadout.hidden = !isTimed;
  timerTrack.hidden = !isTimed;
  showScreen(gameScreen, { focus: false });
  answerInput.focus();

  if (isTimed) {
    cycle.pauseMs = state.mode === "mock" ? PAUSE_MS : 0;
    cycle.start();
  }
}

function updateTimer({ phase, remainingMs, totalMs }) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const ratio = totalMs === 0 ? 0 : remainingMs / totalMs;
  document.querySelector("#timer-seconds").textContent = String(seconds);
  document.querySelector("#timer-bar").style.transform = `scaleX(${ratio})`;
  document.querySelector("#timer-label").textContent = phase === "answer" ? "Time to answer" : "Next question in";
  timerReadout.classList.toggle("is-pause", phase === "pause");
}

function normaliseAnswer(value) {
  const trimmed = String(value).trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

function submitCurrentAnswer(rawAnswer) {
  if (!state.acceptingAnswer) return;
  if (state.mode === "mock") {
    cycle.submit(rawAnswer);
    return;
  }

  if (state.timedPractice) {
    cycle.submit(rawAnswer);
  } else {
    state.acceptingAnswer = false;
    showPracticeFeedback(rawAnswer, false);
  }
}

function handleTimedAnswerEnd({ reason, answer }) {
  if (!state.acceptingAnswer) return;
  state.acceptingAnswer = false;

  if (state.mode === "mock") {
    const question = currentQuestion();
    const numericAnswer = normaliseAnswer(answer);
    state.answers.push({
      ...question,
      pupilAnswer: reason === "timeout" ? null : numericAnswer,
      rawAnswer: reason === "timeout" ? "" : String(answer).trim(),
      correct: reason !== "timeout" && numericAnswer === question.answer,
      unanswered: reason === "timeout" || String(answer).trim() === "",
    });
    lockAnswerUi();
    gameStatus.textContent = reason === "timeout" ? "Time is up. The next question is coming." : "Answer saved. The next question is coming.";
  } else {
    showPracticeFeedback(answer, reason === "timeout");
  }
}

function lockAnswerUi() {
  answerInput.disabled = true;
  document.querySelector("#submit-answer").disabled = true;
  keypad.querySelectorAll("button").forEach((button) => { button.disabled = true; });
}

function showPracticeFeedback(rawAnswer, timedOut) {
  cycle.cancel();
  state.acceptingAnswer = false;
  const question = currentQuestion();
  const numericAnswer = normaliseAnswer(rawAnswer);
  const correct = !timedOut && numericAnswer === question.answer;
  state.practiceAttempted += 1;
  if (correct) state.practiceCorrect += 1;

  answerForm.hidden = true;
  keypad.hidden = true;
  timerReadout.hidden = true;
  timerTrack.hidden = true;
  feedback.hidden = false;
  feedback.className = `feedback ${correct ? "is-correct" : "is-incorrect"}`;
  document.querySelector("#feedback-title").textContent = correct ? "✓ That’s right!" : timedOut ? "○ Time’s up" : "Not quite this time";
  document.querySelector("#feedback-detail").textContent = correct
    ? `${question.left} × ${question.right} = ${question.answer}`
    : `The answer is ${question.answer}.`;
  document.querySelector("#game-progress").textContent = `${state.practiceCorrect} correct from ${state.practiceAttempted} answered`;
  gameStatus.textContent = correct ? "Correct answer." : `The correct answer is ${question.answer}.`;
  document.querySelector("#next-practice").focus();
}

function advanceMockQuestion() {
  state.index += 1;
  if (state.index < state.questions.length) {
    renderQuestion();
  } else if (state.stage === "warmup") {
    showScreen(mockReadyScreen);
  } else {
    renderResults();
  }
}

function nextPracticeQuestion() {
  const next = generateQuestions(1, state.selectedTables)[0];
  state.questions = [next];
  state.index = 0;
  renderQuestion();
}

function renderResults() {
  const correct = state.answers.filter((answer) => answer.correct).length;
  const percentage = Math.round((correct / MOCK_QUESTION_COUNT) * 100);
  document.querySelector("#result-score").textContent = String(correct);
  document.querySelector("#result-percentage").textContent = `${percentage}%`;
  document.querySelector("#result-message").textContent = correct >= 20
    ? "Your table facts are looking strong. Keep practising to make them feel even easier."
    : correct >= 12
      ? "You’re building good table skills. A little regular practice will help them stick."
      : "Every practice round helps. Pick a few tables to work on, then try again when you’re ready.";

  const list = document.querySelector("#review-list");
  list.replaceChildren();
  state.answers.forEach((item, index) => {
    const status = item.correct ? "Correct" : item.unanswered ? "Unanswered" : "Incorrect";
    const symbol = item.correct ? "✓" : item.unanswered ? "—" : "×";
    const pupilDisplay = item.unanswered ? "No answer" : (item.rawAnswer || "No answer");
    const row = document.createElement("li");
    row.className = `review-item review-${status.toLowerCase()}`;
    row.innerHTML = `
      <span class="review-number">${index + 1}</span>
      <strong class="review-question">${item.left} × ${item.right}</strong>
      <span class="review-answer"><small>Your answer</small>${pupilDisplay}</span>
      <span class="review-answer"><small>Correct answer</small>${item.answer}</span>
      <span class="review-status"><span aria-hidden="true">${symbol}</span> ${status}</span>`;
    list.append(row);
  });
  showScreen(resultsScreen);
}

function goHome() {
  state.acceptingAnswer = false;
  showScreen(homeScreen);
}

createTableOptions();

document.querySelector("#open-mock").addEventListener("click", () => showScreen(mockIntroScreen));
document.querySelector("#open-practice").addEventListener("click", () => showScreen(practiceSetupScreen));
document.querySelector("#start-mock").addEventListener("click", startMock);
document.querySelector("#start-scored").addEventListener("click", startScoredMock);
document.querySelector("#retry-mock").addEventListener("click", () => showScreen(mockIntroScreen));
document.querySelector("#practice-again").addEventListener("click", () => showScreen(practiceSetupScreen));
document.querySelector("#brand-home").addEventListener("click", () => {
  if (gameScreen.hidden || state.mode === "practice") goHome();
});
document.querySelectorAll(".back-home").forEach((button) => button.addEventListener("click", goHome));

document.querySelector("#table-options").addEventListener("change", () => {
  syncAllTablesCheckbox();
  document.querySelector("#table-error").textContent = "";
  document.querySelectorAll('input[name="table"]').forEach((input) => input.removeAttribute("aria-invalid"));
});
document.querySelector("#all-tables").addEventListener("change", (event) => {
  document.querySelectorAll('input[name="table"]').forEach((input) => { input.checked = event.target.checked; });
  document.querySelectorAll('input[name="table"]').forEach((input) => input.removeAttribute("aria-invalid"));
  event.target.indeterminate = false;
  document.querySelector("#table-error").textContent = "";
});

document.querySelector("#practice-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const tables = selectedTableValues();
  if (tables.length === 0) {
    document.querySelector("#table-error").textContent = "Choose at least one table to start practising.";
    const firstTable = document.querySelector('input[name="table"]');
    firstTable.setAttribute("aria-invalid", "true");
    firstTable.focus();
    return;
  }
  startPractice(tables, document.querySelector("#timed-practice").checked);
});

answerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitCurrentAnswer(answerInput.value);
});

answerInput.addEventListener("input", () => {
  answerInput.value = answerInput.value.replace(/\D/g, "").slice(0, 3);
});

keypad.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-key]");
  if (!button || !state.acceptingAnswer) return;
  const key = button.dataset.key;
  if (key === "clear") answerInput.value = answerInput.value.slice(0, -1);
  else if (key === "submit") submitCurrentAnswer(answerInput.value);
  else if (answerInput.value.length < 3) answerInput.value += key;
  answerInput.focus();
});

document.querySelector("#next-practice").addEventListener("click", nextPracticeQuestion);
document.querySelector("#end-practice").addEventListener("click", () => {
  state.acceptingAnswer = false;
  document.querySelector("#practice-summary-score").textContent = state.practiceAttempted === 0
    ? "You set up a practice session. Come back when you’re ready for a question."
    : `You answered ${state.practiceCorrect} of ${state.practiceAttempted} questions correctly.`;
  showScreen(practiceSummaryScreen);
});

window.addEventListener("keydown", (event) => {
  if (gameScreen.hidden || !state.acceptingAnswer || event.ctrlKey || event.metaKey || event.altKey) return;
  if (/^\d$/.test(event.key) && document.activeElement !== answerInput) {
    event.preventDefault();
    if (answerInput.value.length < 3) answerInput.value += event.key;
  }
  if (event.key === "Backspace" && document.activeElement !== answerInput) {
    event.preventDefault();
    answerInput.value = answerInput.value.slice(0, -1);
  }
  if (event.key === "Enter" && document.activeElement !== answerInput && !event.target.closest("button")) {
    event.preventDefault();
    submitCurrentAnswer(answerInput.value);
  }
});

window.addEventListener("beforeunload", () => cycle.cancel());
