import test from "node:test";
import assert from "node:assert/strict";
import { generateQuestions, TABLES } from "../question-generator.js";

test("generates the requested number of valid questions", () => {
  const questions = generateQuestions(25, TABLES, () => 0.42);
  assert.equal(questions.length, 25);
  for (const question of questions) {
    assert.equal(question.left * question.right, question.answer);
    assert.ok(question.left >= 2 && question.left <= 12);
    assert.ok(question.right >= 2 && question.right <= 12);
  }
});

test("avoids repeated facts when the pool is large enough", () => {
  let seed = 1;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const questions = generateQuestions(25, TABLES, random);
  assert.equal(new Set(questions.map((question) => question.key)).size, 25);
});

test("limits an individual practice set to the selected table", () => {
  const questions = generateQuestions(11, [7], () => 0.25);
  assert.ok(questions.every((question) => question.left === 7 || question.right === 7));
});

test("rejects an empty table selection", () => {
  assert.throws(() => generateQuestions(1, []), /at least one/i);
});
