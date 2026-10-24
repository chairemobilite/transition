/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { buildGtfsUploadErrorPayload } from '../uploads.socketRoutes';

describe('buildGtfsUploadErrorPayload (issue #1909)', () => {
    test('Returns the localizedMessage of any TrError', () => {
        const err = new TrError(
            'technical: malformed CSV agency.txt',
            'MALFORMED_CSV_LINE_ENDINGS',
            { text: 'transit:gtfs:errors:MalformedCsvFile', params: { fileName: 'agency.txt' } }
        );
        expect(buildGtfsUploadErrorPayload(err)).toEqual({
            text: 'transit:gtfs:errors:MalformedCsvFile',
            params: { fileName: 'agency.txt' }
        });
    });

    test('Falls back to a generic string for a TrError without a localizedMessage', () => {
        const err = new TrError('technical only', 'CODE');
        const payload = buildGtfsUploadErrorPayload(err);
        expect(typeof payload).toEqual('string');
        expect(payload).toMatch(/error importing gtfs file/);
    });

    test('Falls back to a generic string for a plain Error', () => {
        const err = new Error('something else broke');
        const payload = buildGtfsUploadErrorPayload(err);
        expect(typeof payload).toEqual('string');
        expect(payload).toMatch(/error importing gtfs file/);
        expect(payload).toMatch(/something else broke/);
    });

    test('Falls back to a generic string for non-Error values', () => {
        const payload = buildGtfsUploadErrorPayload('plain string error');
        expect(typeof payload).toEqual('string');
        expect(payload).toMatch(/plain string error/);
    });
});
