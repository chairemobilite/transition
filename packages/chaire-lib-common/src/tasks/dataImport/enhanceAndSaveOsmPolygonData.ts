/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import GenericDataImportTask from './genericDataImportTask';
import GeoJSON from 'geojson';
import { DataFileGeojson } from './data/dataGeojson';
import { SingleGeoFeature } from '../../services/geodata/GeoJSONUtils';
import { area as turfArea } from '@turf/turf';
import { ignoreBuildings } from '../../config/osm/osmBuildingQuerySetup';
import { queryResidentialBuildings } from '../../config/osm/osmResidentialBuildingTags';
import { findOverlappingFeatures } from '../../services/geodata/FindOverlappingFeatures';

type PolygonGeojson =
    | GeoJSON.Feature<GeoJSON.Polygon, GeoJSON.GeoJsonProperties>
    | GeoJSON.Feature<GeoJSON.MultiPolygon, GeoJSON.GeoJsonProperties>;

export default class enhanceAndSaveOsmPolygonData extends GenericDataImportTask {
    private _warnings: string[] = [];
    private _errors: string[] = [];

    constructor(fileManager: any) {
        super(fileManager);
    }

    private assertDataDownloaded(dataSourceDirectory: string): void {
        if (
            !(
                this.fileManager.fileExistsAbsolute(dataSourceDirectory + GenericDataImportTask.OSM_RAW_DATA_FILE) &&
                this.fileManager.fileExistsAbsolute(dataSourceDirectory + GenericDataImportTask.OSM_GEOJSON_FILE)
            )
        ) {
            throw new Error(
                'OSM data not available for data source. Please run the task to download the OSM data or put the ' +
                    GenericDataImportTask.OSM_RAW_DATA_FILE +
                    ' and ' +
                    GenericDataImportTask.OSM_GEOJSON_FILE +
                    ' in the directory ' +
                    dataSourceDirectory
            );
        }
    }

    private addWarning(geojson: SingleGeoFeature, warning: string) {
        const osmId = geojson.id;
        this._warnings.push('polygon with id ' + osmId + ': ' + warning);
        console.warn('WARNING: %s, %s', warning, this._geojsonOutputter.toString(geojson));
    }

    private addError(geojson: SingleGeoFeature, error: string) {
        const osmId = geojson.id;
        this._errors.push('polygon with id ' + osmId + ': ' + error);
        console.error('ERROR: %s, %s', error, this._geojsonOutputter.toString(geojson));
    }

    private readAndEnhancePolygons(
        osmGeojsonFeatures: GeoJSON.Feature<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>[]
    ): PolygonGeojson[] {
        const polygons: PolygonGeojson[] = [];

        console.log('Fetch polygons and multipolygons from osm geojson data...');

        // Enhance and validate each polygon
        const size = osmGeojsonFeatures.length;
        console.log(`Validate and enhance each polygon (total: ${size})...`);

        const buildingFeatures = osmGeojsonFeatures.filter((feature) => {
            return feature.properties?.building !== undefined;
        });

        for (let i = 0; i < size; i++) {
            const feature = osmGeojsonFeatures[i];
            if (feature.geometry?.type !== 'Polygon' && feature.geometry?.type !== 'MultiPolygon') {
                continue;
            }

            if (!feature.properties) {
                feature.properties = {};
            }

            let outerBuilding: GeoJSON.Feature<GeoJSON.Geometry, GeoJSON.GeoJsonProperties> | undefined = undefined;
            if (feature.properties['building:part']) {
                outerBuilding = findOverlappingFeatures(feature, buildingFeatures).find(
                    (overlapping) => overlapping.properties?.building !== undefined
                );
                if (outerBuilding) {
                    feature.properties['building:id'] = outerBuilding.id;
                    if (!outerBuilding.properties) {
                        outerBuilding.properties = {};
                    }
                }
            }

            const areaSqMeters: number = Math.round(turfArea(feature.geometry));
            let floorArea: number | undefined = undefined;
            if (
                feature.properties['building:floor_area'] &&
                !isNaN(Number(feature.properties['building:floor_area'])) &&
                feature.properties['building:floor_area'] > 0
            ) {
                // Floor area defined by the OSM feature
                floorArea = Math.round(feature.properties['building:floor_area']);
                feature.properties['building:floor_area:calculated'] = false;
            } else if (
                feature.properties['building:levels'] &&
                !isNaN(Number(feature.properties['building:levels'])) &&
                !feature.properties['building:floor_area']
            ) {
                // No area in the OSM feature, but a number of levels. Calculated by polygon * levels
                floorArea = Math.round(areaSqMeters * feature.properties['building:levels']);
                feature.properties['building:floor_area:calculated'] = true;
            } else if (feature.properties['building:part'] && outerBuilding) {
                // Building part, inherit levels and floor area from parent
                const outerBuildingProperties = outerBuilding.properties || {};
                if (
                    outerBuildingProperties['building:levels'] &&
                    !isNaN(Number(outerBuildingProperties['building:levels']))
                ) {
                    feature.properties['building:levels'] = Number(outerBuildingProperties['building:levels']);
                }
                if (
                    outerBuildingProperties['building:floor_area'] &&
                    !isNaN(Number(outerBuildingProperties['building:floor_area'])) &&
                    outerBuildingProperties['building:floor_area'] > 0
                ) {
                    // Take a floor area proportional to the area of the building
                    // TODO do not cast as any here
                    const outerAreaSqMeters: number = Math.round(turfArea(outerBuilding.geometry as any));
                    if (
                        outerBuildingProperties['building:floor_area'] &&
                        outerBuildingProperties['building:floor_area'] < outerAreaSqMeters
                    ) {
                        outerBuildingProperties['building:floor_area'] = outerAreaSqMeters;
                    }

                    feature.properties['building:floor_area'] =
                        (areaSqMeters / outerAreaSqMeters) * outerBuildingProperties['building:floor_area'];
                }
            }
            if (floorArea && floorArea < areaSqMeters) {
                if (floorArea < 0.8 * areaSqMeters) {
                    /*this.addWarning(
                        feature as SingleGeoFeature,
                        `floor area is less than 80% of total area, something is wrong, please validate: floor area: ${floorArea} m2, area: ${areaSqMeters} m2 (${Math.round(
                            (100 * floorArea) / areaSqMeters
                        ) / 100}, will use building area instead)`
                    );*/
                }
                floorArea = areaSqMeters; // forcing building:area if floor area is too low
            }
            if (feature.properties.building || feature.properties['building:part']) {
                feature.properties['building:area'] = areaSqMeters;
                // set default building:levels to 1:
                feature.properties['building:levels:imputed'] = !!feature.properties['building:levels']; // TODO, check if there could be building:levels = 0 for small buildings and deal with it if so
                feature.properties['building:levels'] = feature.properties['building:levels:imputed']
                    ? 1
                    : feature.properties['building:levels'];
            } else {
                feature.properties['polygon:area'] = areaSqMeters;
            }
            // if no floor area available or calculated and the polygon is a building and non residential and non ignored, trigger warning:
            // TODO: put queries for ignore in a config file:
            if (!floorArea && (feature.properties.building || feature.properties['building:part'])) {
                if (
                    ((feature.properties.building &&
                        !ignoreBuildings.tags.building.includes(feature.properties.building)) ||
                        (feature.properties['building:part'] &&
                            !ignoreBuildings.tags.building.includes(feature.properties['building:part']))) &&
                    !queryResidentialBuildings.tags.building.includes(feature.properties.building) && // TODO: deal with residential buildings
                    feature.properties.amenity !== 'shelter' &&
                    feature.properties.building !== 'barn' &&
                    feature.properties.building !== 'farm_auxiliary' &&
                    feature.properties.man_made !== 'storage_tank' &&
                    feature.properties['building:part'] !== 'barn' &&
                    feature.properties['building:part'] !== 'farm_auxiliary'
                ) {
                    /*this.addWarning(
                        feature as SingleGeoFeature,
                        `floor area could not be found for building (building=${feature.properties.building ||
                            feature.properties[
                                'building:part'
                            ]}), using a default number of levels = 1 and using the building area`
                    );*/
                }
                feature.properties['building:levels'] = feature.properties['building:levels'] || 1;
                feature.properties['building:floor_area:calculated'] = true;
                floorArea = areaSqMeters; // use building area like there is only one floor as default floor area value
            }
            feature.properties['building:floor_area'] = floorArea ? floorArea : undefined;

            polygons.push(feature as PolygonGeojson);

            if (i === 0 || (i + 1) % 5 === 0 || i + 1 === size) {
                process.stdout.write(`=== validated and enhanced polygon ${i + 1}/${size} ===                   \r`);
            }
        }

        return polygons;
    }

    /**
     * IN: A file {@link GenericDataImportTask#OSM_GEOJSON_FILE}
     * containing the polygons and multipolygon from osm data, including the
     * buildings
     *
     * OUT: Saves the enhanced polygons geojson in files
     * {@link GenericDataImportTask#POLYGON_ENHANCED_GEOJSON_FILE} with
     * area and floor_area in sq meters
     *
     * @param dataSourceDirectory The directory containing the data sources
     */
    protected async doRun(dataSourceDirectory: string): Promise<void> {
        // 1. Fetch the polygons using the raw and geojson osm data files
        // 2. For each polygon:
        //    2a. Calculate the area in sq meters and add it to the properties
        //    2b. If building: verify that building:floor_area and/or building:levels is available in the building tags: error if both are missing
        //    2c. If building and building:floor_area, warning if it is < 80% of the total building area
        //    2d. If building: use the floor_area value or calculate the floor area: calculated area * building:levels
        //    2e. If building does not have at least building:levels or building:floor_area and it should not be ignored, trigger a warning for validation/fix
        //    2f. Save area and floor_area to feature
        // 3. Save all features into the new enhanced polygon file

        const absoluteDsDir = this._importDir + dataSourceDirectory + '/';
        console.log('Checking if required file exists...');
        this.assertDataDownloaded(absoluteDsDir);

        console.log('Running import in dir ' + absoluteDsDir);

        console.log('Reading geojson data...');
        const osmGeojsonData = new DataFileGeojson(
            absoluteDsDir + GenericDataImportTask.OSM_GEOJSON_FILE,
            this.fileManager
        );

        console.log('Enhancing polygon data...');
        const polygons: PolygonGeojson[] = this.readAndEnhancePolygons(osmGeojsonData.query({}));

        // Save data to file:
        const enhancedPolygonGeojsonFile = absoluteDsDir + GenericDataImportTask.POLYGON_ENHANCED_GEOJSON_FILE;
        console.log('Saving enhanced polygon geojson data to file: ', enhancedPolygonGeojsonFile);
        if (await this.promptOverwriteIfExists(enhancedPolygonGeojsonFile, 'Enhanced OSM polygons geojson file')) {
            this.fileManager.writeFileAbsolute(
                enhancedPolygonGeojsonFile,
                JSON.stringify({ type: 'FeatureCollection', features: polygons })
            );
        }
    }
}
