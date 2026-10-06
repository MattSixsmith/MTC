import assert from "node:assert/strict";

const endpoint = process.env.CDP_ENDPOINT ?? "http://127.0.0.1:9223";
const pages = await fetch(`${endpoint}/json/list`).then((response) => response.json());
const page = pages.find((item) => item.type === "page" && item.url === "about:blank")
  ?? pages.find((item) => item.type === "page" && item.url.startsWith("http"));
if (!page) throw new Error("No browser page is available through the debugging endpoint.");

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let commandId = 0;
const pending = new Map();
const browserErrors = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  }
  if (message.method === "Runtime.exceptionThrown") browserErrors.push(message.params.exceptionDetails.text);
  if (message.method === "Log.entryAdded" && message.params.entry.level === "error") browserErrors.push(message.params.entry.text);
});

function send(method, params = {}) {
  const id = ++commandId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(expression, timeout = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function answerCurrentQuestion(method = "form") {
  const previous = await evaluate("document.querySelector('#question-text').textContent");
  const answer = await evaluate("document.querySelector('#question-text').textContent.split('×').map(Number).reduce((a, b) => a * b)");
  if (method === "keyboard") {
    await evaluate(`document.querySelector('#answer-input').value = '${answer}'; document.querySelector('#answer-input').focus()`);
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", text: "\r", unmodifiedText: "\r", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await waitFor("document.querySelector('#game-status').textContent.includes('Answer saved')", 1000);
  } else if (method === "keypad") {
    for (const digit of String(answer)) await evaluate(`document.querySelector('[data-key="${digit}"]').click()`);
    await evaluate("document.querySelector('[data-key=\"submit\"]').click()");
  } else {
    await evaluate(`document.querySelector('#answer-input').value = '${answer}'; document.querySelector('#answer-form').requestSubmit()`);
  }
  await waitFor(`document.querySelector('#question-text').textContent !== ${JSON.stringify(previous)} || !document.querySelector('#mock-ready-screen').hidden || !document.querySelector('#results-screen').hidden`, 5000);
}

await send("Runtime.enable");
await send("Log.enable");
await send("Page.enable");
await send("Page.navigate", { url: "http://127.0.0.1:4173" });
await waitFor("document.readyState === 'complete'");

await evaluate("document.querySelector('#open-mock').click(); document.querySelector('#start-mock').click()");
await waitFor("!document.querySelector('#game-screen').hidden");
for (let index = 0; index < 3; index += 1) await answerCurrentQuestion(index === 0 ? "keyboard" : "form");
await waitFor("!document.querySelector('#mock-ready-screen').hidden");

await evaluate("document.querySelector('#start-scored').click()");
for (let index = 0; index < 25; index += 1) await answerCurrentQuestion(index === 0 ? "keypad" : "form");
await waitFor("!document.querySelector('#results-screen').hidden");
assert.equal(await evaluate("document.querySelector('#result-score').textContent"), "25");
assert.equal(await evaluate("document.querySelectorAll('#review-list > li').length"), 25);

await evaluate("document.querySelector('#results-screen .back-home').click(); document.querySelector('#open-practice').click(); document.querySelector('input[name=\"table\"][value=\"7\"]').click(); document.querySelector('#practice-form').requestSubmit()");
await waitFor("!document.querySelector('#game-screen').hidden");
await evaluate("document.querySelector('#answer-input').value = '1'; document.querySelector('#answer-form').requestSubmit()");
await waitFor("!document.querySelector('#feedback').hidden");
assert.match(await evaluate("document.querySelector('#feedback-detail').textContent"), /The answer is \d+\./);

assert.deepEqual(browserErrors, []);
socket.close();
console.log("Browser flow passed: keyboard entry, keypad entry, 3 warm-ups, all 25 scored questions, results, and practice feedback.");
