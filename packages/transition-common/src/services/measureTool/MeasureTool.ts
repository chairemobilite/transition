/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import {
    length as turfLength,
    segmentEach as turfSegmentEach,
    lineString as turfLineString,
    featureCollection as turfFeatureCollection,
    rhumbBearing as turfRhumbBearing
} from '@turf/turf';
import _cloneDeep from 'lodash/cloneDeep';

export const formatDistance = (dist: number) => {
    if (dist < 1) {
        return `${(dist * 100).toFixed(0)} cm`;
    } else if (dist < 100) {
        return `${dist.toFixed(2)} m`;
    } else if (dist < 1000) {
        return `${dist.toFixed(0)} m`;
    } else {
        return `${(dist / 1000).toFixed(2)} km`;
    }
};

/**
 * Measure tool distance service
 * can calculate the total distance of the line and the distance of each segment
 * and save the results in the class attributes
 */
export class MeasureTool {
    // At first, the line is a single point, then it is updated to a line
    private pointsGeojsonCollection: GeoJSON.FeatureCollection<GeoJSON.Point> = {
        type: 'FeatureCollection',
        features: []
    };
    private labelsGeojsonCollection: GeoJSON.FeatureCollection<GeoJSON.Point> = {
        type: 'FeatureCollection',
        features: []
    };
    private lineGeojson: GeoJSON.Feature<GeoJSON.LineString> | undefined;
    private totalDistanceM: number | undefined;
    private distanceMBySegmentIndex: number[] = [];

    constructor(
        points: GeoJSON.FeatureCollection<GeoJSON.Point> | undefined,
        line: GeoJSON.Feature<GeoJSON.LineString> | undefined,
        labels: GeoJSON.FeatureCollection<GeoJSON.Point> | undefined
    ) {
        this.pointsGeojsonCollection = points ? points : turfFeatureCollection([]);
        this.labelsGeojsonCollection = labels ? labels : turfFeatureCollection([]);
        this.lineGeojson = line;
        this.totalDistanceM = undefined;
        this.calculateDistances();
    }

    /**
     * calculate the total distance of the line and the distance of each segment
     * save the results in the class attributes
     */
    private calculateDistances() {
        this.distanceMBySegmentIndex = [];
        if (this.lineGeojson === undefined) {
            this.totalDistanceM = 0;
            return;
        }
        this.totalDistanceM = turfLength(this.lineGeojson, { units: 'meters' });
        turfSegmentEach(
            this.lineGeojson,
            (currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex) => {
                if (currentSegment !== undefined && segmentIndex !== undefined) {
                    this.distanceMBySegmentIndex[segmentIndex] = turfLength(currentSegment, { units: 'meters' });
                    const segmentFromCoordinate = currentSegment.geometry.coordinates[0];
                    const segmentToCoordinate = currentSegment.geometry.coordinates[1];
                    let segmentAngle = 90 - turfRhumbBearing(segmentFromCoordinate, segmentToCoordinate);
                    if (Math.abs(segmentAngle) > 90) {
                        segmentAngle += 180;
                    }
                    this.labelsGeojsonCollection.features[segmentIndex].geometry.coordinates = [
                        (segmentFromCoordinate[0] + segmentToCoordinate[0]) / 2,
                        (segmentFromCoordinate[1] + segmentToCoordinate[1]) / 2
                    ];
                    this.labelsGeojsonCollection.features[segmentIndex].properties!.name = formatDistance(
                        this.distanceMBySegmentIndex[segmentIndex]
                    );
                    this.labelsGeojsonCollection.features[segmentIndex].properties!.angle = segmentAngle;
                }
            }
        );
    }

    /**
     * get both the total length of the line and the length of each segment:
     * @returns {totalDistanceM: number, distanceMBySegmentIndex: number[]}
     */
    public getDistances() {
        return {
            totalDistanceM: this.totalDistanceM,
            distanceMBySegmentIndex: this.distanceMBySegmentIndex
        };
    }

    /**
     * add a point to the line
     * @param point GeoJSON.Feature<GeoJSON.Point>
     */
    public addPoint(point: GeoJSON.Feature<GeoJSON.Point>) {
        point.properties = {
            ...point.properties,
            name: undefined,
            angle: undefined
        };
        this.pointsGeojsonCollection.features.push(point);
        if (this.pointsGeojsonCollection.features.length >= 2) {
            this.labelsGeojsonCollection.features.push(_cloneDeep(point));
        }
    }

    /**
     * add a vertex to the line
     * @param vertex GeoJSON.Feature<GeoJSON.Point>
     */
    public addVertex(vertex: GeoJSON.Feature<GeoJSON.Point>) {
        this.addPoint(vertex);
        if (this.pointsGeojsonCollection.features.length >= 2) {
            this.lineGeojson = turfLineString(
                this.pointsGeojsonCollection.features.map((feature) => feature.geometry.coordinates)
            );
        }
        this.calculateDistances();
    }

    /**
     * get the geojson of the line
     * @returns GeoJSON.Feature<GeoJSON.LineString> | GeoJSON.Feature<GeoJSON.Point> | undefined
     */
    public getLineGeojson() {
        return this.lineGeojson;
    }

    /**
     * get the geojson of the points
     * @returns GeoJSON.FeatureCollection<GeoJSON.Point>
     */
    public getPointsGeojsonCollection() {
        return this.pointsGeojsonCollection;
    }

    /**
     * get the geojson of the labels
     * @returns GeoJSON.FeatureCollection<GeoJSON.Point>
     */
    public getLabelsGeojsonCollection() {
        return this.labelsGeojsonCollection;
    }
}
