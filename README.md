# Doc Detective Core

![Current version](https://img.shields.io/github/package-json/v/doc-detective/doc-detective-core/2.0.0?color=orange)
[![NPM Shield](https://img.shields.io/npm/v/doc-detective-core/next)](https://www.npmjs.com/package/doc-detectiv-core/v/next)
[![Discord Shield](https://img.shields.io/badge/chat-on%20discord-purple)](https://discord.gg/2M7wXEThfF)
[![Docs Shield](https://img.shields.io/badge/docs-doc--detective.com-blue)](https://doc-detective.com)

Low-code documentation testing embedded in your project via [NPM](https://www.npmjs.com/package/doc-detective-core).

For pre-built implementations, see [Doc Detective](https://github.com/doc-detective/doc-detective).

## Beta status

Doc Detective v2 is in beta. The beta currently supports the following browsers and platforms:

- Methods: `runTests(config)`
- Apps: Firefox, Chrome/Chromium
- Platforms: Windows, macOS, Linux (tested on Ubuntu)

When support for at least the following features, apps, and platforms are implemented, v2 will exit beta:

- Methods: `runCoverage(config)`, `suggestTests(config)`
- Actions: startRecording, stopRecording

After the v2 stable release, future updates may include support for the following items:

- Apps: Safari, iOS Safari, Edge, Android Chrome, native Windows, native macOS, native Linux
- Platforms: iOS, Android

## Install

```bash
npm i doc-detective-core@next
```

## Init

```javascript
const { runTests } = require("doc-detective-core");
```

## Methods

### `runTests(config)`

Run test specifications. Takes [`config`](https://doc-detective.com/reference/schemas/config.html) as input. Parses paths in the `config.input` or `config.runTests.input` for test specifications to perform. Returns a test report object.
