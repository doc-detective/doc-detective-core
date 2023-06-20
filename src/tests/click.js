exports.clickElement = clickElement;

// Click an element.
async function clickElement(element) {
    let status;
    let description;
    let result;
    try {
        await element.click();
    } catch {
        // FAIL: Text didn't match
        status = "FAIL";
        description = `Couldn't click element.`;
        result = { status, description };
        return { result };
    }
    // PASS
    status = "PASS";
    description = `Clicked element.`;
    result = { status, description };
    return { result };
}