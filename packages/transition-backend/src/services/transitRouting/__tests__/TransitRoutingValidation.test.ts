/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import { v4 as uuidV4 } from 'uuid';
import { distance as turfDistance } from '@turf/turf';
import { BaseOdTrip } from 'transition-common/lib/services/odTrip/BaseOdTrip';
import { TransitRoutingValidation, TransitValidationAttributes, TransitValidationMessage } from '../TransitRoutingValidation';

import LineCollection from 'transition-common/lib/services/line/LineCollection';
import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import Line from 'transition-common/lib/services/line/Line';
import Agency from 'transition-common/lib/services/agency/Agency';
import Service from 'transition-common/lib/services/service/Service';

import transitAgenciesDbQueries from '../../../models/db/transitAgencies.db.queries';
import transitServicesDbQueries from '../../../models/db/transitServices.db.queries';
import transitLinesDbQueries from '../../../models/db/transitLines.db.queries';
import transitPathsDbQueries from '../../../models/db/transitPaths.db.queries';
import schedulesDbQueries from '../../../models/db/transitSchedules.db.queries';
import transitNodeTransferableDbQueries from '../../../models/db/transitNodeTransferable.db.queries';

// Mock service collections
jest.mock('transition-common/lib/services/line/LineCollection');
jest.mock('transition-common/lib/services/agency/AgencyCollection');
jest.mock('transition-common/lib/services/service/ServiceCollection');

// Mock DB queries
jest.mock('../../../models/db/transitAgencies.db.queries', () => ({
    collection: jest.fn(),
}));
const mockDbAgencyCollection = transitAgenciesDbQueries.collection as jest.MockedFunction<typeof transitAgenciesDbQueries.collection>; 
jest.mock('../../../models/db/transitServices.db.queries', () => ({
    collection: jest.fn(),
}));
const mockDbServiceCollection = transitServicesDbQueries.collection as jest.MockedFunction<typeof transitServicesDbQueries.collection>; 
jest.mock('../../../models/db/transitLines.db.queries', () => ({
    collection: jest.fn(),
    collectionWithSchedules: jest.fn().mockImplementation((lines) => _cloneDeep(lines).map((line) => (line.scheduleByServiceId = {}, line))) // Default to empty services for lines
}));
const mockDbLineCollection = transitLinesDbQueries.collection as jest.MockedFunction<typeof transitLinesDbQueries.collection>; 
const mockDbLineCollectionWithSchedules = transitLinesDbQueries.collectionWithSchedules as jest.MockedFunction<typeof transitLinesDbQueries.collectionWithSchedules>; 
jest.mock('../../../models/db/transitSchedules.db.queries', () => ({
    getTripsInTimeRange: jest.fn().mockResolvedValue([]), // Default to empty trips
}));
const mockGetTripsInTimeRange = schedulesDbQueries.getTripsInTimeRange as jest.MockedFunction<typeof schedulesDbQueries.getTripsInTimeRange>;
// Mock paths db queries
jest.mock('../../../models/db/transitPaths.db.queries', () => ({
    geojsonCollection: jest.fn().mockResolvedValue({ type: 'FeatureCollection', features: [] }) // Default to empty geojson
}));
const mockPathGeojsonCollection = transitPathsDbQueries.geojsonCollection as jest.MockedFunction<typeof transitPathsDbQueries.geojsonCollection>;
// Mock transferable nodes
jest.mock('../../../models/db/transitNodeTransferable.db.queries', () => ({
    saveForNode: jest.fn(),
    getTransferableNodePairs: jest.fn().mockResolvedValue([])
}));
const mockGetTransferableNodePairs = transitNodeTransferableDbQueries.getTransferableNodePairs as jest.MockedFunction<typeof transitNodeTransferableDbQueries.getTransferableNodePairs>;

// Mock turf distance as the coordinates used are for tests and we can't make them use real distance
jest.mock('@turf/turf', () => {
    // Require the original module as some other parts may use other function of turf
    const originalModule =
        jest.requireActual<typeof import('@turf/turf')>('@turf/turf');
  
    return {
        ...originalModule,
        distance: jest.fn().mockReturnValue(1000)
    };
});
const mockTurfDistance = turfDistance as jest.MockedFunction<typeof turfDistance>;

// Mock osrm
const mockTableFrom = jest.fn().mockResolvedValue({ durations: [], distances: [] });
const mockTableTo = jest.fn().mockResolvedValue({ durations: [], distances: [] });
jest.mock('chaire-lib-common/lib/services/routing/RoutingServiceManager', () => ({
    getRoutingServiceForEngine: jest.fn().mockImplementation(() => ({
        tableFrom: mockTableFrom,
        tableTo: mockTableTo
    }))
}));

const mockLineCollection = LineCollection as jest.MockedClass<typeof LineCollection>;
const mockAgencyCollection = AgencyCollection as jest.MockedClass<typeof AgencyCollection>;
const mockServiceCollection = ServiceCollection as jest.MockedClass<typeof ServiceCollection>;

describe('TransitRoutingValidation', () => {
    // Common test data
    const testDate = new Date(2023, 5, 15, 8, 0, 0); // Thursday June 15, 2023, 8:00 AM
    const baseOdTrip = new BaseOdTrip({
        id: uuidV4(),
        timeOfTrip: 8 * 3600, // 8:00 AM
        timeType: 'departure' as 'departure',
        origin_geography: { type: 'Point', coordinates: [-73.5, 45.5] },
        destination_geography: { type: 'Point', coordinates: [-73.6, 45.6] }
    });;

    const routingParams: TransitValidationAttributes = {
        maxTotalTravelTimeSeconds: 90 * 60,
        maxAccessEgressTravelTimeSeconds: 15 * 60,
        maxTransferTravelTimeSeconds: 10 * 60,
        minWaitingTimeSeconds: 60,
        maxWalkingOnlyTravelTimeSeconds: 20 * 60,
        maxFirstWaitingTimeSeconds: 20 * 60,
        walkingSpeedMps: 5000 / 3600, // 5 km/h
        walkingSpeedFactor: 1,
        bufferSeconds: 300,
        scenarioId: uuidV4()
    };

    // Create test agencies
    const agency1Id = uuidV4();
    const agency2Id = uuidV4();
    const agency1 = new Agency({
        id: agency1Id,
        name: 'Agency1',
        acronym: 'A1',
        internal_id: 'A1'
    }, true);
    const agency2 = new Agency({
        id: agency2Id,
        name: 'Agency2',
        acronym: 'A2',
        internal_id: 'A2'
    }, true);

    // Create test lines
    const line1Id = uuidV4();
    const line2Id = uuidV4();
    const line3Id = uuidV4();
    const line1 = new Line({
        id: line1Id,
        agency_id: agency1Id,
        shortname: '1',
        longname: 'Line 1',
        is_enabled: true,
        mode: 'bus'
    }, true);
    const line2 = new Line({
        id: line2Id,
        agency_id: agency2Id,
        shortname: '2',
        longname: 'Line 2',
        is_enabled: true,
        mode: 'bus'
    }, true);
    const line3 = new Line({
        id: line3Id,
        agency_id: agency2Id,
        shortname: '3',
        longname: 'Line 3',
        is_enabled: true,
        mode: 'bus'
    }, true);

    // Create test services
    const weekdayServiceId = uuidV4();
    const weekendServiceId = uuidV4();
    const weekDayService = new Service({
        id: weekdayServiceId,
        name: 'Service1',
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
        start_date: '2023-01-01',
        end_date: '2023-12-31',
        is_enabled: true
    }, true);
    const weekendService = new Service({
        id: weekendServiceId,
        name: 'Service2',
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: true,
        sunday: true,
        start_date: '2023-01-01',
        end_date: '2023-12-31',
        is_enabled: true
    }, true);

    const line1PathId1 = uuidV4();
    const line2PathId1 = uuidV4();
    const line2PathId2 = uuidV4();
    const line3PathId1 = uuidV4();
    const line1path1Geojson: GeoJSON.Feature<GeoJSON.LineString, any> = {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[-73.5, 45.5], [-73.6, 45.6]] },
        properties: {
            id: line1PathId1,
            line_id: line1Id,
            segments: [0, 1]
        }
    };
    const line2path1Geojson: GeoJSON.Feature<GeoJSON.LineString, any> = {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[-73.55, 45.55], [-73.65, 45.65]] },
        properties: {
            id: line2PathId1,
            line_id: line2Id,
            segments: [0, 1]
        }
    };
    const line2path2Geojson: GeoJSON.Feature<GeoJSON.LineString, any> = {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[-73.52, 45.52], [-73.62, 45.62]] },
        properties: {
            id: line2PathId2,
            line_id: line2Id,
            segments: [0, 1]
        }
    };
    const line3path1Geojson: GeoJSON.Feature<GeoJSON.LineString, any> = {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[-73.57, 45.57], [-73.67, 45.67]] },
        properties: {
            id: line3PathId1,
            line_id: line3Id,
            segments: [0, 1]
        }
    };

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Mock collections
        mockLineCollection.prototype.getFeatures.mockReturnValue([line1, line2, line3]);
        mockAgencyCollection.prototype.findByAcronym.mockImplementation((acronym) => {
            if (acronym === 'A1') return agency1;
            if (acronym === 'A2') return agency2;
            return undefined;
        });
        mockServiceCollection.prototype.getById.mockImplementation((id) => {
            if (id === weekdayServiceId) return weekDayService;
            if (id === weekendServiceId) return weekendService;
            return undefined;
        });

        // Mock DB queries
        mockDbAgencyCollection.mockResolvedValue([agency1.attributes, agency2.attributes]);
        mockDbLineCollection.mockResolvedValue([line1.attributes, line2.attributes, line3.attributes]);
        mockDbServiceCollection.mockResolvedValue([weekDayService.attributes, weekendService.attributes]);
        mockPathGeojsonCollection.mockResolvedValue({ type: 'FeatureCollection', features: [line1path1Geojson, line2path1Geojson, line2path2Geojson, line3path1Geojson] });
    });

    test('No lines in trip', async () => {
        const validation = new TransitRoutingValidation(routingParams);
        const result = await validation.run({
            odTrip: baseOdTrip,
            dateOfTrip: testDate,
            declaredTrip: []
        });

        // no declared trip message
        expect(result).toEqual({ type: 'noDeclaredTrip' });
    });

    test('One line not found', async () => {
        mockAgencyCollection.prototype.getByShortname.mockImplementation((shortname) => {
            if (shortname === 'A1') return agency1;
            return undefined;
        });
        
        const validation = new TransitRoutingValidation(routingParams);
        const result = await validation.run({
            odTrip: baseOdTrip,
            dateOfTrip: testDate,
            declaredTrip: [
                { line: '1', agency: 'A1' },
                { line: '3', agency: 'A3' }
            ]
        });

        expect(result).not.toBe(true);
        expect((result as TransitValidationMessage).type).toBe('lineNotFound');
        expect((result as any).line).toEqual([{ line: '3', agency: 'A3' }]);
    });

    test('Multiple lines not found', async () => {
        mockAgencyCollection.prototype.findByAcronym.mockImplementation(() => undefined);
        
        const validation = new TransitRoutingValidation(routingParams);
        const result = await validation.run({
            odTrip: baseOdTrip,
            dateOfTrip: testDate,
            declaredTrip: [
                { line: '1', agency: 'A1' },
                { line: '2', agency: 'A2' }
            ]
        });

        expect(result).not.toBe(true);
        expect((result as TransitValidationMessage).type).toBe('lineNotFound');
        expect((result as any).line).toEqual([
            { line: '1', agency: 'A1' },
            { line: '2', agency: 'A2' }
        ]);
    });

    test('One line has no service', async () => {
        // Mock line collection with schedule data for collectionWithSchedules
        mockDbLineCollectionWithSchedules.mockResolvedValue([
            new Line({ ...line1.attributes, id: line1Id, scheduleByServiceId: {} }, false),
            new Line({ ...line2.attributes, id: line2Id, scheduleByServiceId: { [weekdayServiceId]: { service_id: weekdayServiceId } } }, false)
        ]);

        const validation = new TransitRoutingValidation(routingParams);
        const result = await validation.run({
            odTrip: baseOdTrip,
            dateOfTrip: testDate,
            declaredTrip: [
                { line: '1', agency: 'A1' },
                { line: '2', agency: 'A2' }
            ]
        });

        expect(result).not.toBe(true);
        expect((result as TransitValidationMessage).type).toBe('noServiceOnLine');
        expect((result as any).line).toEqual([{ line: '1', agency: 'A1' }]);
    });

    test('One line has no valid service on dates', async () => {
        // Mock line collection with schedule data for collectionWithSchedules
        // service 2 is weekend so should not be considered available on date
        mockDbLineCollectionWithSchedules.mockResolvedValue([
            new Line({ ...line1.attributes, id: line1Id, scheduleByServiceId: { [weekendServiceId]: { service_id: weekendServiceId } } }, false),
            new Line({ ...line2.attributes, id: line2Id, scheduleByServiceId: { [weekdayServiceId]: { service_id: weekdayServiceId } } }, false)
        ]);

        const validation = new TransitRoutingValidation(routingParams);
        const result = await validation.run({
            odTrip: baseOdTrip,
            dateOfTrip: testDate,
            declaredTrip: [
                { line: '1', agency: 'A1' },
                { line: '2', agency: 'A2' }
            ]
        });

        expect(result).not.toBe(true);
        expect((result as TransitValidationMessage).type).toBe('noServiceOnLine');
        expect((result as any).line).toEqual([{ line: '1', agency: 'A1' }]);

        expect(mockDbLineCollectionWithSchedules).toHaveBeenCalledWith([line1, line2]);
    });

    test('No service at time of trip', async () => {
        // Mock lines with services
        mockDbLineCollectionWithSchedules.mockResolvedValue([
            new Line({ ...line1.attributes, id: line1Id, scheduleByServiceId: { [weekdayServiceId]: { service_id: weekdayServiceId } } }, false),
        ]);
        
        // Mock empty trips for the time range
        mockGetTripsInTimeRange.mockResolvedValue([]);

        const validation = new TransitRoutingValidation(routingParams);
        const result = await validation.run({
            odTrip: baseOdTrip,
            dateOfTrip: testDate,
            declaredTrip: [{ line: '1', agency: 'A1' }]
        });

        expect(result).not.toBe(true);
        expect((result as TransitValidationMessage).type).toBe('noServiceOnLineAtTime');
        expect((result as any).line).toEqual([{ line: '1', agency: 'A1' }]);

        expect(mockDbLineCollectionWithSchedules).toHaveBeenCalledWith([line1]);
        expect(mockGetTripsInTimeRange).toHaveBeenCalledWith({
            rangeStart: baseOdTrip.attributes.timeOfTrip - routingParams.bufferSeconds,
            rangeEnd: baseOdTrip.attributes.timeOfTrip + routingParams.bufferSeconds + routingParams.maxTotalTravelTimeSeconds,
            lineIds: [line1Id],
            serviceIds: [weekdayServiceId]
        });
    });

    test('With trips available at time, validation OK', async () => {
        // Mock lines with services
        mockDbLineCollectionWithSchedules.mockResolvedValue([
            new Line({ ...line1.attributes, id: line1Id, scheduleByServiceId: { [weekdayServiceId]: { service_id: weekdayServiceId } } }, false),
        ]);
        
        // Mock trips available in the time range
        mockGetTripsInTimeRange.mockResolvedValue([
            {
                id: uuidV4(),
                schedule_period_id: 1,
                path_id: line1PathId1,
                departure_time_seconds: 8 * 3600,
                arrival_time_seconds: 9 * 3600,
                line_id: line1Id,
                service_id: weekdayServiceId,
            } as any
        ]);

        // Mock access/egress paths
        mockTableFrom.mockResolvedValue({ distances: [1000, 3000], durations: [600, 1800] });
        mockTableTo.mockResolvedValue({ distances: [1000, 4000], durations: [1200, 2400] });

        const validation = new TransitRoutingValidation(routingParams);
        const result = await validation.run({
            odTrip: baseOdTrip,
            dateOfTrip: testDate,
            declaredTrip: [{ line: '1', agency: 'A1' }]
        });

        // With the current implementation, if trips are found, it should return true
        // (The full route validation isn't implemented yet)
        expect(result).toBe(true);

        expect(mockDbLineCollectionWithSchedules).toHaveBeenCalledWith([line1]);
        expect(mockGetTripsInTimeRange).toHaveBeenCalledWith({
            rangeStart: baseOdTrip.attributes.timeOfTrip - routingParams.bufferSeconds,
            rangeEnd: baseOdTrip.attributes.timeOfTrip + routingParams.bufferSeconds + routingParams.maxTotalTravelTimeSeconds,
            lineIds: [line1Id],
            serviceIds: [weekdayServiceId]
        });
        expect(mockGetTransferableNodePairs).not.toHaveBeenCalled();
    });

    test('With trips available at time, and timeType is arrival, validation OK', async () => {
        // Mock lines with services
        mockDbLineCollectionWithSchedules.mockResolvedValue([
            new Line({ ...line1.attributes, id: line1Id, scheduleByServiceId: { [weekdayServiceId]: { service_id: weekdayServiceId } } }, false),
        ]);
        
        // Mock trips available in the time range
        mockGetTripsInTimeRange.mockResolvedValue([
            {
                id: uuidV4(),
                schedule_period_id: 1,
                path_id: line1PathId1,
                departure_time_seconds: 8 * 3600,
                arrival_time_seconds: 9 * 3600,
                line_id: line1Id,
                service_id: weekdayServiceId
            } as any
        ]);

        // Mock access/egress paths
        mockTableFrom.mockResolvedValue({ distances: [1000, 3000], durations: [600, 1800] });
        mockTableTo.mockResolvedValue({ distances: [1000, 4000], durations: [1200, 2400] });

        // Use an odTrip with arrival time type
        const odTripWithArrival = new BaseOdTrip(_cloneDeep(baseOdTrip.attributes), false);
        odTripWithArrival.attributes.timeType = 'arrival';
        const validation = new TransitRoutingValidation(routingParams);
        const result = await validation.run({
            odTrip: odTripWithArrival,
            dateOfTrip: testDate,
            declaredTrip: [{ line: '1', agency: 'A1' }]
        });

        // With the current implementation, if trips are found, it should return true
        // (The full route validation isn't implemented yet)
        expect(result).toBe(true);

        expect(mockDbLineCollectionWithSchedules).toHaveBeenCalledWith([line1]);
        expect(mockGetTripsInTimeRange).toHaveBeenCalledWith({
            rangeStart: baseOdTrip.attributes.timeOfTrip - routingParams.bufferSeconds - routingParams.maxTotalTravelTimeSeconds,
            rangeEnd: baseOdTrip.attributes.timeOfTrip + routingParams.bufferSeconds,
            lineIds: [line1Id],
            serviceIds: [weekdayServiceId]
        });
    });

    test('With trips available at time, no date, validation OK', async () => {
        // Mock lines with services
        mockDbLineCollectionWithSchedules.mockResolvedValue([
            new Line({ ...line1.attributes, id: line1Id, scheduleByServiceId: { [weekdayServiceId]: { service_id: weekdayServiceId } } }, false),
        ]);
        
        // Mock trips available in the time range
        mockGetTripsInTimeRange.mockResolvedValue([
            {
                id: uuidV4(),
                schedule_period_id: 1,
                path_id: line1PathId1,
                departure_time_seconds: 8 * 3600,
                arrival_time_seconds: 9 * 3600,
                line_id: line1Id,
                service_id: weekdayServiceId
            } as any
        ]);

        // Mock access/egress paths
        mockTableFrom.mockResolvedValue({ distances: [1000, 3000], durations: [600, 1800] });
        mockTableTo.mockResolvedValue({ distances: [1000, 4000], durations: [1200, 2400] });

        // Use an odTrip with arrival time type
        const odTripWithArrival = new BaseOdTrip(_cloneDeep(baseOdTrip.attributes), false);
        odTripWithArrival.attributes.timeType = 'arrival';
        const validation = new TransitRoutingValidation(routingParams);
        const result = await validation.run({
            odTrip: odTripWithArrival,
            declaredTrip: [{ line: '1', agency: 'A1' }]
        });

        // With the current implementation, if trips are found, it should return true
        // (The full route validation isn't implemented yet)
        expect(result).toBe(true);

        expect(mockDbLineCollectionWithSchedules).toHaveBeenCalledWith([line1]);
        expect(mockGetTripsInTimeRange).toHaveBeenCalledWith({
            rangeStart: baseOdTrip.attributes.timeOfTrip - routingParams.bufferSeconds - routingParams.maxTotalTravelTimeSeconds,
            rangeEnd: baseOdTrip.attributes.timeOfTrip + routingParams.bufferSeconds,
            lineIds: [line1Id],
            serviceIds: [weekdayServiceId]
        });
    });

    test('One line, destination too far', async () => {
        // Mock lines with services
        mockDbLineCollectionWithSchedules.mockResolvedValue([
            new Line({ ...line1.attributes, id: line1Id, scheduleByServiceId: { [weekdayServiceId]: { service_id: weekdayServiceId } } }, false),
        ]);
        
        // Mock trips available in the time range
        mockGetTripsInTimeRange.mockResolvedValue([
            {
                id: uuidV4(),
                schedule_period_id: 1,
                path_id: line1PathId1,
                departure_time_seconds: 8 * 3600,
                arrival_time_seconds: 9 * 3600,
                line_id: line1Id,
                service_id: weekdayServiceId,
            } as any
        ]);

        // Mock access/egress paths
        mockTableFrom.mockResolvedValue({ distances: [1000, 3000], durations: [600, 1800] });
        // Distance of 2 km is too far for the parameters (1250 max)
        mockTableTo.mockResolvedValue({ distances: [2000, 4000], durations: [1200, 2400] });

        const validation = new TransitRoutingValidation(routingParams);
        const result = await validation.run({
            odTrip: baseOdTrip,
            dateOfTrip: testDate,
            declaredTrip: [{ line: '1', agency: 'A1' }]
        });

        // With the current implementation, if trips are found, it should return true
        // (The full route validation isn't implemented yet)
        expect(result).toEqual({
            type: 'walkingDistanceTooLong',
            origin: { line: '1', agency: 'A1' },
            destination: 'destination'
        });

        expect(mockDbLineCollectionWithSchedules).toHaveBeenCalledWith([line1]);
        expect(mockGetTripsInTimeRange).toHaveBeenCalledWith({
            rangeStart: baseOdTrip.attributes.timeOfTrip - routingParams.bufferSeconds,
            rangeEnd: baseOdTrip.attributes.timeOfTrip + routingParams.bufferSeconds + routingParams.maxTotalTravelTimeSeconds,
            lineIds: [line1Id],
            serviceIds: [weekdayServiceId]
        });
        expect(mockGetTransferableNodePairs).not.toHaveBeenCalled();
        expect(mockTableFrom).toHaveBeenCalledTimes(1);
        expect(mockTableTo).toHaveBeenCalledTimes(1);
    });

    test('One line, origin too far', async () => {
        // Mock lines with services
        mockDbLineCollectionWithSchedules.mockResolvedValue([
            new Line({ ...line1.attributes, id: line1Id, scheduleByServiceId: { [weekdayServiceId]: { service_id: weekdayServiceId } } }, false),
        ]);
        
        // Mock trips available in the time range
        mockGetTripsInTimeRange.mockResolvedValue([
            {
                id: uuidV4(),
                schedule_period_id: 1,
                path_id: line1PathId1,
                departure_time_seconds: 8 * 3600,
                arrival_time_seconds: 9 * 3600,
                line_id: line1Id,
                service_id: weekdayServiceId,
            } as any
        ]);

        // Mock access/egress paths
        // Distance of 2 km is too far for the parameters (1250 max)
        mockTableFrom.mockResolvedValue({ distances: [2000, 3000], durations: [1200, 1800] });

        const validation = new TransitRoutingValidation(routingParams);
        const result = await validation.run({
            odTrip: baseOdTrip,
            dateOfTrip: testDate,
            declaredTrip: [{ line: '1', agency: 'A1' }]
        });

        // With the current implementation, if trips are found, it should return true
        // (The full route validation isn't implemented yet)
        expect(result).toEqual({
            type: 'walkingDistanceTooLong',
            origin: 'origin',
            destination: { line: '1', agency: 'A1' }
        });

        expect(mockDbLineCollectionWithSchedules).toHaveBeenCalledWith([line1]);
        expect(mockGetTripsInTimeRange).toHaveBeenCalledWith({
            rangeStart: baseOdTrip.attributes.timeOfTrip - routingParams.bufferSeconds,
            rangeEnd: baseOdTrip.attributes.timeOfTrip + routingParams.bufferSeconds + routingParams.maxTotalTravelTimeSeconds,
            lineIds: [line1Id],
            serviceIds: [weekdayServiceId]
        });
        expect(mockGetTransferableNodePairs).not.toHaveBeenCalled();
        expect(mockTableFrom).toHaveBeenCalledTimes(1);
        expect(mockTableTo).not.toHaveBeenCalled();
    });

    describe('Multiple lines', () => {
        const tripsInRange = [
            {
                id: uuidV4(),
                schedule_period_id: 1,
                path_id: line1PathId1,
                departure_time_seconds: 8 * 3600,
                arrival_time_seconds: 9 * 3600,
                line_id: line1Id,
                service_id: weekdayServiceId
            } as any,
            {
                id: uuidV4(),
                schedule_period_id: 2,
                path_id: line2PathId1,
                departure_time_seconds: 8 * 3600 + 30 * 60, // 30 minutes later
                arrival_time_seconds: 9 * 3600 + 30 * 60,
                line_id: line2Id,
                service_id: weekendServiceId
            } as any,
            {
                id: uuidV4(),
                schedule_period_id: 2,
                path_id: line2PathId2,
                departure_time_seconds: 8 * 3600 + 40 * 60, // 40 minutes later
                arrival_time_seconds: 9 * 3600 + 40 * 60,
                line_id: line2Id,
                service_id: weekendServiceId
            } as any,
            {
                id: uuidV4(),
                schedule_period_id: 2,
                path_id: line3PathId1,
                departure_time_seconds: 8 * 3600 + 40 * 60, // 30 minutes later
                arrival_time_seconds: 9 * 3600 + 40 * 60,
                line_id: line3Id,
                service_id: weekendServiceId
            } as any
        ]

        beforeEach(() => {
            // Mock lines with services
            mockDbLineCollectionWithSchedules.mockResolvedValue([
                new Line({ ...line1.attributes, id: line1Id, scheduleByServiceId: { [weekdayServiceId]: { service_id: weekdayServiceId } } }, false),
                new Line({ ...line2.attributes, id: line2Id, scheduleByServiceId: { [weekdayServiceId]: { service_id: weekdayServiceId } } }, false),
                new Line({ ...line3.attributes, id: line3Id, scheduleByServiceId: { [weekdayServiceId]: { service_id: weekdayServiceId } } }, false)
            ]);
            // Mock trips available in the time range
            mockGetTripsInTimeRange.mockResolvedValue(tripsInRange);
        });

        test('Multiple lines, can route', async () => {
            // Mock transferable nodes, some for line1 to line 2, but none for line 2 to line 3
            mockGetTransferableNodePairs.mockImplementationOnce(async ({ pathsFrom, pathsTo }) => [{ from: { pathId: pathsFrom[0], nodeId: uuidV4() }, to: { pathId: pathsTo[0], nodeId: uuidV4() }, walking_travel_time_seconds: 5 * 60, walking_travel_distance_meters: 500 }]);
            mockGetTransferableNodePairs.mockImplementationOnce(async ({ pathsFrom, pathsTo }) => [{ from: { pathId: pathsFrom[0], nodeId: uuidV4() }, to: { pathId: pathsTo[0], nodeId: uuidV4() }, walking_travel_time_seconds: 5 * 60, walking_travel_distance_meters: 500 }]);
    
            // Mock access/egress paths
            mockTableFrom.mockResolvedValue({ distances: [1000, 3000], durations: [600, 1800] });
            mockTableTo.mockResolvedValue({ distances: [1000, 4000], durations: [1200, 2400] });
    
            const validation = new TransitRoutingValidation(routingParams);
            const result = await validation.run({
                odTrip: baseOdTrip,
                dateOfTrip: testDate,
                declaredTrip: [{ line: '1', agency: 'A1' }, { line: '2', agency: 'A2' }, { line: '3', agency: 'A2' }]
            });
    
            expect(result).toEqual(true);
            expect(mockGetTransferableNodePairs).toHaveBeenCalledTimes(2);
            expect(mockGetTransferableNodePairs).toHaveBeenNthCalledWith(1, { pathsFrom: [line1PathId1], pathsTo: [line2PathId1, line2PathId2] });
            expect(mockGetTransferableNodePairs).toHaveBeenNthCalledWith(2, { pathsFrom: [line2PathId1, line2PathId2], pathsTo: [line3PathId1] });
    
            expect(mockTableFrom).toHaveBeenCalledTimes(1);
            expect(mockTableFrom).toHaveBeenCalledWith({
                mode: 'walking',
                origin: expect.objectContaining({ geometry: baseOdTrip.attributes.origin_geography }),
                destinations: line1path1Geojson.geometry.coordinates.map(coordinates => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates }}))
            });
            expect(mockTableTo).toHaveBeenCalledTimes(1);
            expect(mockTableTo).toHaveBeenCalledWith({
                mode: 'walking',
                origins: line3path1Geojson.geometry.coordinates.map(coordinates => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates }})),
                destination: expect.objectContaining({ geometry: baseOdTrip.attributes.destination_geography }),
            });
        });
    
        test('Multiple lines, junction too long', async () => {
            // Mock transferable nodes, some for line1 to line 2, but none for line 2 to line 3
            mockGetTransferableNodePairs.mockImplementationOnce(async ({ pathsFrom, pathsTo }) => [{ from: { pathId: pathsFrom[0], nodeId: uuidV4() }, to: { pathId: pathsTo[0], nodeId: uuidV4() }, walking_travel_time_seconds: 5 * 60, walking_travel_distance_meters: 500 }]);
            mockGetTransferableNodePairs.mockResolvedValueOnce([]);
    
            const validation = new TransitRoutingValidation(routingParams);
            const result = await validation.run({
                odTrip: baseOdTrip,
                dateOfTrip: testDate,
                declaredTrip: [{ line: '1', agency: 'A1' }, { line: '2', agency: 'A2' }, { line: '3', agency: 'A2' }]
            });
    
            expect(result).toEqual({
                type: 'incompatibleTrip',
                originLine: { line: '2', agency: 'A2' },
                destinationLine:  { line: '3', agency: 'A2' },
            });
            expect(mockGetTransferableNodePairs).toHaveBeenCalledTimes(2);
            expect(mockGetTransferableNodePairs).toHaveBeenNthCalledWith(1, { pathsFrom: [line1PathId1], pathsTo: [line2PathId1, line2PathId2] });
            expect(mockGetTransferableNodePairs).toHaveBeenNthCalledWith(2, { pathsFrom: [line2PathId1, line2PathId2], pathsTo: [line3PathId1] });
        });
    
        test('Multiple lines, origin too far', async () => {
            // Mock transferable nodes, some for line1 to line 2, but none for line 2 to line 3
            mockGetTransferableNodePairs.mockImplementationOnce(async ({ pathsFrom, pathsTo }) => [{ from: { pathId: pathsFrom[0], nodeId: uuidV4() }, to: { pathId: pathsTo[0], nodeId: uuidV4() }, walking_travel_time_seconds: 5 * 60, walking_travel_distance_meters: 500 }]);
            mockGetTransferableNodePairs.mockImplementationOnce(async ({ pathsFrom, pathsTo }) => [{ from: { pathId: pathsFrom[0], nodeId: uuidV4() }, to: { pathId: pathsTo[0], nodeId: uuidV4() }, walking_travel_time_seconds: 5 * 60, walking_travel_distance_meters: 500 }]);

            // Mock access/egress paths
            // Distance of 2 km is too far for the parameters (1250 max)
            mockTableFrom.mockResolvedValue({ distances: [2000, 3000], durations: [1200, 1800] });

            const validation = new TransitRoutingValidation(routingParams);
            const result = await validation.run({
                odTrip: baseOdTrip,
                dateOfTrip: testDate,
                declaredTrip: [{ line: '1', agency: 'A1' }, { line: '2', agency: 'A2' }, { line: '3', agency: 'A2' }]
            });

            expect(result).toEqual({
                type: 'walkingDistanceTooLong',
                origin: 'origin',
                destination: { line: '1', agency: 'A1' }
            });
            expect(mockGetTransferableNodePairs).toHaveBeenCalledTimes(2);
            expect(mockGetTransferableNodePairs).toHaveBeenNthCalledWith(1, { pathsFrom: [line1PathId1], pathsTo: [line2PathId1, line2PathId2] });
            expect(mockGetTransferableNodePairs).toHaveBeenNthCalledWith(2, { pathsFrom: [line2PathId1, line2PathId2], pathsTo: [line3PathId1] });

            expect(mockTableFrom).toHaveBeenCalledTimes(1);
            expect(mockTableFrom).toHaveBeenCalledWith({
                mode: 'walking',
                origin: expect.objectContaining({ geometry: baseOdTrip.attributes.origin_geography }),
                destinations: line1path1Geojson.geometry.coordinates.map(coordinates => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates }}))
            });
            expect(mockTableTo).not.toHaveBeenCalled();
        });
        
        test('Multiple lines, destination too far', async () => {
            // Mock transferable nodes, some for line1 to line 2, but none for line 2 to line 3
            mockGetTransferableNodePairs.mockImplementationOnce(async ({ pathsFrom, pathsTo }) => [{ from: { pathId: pathsFrom[0], nodeId: uuidV4() }, to: { pathId: pathsTo[0], nodeId: uuidV4() }, walking_travel_time_seconds: 5 * 60, walking_travel_distance_meters: 500 }]);
            mockGetTransferableNodePairs.mockImplementationOnce(async ({ pathsFrom, pathsTo }) => [{ from: { pathId: pathsFrom[0], nodeId: uuidV4() }, to: { pathId: pathsTo[0], nodeId: uuidV4() }, walking_travel_time_seconds: 5 * 60, walking_travel_distance_meters: 500 }]);

            // Mock access/egress paths
            mockTableFrom.mockResolvedValue({ distances: [1000, 3000], durations: [1200, 1800] });
            // Distance of 2 km is too far for the parameters (1250 max)
            mockTableTo.mockResolvedValue({ distances: [2000, 3000], durations: [1200, 1800] });

            const validation = new TransitRoutingValidation(routingParams);
            const result = await validation.run({
                odTrip: baseOdTrip,
                dateOfTrip: testDate,
                declaredTrip: [{ line: '1', agency: 'A1' }, { line: '2', agency: 'A2' }, { line: '3', agency: 'A2' }]
            });

            expect(result).toEqual({
                type: 'walkingDistanceTooLong',
                origin: { line: '3', agency: 'A2' },
                destination: 'destination'
            });
            expect(mockGetTransferableNodePairs).toHaveBeenCalledTimes(2);
            expect(mockGetTransferableNodePairs).toHaveBeenNthCalledWith(1, { pathsFrom: [line1PathId1], pathsTo: [line2PathId1, line2PathId2] });
            expect(mockGetTransferableNodePairs).toHaveBeenNthCalledWith(2, { pathsFrom: [line2PathId1, line2PathId2], pathsTo: [line3PathId1] });

            expect(mockTableFrom).toHaveBeenCalledTimes(1);
            expect(mockTableFrom).toHaveBeenCalledWith({
                mode: 'walking',
                origin: expect.objectContaining({ geometry: baseOdTrip.attributes.origin_geography }),
                destinations: line1path1Geojson.geometry.coordinates.map(coordinates => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates }}))
            });
            expect(mockTableTo).toHaveBeenCalledTimes(1);
            expect(mockTableTo).toHaveBeenCalledWith({
                mode: 'walking',
                origins: line3path1Geojson.geometry.coordinates.map(coordinates => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates }})),
                destination: expect.objectContaining({ geometry: baseOdTrip.attributes.destination_geography }),
            });
        });

        test.todo('Multiple lines, no transfer trip between 2 lines');
    })
});