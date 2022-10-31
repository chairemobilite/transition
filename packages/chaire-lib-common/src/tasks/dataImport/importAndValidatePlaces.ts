/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import GenericDataImportTask from './genericDataImportTask';
import GeoJSON from 'geojson';
import { DataFileGeojson } from './data/dataGeojson';
import {
    ResidentialEntranceGeojsonProperties,
    ZoneGeojsonProperties,
    ResidenceGeojsonProperties
} from './data/osmGeojsonService';
import { _toInteger } from '../../utils/LodashExtensions';
import { splitOverlappingFeatures } from '../../services/geodata/FindOverlappingFeatures';
import { PromptGeojsonPolygonService } from '../../services/prompt/promptGeojsonService';

// TODO: Make that configurable
const landRoleFieldMapping = {
    land_value: 'valeur_totale',
    area: 'superficie_etages',
    flatNb: 'building:flats'
};

class PlaceStream {
    private _currentPointPos = 0;
    private _currentCount = 0;
    constructor(private pointArray: GeoJSON.Feature[], private countFunction: (feature: GeoJSON.Feature) => number) {
        /* nothing to do */
    }

    getNext(): GeoJSON.Feature | undefined {
        const currentPoint = this.pointArray[this._currentPointPos];
        if (!currentPoint) {
            return undefined;
        }
        // Return the point if there are still points at this location
        const maxCount = this.countFunction(currentPoint);
        if (this._currentCount < maxCount) {
            this._currentCount++;
            return currentPoint;
        }
        // Go to next point in line
        this._currentPointPos++;
        this._currentCount = 0;
        return this.getNext();
    }
}

const landRoleflatCount = (point) => {
    return point.properties?.[landRoleFieldMapping.flatNb];
};

class BuildingMatchResult {
    residences: GeoJSON.Feature<GeoJSON.Point, ResidenceGeojsonProperties>[] = [];
    extraBuildings: GeoJSON.Feature[] = [];
    extraLandRole: GeoJSON.Feature[] = [];

    concat(other: BuildingMatchResult) {
        this.residences = this.residences.concat(other.residences);
        this.extraBuildings = this.extraBuildings.concat(other.extraBuildings);
        this.extraLandRole = this.extraLandRole.concat(other.extraLandRole);
    }
}

export default class ImportAndValidatePlaces extends GenericDataImportTask {
    private _promptPolygon: PromptGeojsonPolygonService;
    private _warnings: string[] = [];
    private _errors: string[] = [];

    // TODO Use dependency injection to pass the prompter
    constructor(fileManager: any, promptPolygon: PromptGeojsonPolygonService) {
        super(fileManager);
        this._promptPolygon = promptPolygon;
    }

    private addWarning(osmId: string | number, warning: string) {
        this._warnings.push(osmId + ': ' + warning);
        console.warn('WARNING: %s: %s', osmId, warning);
    }

    private addError(osmId: string | number, error: string) {
        this._errors.push(osmId + ': ' + error);
        console.error('ERROR: %s: %s', osmId, error);
    }

    private assertDataPrepared(dataSourceDirectory: string): void {
        if (
            !(
                this.fileManager.fileExistsAbsolute(
                    dataSourceDirectory + GenericDataImportTask.RESIDENTIAL_ENTRANCES_FILE
                ) &&
                this.fileManager.fileExistsAbsolute(dataSourceDirectory + GenericDataImportTask.RESIDENTIAL_ZONES_FILE)
            )
        ) {
            throw new Error(
                'Entrances and zones data not prepared for data source. Please run the task to prepare the OSM data or put the ' +
                    GenericDataImportTask.RESIDENTIAL_ENTRANCES_FILE +
                    ' and ' +
                    GenericDataImportTask.RESIDENTIAL_ZONES_FILE +
                    ' in the directory ' +
                    dataSourceDirectory
            );
        }
    }

    validateZone(
        resZone: GeoJSON.Feature<GeoJSON.Geometry, ZoneGeojsonProperties>,
        params: {
            resEntrancesGeojson: DataFileGeojson;
            landRoleData: GeoJSON.FeatureCollection<GeoJSON.Point, GeoJSON.GeoJsonProperties>;
            osmGeojsonData: DataFileGeojson;
        }
    ): GeoJSON.Feature<GeoJSON.Point, ResidenceGeojsonProperties>[] {
        const resZoneId = resZone.id;
        if (!resZoneId) {
            throw new Error('Residential zone without an ID!! ' + JSON.stringify(resZone));
        }
        const nbFlatsInOsm = _toInteger(resZone.properties?.flats) || 0;
        const nbFlatsFromBuildings = resZone.properties?.flats_from_osm || 0;
        const landRoleSplit = splitOverlappingFeatures(resZone, params.landRoleData.features, { allowBuffer: false });
        const landRoleInZone = landRoleSplit.overlapping;
        let landRoleCount = 0;
        // TODO Configure and type the land role properties data
        landRoleInZone.forEach((building) => (landRoleCount += building.properties?.[landRoleFieldMapping.flatNb]));

        if (landRoleCount < nbFlatsInOsm) {
            const difference = nbFlatsInOsm - landRoleCount;
            if (difference > nbFlatsFromBuildings) {
                this.addError(
                    resZone.id || '',
                    'Too few buildings in land role. Either draw new buildings in OSM, or verify land role data: osm (total) -> ' +
                        nbFlatsInOsm +
                        ', land role -> ' +
                        landRoleCount +
                        ', flats in buildings in OSM -> ' +
                        nbFlatsFromBuildings
                );
            } else {
                this.addWarning(
                    resZone.id || '',
                    'Flat number doesn\'t match: osm (total) -> ' +
                        nbFlatsInOsm +
                        ', land role -> ' +
                        landRoleCount +
                        ', flats in buildings in OSM -> ' +
                        nbFlatsFromBuildings
                );
            }
        } else if (landRoleCount > nbFlatsInOsm) {
            this.addError(
                resZone.id || '',
                'Too many flats in land role. Update land role or OSM: osm -> ' +
                    nbFlatsInOsm +
                    ', land role -> ' +
                    landRoleCount
            );
        }
        const entrancesInZone = params.resEntrancesGeojson.query({
            zone_id: resZoneId
        }) as GeoJSON.Feature<GeoJSON.Point, ResidentialEntranceGeojsonProperties>[];
        const matchResults = new BuildingMatchResult();

        const buildingResult = this.processBuildingsInZone(resZone, {
            entrancesInZone,
            osmGeojsonData: params.osmGeojsonData,
            landRoleInZone
        });
        matchResults.concat(buildingResult.result);
        const remainingLandRole = buildingResult.remainingLandRole;

        const zoneResult = this.processRestOfZone(resZone, { landRoleInZone: remainingLandRole });
        matchResults.concat(zoneResult.result);

        if (
            matchResults.extraBuildings.length > 0 ||
            matchResults.extraLandRole.length > 0 ||
            zoneResult.unassigned > 0
        ) {
            const finalMatchResult = this.processLeftOvers(resZone, {
                extraBuildings: matchResults.extraBuildings,
                extraLandRole: matchResults.extraLandRole,
                unassigned: zoneResult.unassigned
            });
            matchResults.concat(finalMatchResult.result);
        }
        return matchResults.residences;
    }

    processLeftOvers(
        resZone: GeoJSON.Feature<GeoJSON.Geometry, ZoneGeojsonProperties>,
        params: {
            extraBuildings: GeoJSON.Feature<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>[];
            extraLandRole: GeoJSON.Feature<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>[];
            unassigned: number;
        }
    ): {
        result: BuildingMatchResult;
    } {
        // 7. With the buckets of land role data and buildings, if the flat count matches, spread the flats in the buildings
        //     Remaining doors from OSM are simply added to the final list of flats.
        const results = new BuildingMatchResult();
        if (params.extraBuildings.length < params.extraLandRole.length) {
            this.addError(
                resZone.id || '',
                'There is too much data in the land role after assigning all OSM flats: extra count in land role -> ' +
                    (params.extraLandRole.length - params.extraBuildings.length)
            );
        }
        for (let i = 0; i < params.extraBuildings.length; i++) {
            const building = params.extraBuildings[i];
            const landRole = params.extraLandRole[i];
            if (landRole) {
                // Assign this land role data to this residence
                const flatCount = landRoleflatCount(landRole);
                const residence = {
                    type: 'Feature',
                    geometry: building.geometry,
                    id: building.id,
                    properties: {
                        from_landrole: false,
                        ...building.properties,
                        land_value: landRole.properties?.[landRoleFieldMapping.land_value] / flatCount || 0,
                        area: landRole.properties?.[landRoleFieldMapping.area] / flatCount || 0
                    }
                } as GeoJSON.Feature<GeoJSON.Point, ResidenceGeojsonProperties>;
                results.residences.push(residence);
            } else {
                const residence = {
                    type: 'Feature',
                    geometry: building.geometry,
                    id: building.id,
                    properties: {
                        from_landrole: false,
                        ...building.properties,
                        land_value: 0,
                        area: 0
                    }
                } as GeoJSON.Feature<GeoJSON.Point, ResidenceGeojsonProperties>;
                results.residences.push(residence);
            }
        }
        return { result: results };
    }

    processRestOfZone(
        resZone: GeoJSON.Feature<GeoJSON.Geometry, ZoneGeojsonProperties>,
        params: { landRoleInZone: GeoJSON.Feature<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>[] }
    ): {
        result: BuildingMatchResult;
        unassigned: number;
    } {
        // 6. For each remaining land role flat
        //    6.2 add landrole flats not in osm data to the entrances with the tag: fromLandrole=true, keeping the useful land role properties (land value, etc)
        const results = new BuildingMatchResult();
        const unassignedFlatCount = resZone.properties.flats - resZone.properties.flats_from_osm;

        const landRoleStream = new PlaceStream(params.landRoleInZone, landRoleflatCount);
        let extraCount = 0;
        for (let i = 0; i < unassignedFlatCount; i++) {
            const landRolePoint = landRoleStream.getNext();
            if (landRolePoint) {
                const landRoleCount = landRoleflatCount(landRolePoint);
                results.residences.push({
                    type: 'Feature',
                    properties: {
                        from_landrole: true,
                        retirement_home: false,
                        land_value: landRolePoint.properties?.[landRoleFieldMapping.land_value] / landRoleCount || 0,
                        area: landRolePoint.properties?.[landRoleFieldMapping.area] / landRoleCount || 0
                    },
                    geometry: landRolePoint.geometry as GeoJSON.Point,
                    id: landRolePoint.id
                });
            } else {
                extraCount = unassignedFlatCount - i;
                this.addError(
                    resZone.id || '',
                    'Land role does not have enough data to match the number of flats in the zone. The new buildings need to be drawn in OSM: missing number of flats -> ' +
                        extraCount
                );
                break;
            }
        }
        let nextLandRole = landRoleStream.getNext();
        if (nextLandRole) {
            // More land role data than flat count
            do {
                results.extraBuildings.push(nextLandRole);
                nextLandRole = landRoleStream.getNext();
            } while (nextLandRole);
        }
        return { result: results, unassigned: extraCount };
    }

    processBuildingsInZone(
        resZone: GeoJSON.Feature<GeoJSON.Geometry, ZoneGeojsonProperties>,
        params: {
            entrancesInZone: GeoJSON.Feature<GeoJSON.Point, ResidentialEntranceGeojsonProperties>[];
            osmGeojsonData: DataFileGeojson;
            landRoleInZone: GeoJSON.Feature[];
        }
    ): {
        result: BuildingMatchResult;
        remainingLandRole: GeoJSON.Feature[];
    } {
        const buildingResults = new BuildingMatchResult();
        const buildingEntrances: {
            [key: string]: GeoJSON.Feature<GeoJSON.Point, ResidentialEntranceGeojsonProperties>[];
        } = {};
        for (let i = 0; i < params.entrancesInZone.length; i++) {
            const building_id = params.entrancesInZone[i].properties.building_id;
            const entrancesArr = buildingEntrances[building_id] || [];
            entrancesArr.push(params.entrancesInZone[i]);
            buildingEntrances[building_id] = entrancesArr;
        }
        const buildings = params.osmGeojsonData.query({ id: Object.keys(buildingEntrances) });
        let remainingLandRole = params.landRoleInZone;
        for (let i = 0; i < buildings.length; i++) {
            const buildingResult = this.processBuildingInZone(buildings[i], {
                landRoleInZone: remainingLandRole,
                buildingEntrances: buildingEntrances[buildings[i].id || '']
            });
            buildingResults.concat(buildingResult.result);
            remainingLandRole = buildingResult.remainingLandRole;
        }
        if (buildingResults.extraBuildings.length === 0 && buildingResults.extraLandRole.length === 0) {
            return { result: buildingResults, remainingLandRole };
        }
        if (buildingResults.extraBuildings.length === buildingResults.extraLandRole.length) {
            this.addWarning(
                resZone.id || '',
                'Land role data for buildings is misplaced, but total count still matches: number of misplace points -> ' +
                    buildingResults.extraBuildings.length
            );
        }
        return { result: buildingResults, remainingLandRole };
    }

    processBuildingInZone(
        building: GeoJSON.Feature<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>,
        params: {
            landRoleInZone: GeoJSON.Feature[];
            buildingEntrances: GeoJSON.Feature<GeoJSON.Point, ResidentialEntranceGeojsonProperties>[];
        }
    ): {
        result: BuildingMatchResult;
        remainingLandRole: GeoJSON.Feature[];
    } {
        // 5. For each building in OSM
        //    Find the land role flats in it, with gradual buffer if no land role data
        //    add the useful land role properties to the flat entrance point (land value, etc), divide values by number of points
        //        If land role has too many data, warn for this zone and keep the rest in a bucket for later
        //    Maybe there isn't for new buildings, but then the final count still needs to match. Empty buildings should go in a bucket to be treated later
        let expectedCount = 0;
        const results = new BuildingMatchResult();
        params.buildingEntrances.forEach((entrance) => (expectedCount += entrance.properties['building:flats']));
        const landRoleSplit = splitOverlappingFeatures(building, params.landRoleInZone, {
            expectedApproximateCount: expectedCount,
            featureCount: (f) => f.properties?.[landRoleFieldMapping.flatNb] || 0,
            maxBufferSize: 2
        });
        const landRoleInBuilding = landRoleSplit.overlapping;
        const flatCount = (entrance: GeoJSON.Feature) => entrance.properties?.['building:flats'] || 1;
        const buildingStream = new PlaceStream(params.buildingEntrances, flatCount);
        const landRoleStream = new PlaceStream(landRoleInBuilding, (entrance) => {
            return entrance.properties?.[landRoleFieldMapping.flatNb];
        });
        let nextBuilding = buildingStream.getNext();
        let nextLandRole = landRoleStream.getNext();
        while (nextBuilding && nextLandRole) {
            // Create a residence
            const landRoleCount = flatCount(nextLandRole);
            const residence = {
                type: 'Feature',
                geometry: nextBuilding.geometry,
                id: nextBuilding.id,
                properties: {
                    from_landrole: false,
                    ...nextBuilding.properties,
                    land_value: nextLandRole.properties?.[landRoleFieldMapping.land_value] / landRoleCount || 0,
                    area: nextLandRole.properties?.[landRoleFieldMapping.area] / landRoleCount || 0
                }
            } as GeoJSON.Feature<GeoJSON.Point, ResidenceGeojsonProperties>;
            results.residences.push(residence);
            nextBuilding = buildingStream.getNext();
            nextLandRole = landRoleStream.getNext();
        }
        if (nextBuilding) {
            // More buildings than land role data
            do {
                results.extraBuildings.push(nextBuilding);
                nextBuilding = buildingStream.getNext();
            } while (nextBuilding);
        }
        if (nextLandRole) {
            // More land role data than buildings
            do {
                results.extraLandRole.push(nextLandRole);
                nextLandRole = landRoleStream.getNext();
            } while (nextLandRole);
        }
        return { result: results, remainingLandRole: landRoleSplit.notOverlapping };
    }

    validateZones(params: {
        resZonesGeojson: DataFileGeojson;
        resEntrancesGeojson: DataFileGeojson;
        landRoleData: GeoJSON.FeatureCollection<GeoJSON.Point, GeoJSON.GeoJsonProperties>;
        osmGeojsonData: DataFileGeojson;
    }): GeoJSON.Feature<GeoJSON.Point, ResidenceGeojsonProperties>[] {
        console.log('=== Processing zones with residential data... ===');
        const { resZonesGeojson, resEntrancesGeojson, landRoleData, osmGeojsonData } = params;
        const allResZones = resZonesGeojson.query({}) as GeoJSON.Feature<GeoJSON.Geometry, ZoneGeojsonProperties>[];
        let residences: GeoJSON.Feature<GeoJSON.Point, ResidenceGeojsonProperties>[] = [];
        for (let i = 0, size = allResZones.length; i < size; i++) {
            const resZone = allResZones[i];
            residences = residences.concat(
                this.validateZone(resZone, { resEntrancesGeojson, landRoleData, osmGeojsonData })
            );

            if (i === 0 || (i + 1) % 10 === 0 || i + 1 === size) {
                console.log(`=== zone ${i + 1}/${size} ===\r`);
            }
        }
        console.log('=== Done Processing zones with residential data... ===');
        return residences;
    }

    /**
     * IN: A file {@link GenericDataImportTask#RESIDENTIAL_ENTRANCES_FILE}
     * containing the residences building entrances (points), along with the
     * building they belong to and a file
     * {@link GenericDataImportTask#RESIDENTIAL_ZONES_FILE} with the zones with
     * residential buildings
     *
     * OUT:
     *
     * @param dataSourceDirectory The directory containing the data sources
     */
    protected async doRun(dataSourceDirectory: string): Promise<void> {
        // 1. Select land role data geojson file from projects/imports directory
        // 2. Import flat entrances and zones with flats from imports/osm/osmFlatsEntrances_[dataSourceId].json and imports/osm/zonesWithFlats_[dataSourceId].json
        // 3. For each zones bounding boxes, get all landrole flats inside the bounding box + get flats that are inside the poylgon using turf/inside or contain
        // 4. Compare the total number of flats in zone from the landrole with the number of flats in zone from osm (flats or home tag)
        //   if landrole flats < osm flats (flats/homes tag):
        //       if number of flats from osm buildings < difference: Error: missing buildings for flats not in landrole
        //       else OK but we should warn if the difference is large, like 50 flats or more
        //   if landrole flats > osm flats: Error: should be fixed in osm and/or landrole
        //   (console.log + save errors and warnings to errors_[dataSourceId].md and warning_[dataSourceId].md)
        //   (include an url with the way id (id editor url + &id=w[WAY_ID]))
        // 5. For each building in OSM
        //    Find the land role flats in it, with gradual buffer if no land role data
        //    add the useful land role properties to the flat entrance point (land value, etc), divide values by number of points
        //        If land role has too many data, warn for this zone and keep the rest in a bucket for later
        //    Maybe there isn't for new buildings, but then the final count still needs to match. Empty buildings should go in a bucket to be treated later
        // 6. For each remaining land role flat
        //    6.2 add landrole flats not in osm data to the entrances with the tag: fromLandrole=true, keeping the useful land role properties (land value, etc)
        // 7. With the buckets of land role data and buildings, if the flat count matches, spread the flats in the buildings
        //     Remaining doors from OSM are simply added to the final list of flats.
        // 8. Save the flats entrances to imports/osm/allFlatsEntrances_[dataSourceId].json
        // 9. Ask if the user wants to replace flats data in the tr_places table for the dataSourceId.
        //    if true
        //        Warn if the user wants to replace if exisiting data has been found.
        //        if true: delete the data in tr_places for the dataSourceId, then save the flats entrances (tr_places with dataSourceId)

        // TODO: create a task to merge multiple dataSourceIds into one if we import osm data by region or subregion
        const absoluteDsDir = this._importDir + dataSourceDirectory + '/';
        this.assertDataPrepared(absoluteDsDir);

        console.log('Running import in dir ' + absoluteDsDir);
        const landRoleData = (await this._promptPolygon.getFeatureCollection(
            absoluteDsDir + 'landRole.geojson'
        )) as GeoJSON.FeatureCollection<GeoJSON.Point, GeoJSON.GeoJsonProperties>;

        const resEntrancesGeojson = new DataFileGeojson(
            absoluteDsDir + GenericDataImportTask.RESIDENTIAL_ENTRANCES_FILE,
            this.fileManager
        );
        const resZonesGeojson = new DataFileGeojson(
            absoluteDsDir + GenericDataImportTask.RESIDENTIAL_ZONES_FILE,
            this.fileManager
        );
        const osmGeojsonData = new DataFileGeojson(
            absoluteDsDir + GenericDataImportTask.OSM_GEOJSON_FILE,
            this.fileManager
        );

        const residences = this.validateZones({ resZonesGeojson, resEntrancesGeojson, landRoleData, osmGeojsonData });

        // Save data to files
        const entrancesDataFile = absoluteDsDir + GenericDataImportTask.ALL_RESIDENCES_FILE;
        if (await this.promptOverwriteIfExists(entrancesDataFile, 'Residential entrances file')) {
            this.fileManager.writeFileAbsolute(
                entrancesDataFile,
                JSON.stringify({ type: 'FeatureCollection', features: residences })
            );
        }
    }
}
