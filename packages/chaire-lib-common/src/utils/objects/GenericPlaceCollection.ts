/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { around } from 'geokdbush';
import KDBush from 'kdbush';

import type { GenericPlace, GenericPlaceAttributes } from './GenericPlace';
import GenericMapObjectCollection from './GenericMapObjectCollection';
import { _isBlank } from '../LodashExtensions';
import Preferences from '../../config/Preferences';
import routingServiceManager from '../../services/routing/RoutingServiceManager';
import { ceilToPositiveInteger } from '../MathUtils';

const createSpatialIndex = <A>(features: GeoJSON.Feature<GeoJSON.Point, A>[]): KDBush => {
    const spatialIndex = new KDBush(features.length);
    for (let i = 0, count = features.length; i < count; i++) {
        spatialIndex.add(features[i].geometry.coordinates[0], features[i].geometry.coordinates[1]);
    }
    spatialIndex.finish();
    return spatialIndex;
};

/**
 * A collection of point locations on a map
 */
export default abstract class GenericPlaceCollection<
    A extends GenericPlaceAttributes,
    T extends GenericPlace<A>
> extends GenericMapObjectCollection<GeoJSON.Point, A, T> {
    // The spatial index only stores the position of each point in the array of
    // features it was built from, so keep that array to get the features back
    protected _spatialIndex: KDBush;
    protected _spatialIndexFeatures: GeoJSON.Feature<GeoJSON.Point, A>[];

    constructor(features: GeoJSON.Feature<GeoJSON.Point, A>[], attributes?: { [key: string]: unknown }) {
        super(features, attributes);
        this._spatialIndexFeatures = this.features;
        this._spatialIndex = createSpatialIndex(this._spatialIndexFeatures);
    }

    updateIndexes(): void {
        super.updateIndexes();
        this.updateSpatialIndex();
    }

    updateIndexesForFeature(feature: GeoJSON.Feature<GeoJSON.Point, A>, index: number): void {
        super.updateIndexesForFeature(feature, index);
        this.updateSpatialIndex();
    }

    updateSpatialIndex() {
        this._spatialIndexFeatures = this.features;
        this._spatialIndex = createSpatialIndex(this._spatialIndexFeatures);
    }

    pointsInBirdRadiusMetersAround(
        geometry: GeoJSON.Point,
        birdRadiusMeters = 1000
    ): GeoJSON.Feature<GeoJSON.Point, A>[] {
        return around(
            this._spatialIndex,
            geometry.coordinates[0],
            geometry.coordinates[1],
            undefined,
            birdRadiusMeters / 1000
        ).map((featureIndex) => this._spatialIndexFeatures[featureIndex]);
    }

    isPointsInBirdRadius(points: GeoJSON.Feature<GeoJSON.Point>[] | null): points is GeoJSON.Feature<GeoJSON.Point>[] {
        return !(points && points.length === 0);
    }

    pointsInWalkingTravelTimeRadiusSecondsAround = async (
        geometry: GeoJSON.Point,
        maxWalkingTravelTimeRadiusSeconds = Preferences.get('transit.nodes.maxTransferWalkingTravelTimeSeconds')
    ): Promise<{ id: string; walkingTravelTimesSeconds: number; walkingDistancesMeters: number }[]> => {
        const routingService = routingServiceManager.getRoutingServiceForEngine('engine');
        const walkingSpeedMetersPerSeconds = Preferences.get('defaultWalkingSpeedMetersPerSeconds');
        const radiusBirdDistanceMeters = maxWalkingTravelTimeRadiusSeconds * walkingSpeedMetersPerSeconds;
        const pointsInBirdRadius = this.pointsInBirdRadiusMetersAround(geometry, radiusBirdDistanceMeters);
        const pointsInRoutedRadius: {
            id: string;
            walkingTravelTimesSeconds: number;
            walkingDistancesMeters: number;
        }[] = [];

        if (!this.isPointsInBirdRadius(pointsInBirdRadius)) {
            return [];
        }

        const tableResults = await routingService.tableFrom({
            mode: 'walking',
            origin: { type: 'Feature', geometry: geometry, properties: {} },
            destinations: pointsInBirdRadius
        });
        const durations = tableResults.durations;
        const distances = tableResults.distances;
        for (let i = 0, count = pointsInBirdRadius.length; i < count; i++) {
            const pointInBirdRadius = pointsInBirdRadius[i];
            const travelTimeSeconds = durations[i];
            // TODO Should we consider walking distance and speed?
            if (!_isBlank(travelTimeSeconds) && travelTimeSeconds <= maxWalkingTravelTimeRadiusSeconds) {
                const distanceMeters = distances[i];
                pointsInRoutedRadius.push({
                    id: pointInBirdRadius.properties.id,
                    walkingTravelTimesSeconds: ceilToPositiveInteger(travelTimeSeconds),
                    walkingDistancesMeters: ceilToPositiveInteger(distanceMeters)
                });
            }
        }
        return pointsInRoutedRadius;
    };
}
