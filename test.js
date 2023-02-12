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
// Driver reference: https://appium.github.io/appium/docs/en/2.0/quickstart/test-js/
async function runTests() {
    // Define driver capabilities.
    // TODO: Build out variety of supported caps
    // Firefox
    const caps_firefox = { "platformName": "windows", "appium:automationName": "Gecko", "browserName": "MozillaFirefox", "appium:newCommandTimeout": 3600, "appium:connectHardwareKeyboard": true }
    // Chrome
    const caps_chrome = { "platformName": "windows", "appium:automationName": "Chromium", "browserName": "Chrome", "appium:newCommandTimeout": 3600, "appium:connectHardwareKeyboard": true }
    const driver = await wdio.remote({
        protocol: "http",
        hostname: "localhost",
        port: 4723,
        path: "/",
        capabilities: caps_chrome
    });

    try {
        // Run through all browser-based actions.
        // Go to URL
        await driver.url('https://www.duckduckgo.com')

        // Find element
        // Selector reference: https://webdriver.io/docs/selectors/
        const searchInput = await driver.$('#search_form_input_homepage');

        // Type keys
        await searchInput.setValue('WebdriverIO')

        // TODO: Match element text

        // Click element
        const searchButton = await driver.$('#search_button_homepage');
        await searchButton.click()

        // TODO: Move mouse


        // Scroll viewport
        await driver.scroll();

        // Save screenshot
        await driver.saveScreenshot('./screenshot.png')

        // Compare screenshots

        
        // Find template image in screenshot


        // Start recording
        // ! Appium: iOS/Android
        // await driver.startRecordingScreen({
        //     timeLimit: 360
        // });
        // ? RecordRTC.js: Chrome/Firefox/Safari/Opera
        // TODO: https://www.npmjs.com/package/recordrtc
        // ? Native Windows/macOS/Linux


        // Stop recording
        // ! Appium: iOS/Android
        // const recording = await driver.stopRecordingScreen();
        // ? RecordRTC.js: Chrome/Firefox/Safari/Opera
        // ? Native Windows/macOS/Linux

        // Wait
        await driver.pause(10000);

        // TODO: Evaluate other Appium-supported actions

    } finally {
        // End driver session.
        await driver.deleteSession();
    }
}