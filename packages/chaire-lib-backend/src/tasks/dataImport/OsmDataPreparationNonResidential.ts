/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import GeoJSON from 'geojson';
import * as turf from '@turf/turf';
import _uniq from 'lodash/uniq';
import { DataOsmRaw, OsmRawDataType } from './data/dataOsmRaw';
import { DataGeojson } from './data/dataGeojson';
import {
    NonResidentialEntranceGeojsonProperties,
    PointOfInterest,
    default as osmGeojsonService
} from './data/osmGeojsonService';
import { getEntrancesForBuilding, findOsmData, FeatureEntrancesOptions } from './data/osmRawDataService';
import {
    splitOverlappingFeatures,
    getOverlappingIndices,
    findOverlappingFeatures
} from 'chaire-lib-common/lib/services/geodata/FindOverlappingFeatures';
import { findNearest } from 'chaire-lib-common/lib/services/geodata/FindNearestFeature';
import { SingleGeoFeature, isPolygon } from 'chaire-lib-common/lib/services/geodata/GeoJSONUtils';
import poiTagsQuery, { isPoiToProcess } from 'chaire-lib-common/lib/config/osm/osmNodesActivityValidTagsQuery';
import { detailedCategoryToCategory } from 'chaire-lib-common/lib/config/osm/osmMappingDetailedCategoryToCategory';
import propertiesToDetailedCategory from 'chaire-lib-common/lib/config/osm/osmMappingTagsToDetailedCategory';
import { GeojsonOutputter } from './osmImportUtils';
import { ignoreBuildings } from 'chaire-lib-common/lib/config/osm/osmBuildingQuerySetup';

// TODO: don't import building=cabin if no POI inside instead of taking the centroid (  Warning: building way/453810388 (https://projets.chaire.transition.city/id/#id=w453810388&map=19.00/45.38979799473684/-74.02757081052633) with points of interest does not have any entrance. Using the centroid instead)
// TODO: ignore shop=mall as a POI
// TODO: ignore amenity=loading_dock as a POI

/** maximum acceptable distance from a point of interest to the corresponding entrance */
const MAX_DISTANCE_TO_ENTRANCE = 30;

const queryBuildingsFromOsm = [
    {
        tags: {
            building: undefined
        }
    }
];
const queryBuildingPartsFromOsm = [
    {
        tags: {
            'building:part': undefined
        }
    }
];

interface PoiBuilding {
    geojson: SingleGeoFeature;
    raw: OsmRawDataType;
    entrances?: GeoJSON.Feature<GeoJSON.Point>[];
    parts?: SingleGeoFeature[];
}

const getCategoryFromProperty = (properties: { [key: string]: any }): string[] => {
    const propertiesToMatch = Object.keys(properties).filter(
        (prop) => propertiesToDetailedCategory[prop] !== undefined
    );
    const possibleDetailedCategories = _uniq(
        propertiesToMatch.map((prop) => {
            const propValue = properties[prop];
            const matchProp = propertiesToDetailedCategory[prop];
            const matchValue = matchProp[propValue];
            if (matchValue !== undefined) {
                return matchValue;
            }
            return matchProp['_default'];
        })
    );
    const detailedCategories = possibleDetailedCategories.filter((val) => val !== undefined && val !== null);
    // TODO Validate if there are many possible categories?
    return detailedCategories as string[];
};

/**
 * Create a point of interest from an entrance and a point of interest. It will
 * use the coordinates from the entrance and the tags from the point of interest
 *
 * @param {GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties>} entrance
 * @param {SingleGeoFeature} poi
 * @return {*}  {PointOfInterest}
 */
function toPoi(
    entrance: GeoJSON.Point,
    poi: SingleGeoFeature,
    properties: Partial<NonResidentialEntranceGeojsonProperties> = {}
): PointOfInterest[] {
    const poiProperties = poi.properties || {};
    const detailedCategories = getCategoryFromProperty(poiProperties);
    return detailedCategories.map((detailedCategory) => {
        const category = detailedCategoryToCategory[detailedCategory];
        return {
            type: 'Feature',
            id: poi.id,
            geometry: {
                ...entrance
            },
            properties: Object.assign({}, properties, {
                osm_poi_id: poi.id,
                category,
                category_detailed: detailedCategory,
                ...poiProperties
            })
        };
    });
}

export default class OsmDataPreparationNonResidential {
    private _geojsonOutputter: GeojsonOutputter;
    private _osmRawData: DataOsmRaw;
    private _osmGeojsonData: DataGeojson;

    constructor(osmRawData: DataOsmRaw, osmGeojsonData: DataGeojson, geojsonOutputter: GeojsonOutputter) {
        this._geojsonOutputter = geojsonOutputter;
        this._osmRawData = osmRawData;
        this._osmGeojsonData = osmGeojsonData;
    }

    /**
     * 1. Retrieve the data to prepare
     * 1.1. Get all buildings in the area
     * 1.2. Get the main and shop entrances
     * 1.3. Filter out buildings that have no main or shop entrances
     * 1.4. Find all points of interest tags (including buildings)
     *
     * @private
     * @param {DataOsmRaw} osmRawData
     * @param {DataGeojson} osmGeojsonData
     * @return {*}  {{ poiBuildings: { geojson: SingleGeoFeature; raw:
     *         OsmRawDataType; entrances?: OsmRawDataType[] }[]; amenities:
     *         SingleGeoFeature[]; }} poiBuildings are buildings with shop or
     *         main entrances. Amenities are all amenities returned by the
     *         query, either polygons or points
     * @memberof OsmDataPreparationNonResidential
     */
    private preparePointOfInterestData(): {
        poiBuildings: PoiBuilding[];
        poiTags: SingleGeoFeature[];
        } {
        console.log('=== Getting buildings and entrances with points of interest... ===');
        // Get all the buildings in the area, except those to ignore
        // TODO Try to add this ignore list in the query instead
        const allOsmBuildings = this._osmRawData
            .queryOr(queryBuildingsFromOsm)
            .filter(
                (osmBuilding) =>
                    !(osmBuilding.tags?.building || []).find((buildingType) =>
                        ignoreBuildings.tags.building.includes(buildingType)
                    )
            );
        const allPoIBuildings: PoiBuilding[] = osmGeojsonService.getGeojsonsFromRawData(
            this._osmGeojsonData,
            allOsmBuildings,
            { generateNodesIfNotFound: true, continueOnMissingGeojson: true }
        );

        const allBuildingPartsRaw = this._osmRawData.queryOr(queryBuildingPartsFromOsm);
        const allBuildingParts: SingleGeoFeature[] = osmGeojsonService
            .getGeojsonsFromRawData(this._osmGeojsonData, allBuildingPartsRaw, {
                generateNodesIfNotFound: true,
                continueOnMissingGeojson: true
            })
            .map((part) => part.geojson);

        console.log('=== Map shop and main entrances to each building... ===');
        // Map shop and main entrances to each building
        const size = allPoIBuildings.length;
        allPoIBuildings.forEach((building, i) => {
            const entrances = getEntrancesForBuilding(building.geojson, building.raw, this._osmRawData, {
                entranceTypes: ['main', 'shop'],
                includeInside: true
            });
            building.entrances =
                entrances.length === 0
                    ? undefined
                    : osmGeojsonService
                        .getGeojsonsFromRawData(this._osmGeojsonData, entrances, {
                            generateNodesIfNotFound: true,
                            continueOnMissingGeojson: true
                        })
                        .map((entrance) => entrance.geojson as GeoJSON.Feature<GeoJSON.Point>);
            // Get building parts
            building.parts = findOverlappingFeatures(building.geojson, allBuildingParts);

            if (i === 0 || (i + 1) % 10 === 0 || i + 1 === size) {
                process.stdout.write(`=== get POIs for building ${i + 1}/${size} ===                   \r`);
            }
        });

        // Find all pois
        console.log('=== Find POIs... ===');
        const poisOrQuery = poiTagsQuery.tags.map((query) => ({ tags: query }));
        // TODO Split amenities between nodes and ways/relation? Parks leisure, vs gym
        // TODO Remove disused and vacant
        const allOsmPoisFeatures = this._osmRawData
            .queryOr(poisOrQuery)
            .filter(isPoiToProcess)
            .filter((poi) => getCategoryFromProperty(poi.tags || {}).length !== 0);
        const allOsmPoisGeojson = osmGeojsonService
            .getGeojsonsFromRawData(this._osmGeojsonData, allOsmPoisFeatures, {
                generateNodesIfNotFound: true,
                continueOnMissingGeojson: true
            })
            .map((poi) => poi.geojson);

        console.log('=== Done getting buildings and entrances with potential points of interest... ===');

        return { poiBuildings: allPoIBuildings, poiTags: allOsmPoisGeojson };
    }

    /**
     * pre-2. Process pois that require a special treatment because of their
     * custom codification
     * pre-2.1. Split pois that are polygons and other (special cases are all polygons)
     * pre-2.2. For each polygon, get points of interest if it is any of the special cases
     * pre-2.2.1. If no point of interest comes up at this point, push back the poi to the poiTags to
     * process and send back
     *
     * @param {(PoiBuilding[])} poiBuildings
     * @param {SingleGeoFeature[]} pois
     * @memberof OsmDataPreparationNonResidential
     */
    private processCustomPois(
        poiBuildings: PoiBuilding[],
        pois: SingleGeoFeature[]
    ): {
        pointsOfInterest: PointOfInterest[];
        remainingPoiTags: SingleGeoFeature[];
    } {
        console.log('=== Processing custom points of interest... ===');

        const polygonPois: SingleGeoFeature[] = [];
        const otherPois: SingleGeoFeature[] = [];
        let allPointsOfInterest: PointOfInterest[] = [];
        const size = pois.length;
        pois.forEach((poi) => (isPolygon(poi) ? polygonPois.push(poi) : otherPois.push(poi)));
        polygonPois.forEach((poi, i) => {
            const categories = getCategoryFromProperty(poi.properties || {});
            if (categories.find((cat) => cat.startsWith('school')) !== undefined) {
                const pointsOfInterest = this.processSchool(poi, poiBuildings);
                if (pointsOfInterest.length > 0) {
                    allPointsOfInterest = allPointsOfInterest.concat(pointsOfInterest);
                } else {
                    otherPois.push(poi);
                }
            } else if (poi.properties?.leisure === 'park' || poi.properties?.leisure === 'marina') {
                // The park will either return a poi on a routing entrance or
                // contain poi or give an error. In all cases, the park poi is
                // considered as processed
                const pointsOfInterest = this.processLargeLeisureArea(poi, pois);
                if (pointsOfInterest.length > 0) {
                    allPointsOfInterest = allPointsOfInterest.concat(pointsOfInterest);
                }
            } else {
                // No special processing was done, add to pois
                otherPois.push(poi);
            }
            if (i === 0 || (i + 1) % 10 === 0 || i + 1 === size) {
                process.stdout.write(`=== get custom POI ${i + 1}/${size} ===                   \r`);
            }
        });

        console.log('=== Done processing custom points of interest... ===');
        return { pointsOfInterest: allPointsOfInterest, remainingPoiTags: otherPois };
    }

    private processSchool(poi: SingleGeoFeature, poiBuildings: PoiBuilding[]): PointOfInterest[] {
        // Find a main entrance on the poi feature
        const entrances = this.findEntranceOnFeature(poi, {
            entranceTypes: ['main'],
            includeInside: false,
            findRoutingEntrance: false
        });
        if (entrances.length > 0) {
            if (entrances.length > 1) {
                console.log(
                    `  Warning: More than one main entrance on education area boundary ${this._geojsonOutputter.toString(
                        poi
                    )}. Taking the first one.`
                );
            }
            return toPoi(
                osmGeojsonService.getGeojsonsFromRawData(this._osmGeojsonData, [entrances[0]], {
                    generateNodesIfNotFound: true,
                    continueOnMissingGeojson: false
                })[0].geojson.geometry as GeoJSON.Point,
                poi,
                {
                    entrance_type: 'entrance'
                }
            );
        }

        // In the buildings inside the area, find the building with same amenity as the ground and use its main door
        const amenityType = poi.properties?.amenity;
        const overlappingBuildingIndices = getOverlappingIndices(
            poi,
            poiBuildings.map((building) => building.geojson)
        );
        const educationBuildingIndexes = overlappingBuildingIndices.filter(
            (index) =>
                poiBuildings[index].geojson.properties?.building === amenityType &&
                (!isPolygon(poi) ||
                    !isPolygon(poiBuildings[index].geojson) ||
                    (isPolygon(poi) &&
                        isPolygon(poiBuildings[index].geojson) &&
                        turf.booleanIntersects(poi, poiBuildings[index].geojson as any)))
        );
        if (educationBuildingIndexes.length > 0) {
            const educationPois = educationBuildingIndexes.flatMap((educationBuildingIndex) => {
                const mainEntrances = poiBuildings[educationBuildingIndex].entrances?.filter((entrance) => {
                    return entrance.properties?.entrance?.includes('main');
                });
                const getBuildingPart = () => {
                    if (poiBuildings[educationBuildingIndex].parts !== undefined) {
                        const overlappingParts = findOverlappingFeatures(
                            poi,
                            poiBuildings[educationBuildingIndex].parts as SingleGeoFeature[]
                        );
                        if (overlappingParts.length === 1) {
                            return overlappingParts[0];
                        }
                    }
                    return undefined;
                };
                const buildingPart = getBuildingPart();
                if (mainEntrances && mainEntrances.length > 0) {
                    if (entrances.length > 1) {
                        console.log(
                            `  Warning: More than one main entrance on education building ${this._geojsonOutputter.toString(
                                poiBuildings[educationBuildingIndex].geojson
                            )}. Taking the first one.`
                        );
                    }
                    return toPoi(mainEntrances[0].geometry, poi, {
                        entrance_type: 'entrance',
                        building_id: poiBuildings[educationBuildingIndex].geojson.id,
                        entrance: mainEntrances[0].properties?.entrance,
                        building_part_id: buildingPart ? buildingPart.id : undefined
                    });
                }
                return [];
            });
            if (educationPois.length > 0) {
                return educationPois;
            }
        }
        console.log(
            `  Warning: Can't find a main entrance for educational ground ${this._geojsonOutputter.toString(poi)}`
        );
        return [];
    }

    private processLargeLeisureArea(poi: SingleGeoFeature, pois: SingleGeoFeature[]): PointOfInterest[] {
        // Find a main entrance on the poi feature
        const entrances = this.findEntranceOnFeature(poi, {
            entranceTypes: ['main'],
            includeInside: false,
            findRoutingEntrance: true
        });
        if (entrances.length > 0) {
            if (entrances.length > 1) {
                console.log(
                    `  Warning: More than one main routing entrance on park boundary ${this._geojsonOutputter.toString(
                        poi
                    )}. Taking the first one.`
                );
            }
            return toPoi(
                osmGeojsonService.getGeojsonsFromRawData(this._osmGeojsonData, [entrances[0]], {
                    generateNodesIfNotFound: true,
                    continueOnMissingGeojson: false
                })[0].geojson.geometry as GeoJSON.Point,
                poi,
                {
                    entrance_type: 'routingEntrance'
                }
            );
        }

        // Find amenities inside the area boundary that have a leisure type
        const overlappingPois = findOverlappingFeatures(
            poi,
            pois.map((otherPoi) => otherPoi)
        );
        if (
            overlappingPois.find((otherPoi) => otherPoi.id !== poi.id && otherPoi.properties?.leisure !== undefined) ===
            undefined
        ) {
            console.error(
                `  Error: Park or marina has no routing entrance nor amenities of type leisure inside. It will be ignored: ${this._geojsonOutputter.toString(
                    poi
                )}`
            );
        }
        return [];
    }

    /**
     * 2. For each building
     * 2.1. Find poi tags in building
     * 2.2. Find entrances in or on the building
     * 2.3. If there are both tags and entrances, map each tag to the nearest shop or main entrance
     * 2.3.1 For each poi/entrance pair: assign entrance coordinates to poi tags
     * 2.4. Else If there are tags but no entrances, use the building centroid as entrance
     * 2.5. If the building was used in 2.3 or 2.4, remove building and tags from the list
     *
     * @param {(PoiBuilding[])} poiBuildings
     * @param {SingleGeoFeature[]} pois
     * @memberof OsmDataPreparationNonResidential
     */
    private processBuildings(
        poiBuildings: PoiBuilding[],
        pois: SingleGeoFeature[]
    ): {
        pointsOfInterest: PointOfInterest[];
        remainingPoiTags: SingleGeoFeature[];
        remainingBuildings: PoiBuilding[];
    } {
        console.log('=== Processing buildings with points of interest inside... ===');

        let poiTagsToProcess = pois;
        let allPointsOfInterest: PointOfInterest[] = [];
        for (let i = 0, size = poiBuildings.length; i < size; i++) {
            try {
                const { pointsOfInterest, remainingPoiTags } = this.processBuilding(poiBuildings[i], poiTagsToProcess);
                poiTagsToProcess = remainingPoiTags;
                allPointsOfInterest = allPointsOfInterest.concat(pointsOfInterest);
                // If the buildings had amenities, remove from the array of buildings
                if (pointsOfInterest.length > 0) {
                    delete poiBuildings[i];
                }
            } catch (error) {
                console.log(
                    `  Error: Error processing building ${this._geojsonOutputter.toString(
                        poiBuildings[i].geojson
                    )}: ${error}`
                );
            }

            if (i === 0 || (i + 1) % 10 === 0 || i + 1 === size) {
                process.stdout.write(`=== building ${i + 1}/${size} ===              \r`);
            }
        }
        const remainingBuildings = poiBuildings.filter((building) => building);

        console.log('=== Done processing buildings with points of interest inside... ===');
        return { pointsOfInterest: allPointsOfInterest, remainingPoiTags: poiTagsToProcess, remainingBuildings };
    }

    private processBuilding(
        poiBuilding: PoiBuilding,
        poiTags: SingleGeoFeature[]
    ): { pointsOfInterest: PointOfInterest[]; remainingPoiTags: SingleGeoFeature[] } {
        // Find points of interest tags overlapping building
        const { overlapping: poisInBuilding, notOverlapping: remainingPoiTags } = splitOverlappingFeatures(
            poiBuilding.geojson,
            poiTags
        );
        const buildingEntrances = poiBuilding.entrances;
        const getBuildingPart = (poi: SingleGeoFeature, parts: SingleGeoFeature[] | undefined) => {
            if (parts !== undefined) {
                const overlappingParts = findOverlappingFeatures(poi, parts as SingleGeoFeature[]);
                if (overlappingParts.length === 1) {
                    return overlappingParts[0];
                }
            }
            return undefined;
        };

        const pointsOfInterest: PointOfInterest[] = [];
        if (poisInBuilding.length <= 0) {
            return { pointsOfInterest, remainingPoiTags: remainingPoiTags };
        }
        // Sometimes, there are ground areas and tags or entrances that are
        // documented to the same place. If 2 poi have the same coordinates,
        // name and categories, just merge the data, in case on the tags has
        // more. One of the poi may not have a name, if so, only category is
        // matched.
        const pushOrMerge = (poi: PointOfInterest) => {
            const duplicatePoi = pointsOfInterest.find(
                (existingPoi) =>
                    existingPoi.geometry.coordinates[0] === poi.geometry.coordinates[0] &&
                    existingPoi.geometry.coordinates[1] === poi.geometry.coordinates[1] &&
                    ((existingPoi.properties.name &&
                        poi.properties.name &&
                        existingPoi.properties.name === poi.properties.name) ||
                        !existingPoi.properties.name ||
                        !poi.properties.name) &&
                    existingPoi.properties.category_detailed &&
                    existingPoi.properties.category_detailed === poi.properties.category_detailed
            );
            if (!duplicatePoi) {
                pointsOfInterest.push(poi);
            } else {
                Object.assign(duplicatePoi.properties, poi.properties);
            }
        };
        if (buildingEntrances !== undefined) {
            // Map each tag to nearest shop or main entrance
            poisInBuilding.forEach((poi) => {
                const buildingPart = getBuildingPart(poi, poiBuilding.parts);
                // If both poi and building are polygons, make sure the building
                // intersects the poi polygon, because they may share a boundary
                // but not be related.
                // If they don't intersect, push back the poi in the list of
                // poi tags to process
                if (
                    isPolygon(poi) &&
                    isPolygon(poiBuilding.geojson) &&
                    turf.booleanIntersects(poi, poiBuilding.geojson) === null
                ) {
                    remainingPoiTags.push(poi);
                    return;
                }
                const entrance = findNearest(poi, buildingEntrances);
                if (entrance !== undefined) {
                    toPoi(entrance.feature.geometry, poi, {
                        entrance_type: 'entrance',
                        building_id: poiBuilding.geojson.id,
                        entrance: entrance.feature.properties?.entrance,
                        building_part_id: buildingPart ? buildingPart.id : undefined
                    }).forEach((poi) => pushOrMerge(poi));
                } else {
                    console.log(
                        `  Warning: Poi ${this._geojsonOutputter.toString(
                            poi
                        )} has no entrance in building ${this._geojsonOutputter.toString(
                            poiBuilding.geojson
                        )}, but there should be. This warning should not appear!`
                    );
                }
            });
        } else {
            console.log(
                `  Warning: building ${this._geojsonOutputter.toString(
                    poiBuilding.geojson
                )} with points of interest does not have any entrance. Using the centroid instead`
            );

            // No entrance, just take the building's centroid
            const centroid = turf.centroid(poiBuilding.geojson).geometry;
            poisInBuilding.forEach((poi) => {
                const buildingPart = getBuildingPart(poi, poiBuilding.parts);
                toPoi(centroid, poi, {
                    entrance_type: 'buildingCentroid',
                    building_id: poiBuilding.geojson.id,
                    building_part_id: buildingPart ? buildingPart.id : undefined
                }).forEach((poi) => pushOrMerge(poi));
            });
        }
        return { pointsOfInterest, remainingPoiTags: remainingPoiTags };
    }

    /**
     * 3. With the remaining poi tags, that are not inside buildings
     * 3.1. Find a routing entrance on this poi and use it
     * 3.2. If there is no routing entrance, add a warning for each of the 2 cases below
     * 3.2.1. Find the nearest building entrance < MAX_DISTANCE_TO_ENTRANCE and use it
     * 3.2.2. If there is no entrance close by, use the poi centroid.
     *
     * @param {SingleGeoFeature[]} poiTags
     * @param {GeoJSON.Feature<GeoJSON.Point>[]} entrances
     * @param {DataOsmRaw} osmRawData
     * @memberof OsmDataPreparationNonResidential
     */
    private processRemainingPoiTags(
        poiTags: SingleGeoFeature[],
        entrances: GeoJSON.Feature<GeoJSON.Point>[]
    ): { pointsOfInterest: PointOfInterest[] } {
        console.log('=== Processing points of interest not in buildings... ===');

        const pointsOfInterest: PointOfInterest[] = [];
        for (let i = 0; i < poiTags.length; i++) {
            const poiTag = poiTags[i];
            this.processPoiTag(poiTag, entrances).forEach((poi) => pointsOfInterest.push(poi));
        }

        console.log('=== Done processing points of interest not in buildings... ===');

        return { pointsOfInterest };
    }

    private findEntranceOnFeature(feature: SingleGeoFeature, options: FeatureEntrancesOptions = {}) {
        // Find a routing entrance on the point of interest
        const poiTagRawData = findOsmData(String(feature.id), this._osmRawData);
        return poiTagRawData ? getEntrancesForBuilding(feature, poiTagRawData, this._osmRawData, options) : [];
    }

    private processPoiTag(
        poiTag: SingleGeoFeature,
        entrances: GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties>[]
    ): PointOfInterest[] {
        // Find a routing entrance on the point of interest
        const routingEntrances = this.findEntranceOnFeature(poiTag);
        if (routingEntrances.length > 0) {
            return toPoi({ type: 'Point', coordinates: [routingEntrances[0].lon, routingEntrances[0].lat] }, poiTag, {
                entrance_type: 'routingEntrance'
            });
        }

        // Otherwise, try to find an entrance close by
        const nearestEntrance = findNearest(poiTag, entrances, { maxDistance: MAX_DISTANCE_TO_ENTRANCE });
        if (nearestEntrance !== undefined) {
            console.log(
                `  Warning: Point of interest ${this._geojsonOutputter.toString(
                    poiTag
                )} is outside a building. Using the closest entrance at ${nearestEntrance.dist}m instead.`
            );
            return toPoi(nearestEntrance.feature.geometry, poiTag, {
                entrance_type: 'nearestEntrance'
            });
        }
        console.log(
            `  Warning: Point of interest ${this._geojsonOutputter.toString(
                poiTag
            )} is outside a building and has no entrances close by. Using the centroid instead`
        );
        // No entrance, just take the poi's centroid
        const centroid = turf.centroid(poiTag).geometry;
        return toPoi(centroid, poiTag, {
            entrance_type: 'centroid'
        });
    }

    /**
     * 4. With the remaining buildings with shop/main entrances, that have no pois inside
     * 4.1. Create a point of interest at the first entrance, using the building's tags.
     * 4.1.1. If the category is undefined, ignore this place of interest, otherwise add to points of interest
     *
     * @param {(PoiBuilding[])} poiBuildings
     * @param {SingleGeoFeature[]} amenities
     * @memberof OsmDataPreparationNonResidential
     */
    private processRemainingBuildings(poiBuildings: PoiBuilding[]): { pointsOfInterest: PointOfInterest[] } {
        console.log('=== Processing remaining buildings... ===');
        const pointsOfInterest: PointOfInterest[] = [];
        for (let i = 0; i < poiBuildings.length; i++) {
            const building = poiBuildings[i];
            // Ignore building with no main or shop entrance
            if (!building.entrances) {
                continue;
            }
            const pois = toPoi(building.entrances[0].geometry, building.geojson, {
                entrance_type: 'entrance'
            });
            if (pois.length > 0) {
                pois.forEach((poi) => pointsOfInterest.push(poi));
            } else if (
                !['school', 'college', 'kindergarten', 'university', 'hospital'].includes(
                    building.geojson.properties?.building
                )
            ) {
                console.log(
                    `  Warning: Ignoring building ${this._geojsonOutputter.toString(
                        building.geojson
                    )} which does not contain any point of interest.`
                );
            }
        }
        console.log('=== Done processing remaining buildings... ===');
        return { pointsOfInterest };
    }

    /**
     * Extract the points of interest from the open street map data
     *
     * @param { DataOsmRaw } osmRawData The raw data from openstreetmap
     * @param { DataGeojson } osmGeojsonData The data from openstreetmap, in
     * geojson format and with more tags
     * @returns { pointsOfInterest: GeoJSON.Feature<GeoJSON.Point,
     * ResidentialEntranceGeojsonProperties>[] } The points of interest
     * locations
     */
    public async run(): Promise<{
        pointsOfInterest: GeoJSON.Feature<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>[];
    }> {
        // 1. Retrieve the data to prepare
        const { poiBuildings, poiTags } = this.preparePointOfInterestData();
        const allEntrances = poiBuildings.flatMap((building) => building.entrances || []);
        console.log(`Found ${poiBuildings.length} buildings and ${poiTags.length} points of interest to process`);

        // pre-2. Process custom poi tags that require special treatment.
        const { pointsOfInterest: poiFromCustomTags, remainingPoiTags: regularPoiTags } = this.processCustomPois(
            poiBuildings,
            poiTags
        );
        let allPointsOfInterest = poiFromCustomTags;

        // 2. Process buildings
        const { pointsOfInterest, remainingPoiTags, remainingBuildings } = this.processBuildings(
            poiBuildings,
            regularPoiTags
        );
        allPointsOfInterest = allPointsOfInterest.concat(pointsOfInterest);
        console.log(
            `Still has ${remainingBuildings.length} buildings and ${remainingPoiTags.length} points of interest to process`
        );

        // 3. Process the remaining amenities tags that are not in buildings
        const { pointsOfInterest: poiFromTags } = this.processRemainingPoiTags(remainingPoiTags, allEntrances);
        allPointsOfInterest = allPointsOfInterest.concat(poiFromTags);

        // 4. Process the remaining buildings that do not have amenities tags inside or around
        const { pointsOfInterest: poiFromBuildings } = this.processRemainingBuildings(remainingBuildings);
        allPointsOfInterest = allPointsOfInterest.concat(poiFromBuildings);

        return { pointsOfInterest: allPointsOfInterest };
    }
}
