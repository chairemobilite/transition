/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Feature, FeatureCollection, LineString } from 'geojson';
import APIResponseBase from './APIResponseBase';

export type PathsAPIResponseAttributes = {
    type: 'FeatureCollection';
    features: Array<{
        type: 'Feature';
        id: number;
        geometry: LineString;
        properties: {
            id: string;
            mode: string;
            name: string;
            nodes: string[];
            line_id: string;
            direction: string;
        };
    }>;
};

export default class PathsAPIResponse extends APIResponseBase<
    PathsAPIResponseAttributes,
    FeatureCollection<LineString>
> {
    protected createResponse(input: FeatureCollection<LineString>): PathsAPIResponseAttributes {
        return {
            type: input.type,
            features: input.features.map((feature: Feature<LineString>) => ({
                type: feature.type,
                id: feature.id as number,
                geometry: feature.geometry,
                properties: {
                    id: feature.properties!.id,
                    mode: feature.properties!.mode,
                    name: feature.properties!.name,
                    nodes: feature.properties!.nodes,
                    line_id: feature.properties!.line_id,
                    direction: feature.properties!.direction
                }
            }))
        };
    }
}
