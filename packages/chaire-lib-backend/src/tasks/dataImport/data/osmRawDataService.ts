/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { bbox, booleanPointInPolygon } from '@turf/turf';
import { DataOsmRaw, OsmRawDataType, OsmRawDataTypeNode } from './dataOsmRaw';
import { SingleGeoFeature } from 'chaire-lib-common/lib/services/geodata/GeoJSONUtils';

export type FeatureEntrancesOptions = {
    entranceTypes?: string[];
    includeInside?: boolean;
    findRoutingEntrance?: boolean;
};

export function getEntrancesForBuilding(
    building: SingleGeoFeature,
    buildingObject: OsmRawDataType,
    osmRawData: DataOsmRaw,
    options: FeatureEntrancesOptions = {}
): OsmRawDataTypeNode[] {
    const entranceTypes = options.entranceTypes || ['main'];
    const includeInside = options.includeInside || false;
    const findRoutingEntrance = options.findRoutingEntrance !== undefined ? options.findRoutingEntrance : true;

    if (
        !(
            building.geometry.type === 'Polygon' ||
            building.geometry.type === 'MultiPolygon' ||
            building.geometry.type === 'LineString' ||
            building.geometry.type === 'MultiLineString'
        )
    ) {
        return [];
    }
    const buildingPolygon = building as
        | GeoJSON.Feature<GeoJSON.Polygon, GeoJSON.GeoJsonProperties>
        | GeoJSON.Feature<GeoJSON.MultiPolygon, GeoJSON.GeoJsonProperties>;

    // Get the nodes that compose this building, from osm raw data
    const boundaryNodes = getOsmNodesFor(buildingObject, osmRawData);

    let nodes = boundaryNodes;

    // Get the nodes inside this building, from osm raw data (shops can have entrances inside the building (example: shopping mall with indoor corridors)
    if (includeInside) {
        const insideNodes = getNodesInside(buildingPolygon, osmRawData, {
            ignoreBoundary: true,
            onlyNodesWithEntranceTags: true,
            onlyNodesWithTags: true
        });
        nodes = boundaryNodes.concat(insideNodes);
    }

    // Do we have an entrance or routing entrance of the corresponding type
    const queriedEntrances = nodes.filter((node) => {
        const tags = node.tags || {};
        const entrances = tags.entrance;
        const routingEntrances = findRoutingEntrance ? tags['routing:entrance'] : false;
        return entrances
            ? entrances.find((entrance) => entranceTypes.includes(entrance))
            : routingEntrances
                ? routingEntrances.find((entrance) => entranceTypes.includes(entrance))
                : false;
    });
    // If not, get routing entrances that are not the main ones, but simply 'yes', ignore entrance=yes
    return queriedEntrances.length > 0
        ? queriedEntrances
        : nodes.filter((node) => {
            const tags = node.tags || {};
            //const entrances = tags.entrance;
            const routingEntrances = findRoutingEntrance ? tags['routing:entrance'] : false;
            return routingEntrances ? routingEntrances.includes('yes') : false;
        });
}

/**
 * Get the node elements corresponding to the OSM element (it should be a
 * way or relation object, with a nodes field)
 * @param data The OSM data
 * @param osmData The OSM data object
 */
export const getOsmNodesFor = function (data: OsmRawDataType, osmData: DataOsmRaw): OsmRawDataTypeNode[] {
    const osmDataIndex = osmData.getIndex();

    const nodesById = osmDataIndex.osmNodesById;
    const waysById = osmDataIndex.osmWaysById;
    const wayIdsByRelationId = osmDataIndex.osmWayIdsByRelationId;

    const removeDuplicateNodes = (nodeIds: number[]) => {
        const nodes = {};
        nodeIds.forEach((nodeId) => {
            nodes[nodeId] = nodesById.nodes[nodeId];
        });
        return Object.keys(nodes)
            .map((nodeId) => nodes[nodeId])
            .filter((node) => node !== undefined);
    };

    if (
        data.type === 'relation' &&
        data.tags &&
        data.tags.type &&
        data.tags.type[0] === 'multipolygon' &&
        data.members
    ) {
        // multipolygon relation
        const ways = wayIdsByRelationId?.wayIdsByRelationId.get(data.id.toString());
        const nodes: number[] = [];
        if (ways && ways.length > 0) {
            for (let i = 0, size = ways.length; i < size; i++) {
                const way = waysById?.ways[ways[i]];
                if (way) {
                    const wayNodes = way.nodes || [];
                    nodes.push(...wayNodes);
                }
            }
            return removeDuplicateNodes(nodes);
        }
        return [];
    } else if (!data.nodes) {
        return [];
    }
    return removeDuplicateNodes(data.nodes);
};

/**
 * Get the node elements inside the polygon/multipolygon OSM element (boundary
 * not included by default)
 * @param geojson the geojson polygon or multipolygon inside which to check for
 * nodes
 * @param osmData The OSM data object
 * @param options ignoreBoundary If true: a point on the boundary will NOT be
 *    considered inside the polygon, default: false (points on boundary are
 *    considered inside the polygon by default) onlyNodesWithTags If true: only
 *    parse nodes with tags (faster boundary nodes parse)
 *    onlyNodesWithEntranceTags If true: only parse nodes with entrance tags
 *    (way faster boundary nodes parse)
 */
export const getNodesInside = function (
    geojson:
        | GeoJSON.Feature<GeoJSON.Polygon, GeoJSON.GeoJsonProperties>
        | GeoJSON.Feature<GeoJSON.MultiPolygon, GeoJSON.GeoJsonProperties>,
    osmData: DataOsmRaw,
    options: { ignoreBoundary?: boolean; onlyNodesWithTags?: boolean; onlyNodesWithEntranceTags?: boolean } = {}
): OsmRawDataTypeNode[] {
    const osmDataIndex = osmData.getIndex();

    const nodesById = osmDataIndex.osmNodesById;
    const nodesToParse = options.onlyNodesWithEntranceTags
        ? nodesById.nodesWithEntranceTags
        : options.onlyNodesWithTags
            ? nodesById.nodesWithTags
            : nodesById.nodes;

    const geojsonBBox = bbox(geojson);
    const minLon = geojsonBBox[0];
    const minLat = geojsonBBox[1];
    const maxLon = geojsonBBox[2];
    const maxLat = geojsonBBox[3];

    const nodeGeojsonsInBBox: GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties>[] = [];

    for (const nodeId in nodesToParse) {
        const node = nodesToParse[nodeId];
        if (node.lon >= minLon && node.lon <= maxLon && node.lat >= minLat && node.lat <= maxLat) {
            const nodeGeojson: GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties> = {
                type: 'Feature',
                id: node.id,
                properties: {},
                geometry: {
                    type: 'Point',
                    coordinates: [node.lon, node.lat]
                }
            };
            nodeGeojsonsInBBox.push(nodeGeojson);
        }
    }

    const nodesInsidePolygon: OsmRawDataTypeNode[] = [];

    for (let i = 0; i < nodeGeojsonsInBBox.length; i++) {
        if (
            booleanPointInPolygon(nodeGeojsonsInBBox[i].geometry, geojson.geometry, {
                ignoreBoundary: options.ignoreBoundary || false
            })
        ) {
            const nodeId = nodeGeojsonsInBBox[i].id;
            if (nodeId !== undefined) {
                nodesInsidePolygon.push(nodesById.nodes[nodeId]);
            }
        }
    }

    return nodesInsidePolygon;
};

export const findOsmData = (geojsonId: string, osmData: DataOsmRaw): OsmRawDataType | undefined => {
    const [type, id] = geojsonId.split('/');
    if (!type || !id) {
        return undefined;
    }
    return osmData.getIndex().find(type, id);
};
