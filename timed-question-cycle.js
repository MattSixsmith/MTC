export class TimedQuestionCycle {
  constructor({
    answerMs = 6000,
    pauseMs = 3000,
    onTick = () => {},
    onAnswerEnd = () => {},
    onPauseEnd = () => {},
    now = () => performance.now(),
    setTimer = (callback, delay) => setTimeout(callback, delay),
    clearTimer = (timerId) => clearTimeout(timerId),
  } = {}) {
    this.answerMs = answerMs;
    this.pauseMs = pauseMs;
    this.onTick = onTick;
    this.onAnswerEnd = onAnswerEnd;
    this.onPauseEnd = onPauseEnd;
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.phase = "idle";
    this.timerId = null;
    this.deadline = 0;
  }

  start() {
    this.cancel();
    this.phase = "answer";
    this.deadline = this.now() + this.answerMs;
    this.#tick();
  }

  submit(answer) {
    if (this.phase !== "answer") return false;
    if (this.now() >= this.deadline) {
      this.#endAnswer("timeout", "");
      return false;
    }
    this.#endAnswer("submitted", answer);
    return true;
  }

  cancel() {
    if (this.timerId !== null) this.clearTimer(this.timerId);
    this.timerId = null;
    this.phase = "idle";
  }

  #tick = () => {
    if (this.phase === "idle") return;
    const remainingMs = Math.max(0, this.deadline - this.now());
    const totalMs = this.phase === "answer" ? this.answerMs : this.pauseMs;
    this.onTick({ phase: this.phase, remainingMs, totalMs });

    if (remainingMs <= 0) {
      if (this.phase === "answer") this.#endAnswer("timeout", "");
      else this.#endPause();
      return;
    }

    this.timerId = this.setTimer(this.#tick, Math.min(100, remainingMs));
  };

  #endAnswer(reason, answer) {
    if (this.phase !== "answer") return;
    if (this.timerId !== null) this.clearTimer(this.timerId);
    this.timerId = null;
    this.phase = "pause";
    this.onAnswerEnd({ reason, answer });
    this.deadline = this.now() + this.pauseMs;
    this.#tick();
  }

  #endPause() {
    if (this.phase !== "pause") return;
    if (this.timerId !== null) this.clearTimer(this.timerId);
    this.timerId = null;
    this.phase = "idle";
    this.onPauseEnd();
  }
}
