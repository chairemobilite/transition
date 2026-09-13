/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createXmlOsmElementValidationTransform } from '../OsmValidationTransform';

const runXmlValidation = async (chunks: string[]): Promise<Error | undefined> => {
    const transform = createXmlOsmElementValidationTransform();
    await pipeline(
        Readable.from(chunks),
        transform,
        new Writable({
            write(_chunk, _encoding, callback) {
                callback();
            }
        })
    );
    return transform.validationError;
};

describe('createXmlOsmElementValidationTransform', () => {
    test('accepts a node', async () => {
        const error = await runXmlValidation([
            '<?xml version="1.0"?><osm version="0.6">',
            '<node id="123" lat="45.0" lon="-73.0"/>',
            '</osm>'
        ]);
        expect(error).toBeUndefined();
    });

    test('accepts a node split across chunks', async () => {
        const error = await runXmlValidation([
            '<?xml version="1.0"?><osm version="0.6"><no',
            'de id="1" lat="0" lon="0"/>',
            '</osm>'
        ]);
        expect(error).toBeUndefined();
    });

    test('rejects an empty document', async () => {
        const error = await runXmlValidation(['<?xml version="1.0"?><osm version="0.6"></osm>']);
        expect(error?.message).toEqual('OSM document contains no node, way, or relation');
    });

    test('rejects node inside a comment', async () => {
        const error = await runXmlValidation([
            '<?xml version="1.0"?><osm version="0.6">',
            '<!-- <node id="1" lat="0" lon="0"/> -->',
            '</osm>'
        ]);
        expect(error?.message).toEqual('OSM document contains no node, way, or relation');
    });

    test('rejects commented-out node split across chunks', async () => {
        const error = await runXmlValidation([
            '<?xml version="1.0"?><osm version="0.6"><!-- <node id',
            '="1" lat="0" lon="0"/> -->',
            '</osm>'
        ]);
        expect(error?.message).toEqual('OSM document contains no node, way, or relation');
    });

    test('rejects a node inside a CDATA section', async () => {
        const error = await runXmlValidation([
            '<?xml version="1.0"?><osm version="0.6">',
            '<![CDATA[ <node id="1" lat="0" lon="0"/> ]]>',
            '</osm>'
        ]);
        expect(error?.message).toEqual('OSM document contains no node, way, or relation');
    });

    test('rejects malformed XML', async () => {
        const error = await runXmlValidation([
            '<?xml version="1.0"?><osm version="0.6">',
            '<node id="123" lat="45.0" lon="-73.0"/>',
            // '</osm>'
        ]);
        expect(error).toBeDefined();
    });
});
