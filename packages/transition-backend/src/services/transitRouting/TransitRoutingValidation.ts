/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _uniq from 'lodash/uniq';
import { distance as turfDistance } from '@turf/turf';
import { TransitQueryAttributes } from 'chaire-lib-common/lib/services/routing/types';
import { BaseOdTrip } from 'transition-common/lib/services/odTrip/BaseOdTrip';

import LineCollection from 'transition-common/lib/services/line/LineCollection';
import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import Line from 'transition-common/lib/services/line/Line';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';

import transitAgenciesDbQueries from '../../models/db/transitAgencies.db.queries';
import transitServicesDbQueries from '../../models/db/transitServices.db.queries';
import transitLinesDbQueries from '../../models/db/transitLines.db.queries';
import transitPathsDbQueries from '../../models/db/transitPaths.db.queries';
import schedulesDbQueries from '../../models/db/transitSchedules.db.queries';
import transitNodeTransferableDbQueries from '../../models/db/transitNodeTransferable.db.queries';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import { PathAttributes } from 'transition-common/lib/services/path/Path';
import routingServiceManager from 'chaire-lib-common/lib/services/routing/RoutingServiceManager';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';

type DeclaredLine = { line: string; agency: string };

export type TransitValidationMessage =
    | {
          type: 'noDeclaredTrip';
      }
    | {
          type: 'lineNotFound';
          line: DeclaredLine[];
      }
    | {
          type: 'noServiceOnLine';
          line: DeclaredLine[];
      }
    | {
          type: 'noServiceOnLineAtTime';
          line: DeclaredLine[];
      }
    | {
          type: 'walkingDistanceTooLong';
          origin: 'origin' | DeclaredLine;
          destination: 'destination' | DeclaredLine;
      }
    | {
          type: 'incompatibleTrip';
          originLine: DeclaredLine;
          destinationLine: DeclaredLine;
      };

/**
 * Type for the validation parameters, they should all be mandatory at this point
 */
export type TransitValidationAttributes = Required<TransitQueryAttributes> & {
    bufferSeconds: number; // Buffer time to subtract to the trip departure time or add to the arrival time
};

export class TransitRoutingValidation {
    private _lineCollection: LineCollection | undefined = undefined;
    private _agencyCollection: AgencyCollection | undefined = undefined;
    private _serviceCollection: ServiceCollection | undefined = undefined;
    private _pathCollection: PathCollection | undefined = undefined;

    constructor(private routingParameters: TransitValidationAttributes) {
        // Nothing else to do
    }

    private prepareData = async () => {
        // Get the data filtered for requested scenario
        if (this._lineCollection && this._agencyCollection && this._serviceCollection && this._pathCollection) {
            // Data already prepared
            return;
        }

        const lineCollection = new LineCollection([], {});
        const lines = await transitLinesDbQueries.collection({ scenarioId: this.routingParameters.scenarioId });
        lineCollection.loadFromCollection(lines);
        this._lineCollection = lineCollection;

        const agencyCollection = new AgencyCollection([], {});
        const agencies = await transitAgenciesDbQueries.collection({ scenarioId: this.routingParameters.scenarioId });
        agencyCollection.loadFromCollection(agencies);
        this._agencyCollection = agencyCollection;

        const serviceCollection = new ServiceCollection([], {});
        const services = await transitServicesDbQueries.collection({ scenarioId: this.routingParameters.scenarioId });
        serviceCollection.loadFromCollection(services);
        this._serviceCollection = serviceCollection;

        const pathCollection = new PathCollection([], {});
        const pathsGeojson = await transitPathsDbQueries.geojsonCollection({
            noNullGeo: true,
            scenarioId: this.routingParameters.scenarioId
        });
        pathCollection.loadFromCollection(pathsGeojson.features);
        this._pathCollection = pathCollection;
    };

    run = async ({
        odTrip,
        dateOfTrip,
        declaredTrip
    }: {
        odTrip: BaseOdTrip;
        dateOfTrip: Date;
        declaredTrip: DeclaredLine[];
    }): Promise<true | TransitValidationMessage> => {
        // No declared trip, return with a noDeclaredTrip message
        if (declaredTrip.length === 0) {
            return {
                type: 'noDeclaredTrip'
            };
        }

        await this.prepareData();

        // Identify the lines use by the declared trip
        const declaredTransitLines: { line?: Line; declaredLine: DeclaredLine }[] = declaredTrip.map((declaredLine) => {
            const agencyId = this._agencyCollection!.getByShortname(declaredLine.agency)?.id;
            if (!agencyId) {
                return { declaredLine };
            }
            const line = this._lineCollection!.getFeatures().find(
                (line) => line.attributes.agency_id === agencyId && line.attributes.shortname === declaredLine.line
            );
            return { declaredLine, line };
        });

        // If not all lines are found, return with a lineNotFound message
        const linesNotFound = declaredTransitLines.filter((declaredLine) => !declaredLine.line);
        if (linesNotFound.length > 0) {
            return {
                type: 'lineNotFound',
                line: linesNotFound.map((declaredLine) => declaredLine.declaredLine)
            };
        }

        // For each line, get the services at the given date
        const linesUsed = declaredTransitLines.map((declaredLine) => declaredLine.line!);
        const linesWithSchedules = await transitLinesDbQueries.collectionWithSchedules(linesUsed);
        const linesWithFilteredServices = linesWithSchedules.map((line, idx) => {
            const schedulesByServiceId = line.attributes.scheduleByServiceId || {};
            const services = Object.entries(schedulesByServiceId).filter(([serviceId, _schedule]) => {
                const service = this._serviceCollection!.getById(serviceId);
                if (!service) {
                    return false;
                }
                // Check if the service is active on the date of the trip
                return service.isValidForDate(dateOfTrip);
            });
            const validServices = services.map(([serviceId, schedule]) => schedule);
            return { line, validServices, declaredLine: declaredTransitLines[idx].declaredLine };
        });

        // If any line has no service, return with a noServiceOnLine message
        const linesWithoutService = linesWithFilteredServices.filter(
            (line) => Object.keys(line.validServices).length === 0
        );
        if (linesWithoutService.length > 0) {
            return {
                type: 'noServiceOnLine',
                line: linesWithoutService.map((line) => line.declaredLine)
            };
        }

        // Get all the trips for each line within the time period of the trip
        const timeRangeStart =
            odTrip.attributes.timeOfTrip -
            (this.routingParameters.bufferSeconds || 0) -
            (odTrip.attributes.timeType === 'departure'
                ? 0
                : this.routingParameters.maxTotalTravelTimeSeconds || 180 * 60);
        const timeRangeEnd =
            timeRangeStart +
            (this.routingParameters.bufferSeconds || 0) * 2 + // Re-add buffer from range start and add another one at the end
            (this.routingParameters.maxTotalTravelTimeSeconds || 180 * 60);

        // Are there trips for each line? If not, return with a noServiceOnLineAtTime message
        const tripsInRange = await schedulesDbQueries.getTripsInTimeRange({
            rangeStart: timeRangeStart,
            rangeEnd: timeRangeEnd,
            lineIds: linesWithFilteredServices.map((line) => line.line.getId()),
            serviceIds: _uniq(
                linesWithFilteredServices.flatMap((line) => line.validServices.map((service) => service.service_id))
            )
        });

        const tripsByLine = linesWithFilteredServices.map((line) => {
            const trips = tripsInRange.filter((trip) => trip.line_id === line.line.getId());
            return {
                line: line.line,
                trips: trips,
                declaredLine: line.declaredLine
            };
        });
        const lineWithNoTrips = tripsByLine.filter((tripByLine) => tripByLine.trips.length === 0);
        if (lineWithNoTrips.length > 0) {
            return {
                type: 'noServiceOnLineAtTime',
                line: lineWithNoTrips.map((line) => line.declaredLine)
            };
        }

        // Get the paths and stop coordinates for each trip in time range
        const paths = _uniq(tripsInRange.map((trip) => trip.path_id)).map(
            (pathId) => this._pathCollection!.getById(pathId)!
        );
        const pathsAndNodes: {
            path: GeoJSON.Feature<GeoJSON.LineString, PathAttributes>;
            nodes: GeoJSON.Feature<GeoJSON.Point>[];
        }[] = paths.map((path) => {
            // Extract the nodes' exact positions on the path from the
            // segment's data, ie the index in the coordinates of the start
            // of this segment. This will be used for access and egress
            // exact calculation, we don't need to node's coordinates
            const nodes = path?.properties.segments.map((segment) => ({
                type: 'Feature' as const,
                geometry: { type: 'Point' as const, coordinates: path.geometry.coordinates[segment] },
                properties: {}
            }));
            return {
                path: path!,
                nodes
            };
        });

        // [For each combination of lines entered]
        // First, get the transferable nodes for each line pairs in the declared
        // trip, they should be already calculated in the database
        for (let i = 0; i < declaredTrip.length - 1; i++) {
            const fromLine = linesUsed[i];
            const toLine = linesUsed[i + 1];

            // Get the paths for the lines
            const fromLinePaths = pathsAndNodes.filter(
                (pathAndNodes) => pathAndNodes.path.properties.line_id === fromLine.id
            );
            const toLinePaths = pathsAndNodes.filter(
                (pathAndNodes) => pathAndNodes.path.properties.line_id === toLine.id
            );

            // Get the transferable nodes between the two lines
            const transferableNodePairs = await transitNodeTransferableDbQueries.getTransferableNodePairs({
                pathsFrom: fromLinePaths.map((pathAndNodes) => pathAndNodes.path.properties.id),
                pathsTo: toLinePaths.map((pathAndNodes) => pathAndNodes.path.properties.id)
            });

            if (transferableNodePairs.length === 0) {
                return {
                    type: 'incompatibleTrip',
                    originLine: declaredTransitLines[i].declaredLine,
                    destinationLine: declaredTransitLines[i + 1].declaredLine
                };
            }
        }

        // Get the nearest entry node to the origin in the first line
        const firstLineUsed = linesUsed[0];
        const firstPossiblePaths = pathsAndNodes.filter(
            (pathAndNodes) => pathAndNodes.path.properties.line_id === firstLineUsed.id
        );
        const possibleAccessNodes = await this.getAccessibleNodes(
            'from',
            odTrip.attributes.origin_geography,
            firstPossiblePaths[0].nodes,
            this.routingParameters.maxAccessEgressTravelTimeSeconds!
        );
        if (possibleAccessNodes.length === 0) {
            return {
                type: 'walkingDistanceTooLong',
                origin: 'origin',
                destination: declaredTrip[0]
            };
        }

        // Get the nearest exit node to the destination in the last line
        const lastLineUsed = linesUsed[linesUsed.length - 1];
        const lastPossiblePaths = pathsAndNodes.filter(
            (pathAndNodes) => pathAndNodes.path.properties.line_id === lastLineUsed.id
        );
        const possibleEgressNodes = await this.getAccessibleNodes(
            'to',
            odTrip.attributes.destination_geography,
            lastPossiblePaths[0].nodes,
            this.routingParameters.maxAccessEgressTravelTimeSeconds!
        );
        if (possibleEgressNodes.length === 0) {
            return {
                type: 'walkingDistanceTooLong',
                origin: declaredTrip[declaredTrip.length - 1],
                destination: 'destination'
            };
        }

        // TODO Should we make sure there are compatible trips?
        // Verify if the service is compatible with the declared trip
        // Set prevArrivalTime to the time of departure - buffer
        // For each line
        // Find trip such that departureTime >= prevArrivalTime + walkingDistanceToEntryNode
        // If no trip found, return with a noServiceOnLineAtLine message
        // Set prevArrivalTime to the stop time at exit node of trip_i
        // Trip found, return true

        return true;
    };

    private getAccessibleNodes = async (
        direction: 'from' | 'to',
        refGeometry: GeoJSON.Point,
        points: GeoJSON.Feature<GeoJSON.Point>[],
        maxWalkingTravelTimeSeconds: number
    ): Promise<GeoJSON.Feature<GeoJSON.Point>[]> => {
        // Calculate points in bird distance first
        const walkingDistance = maxWalkingTravelTimeSeconds * this.routingParameters.walkingSpeedMps!;
        const pointsInBirdDistance = points.filter((point) => turfDistance(refGeometry, point) <= walkingDistance);

        if (pointsInBirdDistance.length === 0) {
            return [];
        }

        // Calculat the actual distance using the routing service
        const refFeature = { type: 'Feature', geometry: refGeometry, properties: {} } as GeoJSON.Feature<GeoJSON.Point>;
        const routingService = routingServiceManager.getRoutingServiceForEngine('engine');
        const routingResultJson =
            direction === 'from'
                ? await routingService.tableFrom({
                    mode: 'walking',
                    origin: refFeature,
                    destinations: pointsInBirdDistance
                })
                : await routingService.tableTo({
                    mode: 'walking',
                    origins: pointsInBirdDistance,
                    destination: refFeature
                });

        const distances = routingResultJson.distances;
        const accessibleNodes: GeoJSON.Feature<GeoJSON.Point>[] = [];
        for (let i = 0, count = pointsInBirdDistance.length; i < count; i++) {
            const nodeInBirdRadius = pointsInBirdDistance[i];
            const travelDistance = distances[i];
            if (!_isBlank(travelDistance) && travelDistance <= walkingDistance) {
                accessibleNodes.push(nodeInBirdRadius);
            }
        }
        return accessibleNodes;
    };
}
