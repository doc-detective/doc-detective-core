const wdio = require('webdriverio');
async function main() {
    const caps = { "platformName": "windows", "appium:automationName": "Gecko", "browserName": "MozillaFirefox", "appium:newCommandTimeout": 3600, "appium:connectHardwareKeyboard": true }
    const driver = await wdio.remote({
        protocol: "http",
        hostname: "localhost",
        port: 4723,
        path: "/",
        capabilities: caps
    });

    await driver.deleteSession();
}

main().catch(console.log);