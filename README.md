# Doc Detective Core

![Current version](https://img.shields.io/github/package-json/v/doc-detective/doc-detective-core/2.0.0?color=orange)
[![NPM Shield](https://img.shields.io/npm/v/doc-detective-core/next)](https://www.npmjs.com/package/doc-detectiv-core/v/next)
[![Discord Shield](https://img.shields.io/badge/chat-on%20discord-purple)](https://discord.gg/2M7wXEThfF)
[![Docs Shield](https://img.shields.io/badge/docs-doc--detective.com-blue)](https://doc-detective.com)

Low-code documentation testing embedded in your project via [NPM](https://www.npmjs.com/package/doc-detective-core).

For pre-built implementations, see [Doc Detective](https://github.com/doc-detective/doc-detective).

## Beta status

Doc Detective v2 is in beta. The beta currently supports the following browsers and platforms:

- Methods: `runTests(config)`, `runCoverage(config)`
- Apps: Firefox, Chrome/Chromium
- Platforms: Windows, macOS, Linux (tested on Ubuntu)

When support for at least the following features, apps, and platforms are implemented, v2 will exit beta:

- Methods: `suggestTests(config)`
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
const { runTests, runCoverage } = require("doc-detective-core");
```

## Functions

### `runTests(config)`

Run test specifications. Returns a test report object. Takes [`config`](https://doc-detective.com/reference/schemas/config.html) as input. Parses paths in the `config.input` or `config.runTests.input` for test specifications to perform.

### `runCoverage(config)`

Analyze test coverage in documentation source files. Returns a coverage report object. Takes [`config`](https://doc-detective.com/reference/schemas/config.html) as input. Parses paths in the `config.input` or `config.runCoverage.input` for documentation source files to analyze. Parses markup based on file's type and the markup definitions specified in `config.fileTypes.markup`.

### `suggestTests(config)` (Experimental)

> **Note:** This is experimental and subject to change. 

Dynamically built tests to address uncovered markup in documentation source files. Returns a suggested test specification. Takes [`config`](https://doc-detective.com/reference/schemas/config.html) as input.