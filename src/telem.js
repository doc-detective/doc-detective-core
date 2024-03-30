const { log } = require("./utils");
const { PostHog } = require('posthog-node')

sendTelemetry()

function telemetryNotice(config) {

}

function sendTelemetry(config, command, results) {
    const client = new PostHog(
        'phc_rjV0MH3nsAd45zFISLgaKAdAXbgDeXt2mOBV2EBHomB',
        { host: 'https://app.posthog.com' }
    )
    client.capture({
        distinctId: 'test-id',
        event: 'test-event'
    })
    
    // Send queued events immediately. Use for example in a serverless environment
    // where the program may terminate before everything is sent.
    // Use `client.flush()` instead if you still need to send more events or fetch feature flags.
    client.shutdown()
}


exports.telemetryNotice = telemetryNotice;
exports.sendTelemetry = sendTelemetry;