/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Feature, FeatureCollection, Point } from 'geojson';
import APIResponseBase from './APIResponseBase';

type NodesAPIProperties = {
    id: string;
    code: string;
    name: string;
    stops: {
        id: string;
        code: string;
        name: string;
        geography: Point;
    }[];
};

export type NodesAPIResponseFormat = FeatureCollection<Point, NodesAPIProperties>;

export default class NodesAPIResponse extends APIResponseBase<NodesAPIResponseFormat, FeatureCollection<Point>> {
    protected createResponse(input: FeatureCollection<Point>): NodesAPIResponseFormat {
        return {
            type: input.type,
            features: input.features.map((feature: Feature<Point>) => ({
                type: feature.type,
                id: feature.id as number,
                geometry: feature.geometry,
                properties: {
                    id: feature.properties!.id,
                    code: feature.properties!.code,
                    name: feature.properties!.name,
                    stops:
                        feature.properties!.data.stops?.map((stop) => ({
                            id: stop.id,
                            code: stop.code,
                            name: stop.name,
                            geography: stop.geography
                        })) || []
                }
            }))
        };
    }
}
