#!/usr/bin/env node

const { installBrowsers, installAppiumDepencencies } = require("./deps");

async function postinstall() {
  await installBrowsers();
  await installAppiumDepencencies();
}

postinstall();