# Doc Detective Core

![Current version](https://img.shields.io/github/package-json/v/doc-detective/doc-detective?color=orange)
[![NPM Shield](https://img.shields.io/npm/v/doc-detective)](https://www.npmjs.com/package/doc-detective)
[![Discord Shield](https://discordapp.com/api/guilds/1066417654899937453/widget.png?style=shield)](https://discord.gg/mSCCRAhH)

Unit test documentation to validate UX flows, in-GUI text, and images. Primarily useful for process docs, Doc Detective supports test definitions single-sourced in documentation or defined in separate test files to suit your infrastructure needs.

Doc Detective ingests text files, parses them for test actions, then executes those actions in a headless Chromium browser. The results (PASS/FAIL and context) are output as a JSON object so that other pieces of infrastructure can parse and manipulate them as needed.

This project handles test parsing and web-based UI testing--it doesn't support results reporting or notifications. This framework is a part of testing infrastructures and needs to be complimented by other components.

Doc Detective uses `puppeteer` to install, launch, and drive Chromium to perform tests. `puppeteer` removes the requirement to manually configure a local web browser and enables easy screenshotting and video recording. In the event `puppeteer` fails to launch Chromium, Doc Detective tries to fall back to local installs of Chromium, Chrome, and Firefox.

**Note:** By default, `puppeteer`'s Chromium doesn't run in Docker containers, which means that `puppeteer` doesn't work either. Don't run Doc Detective in a Docker container unless you first confirm that you have a custom implementation of headless Chrome/Chromium functional in the container. The approved answer to [this question](https://askubuntu.com/questions/79280/how-to-install-chrome-browser-properly-via-command-line) works for me, but it may not work in all environments.

## Get started

Doc Detective integrates with Node projects as an NPM package. When using the NPM package, you must specify all options in the `run()` method's `config` argument, which is a JSON object with the same structure as [config.json](https://github.com/hawkeyexl/doc-detective/blob/master/sample/config.json).

1.  In a terminal, navigate to your Node project, then install Doc Detective:

    ```bash
    npm i doc-detective
    ```

1.  Add a reference to the package in your project:

    ```node
    const { test } = require("doc-detective");
    ```

1.  Run tests with the `run()` method:

    ```node
    test(config);
    ```

## Methods

### test(config)

### coverage(config)

### suggest(config)

## Potential future updates

- Additional input sanitization and improved config/action defaults.
- Refactor tests into individual files.
- New/upgraded test actions:
  - New: Test if a referenced image (such as an icon) is present in the captured screenshot.
  - Upgrade: `startRecording` and `stopRecording` to support start, stop, and intermediate test action state image matching to track differences between video captures from different runs.

## License

This project uses the [MIT license](https://github.com/hawkeyexl/doc-detective/blob/master/LICENSE).
