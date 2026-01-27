/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep'
import { TransitRouting, TransitRoutingAttributes } from '../TransitRouting';
import GeoJSON from 'geojson';
import { minutesToSeconds } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import each from 'jest-each';
import { TestUtils } from 'chaire-lib-common/lib/test';

const MAX_MAX_ACCESS_EGRESS = minutesToSeconds(40) as number;
const MAX_MAX_TRANSFER_TIME = minutesToSeconds(20) as number;
const MIN_MIN_WAITING_TIME = minutesToSeconds(1) as number;

let attributes: TransitRoutingAttributes;
let transitRouting: TransitRouting;
let errors: string[];
let msgErrors = {
    departureAndArrivalTimeAreBlank: 'transit:transitRouting:errors:DepartureAndArrivalTimeAreBlank',
    departureAndArrivalTimeAreBothNotBlank: 'transit:transitRouting:errors:DepartureAndArrivalTimeAreBothNotBlank',
    scenarioIsMissing: 'transit:transitRouting:errors:ScenarioIsMissing',
    maxAccessEgressNoNegative: 'transit:transitRouting:errors:AccessEgressTravelTimeSecondsNoNegative',
    transferTravelTimeSecondsTooLarge: 'transit:transitRouting:errors:TransferTravelTimeSecondsTooLarge',
    transferTravelTimeSecondsNoNegative: 'transit:transitRouting:errors:TransferTravelTimeSecondsNoNegative',
    minimumWaitingTimeSecondsMustBeAtLeast1Minute: 'transit:transitRouting:errors:MinimumWaitingTimeSecondsMustBeAtLeast1Minute',
    routingModesIsEmpty: 'transit:transitRouting:errors:RoutingModesIsEmpty'
};

beforeEach(function () {
    const routing = new TransitRouting({});
    const batchRoutingQueries = routing.attributes.savedForBatch;
    attributes = {
        savedForBatch: batchRoutingQueries
    };

    transitRouting = new TransitRouting(attributes);
});

describe('origin destination function', () => {
    test('no origin destination', () => {
        expect(transitRouting.hasOrigin()).toEqual(false);
        expect(transitRouting.hasDestination()).toEqual(false);
        expect(transitRouting.originLat()).toEqual(null);
        expect(transitRouting.originLon()).toEqual(null);
        expect(transitRouting.destinationLat()).toEqual(null);
        expect(transitRouting.destinationLon()).toEqual(null);
    });

    test('set origin destination', () => {
        let originGeojson: GeoJSON.Position = [-73, 46];
        let destinationGeojson: GeoJSON.Position = [-74, 45];

        transitRouting.setOrigin(originGeojson);
        transitRouting.setDestination(destinationGeojson);

        expect(transitRouting.hasOrigin()).toEqual(true);
        expect(transitRouting.hasDestination()).toEqual(true);
        expect(transitRouting.originLat()).toEqual(originGeojson[1]);
        expect(transitRouting.originLon()).toEqual(originGeojson[0]);
        expect(transitRouting.destinationLat()).toEqual(destinationGeojson[1]);
        expect(transitRouting.destinationLon()).toEqual(destinationGeojson[0]);
    });
});

describe('Validate function', () => {
    const objtestIsBlank = {
        attributes: {
            routingModes: ['transit']
        },
        isValid: false,
        errors: [msgErrors.departureAndArrivalTimeAreBlank, msgErrors.scenarioIsMissing]
    };

    const objtestIsNotBlank = {
        attributes: {
            routingModes: ['transit'],
            scenarioId: '0',
            departureTimeSecondsSinceMidnight: 0,
            arrivalTimeSecondsSinceMidnight: 0
        },
        isValid: false,
        errors: [msgErrors.departureAndArrivalTimeAreBothNotBlank]
    };

    const objtestMaxAccessEgressNoNegative = {
        attributes: {
            routingModes: ['transit'],
            odTripUuid: '868d633f-34e0-4b61-a9cc-61f0512000c3',
            scenarioId: '0',
            maxAccessEgressTravelTimeSeconds: -1
        },
        isValid: false,
        errors: [msgErrors.maxAccessEgressNoNegative]
    };

    const objtestMaxTransferTimeNoNegative = {
        attributes: {
            routingModes: ['transit'],
            odTripUuid: '868d633f-34e0-4b61-a9cc-61f0512000c3',
            scenarioId: '0',
            maxTransferTravelTimeSeconds: -1
        },
        isValid: false,
        errors: [msgErrors.transferTravelTimeSecondsNoNegative]
    };

    const objtestMaxTransferTimeTooLarge = {
        attributes: {
            routingModes: ['transit'],
            odTripUuid: '868d633f-34e0-4b61-a9cc-61f0512000c3',
            scenarioId: '0',
            maxTransferTravelTimeSeconds: MAX_MAX_TRANSFER_TIME + 1
        },
        isValid: false,
        errors: [msgErrors.transferTravelTimeSecondsTooLarge]
    };

    const objtestMinWaitingTimeAtLeast1Minute = {
        attributes: {
            routingModes: ['transit'],
            odTripUuid: '868d633f-34e0-4b61-a9cc-61f0512000c3',
            scenarioId: '0',
            minWaitingTimeSeconds: MIN_MIN_WAITING_TIME - 1
        },
        isValid: false,
        errors: [msgErrors.minimumWaitingTimeSecondsMustBeAtLeast1Minute]
    };

    const objtestValidateMaxMaxAccessEgressAndMaxMaxTransferTime = {
        attributes: {
            routingModes: ['transit'],
            odTripUuid: '868d633f-34e0-4b61-a9cc-61f0512000c3',
            scenarioId: '0',
            departureTimeSecondsSinceMidnight: 0,
            arrivalTimeSecondsSinceMidnight: 0,
            maxAccessEgressTravelTimeSeconds: MAX_MAX_ACCESS_EGRESS,
            maxTransferTravelTimeSeconds: MAX_MAX_TRANSFER_TIME,
            minWaitingTimeSeconds: MIN_MIN_WAITING_TIME,
        },
        isValid: true,
        errors: []
    };

    const objtestValidateMinMaxAccessEgressAndMinMaxTransferTime = {
        attributes: {
            routingModes: ['transit'],
            odTripUuid: '868d633f-34e0-4b61-a9cc-61f0512000c3',
            scenarioId: '0',
            departureTimeSecondsSinceMidnight: 0,
            arrivalTimeSecondsSinceMidnight: 0,
            maxAccessEgressTravelTimeSeconds: 0,
            maxTransferTravelTimeSeconds: 0,
            minWaitingTimeSeconds: MIN_MIN_WAITING_TIME
        },
        isValid: true,
        errors: []
    };

    const objtestValidateonlyWalking = {
        attributes: {
            routingModes: ['walking']
        },
        isValid: true,
        errors: []
    };

    const objtestValidateEmptyRoutingModes = {
        attributes: {
            routingModes: []
        },
        isValid: false,
        errors: [msgErrors.routingModesIsEmpty]
    };

    each([
        ['is blank', objtestIsBlank],
        ['is not blank', objtestIsNotBlank],
        ['maxAccessEgress no negative', objtestMaxAccessEgressNoNegative],
        ['maxTransferTime no negative', objtestMaxTransferTimeNoNegative],
        ['maxTransferTime too large', objtestMaxTransferTimeTooLarge],
        ['minWaitingTime at least 1 minute', objtestMinWaitingTimeAtLeast1Minute],
        ['validate max maxAccessEgress and max maxTransferTime', objtestValidateMaxMaxAccessEgressAndMaxMaxTransferTime],
        ['validate min maxAccessEgress and min maxTransferTime', objtestValidateMinMaxAccessEgressAndMinMaxTransferTime],
        ['validate without transit routing mode', objtestValidateonlyWalking],
        ['routing modes is not empty', objtestValidateEmptyRoutingModes],
    ]).test('%s', (nameTest, objTest) => {
        const allAttributes = Object.assign(attributes, objTest.attributes);
        transitRouting.mergeAttributes(allAttributes);

        expect(transitRouting.isValid()).toEqual(objTest.isValid);

        errors = transitRouting.getErrors();

        expect(errors.length).toEqual(objTest.errors.length);

        expect(errors).toEqual(objTest.errors);
    })
});

describe('Test add elements for batch', () => {
    const orig1: [number, number] = [-73, 45];
    const dest1: [number, number] = [-73.4, 45.4];
    const element1 = {
        departureTimeSecondsSinceMidnight: 28800,
        originGeojson: TestUtils.makePoint(orig1),
        destinationGeojson: TestUtils.makePoint(dest1)
    };
    const element2 = {
        departureTimeSecondsSinceMidnight: 28800,
        originGeojson: TestUtils.makePoint([orig1[0] + 0.1, orig1[1] + 0.1]),
        destinationGeojson: TestUtils.makePoint([orig1[0] + 0.2, orig1[1] + 0.2])
    };
    const duplicate = {
        departureTimeSecondsSinceMidnight: 28800,
        originGeojson: TestUtils.makePoint(orig1),
        destinationGeojson: TestUtils.makePoint(dest1)
    };
    const otherTime = {
        departureTimeSecondsSinceMidnight: 38800,
        originGeojson: TestUtils.makePoint(orig1),
        destinationGeojson: TestUtils.makePoint(dest1)
    };
    const otherTypeOfTime = {
        arrivalTimeSecondsSinceMidnight: 28800,
        originGeojson: TestUtils.makePoint(orig1),
        destinationGeojson: TestUtils.makePoint(dest1)
    };

    test('Test add valid element', () => {
        const routing = new TransitRouting({});
        const batchRoutingQueries = routing.attributes.savedForBatch;
        routing.addElementForBatch(element1);
        expect(batchRoutingQueries.length).toEqual(1);

        routing.addElementForBatch(element2);
        expect(batchRoutingQueries.length).toEqual(2);

        routing.addElementForBatch(otherTime);
        expect(batchRoutingQueries.length).toEqual(3);

        routing.addElementForBatch(otherTypeOfTime);
        expect(batchRoutingQueries.length).toEqual(4);
        expect(batchRoutingQueries).toContainEqual(element1);
        expect(batchRoutingQueries).toContainEqual(element2);
        expect(batchRoutingQueries).toContainEqual(otherTime);
        expect(batchRoutingQueries).toContainEqual(otherTypeOfTime);
    });

    test('Test duplicate element', () => {
        const routing = new TransitRouting({});
        const batchRoutingQueries = routing.attributes.savedForBatch;
        routing.addElementForBatch(element1);
        expect(batchRoutingQueries.length).toEqual(1);

        routing.addElementForBatch(element2);
        expect(batchRoutingQueries.length).toEqual(2);

        routing.addElementForBatch(duplicate);
        expect(batchRoutingQueries.length).toEqual(2);
        expect(batchRoutingQueries).toContainEqual(element1);
        expect(batchRoutingQueries).toContainEqual(element2);
    });
});

describe('toTripRoutingQueryAttributes', () => {
    const defaultParameters = { 
        routingModes: ['transit' as const],
        scenarioId: '0',
        maxAccessEgressTravelTimeSeconds: 0,
        maxTransferTravelTimeSeconds: 0,
        minWaitingTimeSeconds: MIN_MIN_WAITING_TIME,
        originGeojson: TestUtils.makePoint([0, 1]),
        destinationGeojson: TestUtils.makePoint([1, 0])
    };

    test('departure and arrival unset', () => {
        const params = _cloneDeep(defaultParameters);
        transitRouting = new TransitRouting(params);

        expect(transitRouting.toTripRoutingQueryAttributes()).toEqual(expect.objectContaining({
            ...defaultParameters,
            timeSecondsSinceMidnight: 0,
            timeType: 'departure'
        }));

    });

    test('departure set', () => {
        const params = _cloneDeep(defaultParameters);
        transitRouting = new TransitRouting({
            ...params,
            departureTimeSecondsSinceMidnight: 800
        });

        expect(transitRouting.toTripRoutingQueryAttributes()).toEqual(expect.objectContaining({
            ...defaultParameters,
            timeSecondsSinceMidnight: 800,
            timeType: 'departure'
        }));
    });

    test('arrival set', () => {
        const params = _cloneDeep(defaultParameters);
        transitRouting = new TransitRouting({
            ...params,
            arrivalTimeSecondsSinceMidnight: 800
        });

        expect(transitRouting.toTripRoutingQueryAttributes()).toEqual(expect.objectContaining({
            ...defaultParameters,
            timeSecondsSinceMidnight: 800,
            timeType: 'arrival'
        }));
    });
});
