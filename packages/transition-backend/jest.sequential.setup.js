/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/**
 * Global setup for sequential tests that require the json2capnp service
 */

function displayJson2CapnpError(host, port, reason = 'not running') {
    console.error('\n' + '='.repeat(80));
    console.error(`ERROR: json2capnp service is ${reason}!`);
    console.error('='.repeat(80));
    console.error('\nThe sequential tests require the json2capnp rust server to be started.');
    console.error('\nTo start the service, run the following commands:');
    console.error('  cd services/json2capnp');
    console.error('  cargo run 2000 ../../projects/test/test_cache/test');
    console.error('\nOr in a single command from the project root:');
    console.error('  (cd services/json2capnp && cargo run 2000 ../../projects/test/test_cache/test)');
    console.error(`\nExpected service location: ${host}:${port}`);
    console.error('\n' + '='.repeat(80) + '\n');
}

module.exports = async () => {
    const http = require('http');
    const Preferences = require('chaire-lib-common/lib/config/Preferences').default;

    // Get json2capnp configuration
    const json2CapnpConfig = Preferences.get('json2Capnp', {
        host: 'http://localhost',
        port: 2000
    });

    const host = json2CapnpConfig.host.replace(/^https?:\/\//, '');
    const port = json2CapnpConfig.port;

    console.log(`\nChecking if json2capnp service is running at ${host}:${port}...`);

    return new Promise((resolve, reject) => {
        const request = http.get({
            hostname: host,
            port: port,
            path: '/',
            timeout: 2000
        }, (res) => {
            console.log('✓ json2capnp service is running');
            resolve();
        });

        request.on('error', (err) => {
            displayJson2CapnpError(host, port, 'not running');
            reject(new Error(`json2capnp service is not available at ${host}:${port}`));
        });

        request.on('timeout', () => {
            request.destroy();
            displayJson2CapnpError(host, port, 'not responding (timeout)');
            reject(new Error(`json2capnp service connection timeout at ${host}:${port}`));
        });
    });
};
