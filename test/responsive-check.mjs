import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";

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
  await send("Page.navigate", { url: "http://127.0.0.1:4173" });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const home = await evaluate("({ innerWidth, scrollWidth: document.documentElement.scrollWidth })");
  assert.ok(home.scrollWidth <= home.innerWidth, `Home overflows at ${width}px: ${JSON.stringify(home)}`);

  await evaluate("document.querySelector('#open-mock').click(); document.querySelector('#start-mock').click()");
  const game = await evaluate("({ innerWidth, scrollWidth: document.documentElement.scrollWidth })");
  assert.ok(game.scrollWidth <= game.innerWidth, `Game overflows at ${width}px: ${JSON.stringify(game)}`);

  if (width === 390) {
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync("question-mobile.png", Buffer.from(shot.data, "base64"));
  }
}

socket.close();
console.log("Responsive check passed at 320px, 390px, 768px and 1440px for home and question screens.");
