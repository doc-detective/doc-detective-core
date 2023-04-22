# Doc Detective Core

![Current version](https://img.shields.io/github/package-json/v/doc-detective/doc-detective-core?color=orange)
[![NPM Shield](https://img.shields.io/npm/v/doc-detective)](https://www.npmjs.com/package/doc-detective)
[![Discord Shield](https://img.shields.io/badge/chat-on%20discord-purple)](https://discord.gg/2M7wXEThfF)

:exclamation: The v2 beta is available! See the [2.0.0 branch](https://github.com/doc-detective/doc-detective-core/tree/2.0.0). :exclamation:

Low-code documentation testing embedded in your project via [NPM](https://www.npmjs.com/package/doc-detective).

For pre-built implementations, see [Doc Detective](https://github.com/doc-detective/doc-detective).

## Install

```bash
npm i doc-detective
```

## Init

```javascript
const { test, coverage, suggest } = require("doc-detective");
```

## Methods

### `test(config, argv)`

Run tests. Recursively parses files in the `config.input` path for tests to perform. Returns a test report object.

### `coverage(config, argv)`

Run test coverage analysis on the specified source documents. Identifies uncovered markup based on regular expressions in `config.fileTypes.markup`. Returns a coverage report object.

### `suggest(config, argv)`

Interactively build tests for uncovered markup in the specified source documents. Identifies uncovered markup based on regular expressions in `config.fileTypes.markup`. Writes tests to file and returns a suggestions object.


## Objects

### `config`

Settings for your documentation source files and Doc Detective tests. See a sample config object in the [Doc Detective](https://github.com/doc-detective/doc-detective/blob/main/sample/config.json) repo.
