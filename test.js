const axios = require("axios");
const appium = require("appium");
const { exit } = require('node:process');
const wdio = require('webdriverio');

main();

// Primary execution function.
async function main() {
    appiumStart();
    await appiumIsReady();
    await runTests();
    exit();
}

// Start the Appium server asynchronously.
async function appiumStart() {
    appium.main();
}

// Delay execution until Appium server is available.
async function appiumIsReady() {
    let isReady = false;
    while (!isReady) {
        // Retry delay
        // TODO: Add configurable retry delay
        // TODO: Add configurable timeout duration
        await new Promise(resolve => setTimeout(resolve, 1000))
        try {
            let resp = await axios.get("http://localhost:4723/sessions");
            if (resp.status === 200) isReady = true;
        } catch { }
    }
    return isReady;
}

// Perform tests through Appium drivers.
async function runTests() {
    // Define driver capabilities.
    const caps = { "platformName": "windows", "appium:automationName": "Gecko", "browserName": "MozillaFirefox", "appium:newCommandTimeout": 3600, "appium:connectHardwareKeyboard": true }
    const driver = await wdio.remote({
        protocol: "http",
        hostname: "localhost",
        port: 4723,
        path: "/",
        capabilities: caps
    });

    // Run through all browser-based actions.
    // TODO: Go to URL
    // TODO: Find element
    // TODO: Match element text
    // TODO: Click element
    // TODO: Type keys
    // TODO: Move mouse
    // TODO: Scroll viewport
    // TODO: Screenshot
    // TODO: Start recording
    // TODO: Stop recording
    // TODO: Evaluate other Appium-supported actions

    // End driver session.
    await driver.deleteSession();
}