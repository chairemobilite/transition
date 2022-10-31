/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/** Functions used by the json2capnp service in javascript. */

// TODO Type those functions

const writePackedMessageToStream = function(writeStream, message) {
    const arrayBuffer = message.toPackedArrayBuffer();
    // Because streams can't handle ArrayBuffers
    const buffer = Buffer.from(arrayBuffer);
    writeStream.write(buffer);
};

const readToEndOfStream = function(readStream) {
    return new Promise((resolve, reject) => {
        let result = new Uint8Array();
        readStream.on('close', () => {
            readStream.destroy();
            resolve(result);
        });

        readStream.on('error', reject);

        readStream.on('data', (data) => {
            const oldLen = result.byteLength;
            const newResult = new Uint8Array(oldLen + data.byteLength);
            newResult.set(result);
            newResult.set(data, oldLen);
            result = newResult;
        });
    });
};

export { writePackedMessageToStream, readToEndOfStream };
