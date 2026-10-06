import assert from "node:assert/strict";

const pages = await fetch("http://127.0.0.1:9223/json/list").then((response) => response.json());
const page = pages.find((item) => item.type === "page" && item.url.startsWith("http"))
  ?? pages.find((item) => item.type === "page" && item.url === "about:blank");
if (!page) throw new Error("No browser page is available through the debugging endpoint.");

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let id = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const job = pending.get(message.id);
  pending.delete(message.id);
  message.error ? job.reject(new Error(message.error.message)) : job.resolve(message.result);
});

function send(method, params = {}) {
  const commandId = ++id;
  socket.send(JSON.stringify({ id: commandId, method, params }));
  return new Promise((resolve, reject) => pending.set(commandId, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

await send("Runtime.enable");
await send("Page.enable");

for (const width of [320, 390, 768, 1440]) {
  await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
  await send("Emulation.setTouchEmulationEnabled", width <= 768
    ? { enabled: true, maxTouchPoints: 5 }
    : { enabled: false });
  await send("Page.navigate", { url: "http://127.0.0.1:4173" });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const home = await evaluate("({ innerWidth, innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, actionsVisible: [...document.querySelectorAll('.mode-card button')].every((button) => button.getBoundingClientRect().bottom <= innerHeight) })");
  assert.ok(home.scrollWidth <= home.innerWidth, `Home overflows at ${width}px: ${JSON.stringify(home)}`);

  if (process.env.CAPTURE_SCREENSHOTS === "1" && width === 768) {
    const { writeFileSync } = await import("node:fs");
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync("home-768.png", Buffer.from(shot.data, "base64"));
  }

  if (width === 768) {
    assert.ok(home.scrollHeight <= home.innerHeight, `Home should fit within an iPad viewport: ${JSON.stringify(home)}`);
    assert.equal(home.actionsVisible, true, "Both home actions should be visible without scrolling on iPad");
  }

  const inputMode = await evaluate("({ readOnly: document.querySelector('#answer-input').readOnly, inputMode: document.querySelector('#answer-input').inputMode })");
  if (width <= 768) {
    assert.deepEqual(inputMode, { readOnly: true, inputMode: "none" }, `Touch keyboard is not suppressed at ${width}px`);
  } else {
    assert.deepEqual(inputMode, { readOnly: false, inputMode: "numeric" }, "Desktop answer input should remain editable");
  }

  await evaluate("document.querySelector('#open-mock').click()");
  const mockIntro = await evaluate("({ innerWidth, innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, facts: document.querySelectorAll('.mock-facts > li').length, startVisible: document.querySelector('#start-mock').getBoundingClientRect().bottom <= innerHeight })");
  assert.ok(mockIntro.scrollWidth <= mockIntro.innerWidth, `Mock intro overflows at ${width}px: ${JSON.stringify(mockIntro)}`);
  assert.equal(mockIntro.facts, 4, "Mock intro should show four at-a-glance facts");
  if (width === 768) {
    assert.ok(mockIntro.scrollHeight <= mockIntro.innerHeight, `Mock intro should fit within an iPad viewport: ${JSON.stringify(mockIntro)}`);
    assert.equal(mockIntro.startVisible, true, "The start button should be visible without scrolling on iPad");
  }

  if (process.env.CAPTURE_SCREENSHOTS === "1" && (width === 390 || width === 768 || width === 1440)) {
    const { writeFileSync } = await import("node:fs");
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync(`mock-intro-${width}.png`, Buffer.from(shot.data, "base64"));
  }

  await evaluate("document.querySelector('#start-mock').click()");
  const game = await evaluate("({ innerWidth, scrollWidth: document.documentElement.scrollWidth })");
  assert.ok(game.scrollWidth <= game.innerWidth, `Game overflows at ${width}px: ${JSON.stringify(game)}`);

  if (width === 390) {
    await evaluate("document.querySelector('[data-key=\"1\"]').click()");
    await new Promise((resolve) => setTimeout(resolve, 6100));
    assert.equal(
      await evaluate("document.querySelector('#pause-kicker').textContent"),
      "Time is up — answer saved",
      "An answer entered before timeout should be captured without pressing submit",
    );
  }

  if (width === 768) {
    await evaluate("document.querySelector('#answer-input').focus(); document.querySelector('#answer-input').dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }))");
    assert.equal(await evaluate("document.querySelector('#answer-input').value"), "1", "An attached iPad keyboard should still enter digits");
    await evaluate("document.querySelector('#answer-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))");
    assert.match(await evaluate("document.querySelector('#game-status').textContent"), /Answer saved/, "An attached iPad keyboard should still submit with Enter");
    assert.deepEqual(
      await evaluate("({ questionHidden: document.querySelector('#question-stage').hidden, pauseHidden: document.querySelector('#pause-stage').hidden, title: document.querySelector('#pause-title').textContent })"),
      { questionHidden: true, pauseHidden: false, title: "Next question coming up" },
      "The three-second interstitial should replace the answered question",
    );
    await new Promise((resolve) => setTimeout(resolve, 3100));
    assert.deepEqual(
      await evaluate("({ questionHidden: document.querySelector('#question-stage').hidden, pauseHidden: document.querySelector('#pause-stage').hidden, progress: document.querySelector('#game-progress').textContent })"),
      { questionHidden: false, pauseHidden: true, progress: "Question 2 of 3" },
      "The next question should replace the interstitial after three seconds",
    );
  }

  await send("Page.navigate", { url: "http://127.0.0.1:4173" });
  await new Promise((resolve) => setTimeout(resolve, 300));
  await evaluate("document.querySelector('#open-practice').click()");
  const practiceSetup = await evaluate("({ innerWidth, innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, tables: document.querySelectorAll('#table-options input').length, startVisible: document.querySelector('#practice-form button[type=\"submit\"]').getBoundingClientRect().bottom <= innerHeight })");
  assert.ok(practiceSetup.scrollWidth <= practiceSetup.innerWidth, `Practice setup overflows at ${width}px: ${JSON.stringify(practiceSetup)}`);
  assert.equal(practiceSetup.tables, 11, "Practice setup should show all eleven table choices");
  if (width === 768) {
    assert.ok(practiceSetup.scrollHeight <= practiceSetup.innerHeight, `Practice setup should fit within an iPad viewport: ${JSON.stringify(practiceSetup)}`);
    assert.equal(practiceSetup.startVisible, true, "The practice start button should be visible without scrolling on iPad");
  }

  if (process.env.CAPTURE_SCREENSHOTS === "1" && width === 768) {
    const { writeFileSync } = await import("node:fs");
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync("practice-setup-768.png", Buffer.from(shot.data, "base64"));
  }

}

for (const viewport of [{ width: 768, height: 820 }, { width: 1024, height: 768 }, { width: 1024, height: 700 }, { width: 1024, height: 640 }]) {
  await send("Emulation.setDeviceMetricsOverride", { ...viewport, deviceScaleFactor: 1, mobile: true });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send("Page.navigate", { url: "http://127.0.0.1:4173" });
  await new Promise((resolve) => setTimeout(resolve, 300));

  const home = await evaluate("({ innerWidth, innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, actionsVisible: [...document.querySelectorAll('.mode-card button')].every((button) => button.getBoundingClientRect().bottom <= innerHeight) })");
  assert.ok(home.scrollWidth <= home.innerWidth, `Home overflows horizontally at ${viewport.width}x${viewport.height}: ${JSON.stringify(home)}`);
  assert.ok(home.scrollHeight <= home.innerHeight, `Home should fit at ${viewport.width}x${viewport.height}: ${JSON.stringify(home)}`);
  assert.equal(home.actionsVisible, true, `Home actions should be visible at ${viewport.width}x${viewport.height}`);

  if (process.env.CAPTURE_SCREENSHOTS === "1") {
    const { writeFileSync } = await import("node:fs");
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync(`home-${viewport.width}x${viewport.height}.png`, Buffer.from(shot.data, "base64"));
  }

  await evaluate("document.querySelector('#open-mock').click()");
  const mockIntro = await evaluate("({ innerWidth, innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, startVisible: document.querySelector('#start-mock').getBoundingClientRect().bottom <= innerHeight })");
  assert.ok(mockIntro.scrollWidth <= mockIntro.innerWidth, `Mock intro overflows horizontally at ${viewport.width}x${viewport.height}: ${JSON.stringify(mockIntro)}`);
  assert.ok(mockIntro.scrollHeight <= mockIntro.innerHeight, `Mock intro should fit at ${viewport.width}x${viewport.height}: ${JSON.stringify(mockIntro)}`);
  assert.equal(mockIntro.startVisible, true, `Mock intro start action should be visible at ${viewport.width}x${viewport.height}`);

  if (process.env.CAPTURE_SCREENSHOTS === "1") {
    const { writeFileSync } = await import("node:fs");
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync(`mock-intro-${viewport.width}x${viewport.height}.png`, Buffer.from(shot.data, "base64"));
  }
}

socket.close();
console.log("Responsive check passed at phone, short iPad, iPad landscape and desktop sizes.");
