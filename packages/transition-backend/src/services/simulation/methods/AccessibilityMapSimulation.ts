/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import random from 'random';
import { EventEmitter } from 'events';
import { point as turfPoint } from '@turf/turf';

import { SimulationAlgorithmDescriptor } from 'transition-common/lib/services/simulation/SimulationAlgorithm';
import { SimulationRunDataAttributes } from 'transition-common/lib/services/simulation/SimulationRun';
import { TransitRoutingBaseAttributes } from 'chaire-lib-common/lib/services/routing/types';
import { SimulationMethodFactory, SimulationMethod } from './SimulationMethod';
import dataSourceDbQueries from 'chaire-lib-backend/lib/models/db/dataSources.db.queries';
import placesDbQueries from '../../../models/db/places.db.queries';
import nodesDbQueries from '../../../models/db/transitNodes.db.queries';
import { TransitAccessibilityMapCalculator } from '../../accessibilityMap/TransitAccessibilityMapCalculator';
import TransitAccessibilityMapRouting from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapRouting';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';

export const AccessMapSimulationTitle = 'AccessMapSimulation';
export interface AccessMapSimulationOptions {
    // TODO Support multiple data sources
    dataSourceId: string;
    sampleRatio: number;
}

type AccessMapSimulationResults = {
    // TODO Array of costs for 5 places, if we keep each place, it's too much data, or is it?
    placesCost: number[];
};

export class AccessibilityMapSimulationFactory implements SimulationMethodFactory<AccessMapSimulationOptions> {
    getDescriptor = () => new AccessMapSimulationDescriptor();
    create = (options: AccessMapSimulationOptions, simulationDataAttributes: SimulationRunDataAttributes) =>
        new AccessibilityMapSimulation(options, simulationDataAttributes);
}

export class AccessMapSimulationDescriptor implements SimulationAlgorithmDescriptor<AccessMapSimulationOptions> {
    getTranslatableName = (): string => 'transit:simulation:simulationMethods:AccessibilityMap';

    // TODO Add help texts
    getOptions = () => ({
        dataSourceId: {
            i18nName: 'transit:simulation:simulationMethods:AccessMapDataSources',
            type: 'select' as const,
            choices: async () => {
                const dataSources = await dataSourceDbQueries.collection({ type: 'places' });
                return dataSources.map((ds) => ({
                    value: ds.id,
                    label: ds.shortname
                }));
            }
        },
        sampleRatio: {
            i18nName: 'transit:simulation:simulationMethods:AccessMapMaxSampleRatio',
            type: 'number' as const,
            validate: (value: number) => value > 0 && value <= 1,
            default: 1
        }
    });

    validateOptions = (_options: AccessMapSimulationOptions): { valid: boolean; errors: string[] } => {
        const valid = true;
        const errors: string[] = [];

        // TODO Actually validate something

        return { valid, errors };
    };
}

// Simulation time range, between 8 and 9, in seconds.
const SIMULATION_TIME_RANGE = [8 * 60 * 60, 9 * 60 * 60];

/**
 * Simulate a scenario using accessibility maps from various random places in
 * the area
 */
export default class AccessibilityMapSimulation implements SimulationMethod {
    private static NODE_COLLECTION: NodeCollection | undefined = undefined;
    private static PLACES_WEIGHT: { [placeId: number]: number };
    private static loadingEvent: EventEmitter | false = false;
    private static placesLoadingEvent: EventEmitter | false = false;

    constructor(
        private options: AccessMapSimulationOptions,
        private simulationDataAttributes: SimulationRunDataAttributes
    ) {
        // Nothing to do
    }

    async getNodeCollection(): Promise<NodeCollection> {
        return new Promise((resolve) => {
            if (AccessibilityMapSimulation.NODE_COLLECTION !== undefined) {
                resolve(AccessibilityMapSimulation.NODE_COLLECTION);
                return;
            }
            const loadingEvent = AccessibilityMapSimulation.loadingEvent;
            if (!loadingEvent) {
                // Create the event emitter and fetch the nodes
                const eventEmitter = new EventEmitter();
                AccessibilityMapSimulation.loadingEvent = eventEmitter;
                const nodeCollection = new NodeCollection([], {});
                nodesDbQueries.geojsonCollection().then((featureCollection) => {
                    nodeCollection.loadFromCollection(featureCollection.features);
                    AccessibilityMapSimulation.NODE_COLLECTION = nodeCollection;
                    eventEmitter.emit('nodeCollection.loaded');
                    resolve(nodeCollection);
                });
            } else {
                loadingEvent.once('nodeCollection.loaded', () => {
                    resolve(AccessibilityMapSimulation.NODE_COLLECTION as NodeCollection);
                });
            }
        });
    }

    static async getPlacesWeight(dataSourceId: string): Promise<{ [placeId: number]: number }> {
        return new Promise((resolve) => {
            if (AccessibilityMapSimulation.PLACES_WEIGHT !== undefined) {
                resolve(AccessibilityMapSimulation.PLACES_WEIGHT);
                return;
            }
            const loadingEvent = AccessibilityMapSimulation.placesLoadingEvent;
            if (!loadingEvent) {
                // Create the event emitter and fetch the nodes
                const eventEmitter = new EventEmitter();
                AccessibilityMapSimulation.placesLoadingEvent = eventEmitter;
                placesDbQueries.collection([dataSourceId]).then((places) => {
                    const placesWeight: { [placeId: number]: number } = {};
                    places.forEach((place) => {
                        placesWeight[place.integer_id as number] =
                            place.data['weight:tripDestinationsPerWeekday'] !== undefined
                                ? place.data['weight:tripDestinationsPerWeekday']
                                : 1;
                    });
                    AccessibilityMapSimulation.PLACES_WEIGHT = placesWeight;
                    eventEmitter.emit('placeWeights.loaded');
                    resolve(placesWeight);
                });
            } else {
                loadingEvent.once('placeWeights.loaded', () => {
                    resolve(AccessibilityMapSimulation.PLACES_WEIGHT as { [placeId: number]: number });
                });
            }
        });
    }

    async simulate(
        scenarioId: string,
        options: { trRoutingPort: number; transitRoutingParameters: TransitRoutingBaseAttributes }
    ): Promise<{ fitness: number; results: AccessMapSimulationResults }> {
        const nodeCollection = await this.getNodeCollection();

        const countByDs = await placesDbQueries.countForDataSources([this.options.dataSourceId]);
        const placesAvgCosts: number[] = [];
        const maxSamples = Math.ceil(countByDs[this.options.dataSourceId] * this.options.sampleRatio);
        const accessMapRoutingParams = {
            ...options.transitRoutingParameters,
            scenarioId,
            numberOfPolygons: 1
        };
        const accessMapRouting = new TransitAccessibilityMapRouting(accessMapRoutingParams, false);

        // Get random sample from data sources
        const places = await placesDbQueries.collection([this.options.dataSourceId], maxSamples);

        // TODO For cost functions, we need to know the total number of places
        // that can be accessed by this scenario. For now, we take the total
        // count for data sources as total, but there may be places from other
        // data sources, count does not differenciate between them. Cost can be
        // higher than 1
        let currentTotalAverage = 0;
        let currentPlaceCount = 0;
        let currentVariability = 100;
        let lowVariabilityCount = 0;
        // TODO Parameterize this?
        const lowVariabilityThreshold = 0.01;
        const allPlaces = await AccessibilityMapSimulation.getPlacesWeight(this.options.dataSourceId);
        // Denominator of the final cost function. Sum of all weights
        const totalPlaces = Object.keys(allPlaces)
            .map((placeId) => allPlaces[placeId])
            .reduce((total, currentWeight) => total + currentWeight, 0);

        // Don't stop after only 1 low variability sample, wait for 2 sets of samples
        while (places.length > 0 && lowVariabilityCount < 2) {
            // Test 5 at a time and see if variability is still high
            const placesToTest = places.splice(0, 5);
            const costs: number[] = [];
            const promises = placesToTest.map(async (place) => {
                const randomDepartureTime = random.int(SIMULATION_TIME_RANGE[0], SIMULATION_TIME_RANGE[1]);
                accessMapRouting.attributes.locationGeojson = turfPoint(place.geography.coordinates);
                accessMapRouting.attributes.departureTimeSecondsSinceMidnight = randomDepartureTime;
                try {
                    const { result } = await TransitAccessibilityMapCalculator.calculate(accessMapRouting.attributes, {
                        port: options.trRoutingPort
                    });

                    const nodeStats = result.getAccessibilityStatsForDuration(
                        options.transitRoutingParameters.maxTotalTravelTimeSeconds || 3600,
                        nodeCollection,
                        {
                            statMethod: (placeIds: number[], fastestTimeByPlaceId: { [placeId: number]: number }) =>
                                placeIds
                                    // Make the weight a factor of the time to reach. Similar places, accessible in 10
                                    // or 60 minutes should not have the same weight.
                                    // TODO Fine-tune this formula to see what gives best results
                                    .map((placeId) => (allPlaces[placeId] || 1) / (fastestTimeByPlaceId[placeId] || 1))
                                    .reduce((weight, currentWeight) => currentWeight + weight, 0)
                        }
                    );
                    // Cost is the percentage of accessible places
                    costs.push(
                        Object.keys(nodeStats.accessiblePlacesCountByCategory).reduce(
                            (totalCount, currentKey) =>
                                totalCount + nodeStats.accessiblePlacesCountByCategory[currentKey],
                            0
                        ) / totalPlaces
                    );
                } catch {
                    // No routing or other error, cost is 0
                    costs.push(0);
                }
            });
            await Promise.allSettled(promises);
            const currentTotal = costs.reduce((total, current) => total + current, 0);
            const currentAvg = currentTotal / costs.length;
            placesAvgCosts.push(currentAvg);

            // Look at the current variability of the average
            const totalAverage =
                (currentTotalAverage * currentPlaceCount + currentTotal) / (currentPlaceCount + costs.length);
            currentPlaceCount += costs.length;
            currentVariability = (totalAverage - currentTotalAverage) / currentTotalAverage;
            lowVariabilityCount = Math.abs(currentVariability) <= lowVariabilityThreshold ? lowVariabilityCount + 1 : 0;
            currentTotalAverage = totalAverage;
        }
        return { fitness: currentTotalAverage, results: { placesCost: placesAvgCosts } };
    }
}
