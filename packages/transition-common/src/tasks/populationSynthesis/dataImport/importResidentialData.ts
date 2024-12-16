/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/** This file is probably deprecated. It was written initially, but was later replaced by the files in chaire-lib-common/lib/tasks/dataImport */
import { v4 as uuidV4 } from 'uuid';
import { Point } from 'geojson';
import * as turf from '@turf/turf';

import { DataOsmRaw } from 'chaire-lib-common/lib/tasks/dataImport/data/dataOsmRaw';
import { DataGeojson } from 'chaire-lib-common/lib/tasks/dataImport/data/dataGeojson';
import { getOsmNodesFor } from 'chaire-lib-common/lib/tasks/dataImport/data/osmRawDataService';
import { PlaceAttributes } from '../../../services/places';
import { splitOverlappingFeatures } from 'chaire-lib-common/lib/services/geodata/FindOverlappingFeatures';
import { queryResidentialZones, queryZonesWithResidences } from 'chaire-lib-common/lib/config/osm/osmFlatsLanduseTags';

// fields to query in the osm raw data to get the residential buildings and zones
const queryResidentialBuildingsFromOsm = [
    {
        tags: {
            'building:flats': undefined
        }
    }
];

export class ResidentialDataImporter {
    private osmRawData: DataOsmRaw;
    private osmPolygons: DataGeojson;
    private landRole: DataGeojson;

    constructor(osmRawData: DataOsmRaw, osmPolygons: DataGeojson, landRole: DataGeojson) {
        this.osmRawData = osmRawData;
        this.osmPolygons = osmPolygons;
        this.landRole = landRole;
    }

    // FIXME: This is tailored to residential, but the algorithm is the same for all buildings, adapt this method
    private async findHomePoints(homeObject, nodes: any[], geometry: GeoJSON.Feature): Promise<Point[]> {
        // Do we have a home entrance
        const homeDoors = nodes.filter((node) => node.tags?.entrance === 'main' || node.tags?.entrance === 'home');
        if (homeDoors.length > 0) {
            // console.log("Got a main entrance!");
            return homeDoors.map((entrance) => {
                return { type: 'Point', coordinates: [entrance.lon, entrance.lat] };
            });
        }
        // Do we have a entrance
        const entrances = nodes.filter((node) => node.tags?.entrance);
        if (entrances.length) {
            // console.log("We have a entrance, but not the main one!");
            return entrances.map((entrance) => {
                return { type: 'Point', coordinates: [entrance.lon, entrance.lat] };
            });
        }
        // Find a connection point among the building's nodes
        const nodeIds = nodes.map((node) => node.id);
        const other = this.osmRawData.query({ type: ['way', 'relation'], nodes: nodeIds }, 2);
        if (other.length !== 1) {
            const otherObject = other.find((obj) => obj.id !== homeObject.id);
            if (!otherObject) {
                throw new Error('We should have an other object');
            }
            const commonPoint = nodes.find((node) => otherObject.nodes.includes(node));
            if (commonPoint) {
                // console.log("We have a connection point");
                return [{ type: 'Point', coordinates: [commonPoint.lon, commonPoint.lat] }];
            }
        }
        // console.log("taking the centroid");
        return [turf.centroid(geometry as turf.AllGeoJSON).geometry];
    }

    private explodeLandRole(landRole: GeoJSON.Feature[]): GeoJSON.Feature[] {
        const exploded: GeoJSON.Feature[] = [];
        // Create the residences from the land role data
        for (let j = 0; j < landRole.length; j++) {
            const landRoleBuilding = landRole[j];
            const nbResidences = landRoleBuilding.properties?.['building:flats'];
            for (let flatNb = 0; flatNb < nbResidences; flatNb++) {
                exploded.push(landRoleBuilding);
            }
        }
        return exploded;
    }

    private findNearest(element: GeoJSON.Feature<Point>, elements: GeoJSON.Point[]): Point {
        let smallerDistance = turf.distance(element, { type: 'Feature', geometry: elements[0], properties: [] });
        let nearest: Point = elements[0];
        for (let i = 1; i < elements.length; i++) {
            const distance = turf.distance(element, { type: 'Feature', geometry: elements[i], properties: [] });
            if (distance < smallerDistance) {
                smallerDistance = distance;
                nearest = elements[i];
            }
        }
        return nearest;
    }

    /**
     * Create the residences from the OSM building data
     *
     * @param dataSourceName The data source name
     * @param osmResidentialBuildings The residential buildings found in the OSM
     * raw data
     * @param landRoleData The complete land role data
     * @returns The 'residences' field contain the residences that have been
     * created, the 'remainingLandRole' is the land role data that has not been
     * assigned to homes and 'mismatchCount' is the difference between the
     * number of flats in OSM and the land role. A positive number means there
     * are more flats in OSM than land role
     */
    private async createHomesFromOsmBuildings(
        dataSourceName: string,
        osmResidentialBuildings: GeoJSON.Feature[],
        landRoleData: GeoJSON.Feature[]
    ): Promise<{ residences: PlaceAttributes[]; remainingLandRole: GeoJSON.Feature[]; mismatchCount: number }> {
        const allHomes: any[] = [];
        let remainingLandRole = landRoleData;
        let mismatchCount = 0;

        // For each residential building in the osm data
        for (let i = 0, countBuildings = osmResidentialBuildings.length; i < countBuildings; i++) {
            const feature = osmResidentialBuildings[i];
            const osmResidentialBuilding = feature.properties?.raw;
            const nodes = getOsmNodesFor(osmResidentialBuilding, this.osmRawData);
            // Find the polygon corresponding to the residential building feature

            // Find the point(s) that this building should map to
            const homeCoordinates = await this.findHomePoints(osmResidentialBuilding, nodes, feature);
            const properties = feature.properties || {};

            const nbFlats = parseInt(osmResidentialBuilding.tags['building:flats'] || 1);
            if (isNaN(nbFlats) || nbFlats < 0) {
                console.error('Property building:flats is invalid', osmResidentialBuilding);
                continue;
            }

            // Find the overlapping buildings from the land role
            const landRoleSplit = splitOverlappingFeatures(feature, remainingLandRole, {
                expectedApproximateCount: nbFlats,
                featureCount: (f) => f.properties?.['building:flats'] || 0,
                maxBufferSize: 2
            });
            const overlapping = landRoleSplit.overlapping;
            let landRoleCount = 0;
            overlapping.forEach((building) => (landRoleCount += building.properties?.['building:flats']));
            if (landRoleCount !== nbFlats) {
                mismatchCount += nbFlats - landRoleCount;
                console.log(
                    'Count doesn\'t match for osm building %s: osm -> %d, land role -> %d',
                    feature.type + '/' + feature.id,
                    nbFlats,
                    landRoleCount
                );
            }
            const landRoleIn = this.explodeLandRole(overlapping);

            const name = properties['name'] || null;
            const shortname = properties['@id'] || null;
            const description = properties.description || null;
            const internalId = properties.internal_id || null;
            // Split the nbFlats between all entrances, based on the land role numbers and add the place
            for (let flatNb = 0; flatNb < landRoleCount; flatNb++) {
                const uuid = uuidV4();
                const landRoleData = landRoleIn[flatNb]; // Can be undefined if flabNb > landRole
                const closestDoor = landRoleData
                    ? this.findNearest(landRoleData as GeoJSON.Feature<Point>, homeCoordinates)
                    : homeCoordinates[flatNb % homeCoordinates.length];
                const attributes = {
                    id: uuid,
                    data_source_id: dataSourceName,
                    internal_id: internalId,
                    shortname,
                    name,
                    description,
                    data: { ...osmResidentialBuilding.tags, ...(landRoleData?.properties || {}) },
                    geography: closestDoor
                };
                // console.log("We have a building...", attributes.data, osmResidentialBuilding.tags);
                allHomes.push(attributes);
            }

            remainingLandRole = landRoleSplit.notOverlapping;
        }
        return { residences: allHomes, remainingLandRole, mismatchCount };
    }

    /**
     * Create the residences from the OSM residential zones. The actual points
     * for the homes will be taken from the land role data
     * @param dataSourceName The data source name
     * @param osmZone The zone in OSM to process. 'raw' is the raw osm data,
     * while 'geojson' is the shape for this zone
     * @param homeBuildings The buildings previously created
     * @param landRoleData The land role data
     * @returns The 'residences' field contain the residences that have been
     * created in this method, the 'remainingLandRole' is the land role data
     * that has not been assigned to homes and 'mismatchCount' is the difference
     * between the number of flats in OSM and the land role. A positive number
     * means there are more flats in OSM than land role.
     */
    private async createHomesInResidentialAreas(
        dataSourceName: string,
        osmZone: { raw: { [key: string]: any }; geojson: GeoJSON.Feature },
        homeBuildings: PlaceAttributes[],
        landRoleData: GeoJSON.Feature[]
    ): Promise<{ residences: PlaceAttributes[]; mismatchCount: number }> {
        const allHomes: any[] = [];
        let mismatchCount = 0;

        // Find how many buildings have previously been created in this zone
        // and add them to the total count of the zone
        let countResidencesInZone = homeBuildings.length;
        const data = osmZone.raw;
        const feature = osmZone.geojson;

        // Get the number of flats in this residential zone, issue warning if invalid
        const numberOfFlats = parseInt(data.tags?.flats);
        if (isNaN(numberOfFlats) || numberOfFlats < 0) {
            console.warn('Invalid number of flats for residential zone', feature.type + '/' + feature.id);
            throw 'Invalid number of flats for residential zone';
        }

        // Find the land role features that overlap the zone, do not allow convex as zones in OSM can include other zones of different types
        const properties = feature.properties || {};
        const name = properties['name'] || null;
        const shortname = properties['@id'] || null;
        const description = properties.description || null;
        const internalId = properties.internal_id || null;

        // Create the residences from the land role data
        for (let j = 0; j < landRoleData.length; j++) {
            const landRoleBuilding = landRoleData[j];
            const nbResidences = landRoleBuilding.properties?.['building:flats'];
            for (let flatNb = 0; flatNb < nbResidences; flatNb++) {
                const uuid = uuidV4();
                const attributes = {
                    id: uuid,
                    data_source_id: dataSourceName,
                    internal_id: internalId,
                    shortname,
                    name,
                    description,
                    data: data.tags,
                    geography: landRoleBuilding.geometry
                };
                allHomes.push(attributes);
                countResidencesInZone++;
            }
        }
        // Issue a warning if the residence count and number of flats do not match
        if (numberOfFlats < countResidencesInZone) {
            mismatchCount = numberOfFlats - countResidencesInZone;
            console.log(
                'Error: Residence count in land role > osm data for residential zone %s: expected from osm zone data -> %d, obtained previously from osm buildings and land role: %d',
                data.type + '/' + data.id,
                numberOfFlats,
                countResidencesInZone
            );
        }
        if (numberOfFlats > countResidencesInZone) {
            mismatchCount = numberOfFlats - countResidencesInZone;
            // not a problem:
            //console.log("Error: Residence count in land role < osm data for residential zone %s: expected from osm zone data -> %d, obtained previously from osm buildings and land role: %d", data.type + '/' + data.id, numberOfFlats, countResidencesInZone);
        }

        return { residences: allHomes, mismatchCount };
    }

    /**
     * Get land role data for buildings that have a flat count
     */
    private async getResidentialLandRoleBuildings() {
        const landRoleData = this.landRole.query({});
        return landRoleData.filter((building) => building.properties?.['building:flats'] > 0);
    }

    private async getResidentialBuildingGeojsons(buildings): Promise<GeoJSON.Feature[]> {
        const residentialBuildingGeojson: GeoJSON.Feature[] = [];
        for (let i = 0; i < buildings.length; i++) {
            const geojson = this.osmPolygons.find({ id: buildings[i].type + '/' + buildings[i].id });
            if (!geojson) {
                console.error(
                    'A geojson has not been found for the OSM zone %s/%s. Maybe you have the wrong files?',
                    buildings[i].type,
                    buildings[i].id
                );
                throw 'Missing OSM geojson';
            }
            residentialBuildingGeojson[i] = geojson;
        }
        return residentialBuildingGeojson;
    }

    // FIXME: Too many parameters and return field, this should all be in a class: raw data, remaining data, etc.
    private async processZones(
        zones: { [key: string]: any }[],
        dataSourceName: string,
        lanRoleData: GeoJSON.Feature[],
        residentialBuildings: GeoJSON.Feature[],
        needBuildingMatch = false
    ): Promise<{
        residences: PlaceAttributes[];
        remainingLandRole: GeoJSON.Feature[];
        remainingBuildings: GeoJSON.Feature[];
    }> {
        console.log('=== Analyzing zones with flats... ===');
        let allResidences: PlaceAttributes[] = [];
        let residentialBuildingsGeojson = residentialBuildings;
        let landRoleNotProcessed = lanRoleData;
        for (let i = 0, countZones = zones.length; i < countZones; i++) {
            const zone = zones[i];
            const zoneGeojson = this.osmPolygons.find({ id: zone.type + '/' + zone.id });
            if (!zoneGeojson) {
                console.error(
                    'zone %s/%s | A geojson has not been found for the OSM zone %s/%s. Maybe you have the wrong files?',
                    i + 1,
                    countZones,
                    zone.type,
                    zone.id
                );
                continue;
            }
            // Get the buildings from osm and land role for this zone
            const landRoleSplit = splitOverlappingFeatures(zoneGeojson, lanRoleData);
            const overlappingBuildings = splitOverlappingFeatures(zoneGeojson, residentialBuildingsGeojson);
            residentialBuildingsGeojson = overlappingBuildings.notOverlapping;

            // First create homes from the OSM residential buildings, removing their corresponding entry in the land role
            const { residences, remainingLandRole } = await this.createHomesFromOsmBuildings(
                dataSourceName,
                overlappingBuildings.overlapping,
                landRoleSplit.overlapping
            );
            allResidences = allResidences.concat(residences);
            if (!needBuildingMatch) {
                // Second, create homes from the residential area data and land role
                const homesFromZones = await this.createHomesInResidentialAreas(
                    dataSourceName,
                    { raw: zone, geojson: zoneGeojson },
                    residences,
                    remainingLandRole
                );
                if (homesFromZones.mismatchCount < 0) {
                    console.error(
                        'zone %s/%s | There are more residences in land role than osm for zone %s/%s. Please verify your data',
                        i + 1,
                        countZones,
                        zone.type,
                        zone.id
                    );
                    continue;
                }
                // Lastly, create homes from the remaining land role buildings
                allResidences = allResidences.concat(homesFromZones.residences);
            }

            if (i === 0 || (i + 1) % 10 === 0 || i + 1 === countZones) {
                console.log(`=== zone ${i + 1}/${countZones} ===`);
            }

            landRoleNotProcessed = landRoleSplit.notOverlapping;
        }

        console.log('=== Completed analyzing zones with flats ===');
        return {
            residences: allResidences,
            remainingLandRole: landRoleNotProcessed,
            remainingBuildings: residentialBuildingsGeojson
        };
    }

    public async createResidentialDataSource(dataSourceName: string) {
        const allOsmResidentialBuildings = this.osmRawData.queryOr(queryResidentialBuildingsFromOsm);
        let residentialBuildingsGeojson = await this.getResidentialBuildingGeojsons(allOsmResidentialBuildings);
        residentialBuildingsGeojson.forEach((geojson, index) => {
            const properties = geojson.properties || {};
            properties.raw = allOsmResidentialBuildings[index];
            geojson.properties = properties;
        });

        const allLandRoleBuildingWithResidences = await this.getResidentialLandRoleBuildings();
        let landRoleNotProcessed = allLandRoleBuildingWithResidences;

        // First, look at the purely residential zones, to match all land role points and buildings
        const allOsmZones = this.osmRawData.query(queryResidentialZones);
        const residencesInResidentialZones = await this.processZones(
            allOsmZones,
            dataSourceName,
            landRoleNotProcessed,
            residentialBuildingsGeojson
        );
        let allResidences = residencesInResidentialZones.residences;
        landRoleNotProcessed = residencesInResidentialZones.remainingLandRole;
        residentialBuildingsGeojson = residencesInResidentialZones.remainingBuildings;

        // check other zones:
        const allOtherOsmZones = this.osmRawData.queryOr(queryZonesWithResidences);
        const residencesNotInResidentialZones = await this.processZones(
            allOtherOsmZones,
            dataSourceName,
            landRoleNotProcessed,
            residentialBuildingsGeojson,
            true
        );
        allResidences = allResidences.concat(residencesNotInResidentialZones.residences);

        return allResidences;
    }
}

// Import the residential zones data_source from osm data + land role

// For each polygon (way, relation), find geometry in the geojson file
// Look at included nodes for polygon, 1- find entrances and use them as a point 2- otherwise find a connected point, 3- otherwise, take the centroid

// For residential + commercial buildings, 2 places: one for commercial, one for the residential part

// Also prompt the land role, to make the match with the residential zones, so that in one pass, we can populate the complete tr_places datasource of residential data.

// Using land role, if a point is outside buffer of building (5m of the building boundaries)
