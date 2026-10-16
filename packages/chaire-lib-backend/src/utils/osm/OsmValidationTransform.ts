/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { PassThrough, Transform } from 'stream';
import { StringDecoder } from 'string_decoder';
import sax from 'sax';

export interface ValidatingTransform extends Transform {
    validationError?: Error;
}

/** Call for each stream: implementations may hold internal state that must not be shared across runs. */
export type ValidationTransformFactory = () => ValidatingTransform;

/** No-op validator */
export const createPassthroughTransform: ValidationTransformFactory = () => {
    return new PassThrough();
};

/**
 * Validates the streamed XML is well-formed and contains at least one node/way/relation element.
 * Does not validate that the OSM document itself is well-formed, only the XML.
 */
export const createXmlOsmElementValidationTransform: ValidationTransformFactory = () => {
    const osmElementNames = new Set(['node', 'way', 'relation']);
    let isOsmElementFound = false;
    let parseError: Error | undefined;

    const parser = sax.parser(true);
    parser.onopentag = (node) => {
        if (osmElementNames.has(node.name)) {
            isOsmElementFound = true;
        }
    };
    parser.onerror = (error) => {
        parseError = error;
    };

    const decoder = new StringDecoder('utf8');

    const transform: ValidatingTransform = new Transform({
        transform(chunk, _encoding, callback) {
            // Stop parsing after the first parsing error. We don't need to find more
            if (!parseError) {
                parser.write(decoder.write(chunk));
            }
            // Always pass the chunk through
            callback(null, chunk);
        },
        flush(callback) {
            if (!parseError) {
                // Without calling parser.resume() after an error, this would throw.
                parser.write(decoder.end());
                parser.close();
            }
            if (parseError) {
                transform.validationError = parseError;
            } else if (!isOsmElementFound) {
                transform.validationError = new Error('OSM document contains no node, way, or relation');
            }
            callback();
        }
    });

    return transform;
};
