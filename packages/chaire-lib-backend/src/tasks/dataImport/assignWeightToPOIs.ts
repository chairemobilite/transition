/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _uniqBy from 'lodash/uniqBy';
import GenericDataImportTask from './genericDataImportTask';
import GeoJSON from 'geojson';
import { DataFileGeojson } from './data/dataGeojson';
import { SingleGeoFeature } from 'chaire-lib-common/lib/services/geodata/GeoJSONUtils';
import { PointOfInterest } from './data/osmGeojsonService';
import { poiWeightCategories, poiIgnoredQueries } from 'chaire-lib-common/lib/config/osm/osmPoiCategories';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';

const poiIgnoredTags = poiIgnoredQueries.map((query) => {
    return query.tags;
});

// TODO: make sure we do not have duplicate (like sport center as a node and as a building, wighted twice)
// TODO: deal with access=private on buildings and/or POIs (should we include them or not, and if so, which?)

// TODO: This function is only used in code that was commented in this file. If this code is eventually uncommented, re-enable, otherwise delete it.
// const getLanduseCodesFromProperty = (properties: { [key: string]: any }): number[] => {
//     const propertiesToMatch = Object.keys(properties).filter((prop) => landUseCodesByOsmTag[prop] !== undefined);
//     const possibleLandUseCodes = _uniq(
//         _flatten(
//             propertiesToMatch.map((prop) => {
//                 const propValue = properties[prop];
//                 const matchProp = landUseCodesByOsmTag[prop];
//                 const matchValue = matchProp[propValue];
//                 if (matchValue !== undefined) {
//                     return matchValue;
//                 }
//                 return matchProp['_default'];
//             })
//         )
//     );
//     const landUseCodes = possibleLandUseCodes.filter((val) => val !== undefined && val !== null);
//     // TODO Validate if there are many possible categories?
//     // TODO: deal with Walmart, Costco, Canadian Tire + others with separate POIs inside the main building:
//     //       garden center, supermarket, department store, pharmacy, tire store, car repair, fast food, etc.
//     // TODO: deal with building:part to separate floor area of large buildings when available
//     return landUseCodes as number[];
// };

export default class assignWeightToPOIs extends GenericDataImportTask {
    private _warnings: string[] = [];
    private _errors: string[] = [];
    private _buildingCache: {
        [key: string]: {
            'building:flats': number | undefined;
            'building:area': number | undefined;
            'building:floor_area': number | undefined;
            poisCount: number;
            floorAreaByPOI: number | undefined;
            areaUsedByFlats: number | undefined;
        };
    };
    private _poisWithMissingWeights: GeoJSON.Feature<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>[];

    constructor(fileManager: any) {
        super(fileManager);
        this._buildingCache = {};
        this._poisWithMissingWeights = [];
    }

    private assertDataPrepared(dataSourceDirectory: string): void {
        if (
            !(
                this.fileManager.fileExistsAbsolute(
                    dataSourceDirectory + GenericDataImportTask.POLYGON_ENHANCED_GEOJSON_FILE
                ) &&
                this.fileManager.fileExistsAbsolute(dataSourceDirectory + GenericDataImportTask.POINT_OF_INTEREST_FILE)
            )
        ) {
            throw new Error(
                'OSM geojson data not available for data source. Please run the required tasks to prepare the geojson files ' +
                    GenericDataImportTask.POLYGON_ENHANCED_GEOJSON_FILE +
                    ' and ' +
                    GenericDataImportTask.POINT_OF_INTEREST_FILE +
                    ' in the directory ' +
                    dataSourceDirectory
            );
        }
    }

    private addWarning(geojson: SingleGeoFeature, warning: string) {
        const osmId = geojson.id;
        this._warnings.push('POI with id ' + osmId + ': ' + warning);
        console.warn('WARNING: %s, %s', warning, this._geojsonOutputter.toString(geojson));
    }

    private addError(geojson: SingleGeoFeature, error: string) {
        const osmId = geojson.id;
        this._errors.push('POI with id ' + osmId + ': ' + error);
        console.error('ERROR: %s, %s', error, this._geojsonOutputter.toString(geojson));
    }

    private weightPOIs(categorizedPois: PointOfInterest[], osmPolygonGeojsonData: DataFileGeojson): PointOfInterest[] {
        const weightedPOIs: PointOfInterest[] = [];

        console.log('Fetch POIs from osm geojson data...');

        const size = categorizedPois.length;
        console.log(`Weight POIs (total: ${size})...`);

        // assign outer building levels, floor area and % of area or floor area to each building parts // TODO: also assign flats to the correct building:part

        // get POIs count per polygon and cache polygon data:
        for (let i = 0; i < size; i++) {
            const poi = categorizedPois[i];

            if (!poi.properties) {
                poi.properties = {};
            }

            let buildingId = poi.properties.building_part_id || poi.properties.building_id;
            if (buildingId) {
                if (!this._buildingCache[buildingId]) {
                    const buildingProperties = osmPolygonGeojsonData.find({ id: buildingId })?.properties || {};
                    const areaUsedByFlats =
                        buildingProperties['building:flats'] && buildingProperties['building:flats'] > 0
                            ? Math.min(
                                0.7 * buildingProperties['building:floor_area'],
                                buildingProperties['building:flats'] * 100
                            )
                            : 0;
                    this._buildingCache[buildingId] = {
                        'building:flats': buildingProperties['building:flats'],
                        'building:area': buildingProperties['building:area'],
                        areaUsedByFlats,
                        'building:floor_area': buildingProperties['building:floor_area'] - areaUsedByFlats,
                        poisCount: 0, // add number of flats. TODO: put constraints on min and max floor area of flats
                        floorAreaByPOI: undefined
                    };
                }
                this._buildingCache[buildingId].poisCount++;
            } else {
                const polygonProperties = osmPolygonGeojsonData.find({ id: poi.id })?.properties || {};
                if (polygonProperties && polygonProperties['polygon:area']) {
                    // polygon (not building)
                    poi.properties['polygon:area'] = polygonProperties['polygon:area'];
                } else if (polygonProperties && polygonProperties.building) {
                    // the poi itself is a building (farm building or other without node poi inside building)
                    buildingId = poi.id;
                } else {
                    //console.log('no building or area found for poi', poi);
                }
            }
        }

        for (const buildingId in this._buildingCache) {
            if (buildingId === 'way/1022056537') {
                console.log('POI!!!', this._buildingCache[buildingId]);
            }
            const buildingCache = this._buildingCache[buildingId];
            const poisCount = buildingCache.poisCount;
            if ((poisCount > 0 && buildingCache['building:floor_area']) || buildingCache['building:area']) {
                buildingCache.floorAreaByPOI = buildingCache['building:floor_area']
                    ? Math.round(buildingCache['building:floor_area'] / poisCount)
                    : buildingCache['building:area']
                        ? Math.round(buildingCache['building:area'] / poisCount)
                        : undefined;
            }
        }

        // weigh POIs:
        for (let i = 0; i < size; i++) {
            const poi = categorizedPois[i];

            if (!poi.properties) {
                poi.properties = {};
            }

            let poiFloorArea: number | undefined = undefined;
            const buildingId = poi.properties.building_part_id || poi.properties.building_id;
            if (buildingId) {
                if (this._buildingCache[buildingId]) {
                    const buildingCache = this._buildingCache[buildingId];
                    poiFloorArea = buildingCache.floorAreaByPOI;
                    poi.properties.assignedFloorArea = poiFloorArea;
                    poi.properties['building:floor_area'] = poiFloorArea;
                    if (!poiFloorArea) {
                        /*this.addWarning(
                            poi as SingleGeoFeature,
                            `POI building missing floor area per POI`
                        );*/
                    }
                }
            }

            let poiWeight: number | undefined = undefined;
            const poiPossibleWeights: number[] = []; // array of weights calculated for each matched landuse code, will be averaged

            const matchingPoiCategories = poi.properties.weight_categories || [];

            for (let j = 0, countJ = matchingPoiCategories.length; j < countJ; j++) {
                const weightCategory = matchingPoiCategories[j];
                const weightCategoryConfig = poiWeightCategories[weightCategory];
                if (!weightCategoryConfig) {
                    console.log('missing config for weightCategory', weightCategory);
                }
                if (weightCategoryConfig) {
                    const weighingMethods = weightCategoryConfig.tripDestinationsTripsMethods;
                    if (weighingMethods.length === 0) {
                        console.log('missing methods for weightCategory', weightCategory);
                    }
                    // find the first matching workable weighing method:
                    for (let k = 0, countK = weighingMethods.length; k < countK; k++) {
                        const weighingMethod = weighingMethods[k];
                        if (
                            weighingMethod === 'area' &&
                            weightCategoryConfig.tripDestinationsTripsPerSqMetersPerWeekday &&
                            weightCategoryConfig.tripDestinationsTripsPerSqMetersPerWeekday.average &&
                            weightCategoryConfig.areaTag
                        ) {
                            const areaValue = poi.properties[weightCategoryConfig.areaTag];
                            if (!_isBlank(areaValue)) {
                                poiPossibleWeights.push(
                                    Math.round(
                                        weightCategoryConfig.tripDestinationsTripsPerSqMetersPerWeekday.average *
                                            areaValue
                                    )
                                );
                                break;
                            }
                        } else if (
                            weighingMethod === 'capacity' &&
                            weightCategoryConfig.tripDestinationsTripsPerCapacityPerWeekday &&
                            weightCategoryConfig.tripDestinationsTripsPerCapacityPerWeekday.average &&
                            weightCategoryConfig.capacityTag
                        ) {
                            const capacityValue = poi.properties[weightCategoryConfig.capacityTag];
                            if (!_isBlank(capacityValue)) {
                                poiPossibleWeights.push(
                                    Math.round(
                                        weightCategoryConfig.tripDestinationsTripsPerCapacityPerWeekday.average *
                                            capacityValue
                                    )
                                );
                                break;
                            }
                        } else {
                            console.error(
                                `Cannot calculate category weight for poi ${poi.id} with category ${weightCategory} (missing ${weighingMethod})`
                            );
                        }
                    }
                }
            }

            // Disabled for now, using OD based weights from categories
            /*const landUseCodes = getLanduseCodesFromProperty(feature.properties);
            if (landUseCodes.length === 0) {
                this.addWarning(
                    feature as SingleGeoFeature,
                    `missing land use codes for POI`
                );
            }

            for (let j = 0, count = landUseCodes.length; j < count; j++) {
                const landUseCodeStr = landUseCodes[j].toString();
                const landUseCodeWeightFunction = tripGenerationFunctionsByLandUseCode[landUseCodeStr];
                if (poiFloorArea && landUseCodeWeightFunction && typeof landUseCodeWeightFunction === 'function') {
                    const _poiWeight = landUseCodeWeightFunction(poiFloorArea, undefined, undefined);
                    if (poiFloorArea && _poiWeight) {
                        poiPossibleWeights.push(_poiWeight);
                        this._weightByFloorArea.push(_poiWeight / poiFloorArea);
                    }
                }
            }

            */

            if (poiPossibleWeights.length > 0) {
                //console.log('poiPossibleWeights', poiPossibleWeights);
                poiWeight = poiPossibleWeights.reduce((partialSum, a) => partialSum + a, 0) / poiPossibleWeights.length;
            }
            if (!_isBlank(poiWeight)) {
                poi.properties['weight:tripDestinationsPerWeekday'] = poiWeight;
                weightedPOIs.push(poi);
            } else {
                //console.log('missing weight for poi', poi);
                this._poisWithMissingWeights.push(poi); // TODO: deal with POIs with missing weights
            }

            if (i === 0 || (i + 1) % 100 === 0 || i + 1 === size) {
                process.stdout.write(`=== weighted POI ${i + 1}/${size} ===                   \r`);
            }
        }

        // assign average to POIs with missing weights:
        /*for (let i = 0, count = this._poisWithMissingWeights.length; i < count; i++) {
            const feature = this._poisWithMissingWeights[i];
            if (!feature.properties) {
                feature.properties = {};
            }
            if (feature.properties?.assignedFloorArea) {
                feature.properties['weight:tripDestinationsPerWeekday'] = avgWeightByFloorArea * feature.properties.assignedFloorArea; // TODO: we need to find better fallbacks/approximations
            } else {
                feature.properties['weight:tripDestinationsPerWeekday'] = avgWeight; // TODO: we need to find better fallbacks/approximations
            }
            weightedPOIs.push(feature as PointOfInterest);
        }*/

        return weightedPOIs;
    }

    private async categorizePOIs(poiDataSource: DataFileGeojson): Promise<PointOfInterest[]> {
        const allPois = (poiDataSource.queryOr([{}]) || []).filter((poi) => {
            for (let i = 0, count = poiIgnoredTags.length; i < count; i++) {
                const tags = poiIgnoredTags[i] || {};
                let allTagsMatch = true;
                for (const tag in tags) {
                    if (!poi.properties?.[tag] || poi.properties?.[tag] !== tags[tag]) {
                        allTagsMatch = false;
                    }
                }
                if (allTagsMatch) {
                    return false;
                }
            }
            return true;
        });
        /*
        Get a hash map of every POI by id
        this serves to find orphans POIs (POIs not matched by any category)
        Also verify if the poi has an id (it should)
        */
        const poisByPoiId: Map<string, PointOfInterest> = new Map(
            allPois.map((poi, index) => {
                if (poi.id) {
                    if (!poi.properties) {
                        poi.properties = {};
                    }
                    poi.properties.weight_categories = [];
                    poi.properties['weight:tripDestinationsPerWeekday'] = undefined;
                    return [poi.id.toString(), poi as PointOfInterest];
                } else {
                    console.error('Error: missing id for poi', poi);
                    return [index.toString(), poi as PointOfInterest];
                }
            })
        );

        // Get matching POIs for each weight category:
        for (const poiCategory in poiWeightCategories) {
            const weightConfig = poiWeightCategories[poiCategory];
            const queryOr = weightConfig.osmQueryOr.map((query) => {
                // if it is a tag query, use the nested data
                return query.tags ? query.tags : query;
            });
            const matchingPOIs = _uniqBy(poiDataSource.queryOr(queryOr), (poi) => {
                if (poi.id) {
                    return poi.id;
                }
            });

            /*
            TODO: deal with duplicates, like a zoo for which we have a polygon:area
            used to calculate weight, but the name is also in a POI node inside a building or near an entrance
            */
            console.log(`POI weight category: ${poiCategory}: ${matchingPOIs.length} matching POIs`);
            for (let i = 0, count = matchingPOIs.length; i < count; i++) {
                const matchedPoi = matchingPOIs[i];
                const poiId = matchedPoi.id;
                const poi = poiId ? poisByPoiId.get(poiId.toString()) : undefined;
                if (poi) {
                    if (!poi.properties) {
                        poi.properties = {};
                    }
                    if (!poi.properties.weight_categories) {
                        poi.properties.weight_categories = [];
                    }
                    poi.properties.weight_categories.push(poiCategory);
                }
            }
        }

        return Array.from(poisByPoiId.values());
    }

    /**
     * IN: A file {@link GenericDataImportTask#POLYGON_ENHANCED_GEOJSON_FILE}
     * containing the enhanced polygons and multipolygon with area and floor area
     *
     * OUT: Saves the weigthed POIs to file
     * {@link GenericDataImportTask#WEIGHTED_POINT_OF_INTEREST_FILE} with
     * weight in number fo generated trip per weekday
     *
     * @param dataSourceDirectory The directory containing the data sources
     */
    protected async doRun(dataSourceDirectory: string): Promise<void> {
        // 1. Fetch the POIs using the POIs geojson file
        // 2. For each POI:
        //    2a. Get the associated building or area
        //    2b. Increase the count of POIS in the building/area by one
        // 3. For each POI:
        //    3a. Get the assigned floor_area or area for the POI by dividing the total area by the count of POI in building/area
        //    3b. Make sure we follow constraints for some POIs (max/min floor area)
        //    3c. Show warnings/errors for missing data (no floor area/area available)
        //    3c. Add weight to POI
        // 4. Save all POIs into the new weighted POIs file

        // check for missing required config in poi categories:
        for (const poiCategory in poiWeightCategories) {
            const weightConfig = poiWeightCategories[poiCategory];
            const weighingMethod = weightConfig.tripDestinationsTripsMethods;

            if (weighingMethod.includes('area') && !weightConfig.areaTag) {
                console.error(`Error: missing areaTag for poi category ${poiCategory}`);
            }
            if (weighingMethod.includes('capacity') && !weightConfig.capacityTag) {
                console.error(`Error: missing capacityTag for poi category ${poiCategory}`);
            }
            if (weighingMethod.includes('area') && !weightConfig.tripDestinationsTripsPerSqMetersPerWeekday) {
                console.error(
                    `Error: missing tripDestinationsTripsPerSqMetersPerWeekday for poi category ${poiCategory}`
                );
            }
            if (weighingMethod.includes('capacity') && !weightConfig.tripDestinationsTripsPerCapacityPerWeekday) {
                console.error(
                    `Error: missing tripDestinationsTripsPerCapacityPerWeekday for poi category ${poiCategory}`
                );
            }
        }

        const absoluteDsDir = this._importDir + dataSourceDirectory + '/';
        console.log('Checking if required file exists...');
        this.assertDataPrepared(absoluteDsDir);

        console.log('Running import in dir ' + absoluteDsDir);

        console.log('Reading geojson data...');
        const osmGeojsonData = new DataFileGeojson(
            absoluteDsDir + GenericDataImportTask.POLYGON_ENHANCED_GEOJSON_FILE,
            this.fileManager
        );

        const poisData = new DataFileGeojson(
            absoluteDsDir + GenericDataImportTask.POINT_OF_INTEREST_FILE,
            this.fileManager
        );

        console.log('Categorize POIs...');
        const categorizedPOIs: PointOfInterest[] = await this.categorizePOIs(poisData);

        console.log('Weigh POIs...');
        const weightedPOIs: PointOfInterest[] = this.weightPOIs(categorizedPOIs, osmGeojsonData);

        if (this.fileManager.fileExistsAbsolute(absoluteDsDir + 'customPointOfInterestWeights.json')) {
            console.log('Setting custom POI weights...');
            const customPoiWeights = JSON.parse(
                this.fileManager.readFileAbsolute(absoluteDsDir + 'customPointOfInterestWeights.json')
            );
            for (const poiId in customPoiWeights) {
                const indexOfPoi = weightedPOIs.findIndex((poi) => {
                    return poi.id === poiId;
                });
                if (indexOfPoi >= 0) {
                    weightedPOIs[indexOfPoi].properties['weight:tripDestinationsPerWeekday'] = customPoiWeights[poiId];
                } else {
                    console.error('could not find poi which needs to be changed by custom weight', poiId);
                }
            }
        }

        if (this.fileManager.fileExistsAbsolute(absoluteDsDir + 'customPointOfInterestWeightFactors.json')) {
            console.log('Setting custom POI weight factors...');
            const customPoiWeightFactors = JSON.parse(
                this.fileManager.readFileAbsolute(absoluteDsDir + 'customPointOfInterestWeightFactors.json')
            );
            for (const poiId in customPoiWeightFactors) {
                const indexOfPoi = weightedPOIs.findIndex((poi) => {
                    return poi.id === poiId;
                });
                if (indexOfPoi >= 0) {
                    const actualWeight = weightedPOIs[indexOfPoi].properties['weight:tripDestinationsPerWeekday'];
                    if (!_isBlank(actualWeight)) {
                        weightedPOIs[indexOfPoi].properties['weight:tripDestinationsPerWeekday'] = Math.round(
                            (actualWeight || 1) * customPoiWeightFactors[poiId]
                        );
                    } else {
                        console.error(
                            'could not find poi weight which needs to be changed by custom weight factor',
                            poiId
                        );
                    }
                } else {
                    console.error('could not find poi which needs to be changed by custom weight factor', poiId);
                }
            }
        }

        if (this.fileManager.fileExistsAbsolute(absoluteDsDir + GenericDataImportTask.CUSTOM_POINT_OF_INTEREST_FILE)) {
            console.log('Add custom POIs...');
            const customPoisData = new DataFileGeojson(
                absoluteDsDir + GenericDataImportTask.CUSTOM_POINT_OF_INTEREST_FILE,
                this.fileManager
            );
            const customPois = customPoisData.queryOr([{}]) || [];
            console.log('customPois', customPois);
            for (let i = 0, count = customPois.length; i < count; i++) {
                weightedPOIs.push(customPois[i] as PointOfInterest);
            }
        }

        // Save data to file:
        const weightedPOIGeojsonFile = absoluteDsDir + GenericDataImportTask.WEIGHTED_POINT_OF_INTEREST_FILE;
        console.log('Saving weighted POIs geojson data to file: ', weightedPOIGeojsonFile);
        if (await this.promptOverwriteIfExists(weightedPOIGeojsonFile, 'Weighted POIs geojson file')) {
            this.fileManager.writeFileAbsolute(
                weightedPOIGeojsonFile,
                JSON.stringify({ type: 'FeatureCollection', features: weightedPOIs })
            );
        }
    }
}
