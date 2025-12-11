/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import GeoJSON from 'geojson';
import * as turf from '@turf/turf';
import { DataOsmRaw, OsmRawDataType } from './data/dataOsmRaw';
import { DataGeojson } from './data/dataGeojson';
import {
    ResidentialEntranceGeojsonProperties,
    ZoneGeojsonProperties,
    default as osmGeojsonService
} from './data/osmGeojsonService';
import { getEntrancesForBuilding } from './data/osmRawDataService';
import { _toInteger } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { queryResidentialZones, queryZonesWithResidences } from 'chaire-lib-common/lib/config/osm/osmFlatsLanduseTags';
import { findOverlappingFeatures } from 'chaire-lib-common/lib/services/geodata/FindOverlappingFeatures';
import {
    queryResidentialBuildings,
    defaultNumberOfFlats
} from 'chaire-lib-common/lib/config/osm/osmResidentialBuildingTags';
import { SingleGeoFeature } from 'chaire-lib-common/lib/services/geodata/GeoJSONUtils';
import { GeojsonOutputter } from './osmImportUtils';

// fields to query in the osm raw data to get the residential buildings:
const queryResidentialBuildingsFromOsm = [
    {
        tags: {
            'building:flats': undefined
        }
    },
    queryResidentialBuildings
];

export default class OsmDataPreparationResidential {
    private _hasError = false;
    private _geojsonOutputter: GeojsonOutputter;
    private _continueOnGeojsonError: boolean;

    constructor(geojsonOutputter: GeojsonOutputter, continueOnGeojsonError: boolean) {
        this._geojsonOutputter = geojsonOutputter;
        this._continueOnGeojsonError = continueOnGeojsonError;
    }

    private parseNumberOfFlats(building: SingleGeoFeature) {
        const properties = building.properties || {};
        let nbFlats = parseInt(properties['building:flats']);

        // Make sure there is a number of flats and it is valid. Otherwise, print an error
        if (isNaN(nbFlats) || nbFlats < 0) {
            if (defaultNumberOfFlats[properties.building]) {
                // use default number of flats for the provided residential building type if not found
                nbFlats = defaultNumberOfFlats[properties.building]; // default value may be null
            }
            if (isNaN(nbFlats) || nbFlats < 0) {
                // default value may be null so we need to recheck if it is a number
                console.error(
                    `Property building:flats is invalid for building ${this._geojsonOutputter.toString(building)}`
                );
                this._hasError = true;
                nbFlats = NaN;
            }
        } else {
            nbFlats = Math.floor(nbFlats); // force integer
        }
        return nbFlats;
    }

    private getResidentialBuildingEntrances(
        osmRawData: DataOsmRaw,
        osmGeojsonData: DataGeojson
    ): GeoJSON.Feature<GeoJSON.Point, ResidentialEntranceGeojsonProperties>[] {
        console.log('=== Getting residential building entrances... ===');
        // Get the buildings with flats from both osm raw data and geojson and
        // have them matched together for easier processing
        const allOsmResidentialBuildings = osmRawData.queryOr(queryResidentialBuildingsFromOsm);
        const residentialBuildings = osmGeojsonService.getGeojsonsFromRawData(
            osmGeojsonData,
            allOsmResidentialBuildings,
            { generateNodesIfNotFound: false, continueOnGeojsonError: this._continueOnGeojsonError }
        );

        // For each building, get its entrances
        let allBuildingEntrances: GeoJSON.Feature<GeoJSON.Point, ResidentialEntranceGeojsonProperties>[] = [];
        for (let i = 0, size = residentialBuildings.length; i < size; i++) {
            allBuildingEntrances = allBuildingEntrances.concat(
                this.getHomeEntrances(residentialBuildings[i], osmRawData)
            );

            if (i === 0 || (i + 1) % 10 === 0 || i + 1 === size) {
                process.stdout.write(`=== building ${i + 1}/${size} ===              \r`);
            }
        }

        console.log('=== Done getting residential building entrances... ===');

        return allBuildingEntrances;
    }

    private getHomeEntrances(
        building: { geojson: SingleGeoFeature; raw: OsmRawDataType },
        osmRawData: DataOsmRaw
    ): GeoJSON.Feature<GeoJSON.Point, ResidentialEntranceGeojsonProperties>[] {
        const nbFlats = this.parseNumberOfFlats(building.geojson);
        // Find the point(s) that this building should map to
        const homeCoordinates = this.findHomeEntrances(building.raw, building.geojson, osmRawData, nbFlats);
        return homeCoordinates;
    }

    private getResidentialBuildingProperties(
        building: GeoJSON.Feature<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>,
        nbFlats: number
    ): ResidentialEntranceGeojsonProperties {
        // Keep the following tags from the building
        //     - way id (required)
        //     - building:levels (optional)
        //     - flats/building:flats (required)
        //     - area (calculate with turf) (required)
        //     - building type (building tag) (warning/error if building:floor_area and difference is great) (required)
        //     - retirement home? (amenity=retirement_home or amenity=social_facility with social_facility:for=senior) (can be both: amenity=retirement_home;social_facility) (required)
        //     - entrance type: entrance or centroid (required)
        //     - entrance (required) (home/main or yes)
        //     - fromLandrole=false (required)
        const initialProperties = building.properties || {};
        const buildingProperties: ResidentialEntranceGeojsonProperties = {
            building_id: initialProperties['id'],
            'building:flats': nbFlats,
            area: turf.area(building),
            retirement_home: osmGeojsonService.isRetirementHome(initialProperties),
            from_landrole: false
        };
        if (initialProperties['building:levels']) {
            buildingProperties['building:levels'] = initialProperties['building:levels'];
        }
        if (initialProperties['building:floor_area']) {
            buildingProperties['building:floor_area'] = initialProperties['building:floor_area'];
        }
        if (initialProperties['flats']) {
            buildingProperties['flats'] = initialProperties['flats'];
        }
        if (initialProperties['building']) {
            buildingProperties['building'] = initialProperties['building'];
        }
        return buildingProperties;
    }

    // FIXME: This is tailored to residential, but the algorithm is the same for all buildings, adapt this method
    private findHomeEntrances(
        homeObject: OsmRawDataType,
        building: SingleGeoFeature,
        osmRawData: DataOsmRaw,
        nbFlats: number
    ): GeoJSON.Feature<GeoJSON.Point, ResidentialEntranceGeojsonProperties>[] {
        // Prepare the building properties that should be assigned to entrances
        const entranceProperties = this.getResidentialBuildingProperties(building, nbFlats);

        // Do we have a home or main entrance
        const entrances = getEntrancesForBuilding(building, homeObject, osmRawData, {
            entranceTypes: ['main', 'home'],
            continueOnInsideNodesUndefinedError: this._continueOnGeojsonError
        });
        if (entrances.length) {
            let flatsAssigned = 0;
            const splitIn = entrances.length;
            // Create a feature for each entrance, splitting the number of flats between those entrances
            return entrances.map((entrance, index) => {
                const doorFlats = Math.floor((nbFlats - flatsAssigned) / (splitIn - index));
                flatsAssigned += doorFlats;
                return {
                    type: 'Feature',
                    id: entrance.type + '/' + entrance.id,
                    geometry: {
                        type: 'Point',
                        coordinates: [entrance.lon, entrance.lat]
                    },
                    properties: Object.assign({}, entranceProperties, {
                        entrance_type: 'entrance',
                        entrance: entrance.tags?.entrance,
                        'building:flats': doorFlats,
                        building_id: building.id
                    })
                };
            });
        }

        console.log(
            `  Warning: building ${this._geojsonOutputter.toString(
                building
            )} with homes/flats does not have any entrance. Using the centroid instead`
        );

        // No point connecting to other features, just take the building's centroid
        const centroid = turf.centroid(building).geometry;
        return [
            {
                type: 'Feature',
                geometry: centroid,
                properties: Object.assign({}, entranceProperties, {
                    entrance_type: 'centroid',
                    'building:flats': nbFlats,
                    building_id: building.id
                })
            }
        ];
    }

    private processResidentialZones(
        osmRawData: DataOsmRaw,
        osmGeojsonData: DataGeojson,
        allBuildingEntrances: GeoJSON.Feature<GeoJSON.Point, ResidentialEntranceGeojsonProperties>[]
    ): GeoJSON.Feature[] {
        console.log('=== Processing residential zones... ===');
        const allOsmZones = osmRawData.query(queryResidentialZones);

        const zones = this.processZonesForHomes(allOsmZones, osmGeojsonData, allBuildingEntrances);
        console.log('=== Done processing residential zones... ===');
        return zones;
    }

    private processOtherZonesForHomes(
        osmRawData: DataOsmRaw,
        osmGeojsonData: DataGeojson,
        allBuildingEntrances: GeoJSON.Feature<GeoJSON.Point, ResidentialEntranceGeojsonProperties>[]
    ): GeoJSON.Feature[] {
        console.log('=== Processing non-residential zones... ===');
        const nonResidentialOsmZones = osmRawData.queryOr(queryZonesWithResidences);
        const nonResidentialOsmZonesWithFlats = nonResidentialOsmZones.filter((zone) => zone.tags?.flats);

        const zones = this.processZonesForHomes(nonResidentialOsmZonesWithFlats, osmGeojsonData, allBuildingEntrances);
        console.log('=== Done processing non-residential zones... ===');

        console.log('=== Verifying non residential zones for flat count mismatch... ===');
        // For non-residential zones
        for (let i = 0, size = zones.length; i < size; i++) {
            const zone = zones[i];
            const flatsFromOsm =
                typeof zone.properties?.flats === 'string'
                    ? parseInt(zone.properties?.flats)
                    : typeof zone.properties?.flats === 'number'
                        ? zone.properties?.flats
                        : 0;
            const flatsFromBuilding = zone.properties?.flats_from_osm;
            if (flatsFromOsm !== flatsFromBuilding) {
                console.error(
                    `  Flats count mismatch for non-residential zone ${this._geojsonOutputter.toString(
                        zone
                    )}. Expected number of flats for zone: %d, obtained from buildings: %d. All flats should match a building`,
                    zone.id,
                    flatsFromOsm,
                    flatsFromBuilding
                );
            }
        }

        console.log('=== Done verifying non residential zones for flat count mismatch... ===');
        return zones;
    }

    private processZonesForHomes(
        allOsmZones: { [key: string]: any }[],
        osmGeojsonData: DataGeojson,
        allBuildingEntrances: GeoJSON.Feature<GeoJSON.Point, ResidentialEntranceGeojsonProperties>[]
    ): SingleGeoFeature[] {
        const zones: SingleGeoFeature[] = [];
        for (let i = 0, size = allOsmZones.length; i < size; i++) {
            const zone = allOsmZones[i];
            const zoneGeojson = osmGeojsonData.find({ id: zone.type + '/' + zone.id });
            if (
                !zoneGeojson ||
                (zoneGeojson.geometry.type !== 'Polygon' && zoneGeojson.geometry.type !== 'MultiPolygon')
            ) {
                console.error(
                    'A geojson has not been found for the OSM zone %s/%s. Maybe you have the wrong files?',
                    zone.type,
                    zone.id
                );
                this._hasError = true;
                continue;
            }
            this.processZoneForHomes(
                zoneGeojson as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
                allBuildingEntrances
            );
            zones.push(zoneGeojson as SingleGeoFeature);

            if (i === 0 || (i + 1) % 10 === 0 || i + 1 === size) {
                process.stdout.write(`=== zone ${i + 1}/${size} ===              \r`);
            }
        }
        return zones;
    }

    /**
     * Add a property to the zones, called flats_from_osm, for the number of
     * flats found from the buildings drawn in OSM
     * @param zoneGeojson The geojson representing the zone
     * @param allBuildingEntrances All the building entrances found in the OSM
     * data
     */
    private processZoneForHomes(
        zoneGeojson: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, GeoJSON.GeoJsonProperties>,
        allBuildingEntrances: GeoJSON.Feature<GeoJSON.Point, ResidentialEntranceGeojsonProperties>[]
    ) {
        const entrancesInZone = findOverlappingFeatures(zoneGeojson, allBuildingEntrances);
        const zoneBoundaryLineStrings = turf.polygonToLine(zoneGeojson); // check for entrances on zone boundary
        const zoneBoundaryStrings =
            zoneBoundaryLineStrings.type === 'FeatureCollection'
                ? zoneBoundaryLineStrings.features
                : [zoneBoundaryLineStrings];
        let entrancesOnZoneBoundary: any[] = [];
        zoneBoundaryStrings.forEach(
            (boundary) =>
                (entrancesOnZoneBoundary = entrancesOnZoneBoundary.concat(
                    findOverlappingFeatures(boundary, allBuildingEntrances)
                ))
        );
        if (entrancesOnZoneBoundary.length > 0) {
            console.warn(
                `There is at least one entrance on the zone boundary (zone ${this._geojsonOutputter.toString(
                    zoneGeojson
                )}), flats count could mismatch because entrances on the boundaries maybe counted twice or ignored (in each touching zone)\n`
            );
        }

        let flatsFromOsmBuildings = 0;

        for (let i = 0, size = entrancesInZone.length; i < size; i++) {
            const entrance = entrancesInZone[i];
            // Assign the zone ID to the building
            const entranceProperties = entrance.properties || {};
            entranceProperties.zone_id = zoneGeojson.id;
            entrance.properties = entranceProperties;
            flatsFromOsmBuildings += entranceProperties['building:flats'];
        }

        const zoneProperties = zoneGeojson.properties || {};
        zoneProperties.flats_from_osm = flatsFromOsmBuildings;
        zoneProperties.flats = _toInteger(zoneProperties.flats, flatsFromOsmBuildings);
        zoneGeojson.properties = zoneProperties as ZoneGeojsonProperties;
    }

    /**
     * Extract the residential entrances and residential zones from the open
     * street map data.
     *
     * @param { DataOsmRaw } osmRawData The raw data from openstreetmap
     * @param { DataGeojson } osmGeojsonData The data from openstreetmap, in
     * geojson format and with more tags
     * @returns { residentialEntrances: GeoJSON.Feature<GeoJSON.Point,
     * ResidentialEntranceGeojsonProperties>[], zonesWithResidences:
     * GeoJSON.Feature<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>[] } The
     * residential entrances and zones respectively
     */
    public async run(
        osmRawData: DataOsmRaw,
        osmGeojsonData: DataGeojson
    ): Promise<{
        residentialEntrances: GeoJSON.Feature<GeoJSON.Point, ResidentialEntranceGeojsonProperties>[];
        zonesWithResidences: GeoJSON.Feature<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>[];
    }> {
        // 1. Read entrances from project's imports/[dataSourceId]/osmRawData.json file
        // 2. Read polygons with building:flats tag from imports/osm/osmData.geojson file
        // 3. For each entrance, find the associated building from geojson or use centroid if no entrance found
        // 4. Assign number of flats to each entrance and keep these tags from the building: way_id/area/building:levels/building(detached/terrace/commercial, etc.)/amenity(retirement_home or social) for each entrance that is associated with a building that has at least one flat.
        //   For each entrance: assign tags from building:
        //     - way id (required)
        //     - building:levels (optional)
        //     - flats/building:flats (required)
        //     - area (calculate with turf) (required)
        //     - building type (building tag) (warning/error if building:floor_area and difference is great) (required)
        //     - retirement home? (amenity=retirement_home or amenity=social_facility with social_facility:for=senior) (can be both: amenity=retirement_home;social_facility) (required)
        //     - entrance type: entrance or centroid or node (required)
        //     - entrance (required) (home/main or yes)
        //     - fromLandrole=false (required)
        // 5. Read polygons with flats/homes tag and all landuse=residential and create/assign bounding box to get minX, minY, maxX, maxY. If a landuse=residential and flats or homes tag is empty or invalid: error
        // 6. For each polygon bounding box, find all flats entrances inside the bounding box and keep the entrances that are inside the polygon (turf/inside and or contain)
        // 7. Assign the number of flats from osm buildings to the polygon, which will be a zone (we will still need to add/validate flats from landrole)
        // 8. Assign zone way_id to entrances
        // 9. Save entrances to imports/[dataSourceId]/residentialEntrances.geojson file
        // 10. Save zones to imports/[dataSourceId]/residentialZones.geojson file

        // Get all the residential building entrances
        const allBuildingEntrances = this.getResidentialBuildingEntrances(osmRawData, osmGeojsonData);

        // First, look at the purely residential zones, to match all land role points and buildings
        const residentialZones = this.processResidentialZones(osmRawData, osmGeojsonData, allBuildingEntrances);

        // Also check the zones that are not purely residential and need matching buildings
        const nonResidentialZonesWithResidences = this.processOtherZonesForHomes(
            osmRawData,
            osmGeojsonData,
            allBuildingEntrances
        );

        // Concatenate zone data
        const zonesWithResidences = residentialZones.concat(nonResidentialZonesWithResidences);

        return { residentialEntrances: allBuildingEntrances, zonesWithResidences };
    }
}
