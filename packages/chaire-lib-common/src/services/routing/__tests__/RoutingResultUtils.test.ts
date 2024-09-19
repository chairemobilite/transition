/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { UnimodalRoutingResult } from "../RoutingResult";
import { resultToObject } from "../RoutingResultUtils";
import { pathNoTransferRouteResult } from '../../../test/services/transitRouting/TrRoutingConstantsStubs';
import TestUtils from "../../../test/TestUtils";
import { TransitRoutingResult } from "../TransitRoutingResult";

const origin = TestUtils.makePoint([0, 0]);
const destination = TestUtils.makePoint([1, 1]);

describe('resultToObject', () => {

    test('Successful unimodal result', () => {
        const routingMode = 'driving' as const;
        const paths = [
            {
                distance: 1000,
                duration: 600,
                geometry: {
                    type: 'LineString' as const,
                    coordinates: [
                        [0, 0],
                        [1, 1],
                    ],
                },
                legs: []
            },
        ];

        const validParams = {
            routingMode,
            origin,
            destination,
            paths
        };
        expect(resultToObject(validParams)).toBeInstanceOf(UnimodalRoutingResult);

    });

    test('Successful transit result', () => {
        const validParams = {
            origin,
            destination,
            paths: [pathNoTransferRouteResult]
        };
        expect(resultToObject(validParams)).toBeInstanceOf(TransitRoutingResult);
    });

    test('Unimodal result with error', () => {
        const routingMode = 'driving' as const;

        const validParams = {
            routingMode,
            origin,
            destination,
            paths: [],
            error: { localizedMessage: 'error', error: 'error', errorCode: 'ERR_CODE' }
        };
        expect(resultToObject(validParams)).toBeInstanceOf(UnimodalRoutingResult);
    });

    test('Transit result with error', () => {
        const validParams = {
            origin,
            destination,
            paths: [],
            error: { localizedMessage: 'error', error: 'error', errorCode: 'ERR_CODE' }
        };
        expect(resultToObject(validParams)).toBeInstanceOf(TransitRoutingResult);
    });
});
