const axios = require("axios");
const appium = require("appium");
const { exit } = require('node:process');
const wdio = require('webdriverio');
const OBSWebSocket = require('obs-websocket-js').default;

main();

// Primary execution function.
async function main() {
    appiumStart();
    const obs = await obsConnect();
    await appiumIsReady();
    await runTests();
    await obsDisconnect(obs);
    exit();
}

// Start the Appium server asynchronously.
async function appiumStart() {
    appium.main();
}

// Connect to OBS
async function obsConnect() {
    const obs = new OBSWebSocket();
    try {
        const {
            obsWebSocketVersion,
            negotiatedRpcVersion
        } = await obs.connect('ws://127.0.0.1:4455', 'T3AUEXrjK3xrPegG');
        console.log(`Connected to server ${obsWebSocketVersion} (using RPC ${negotiatedRpcVersion})`)
        return obs;
    } catch (error) {
        console.error('Failed to connect', error.code, error.message);
    }
}

// Disconnect from OBS
async function obsDisconnect(obs) {
    await obs.disconnect();
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
        // TODO: https://webdriver.io/docs/api/browser/action#key-input-source

        // TODO: Match element text

        // Click element
        const searchButton = await driver.$('#search_button_homepage');
        await searchButton.click()

        // Move mouse
        // TODO: https://webdriver.io/docs/api/browser/action#pointer-input-source

        // Scroll viewport
        await driver.scroll();
        // TODO: https://webdriver.io/docs/api/browser/action#wheel-input-source

        // Save screenshot
        await driver.saveScreenshot('./screenshot.png')

        // Compare screenshots
        // TODO: https://appium.io/docs/en/writing-running-appium/image-comparison/

        // Find template image in screenshot
        // TODO: https://appium.io/docs/en/writing-running-appium/image-comparison/

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