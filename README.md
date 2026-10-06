# Times Table Trail

A dependency-free MVP for Year 4 pupils to practise multiplication tables and the interaction style of England's Multiplication Tables Check.

## Run locally

Requires Node.js 20 or later.

```sh
npm start
```

Then open `http://127.0.0.1:4173`.

## Tests

```sh
npm test
```

The tests cover question generation, exact timer boundaries, duplicate-submission protection and timer cleanup.

The browser checks used during development live in `test/browser-flow.mjs` and `test/responsive-check.mjs`. They expect a local server plus a Chromium debugging endpoint on port 9223.
