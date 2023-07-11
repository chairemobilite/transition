/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import {
    featureCollection as turfFeatureCollection,
    lineString as turfLineString,
    multiLineString as turfMultiLineString,
    circle as turfCircle,
    area as turfArea,
    polygonToLine as turfPolygonToLine,
    //multiPolygon as turfMultiPolygon
    bbox as turfBbox,
    bboxPolygon as turfBboxPolygon,
    envelope as turfEnvelope,
    polygonSmooth as turfPolygonSmooth,
    polygon as turfPolygon,
    multiPolygon as turfMultiPolygon,
    featureCollection
} from '@turf/turf';
import { Feature, FeatureCollection, Point, MultiPolygon, MultiLineString, BBox } from 'geojson';
import polygonClipping, { Ring } from 'polygon-clipping';
import _cloneDeep from 'lodash.clonedeep';
import _sum from 'lodash.sum';
import _uniq from 'lodash.uniq';

import TransitAccessibilityMapRouting from './TransitAccessibilityMapRouting';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { routingServiceManager as trRoutingServiceManager } from 'chaire-lib-common/lib/services/trRouting/TrRoutingServiceManager';
import {
    TrRoutingResultAccessibilityMap,
    AccessibilityMapQueryOptions
} from 'chaire-lib-common/lib/services/trRouting/TrRoutingService';
import { secondsSinceMidnightToTimeStr } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import { _toInteger, _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import {
    TransitAccessibilityMapResultByNode,
    TransitAccessibilityMapWithPolygonResult,
    TransitAccessibilityMapResult
} from './TransitAccessibilityMapResult';
import { resolve } from 'path';
import { Polygon } from 'polygon-clipping';
import { forEach } from 'lodash';
import { Canvg } from 'canvg';
import { geojson2svg } from 'geojson2svg';
import { resvg } from 'resvg';

export interface TransitMapCalculationOptions {
    isCancelled?: (() => boolean) | false;
    port?: number;
    /**
     * Additional properties to add to each accessibility polygon calculated
     *
     * @type {{ [key: string]: any }}
     * @memberof TransitMapCalculationOptions
     */
    additionalProperties?: { [key: string]: any };
    accessibleNodes?: { ids: string[]; durations: number[] };
    [key: string]: any;
}

const getDurations = (maxDuration: number, numberOfPolygons: number): number[] => {
    const durations = [maxDuration];
    for (let i = numberOfPolygons - 1; i > 0; i--) {
        durations.push(Math.ceil((i * maxDuration) / numberOfPolygons));
    }
    return durations;
};

const getTimes = (time: number, delta?: number, deltaInterval?: number) => {
    const deltaNb = delta ? delta : 0;
    const deltaIntervalNb = deltaInterval ? (deltaInterval <= 0 ? 60 : deltaInterval) : 60;
    const times: number[] = [];
    for (let i = time - deltaNb; i <= time + deltaNb; i += deltaIntervalNb) {
        if (i >= 0) {
            times.push(i);
        }
    }
    return times;
};

const isNumber = (val: any): val is number => {
    return Number.isFinite(val);
};

const getAttributesOrDefault = (routing: TransitAccessibilityMapRouting) => {
    const attributes = routing.getAttributes();
    if (!attributes.locationGeojson) {
        throw 'There should be a valid location';
    }
    return {
        departureTimeSecondsSinceMidnight: attributes.departureTimeSecondsSinceMidnight,
        departureTime: isNumber(attributes.departureTimeSecondsSinceMidnight)
            ? secondsSinceMidnightToTimeStr(attributes.departureTimeSecondsSinceMidnight)
            : '',
        arrivalTimeSecondsSinceMidnight: attributes.arrivalTimeSecondsSinceMidnight,
        arrivalTime: isNumber(attributes.arrivalTimeSecondsSinceMidnight)
            ? secondsSinceMidnightToTimeStr(attributes.arrivalTimeSecondsSinceMidnight)
            : '',
        maxTotalTravelTimeSeconds: attributes.maxTotalTravelTimeSeconds || 900,
        numberOfPolygons: attributes.numberOfPolygons || 1,
        deltaSeconds: attributes.deltaSeconds || 0,
        deltaIntervalSeconds: attributes.deltaIntervalSeconds || 60,
        locationGeojson: attributes.locationGeojson,
        minWaitingTimeSeconds: attributes.minWaitingTimeSeconds || 180,
        maxAccessEgressTravelTimeSeconds: attributes.maxAccessEgressTravelTimeSeconds || 900,
        maxTransferTravelTimeSeconds: attributes.maxTransferTravelTimeSeconds || 900,
        walkingSpeedMps: attributes.walkingSpeedMps || 5.0 / 3.6,
        walkingSpeedFactor: attributes.walkingSpeedFactor,
        scenarioId: attributes.scenarioId,
        locationColor: attributes.locationColor,
        placeName: attributes.placeName
    };
};

const getDefaultGeojsonPolygon = (locationColor) =>
    ({
        type: 'Feature',
        properties: {
            color: locationColor
        },
        geometry: {
            type: 'MultiPolygon',
            coordinates: []
        }
    } as Feature<MultiPolygon>);

export class TransitAccessibilityMapCalculator {
    private static generateQuery(
        query: {
            minWaitingTime: number;
            maxAccessTravelTime: number;
            maxEgressTravelTime: number;
            maxTransferTravelTime: number;
            scenarioId: string;
        },
        options: {
            timeSecondsSinceMidnight: number;
            maxTravelTimeSeconds: number;
            timeOfTripType: 'departure' | 'arrival';
            location: Feature<Point>;
            accessibleNodes?: { ids: string[]; durations: number[] };
        }
    ): AccessibilityMapQueryOptions {
        const params: AccessibilityMapQueryOptions = {
            ...query,
            maxTravelTime: options.maxTravelTimeSeconds,
            location: options.location,
            timeOfTrip: options.timeSecondsSinceMidnight,
            timeOfTripType: options.timeOfTripType
        };
        if (options.accessibleNodes) {
            params.accessibleNodes = options.accessibleNodes;
        }
        return params;
    }

    private static async clipPolygon(
        nodeCircles,
        isCancelled: (() => boolean) | false = false
    ): Promise<polygonClipping.MultiPolygon> {
        // return f.union(nodeCircles);
        // TODO This is a much slower version of the simple above line, dividing the work, but allowing the user to cancel the request...
        return new Promise((resolve, reject) => {
            const pieces = 20; //d'où vient pieces = 20?
            const splitSize = Math.ceil(nodeCircles.length / pieces);
            let clipped: polygonClipping.MultiPolygon = [];
            const clipFunc = (previous, i) => {
                const toClip = previous.concat(nodeCircles.slice(i * pieces, (i + 1) * pieces));
                clipped = polygonClipping.union(toClip);
                if (isCancelled && isCancelled()) {
                    reject('Cancelled');
                    return;
                }
                if (i < splitSize - 1) {
                    setTimeout(() => {
                        try {
                            // The function will concat with previous, nothing to do for this case
                            clipFunc(clipped, i + 1);
                        } catch (error) {
                            // Error clipping this data, reject the promise
                            reject(error);
                        }
                    }, 0);
                } else {
                    resolve(clipped);
                }
            };
            clipFunc(clipped, 0);
        });
    }

    private static async pngPolygon(
        nodeCircles,
        isCancelled: (() => boolean) | false = false
    ): Promise<polygonClipping.MultiPolygon> {
        // return f.union(nodeCircles);
        // TODO This is a much slower version of the simple above line, dividing the work, but allowing the user to cancel the request...
        return new Promise((resolve, reject) => {
            let pnged: polygonClipping.MultiPolygon = [];
            const fs = require('fs');
            const gm = require('gm');
            gm(100, 100, '#2266bbaa').size(function(err, value) {
                console.log(value);
            
                if(err) {
                    console.log(err);
                }
            });
            const pngFunc = (previous, i) => {
                const toPng = nodeCircles[i][0][0];
                pnged = [];
                // pnged = polygonClipping.union(toPng);
                if (isCancelled && isCancelled()) {
                    reject('Cancelled');
                    return;
                }
                if (i < nodeCircles.length - 1) {
                    setTimeout(() => {
                        try {
                            // The function will concat with previous, nothing to do for this case
                            pngFunc(pnged, i + 1);
                        } catch (error) {
                            // Error clipping this data, reject the promise
                            reject(error);
                        }
                    }, 0);
                } else {
                    resolve(pnged);
                }
            };
            pngFunc(pnged, 0);
        });
    }

    private static async pixelizePolygon(
        nodeCircles,
        isCancelled: (() => boolean) | false = false
    ): Promise<polygonClipping.MultiPolygon> {
        return new Promise((resolve, reject) => {

            let toPixel = [ [-73.497, 45.543], [-73.497, 45.52], [-73.472, 45.52], [-73.472, 45.543], [-73.497, 45.543]];
            const geojson2svg = require('geojson2svg');
            let converter = geojson2svg({output: 'svg'});
            let toPixelSvg = converter.convert({'type': 'Polygon', 'coordinates': [[ [73.497, 45.543], [73.497, 45.52], [73.472, 45.52], [73.472, 45.543], [73.497, 45.543]]]});
            console.log(toPixelSvg);

            const { Resvg } = require('resvg');
            const opts = {
                background: 'rgba(255, 255, 255, 1)',
            }
            const resvg = Resvg(toPixelSvg, opts);
            const pngData = resvg.render();
            console.log(pngData.width);
            // const pngBuffer = pngData.asPng();
            // console.log(pngBuffer.)

            /*
            img = new Image(),
            serializer = new XMLSerializer(),
            svgStr = serializer.serializeToString(document.getElementById('svg'));

            img.src = 'data:image/svg+xml;base64,'+window.btoa(svgStr);

            // You could also use the actual string without base64 encoding it:
            //img.src = "data:image/svg+xml;utf8," + svgStr;

            var canvas = document.createElement("canvas");

            var w=800;
            var h=400;

            canvas.width = w;
            canvas.height = h;
            canvas.getContext("2d").drawImage(img,0,0,w,h);

            var imgURL = canvas.toDataURL("image/png");


            var dlLink = document.createElement('a');
            dlLink.download = "image";
            dlLink.href = imgURL;
            dlLink.dataset.downloadurl = ["image/png", dlLink.download, dlLink.href].join(':');
            
            document.body.appendChild(dlLink);
            dlLink.click();
            document.body.removeChild(dlLink);
            */

            // //sharp
            // const sharp = require('sharp');
            // let png = sharp(toPixelSvg).png();
            // console.log(png);

            //canvg
            // const canvas = document.createElement('canvas');
            // if (canvas != undefined) {
            //     const ctx = canvas.getContext('2d');
            //     if(ctx != null){
            //         let canvg = Canvg.fromString(ctx, toPixelSvg);
            //         canvg.start();
            //         let png = canvas.toDataURL("img/png");
            //         console.log(png);
            //     } else {
            //         console.log("ctx null");
            //     }
            // } else {
            //     console.log("canvas undefined");
            // }

            

            let pixelized: polygonClipping.MultiPolygon = [];
            const pixelFunc = (previous, i) => {
                // const toPixel = nodeCircles[i][0][0][0];

                

                if (isCancelled && isCancelled()) {
                    reject('Cancelled');
                    return;
                }
                if (i < nodeCircles.length - 1) {
                    setTimeout(() => {
                        try {
                            // The function will concat with previous, nothing to do for this case
                            pixelFunc(pixelized, i + 1);
                        } catch (error) {
                            // Error clipping this data, reject the promise
                            reject(error);
                        }
                    }, 0);
                } else {
                    resolve(pixelized);
                }
            };
            pixelFunc(pixelized, 0);
        });
    }

    // private static async pixelizePolygon(
    //     nodeCircles,
    //     isCancelled: (() => boolean) | false = false
    // ): Promise<polygonClipping.MultiPolygon> {
    //     return new Promise((resolve, reject) => {
    //         // let pixelized: FeatureCollection<MultiPolygon> = {type: 'FeatureCollection', features: []};
    //         let pixelized: polygonClipping.MultiPolygon = [];
    //         let maxBbox = [-500, -500, 500, 500];
    //         //envelope au lieu de bbox??
    //         //boolean within
    //         //const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom)
    //         // let extremumsPos: number[] = [-180, -90, 180, 90]; //min lat et long
    //         // for (let circle of nodeCircles){
    //         //     // console.log(circle);
    //         //     if(circle[0][0][0] > extremumsPos[0]){
    //         //         extremumsPos[0] = circle[0][0][0];
    //         //     }
    //         //     if(circle[0][0][1] > extremumsPos[1]){
    //         //         extremumsPos[1] = circle[0][0][1];
    //         //     }
    //         //     if(circle[0][0][0] < extremumsPos[2]){
    //         //         extremumsPos[2] = circle[0][0][0];
    //         //     }
    //         //     if(circle[0][0][1] < extremumsPos[3]){
    //         //         extremumsPos[3] = circle[0][0][1];
    //         //     }
    //         // }

    //         // const ring = turfLineString([[extremumsPos[0], extremumsPos[3]], [extremumsPos[0], extremumsPos[1]], [extremumsPos[2], extremumsPos[1]], [extremumsPos[2], extremumsPos[3]], [extremumsPos[0], extremumsPos[3]]]);
    //         // let polygon: Feature<MultiPolygon> = turfMultiPolygon([[[[extremumsPos[0], extremumsPos[3]], [extremumsPos[0], extremumsPos[1]], [extremumsPos[2], extremumsPos[1]], [extremumsPos[2], extremumsPos[3]], [extremumsPos[0], extremumsPos[3]]]]]);

    //         //pixelized = turfPolygonSmooth(polygon, {iterations:3});
    //         // pixelized = { features: [polygon], type: 'FeatureCollection' };

    //         const pixelizeFunc = (previous, i) => {
    //             // logique pixelisation
    //             //const toPixelize = previous.concat(nodeCircles[i][0]);
    //             // const bbox = turfBboxPolygon(turfBbox(toPixelize));
    //             // if (pixelized.length == 0){
    //             //     if (bbox.bbox != undefined){
    //             //         maxBbox = bbox.bbox;
    //             //     }
    //             // }

    //             // pixelized = polygonClipping.union();

    //             // const polygon: Polygon = [nodeCircles[i][0][0], nodeCircles[i][0][1], nodeCircles[i][(nodeCircles[i].length)/2][0], nodeCircles[i][(nodeCircles[i].length)/2][0]];
    //             // const polygon: Polygon = [nodeCircles[i]];
    //             // pixelized = polygonClipping.union(polygon);

    //             // const ring: Ring = [[extremumsPos[0], extremumsPos[3]], [extremumsPos[0], extremumsPos[1]], [extremumsPos[2], extremumsPos[1]], [extremumsPos[2], extremumsPos[3]], [extremumsPos[0], extremumsPos[3]]];
    //             // const polygon: Polygon = [ring];
    //             // pixelized = [polygon];

    //             // let extremumsPos: number[] = [nodeCircles[i][0][0][0], nodeCircles[i][0][0][1], nodeCircles[i][0][0][0], nodeCircles[i][0][0][1]];
    //             let extremumsPos: number[] = [-180, -90, 180, 90];
    //             // console.log(nodeCircles[i]); //nodeCircles[i] = structure comprenant un cercle
    //             // console.log(nodeCircles[i][0]); //cercle
    //             // console.log(nodeCircles[i][0][0]); //coords
    //             // console.log(nodeCircles[i][0][0][0]); //lat ou long
    //             for (let j = 0; j < nodeCircles[i].length; j++) {
    //                 if (nodeCircles[i][j][0][0] > extremumsPos[0]) {
    //                     extremumsPos[0] = nodeCircles[i][j][0][0];
    //                 }
    //                 if (nodeCircles[i][j][0][1] > extremumsPos[1]) {
    //                     extremumsPos[1] = nodeCircles[i][j][0][1];
    //                 }
    //                 if (nodeCircles[i][j][0][0] < extremumsPos[2]) {
    //                     extremumsPos[2] = nodeCircles[i][j][0][0];
    //                 }
    //                 if (nodeCircles[i][j][0][1] < extremumsPos[3]) {
    //                     extremumsPos[3] = nodeCircles[i][j][0][1];
    //                 }
    //             }

    //             // console.log(extremumsPos);
    //             //mettre un octogone avec les mi points
    //             // const toPixelize = previous.concat([
    //             //     [extremumsPos[2], extremumsPos[1]],
    //             //     [extremumsPos[2], extremumsPos[3]],
    //             //     [extremumsPos[0], extremumsPos[3]],
    //             //     [extremumsPos[0], extremumsPos[1]],
    //             //     [extremumsPos[2], extremumsPos[1]]
    //             // ]);
    //             const toPixelize: polygonClipping.Polygon = [
    //                 [
    //                     [extremumsPos[2], extremumsPos[1]],
    //                     [extremumsPos[2], extremumsPos[3]],
    //                     [extremumsPos[0], extremumsPos[3]],
    //                     [extremumsPos[0], extremumsPos[1]],
    //                     [extremumsPos[2], extremumsPos[1]]
    //                 ]
    //             ];
    //             console.log(toPixelize);
    //             if (previous != undefined && toPixelize[0] != toPixelize[2] && toPixelize[1] != toPixelize[3] && pixelized.length > 0) {
    //                 pixelized = polygonClipping.union([toPixelize, previous]);
    //             } else {
    //                 pixelized[0] = toPixelize;
    //             }
    //             if (isCancelled && isCancelled()) {
    //                 reject('Cancelled');
    //                 return;
    //             }
    //             if (i < nodeCircles.length - 1) {
    //                 setTimeout(() => {
    //                     try {
    //                         // The function will concat with previous, nothing to do for this case
    //                         pixelizeFunc(pixelized, i + 1);
    //                     } catch (error) {
    //                         // Error clipping this data, reject the promise
    //                         reject(error);
    //                     }
    //                 }, 0);
    //             } else {
    //                 console.log(pixelized);
    //                 resolve(pixelized);
    //             }
    //         };
    //         pixelizeFunc(pixelized, 0);
    //     });
    // }

    // FIXME: Type the options
    static async calculate(
        routing: TransitAccessibilityMapRouting,
        updatePreferences = false,
        options: TransitMapCalculationOptions = {}
    ): Promise<TransitAccessibilityMapResult> {
        if (updatePreferences) {
            routing.updateRoutingPrefs();
        }

        const attributes = getAttributesOrDefault(routing);
        const durations = getDurations(attributes.maxTotalTravelTimeSeconds, attributes.numberOfPolygons);
        const departureTime = attributes.departureTimeSecondsSinceMidnight;
        const arrivalTime = attributes.arrivalTimeSecondsSinceMidnight;
        const specifiedTime = !_isBlank(departureTime) ? (departureTime as number) : (arrivalTime as number);
        const times = getTimes(specifiedTime, attributes.deltaSeconds, attributes.deltaIntervalSeconds);

        const { isCancelled, additionalProperties, accessibleNodes, ...queryOptions } = options;
        const promises: Promise<TrRoutingResultAccessibilityMap>[] = [];
        let specifiedTimeIndex = 0;
        const trRoutingService = trRoutingServiceManager.getService();

        const baseQuery = {
            minWaitingTime: attributes.minWaitingTimeSeconds,
            maxAccessTravelTime: attributes.maxAccessEgressTravelTimeSeconds,
            maxEgressTravelTime: attributes.maxAccessEgressTravelTimeSeconds,
            maxTransferTravelTime: attributes.maxTransferTravelTimeSeconds,
            scenarioId: attributes.scenarioId as string
            // TODO needed?
            // maxFirstWaitingTime: routing.get('maxFirstWaitingTimeSeconds', undefined)
        };
        for (let i = 0, countI = times.length; i < countI; i++) {
            const time = times[i];
            if (time === specifiedTime) {
                specifiedTimeIndex = i;
            }
            const query = this.generateQuery(baseQuery, {
                location: attributes.locationGeojson,
                timeSecondsSinceMidnight: time,
                maxTravelTimeSeconds: durations[0],
                timeOfTripType: !_isBlank(departureTime) ? 'departure' : 'arrival',
                accessibleNodes
            });

            promises.push(trRoutingService.accessibleMap(query, queryOptions));
        }

        try {
            const promiseResults = await Promise.allSettled(promises);
            let routingResultAtTime: TrRoutingResultAccessibilityMap | undefined = undefined;
            const routingResults = promiseResults
                .map((promiseResult, index) => {
                    if (promiseResult.status === 'rejected') {
                        // TODO Return something for no routing found?
                        return undefined;
                    }
                    const routingResult = promiseResult.value;
                    if (specifiedTimeIndex === index) {
                        routingResultAtTime = routingResult;
                    }
                    return routingResult;
                })
                .filter((result) => result !== undefined) as TrRoutingResultAccessibilityMap[];

            // Cancel further processing if the request was cancelled
            if (isCancelled && isCancelled()) {
                throw 'Cancelled';
            }
            const result = new TransitAccessibilityMapResultByNode(routingResults, durations[0]);

            return {
                result,
                durations,
                nbCalculations: times.length,
                routingResult: routingResultAtTime
            };
        } catch (error) {
            if (TrError.isTrError(error)) {
                throw error;
            }
            const trError = new TrError(
                `cannot calculate transit accessibility map with trRouting: ${error}`,
                'TRRAM0001',
                'TransitAccessibilityMapCannotBeCalculatedBecauseError'
            );
            // TODO extract cancelled to constant
            if (error !== 'Cancelled') {
                console.error(error);
            }
            throw trError;
        }
    }

    // FIXME: Type the options
    static async calculateWithPolygons(
        routing: TransitAccessibilityMapRouting,
        updatePreferences = false,
        options: TransitMapCalculationOptions = {}
    ): Promise<TransitAccessibilityMapWithPolygonResult> {
        const { result, durations, nbCalculations, routingResult } = await TransitAccessibilityMapCalculator.calculate(
            routing,
            updatePreferences,
            options
        );
        const attributes = getAttributesOrDefault(routing);
        const { isCancelled, additionalProperties } = options;

        try {
            const polygons = await this.generatePolygons(attributes, result, durations, nbCalculations, {
                isCancelled,
                additionalProperties
            });
            if (isCancelled && isCancelled()) {
                throw 'Cancelled';
            }

            return {
                polygons: turfFeatureCollection(polygons.polygons),
                strokes: turfFeatureCollection(polygons.strokes),
                resultByNode: routingResult
            };
        } catch (error) {
            if (TrError.isTrError(error)) {
                throw error;
            }
            const trError = new TrError(
                `cannot calculate transit accessibility map with trRouting: ${error}`,
                'TRRAM0001',
                'TransitAccessibilityMapCannotBeCalculatedBecauseError'
            );
            // TODO extract cancelled to constant
            if (error !== 'Cancelled') {
                console.error(error);
            }
            throw trError;
        }
    }

    // TODO: Move to result class?
    private static async generatePolygons(
        attributes: {
            walkingSpeedMps: number;
            maxAccessEgressTravelTimeSeconds: number;
            locationGeojson: Feature<Point>;
            locationColor?: string;
            [key: string]: any;
        },
        result: TransitAccessibilityMapResultByNode,
        durations: number[],
        deltaCount = 1,
        options: TransitMapCalculationOptions = {}
    ) {
        console.log('generate polygons');
        const isCancelled = options.isCancelled || (() => false);

        durations.sort((a, b) => b - a); // durations must be in descending order so it appears correctly in qgis
        const polygons: Feature<MultiPolygon>[] = [];
        const polygonStrokes: Feature<MultiLineString>[] = [];

        const walkingSpeedMps = attributes.walkingSpeedMps;
        const maxDistanceMeters = Math.floor(attributes.maxAccessEgressTravelTimeSeconds * walkingSpeedMps);

        // when a node is fully accessible in the previous duration (maxDistanceMeters === nodeRemainingDistanceMeters),
        // we don't need to calculate remaining distance for the next duration,
        // and the previous polygon can be used for the next duration because it is 100% contained
        // TODO: implement this optimization also in updateNodesTravelTimes
        let stepI = 1;
        const stepsCount = durations.length * 2;
        let nodeCircles = [
            turfCircle(attributes.locationGeojson, maxDistanceMeters / 1000, { units: 'kilometers', steps: 64 })
                .geometry.coordinates
        ];
        const defaultGeojsonPolygon = getDefaultGeojsonPolygon(attributes.locationColor);
        const nodeCollection = serviceLocator.collectionManager.get('nodes');

        for (let d = 0, size = durations.length; d < size; d++) {
            const duration = durations[d];
            if (isCancelled()) {
                throw 'Cancelled';
            }
            const durationMaxDistanceMeters = Math.min(maxDistanceMeters, Math.floor(duration * walkingSpeedMps));
            nodeCircles = [
                turfCircle(attributes.locationGeojson, durationMaxDistanceMeters / 1000, {
                    units: 'kilometers',
                    steps: 64
                }).geometry.coordinates
            ];

            const { accessiblePlacesCountByCategory, accessiblePlacesCountByDetailedCategory } =
                result.getAccessibilityStatsForDuration(duration, nodeCollection);

            // include starting/ending location circle:
            const travelTimesByNodeId = result.getTraveTimesByNodeId();

            for (const nodeId in travelTimesByNodeId) {
                const node = nodeCollection.getById(nodeId);
                // TODO node collection manager is in legacy code and is a geojson attribute, but unit test use Node objects, which need to be converted to geojson
                const nodeGeometry = node.geometry ? node : node.toGeojson();
                const remainingTimesSeconds = travelTimesByNodeId[nodeId].map((travelTimeSeconds) => {
                    return travelTimeSeconds < duration ? duration - travelTimeSeconds : 0;
                });

                // we need to average over the delta count, since empty result
                // for a duration must count as 0, not null. The accessibility
                // map is more a heatmap of accessible places, so a location
                // accessible only in one delta should not be shown with the
                // same weight as the one accessible for each delta. Downside is
                // that a location on the border of the accessible area in one
                // of the delta query will thus not be part of the accessibility
                // map at all.
                //
                // TODO Show the complete accessibility map for the deltas, but
                // with heatmaps showing more accessible locations
                const avgRemainingTimeSeconds = _sum(remainingTimesSeconds) / deltaCount;
                let nodeRemainingDistanceMeters = Math.floor(avgRemainingTimeSeconds * walkingSpeedMps);
                nodeRemainingDistanceMeters = Math.min(maxDistanceMeters, nodeRemainingDistanceMeters);
                nodeCircles.push(
                    turfCircle(nodeGeometry, nodeRemainingDistanceMeters / 1000, { units: 'kilometers', steps: 64 })
                        .geometry.coordinates
                );
            }

            serviceLocator.eventManager.emit('progress', {
                name: 'AccessibilityMapPolygonGeneration',
                progress: stepI++ / stepsCount
            });

            //const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom)
            const polygonCoordinates = await this.pngPolygon(nodeCircles, isCancelled);

            // TODO This is the veryyy sloooooow operation.
            // const polygonCoordinates = await this.clipPolygon(nodeCircles, isCancelled);
            const polygon = _cloneDeep(defaultGeojsonPolygon);
            polygon.geometry.coordinates = polygonCoordinates;

            const area = turfArea(polygon);
            polygon.properties = {
                durationSeconds: Math.round(duration),
                durationMinutes: Math.round(duration / 60),
                areaSqM: area,
                areaSqKm: area / 1000000,
                areaSqMiles: area / 1000000 / 2.58999,
                color: attributes.locationColor,
                accessiblePlacesCountByCategory,
                accessiblePlacesCountByDetailedCategory,
                ...attributes,
                ...(options.additionalProperties || {})
            };

            for (const category in accessiblePlacesCountByCategory) {
                polygon.properties[`cat_${category}`] = accessiblePlacesCountByCategory[category];
            }
            for (const detailedCategory in accessiblePlacesCountByDetailedCategory) {
                polygon.properties[`catDet_${detailedCategory}`] =
                    accessiblePlacesCountByDetailedCategory[detailedCategory];
            }

            polygons.push(polygon);
            // TODO Can this be other than a feature collection? If so, we need to handle the various cases
            const polygonStroke = turfPolygonToLine(polygon) as FeatureCollection<GeoJSON.LineString | MultiLineString>;
            const polygonStroke2 = turfFeatureCollection([]) as FeatureCollection<GeoJSON.LineString>;
            for (let i = 0, countI = polygonStroke.features.length; i < countI; i++) {
                const feature = polygonStroke.features[i];
                if (feature.geometry.type === 'MultiLineString') {
                    // this is a polygon with hole, we need to separate into two LineStrings.
                    for (let j = 1, countJ = feature.geometry.coordinates.length; j < countJ; j++) {
                        polygonStroke2.features.push(turfLineString(feature.geometry.coordinates[j]));
                    }
                    // TODO Copied from original code, but should it be .push instead of features[i] ?
                    polygonStroke2.features[i] = turfLineString(feature.geometry.coordinates[0]); // keep the first one as is, but convert to LineString
                } else {
                    polygonStroke2.features.push(feature as Feature<GeoJSON.LineString>);
                }
            }

            polygonStrokes.push(
                turfMultiLineString(
                    polygonStroke2.features.map((lineString) => {
                        return lineString.geometry.coordinates;
                    })
                )
            );

            serviceLocator.eventManager.emitProgress('AccessibilityMapPolygonGeneration', stepI++ / stepsCount);
        }

        if (isCancelled()) {
            throw 'Cancelled';
        }

        return { polygons: polygons, strokes: polygonStrokes };
    }
}
