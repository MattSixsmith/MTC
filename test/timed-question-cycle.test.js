import test from "node:test";
import assert from "node:assert/strict";
import { TimedQuestionCycle } from "../timed-question-cycle.js";

function createClock() {
  let now = 0;
  let nextId = 1;
  const jobs = new Map();
  return {
    now: () => now,
    setTimer(callback, delay) {
      const id = nextId++;
      jobs.set(id, { at: now + delay, callback });
      return id;
    },
    clearTimer(id) { jobs.delete(id); },
    advance(milliseconds) {
      const target = now + milliseconds;
      while (true) {
        const next = [...jobs.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > target) break;
        jobs.delete(next[0]);
        now = next[1].at;
        next[1].callback();
      }
      now = target;
    },
  };
}

test("expires after exactly six seconds then pauses for three", () => {
  const clock = createClock();
  const answers = [];
  let pauses = 0;
  const cycle = new TimedQuestionCycle({
    answerMs: 6000,
    pauseMs: 3000,
    onAnswerEnd: (result) => answers.push(result),
    onPauseEnd: () => { pauses += 1; },
    ...clock,
  });
  cycle.start();
  clock.advance(5999);
  assert.equal(answers.length, 0);
  clock.advance(1);
  assert.deepEqual(answers, [{ reason: "timeout", answer: "" }]);
  clock.advance(2999);
  assert.equal(pauses, 0);
  clock.advance(1);
  assert.equal(pauses, 1);
});

test("accepts only one submission", () => {
  const clock = createClock();
  const answers = [];
  const cycle = new TimedQuestionCycle({ onAnswerEnd: (result) => answers.push(result), ...clock });
  cycle.start();
  assert.equal(cycle.submit("56"), true);
  assert.equal(cycle.submit("57"), false);
  assert.deepEqual(answers, [{ reason: "submitted", answer: "56" }]);
});

test("captures an answer that is present when time expires", () => {
  const clock = createClock();
  const answers = [];
  let currentAnswer = "5";
  const cycle = new TimedQuestionCycle({
    answerMs: 6000,
    getCurrentAnswer: () => currentAnswer,
    onAnswerEnd: (result) => answers.push(result),
    ...clock,
  });
  cycle.start();
  clock.advance(5900);
  currentAnswer = "56";
  clock.advance(100);
  assert.deepEqual(answers, [{ reason: "timeout", answer: "56" }]);
});

test("a submission at the deadline consistently counts as timed out", () => {
  const clock = createClock();
  const answers = [];
  const cycle = new TimedQuestionCycle({ answerMs: 6000, onAnswerEnd: (result) => answers.push(result), ...clock });
  cycle.start();
  clock.advance(6000);
  assert.equal(cycle.submit("56"), false);
  assert.deepEqual(answers, [{ reason: "timeout", answer: "" }]);
});

test("cancel clears pending work", () => {
  const clock = createClock();
  let ended = false;
  const cycle = new TimedQuestionCycle({ onAnswerEnd: () => { ended = true; }, ...clock });
  cycle.start();
  cycle.cancel();
  clock.advance(10000);
  assert.equal(ended, false);
});
