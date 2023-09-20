/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import _get from 'lodash/get';
import _isEqual from 'lodash/isEqual';
import * as turf from '@turf/turf';
import * as GtfsTypes from 'gtfs-types';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import { GenericPlace, GenericPlaceAttributes } from 'chaire-lib-common/lib/utils/objects/GenericPlace';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import SaveUtils from 'chaire-lib-common/lib/services/objects/SaveUtils';
import Saveable from 'chaire-lib-common/lib/utils/objects/Saveable';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { metersToMapboxPixelsAtMaxZoom } from 'chaire-lib-common/lib/utils/geometry/ConversionUtils';
import { EventEmitter } from 'events';
import routingServiceManager from 'chaire-lib-common/lib/services/routing/RoutingServiceManager';
import { RoutingMode } from 'chaire-lib-common/lib/config/routingModes';
import {
    PlaceCategory,
    PlaceDetailedCategory
} from 'chaire-lib-common/lib/config/osm/osmMappingDetailedCategoryToCategory';

export interface TransferableNodes {
    nodesIds: string[];
    walkingTravelTimesSeconds: number[];
    walkingDistancesMeters: number[];
}

export interface AccessiblePlacesPerTravelTime {
    mode: RoutingMode; // default: walking
    placesByTravelTimeByCategory: {
        // key is time in minutes
        [key in PlaceCategory]: number[]; // values: array of places integer ids that are exactly [key] minutes from node
    }[];
    placesByTravelTimeByDetailedCategory: {
        // key is time in minutes
        [key in PlaceDetailedCategory]: number[]; // values: array of places integer ids that are exactly [key] minutes from node
    }[];
}
export interface AccessibleResidentialEntrancesPerTravelTime {
    mode: RoutingMode; // default: walking
    residentialEntrancesByTravelTime: number[][]; // index: travel time in minutes, value: array of residential_entrances integer ids that are exactly [key] minutes from node
}

/**
 * TODO tahini: the Node class was copied from js. Need to: refactor some methods, take out of this class some algorithms
 */
export interface NodeAttributes extends GenericPlaceAttributes {
    station_id?: string;
    code: string;
    name?: string;
    is_enabled?: boolean;
    routing_radius_meters: number;
    default_dwell_time_seconds: number;
    data: {
        transferableNodes?: TransferableNodes;
        accessiblePlaces?: { [key in RoutingMode]?: AccessiblePlacesPerTravelTime };
        accessibleResidentialEntrances?: { [key in RoutingMode]?: AccessibleResidentialEntrancesPerTravelTime };
        stops?: StopAttributes[];
        canBeUsedAsTerminal?: boolean;
        [key: string]: any;
    };
}

// TODO: Move the stops from the Node's data to its own object/data table
export interface StopAttributes extends GenericPlaceAttributes {
    code?: string;
    name?: string;
    data: {
        gtfs?: {
            stop_id: string;
            stop_code?: string;
            stop_name?: string;
            stop_desc?: string;
            zone_id?: string;
            location_type: GtfsTypes.LocationType;
            parent_station?: string;
        };
        // TODO Document weight and relativeWeight
        weight?: number;
        relativeWeight?: number;
        [key: string]: any;
    };
}

/**
 * A group of stop signs or platforms allowing direct connections between lines.
 * A node can be part of a station or not.
 * Can include stops (when designing precise network operations) or not (when planning or designing).
 */
export class Node extends GenericPlace<NodeAttributes> implements Saveable {
    protected static displayName = 'Node';

    constructor(attributes: Partial<NodeAttributes> = {}, isNew: boolean, collectionManager?) {
        super(attributes, isNew, collectionManager);

        this.updateHistoryCallback = this.updateRoutingRadiusInPixels;
        this.getRoutingRadiusPixelsAtMaxZoom();
    }

    _prepareAttributes(attributes: Partial<NodeAttributes>) {
        attributes.routing_radius_meters = _get(
            attributes,
            'routing_radius_meters',
            Preferences.get('transit.nodes.defaultRoutingRadiusMeters', 50)
        );
        attributes.default_dwell_time_seconds = _get(
            attributes,
            'default_dwell_time_seconds',
            Preferences.get('transit.nodes.defaultDwellTimeSeconds')
        );
        return super._prepareAttributes(attributes);
    }

    // TODO: Move out of this class
    hasPaths() {
        const paths = this._collectionManager?.get('paths').getFeatures() || [];
        const nodeId = this.get('id');
        const pathsCount = paths.length;
        for (let i = 0; i < pathsCount; i++) {
            const path = paths[i];
            if (path.properties.nodes.includes(nodeId)) {
                return true;
            }
        }
        return false;
    }

    // TODO: Move out of this class
    getPaths() {
        const paths = this._collectionManager?.get('paths').getFeatures() || [];
        const nodeId = this.get('id');
        const pathsCount = paths.length;
        const pathsUsingNode: any[] = [];
        for (let i = 0; i < pathsCount; i++) {
            const path = paths[i];
            if (path.properties.nodes.includes(nodeId)) {
                pathsUsingNode.push(path.get('id'));
            }
        }
        return pathsUsingNode;
    }

    getRoutingRadiusPixelsAtMaxZoom() {
        const latitude = this._attributes.geography.coordinates[1];
        if (latitude) {
            this._attributes.data.routingRadiusPixelsAtMaxZoom = metersToMapboxPixelsAtMaxZoom(
                this._attributes.routing_radius_meters,
                latitude
            );
        } else {
            this._attributes.data.routingRadiusPixelsAtMaxZoom = null;
        }
    }

    getRadiusPixelsAtMaxZoom(radius: number): number | null {
        const latitude = this._attributes.geography.coordinates[1];
        return metersToMapboxPixelsAtMaxZoom(radius, latitude);
    }

    toGeojson() {
        const _250mRadiusPixelsAtMaxZoom = this.getRadiusPixelsAtMaxZoom(250) || 1;

        return {
            id: this._attributes.integer_id,
            geometry: this._attributes.geography,
            type: 'Feature',
            properties: {
                ...this._attributes,
                _routingRadiusPixelsAtMaxZoom: this._attributes.data.routingRadiusPixelsAtMaxZoom,
                _250mRadiusPixelsAtMaxZoom: _250mRadiusPixelsAtMaxZoom,
                _500mRadiusPixelsAtMaxZoom: _250mRadiusPixelsAtMaxZoom * 2,
                _750mRadiusPixelsAtMaxZoom: _250mRadiusPixelsAtMaxZoom * 3,
                _1000mRadiusPixelsAtMaxZoom: _250mRadiusPixelsAtMaxZoom * 4
            }
            // TODO: we should filter out transferable nodes in data here
        } as GeoJSON.Feature<GeoJSON.Point, NodeAttributes>;
    }

    validate(nameIsRequired = Preferences.get('transit.nodes.nameIsRequired')) {
        this._isValid = true;
        this.errors = [];
        if (nameIsRequired && _isBlank(this._attributes.name)) {
            this._isValid = false;
            this.errors.push('transit:transitNode:errors:NameIsRequired');
        }
        const routingRadiusMeters = this._attributes.routing_radius_meters;
        if (isNaN(routingRadiusMeters) || routingRadiusMeters > 200 || routingRadiusMeters < 5) {
            this._isValid = false;
            this.errors.push('transit:transitNode:errors:RoutingRadiusMetersIsInvalid');
        }
        const dwellTimeSeconds = this._attributes.default_dwell_time_seconds;
        if (isNaN(dwellTimeSeconds) || dwellTimeSeconds < 0) {
            this._isValid = false;
            this.errors.push('transit:transitNode:errors:DefaultDwellTimeSecondsIsInvalid');
        }
        return this._isValid;
    }

    lat() {
        return this._attributes.geography.coordinates[1];
    }

    lon() {
        return this._attributes.geography.coordinates[0];
    }

    updateRoutingRadiusInPixels() {
        const routingRadius = this._attributes.routing_radius_meters;
        const geography = this._attributes.geography;
        const routingRadiusInPixels = metersToMapboxPixelsAtMaxZoom(routingRadius, geography.coordinates[1]);
        this._attributes.data.routingRadiusPixelsAtMaxZoom = routingRadiusInPixels;
        return routingRadiusInPixels;
    }

    calculateOdTripsWeight(dataSourceId) {
        // Nothing to do. Why?
    }

    private async getOsrmRoutingTableFrom(mode, allNodes): Promise<any> {
        const routingService = routingServiceManager.getRoutingServiceForEngine('engine');
        return await routingService.tableFrom({ mode, origin: this.toGeojson(), destinations: allNodes });
    }

    async travelTimesAndDistancesToAllNodes(mode = 'driving') {
        const allNodes = this._collectionManager?.get('nodes').getFeatures() || [];
        const resultsByNodeId = {};
        const routingResultJson = await this.getOsrmRoutingTableFrom(mode, allNodes);
        const durations = _get(routingResultJson, 'durations');
        const distances = _get(routingResultJson, 'distances');
        for (let i = 0, count = allNodes.length; i < count; i++) {
            const node = allNodes[i];
            const travelTimeSeconds = _get(durations, `[${i}]`, null);
            if (!_isBlank(travelTimeSeconds)) {
                const distanceMeters = _get(distances, `[${i}]`, null);
                resultsByNodeId[node.properties.id] = {
                    travelTimeSeconds,
                    distanceMeters
                };
            }
        }
        return resultsByNodeId;
    }

    async travelTimesAndDistancesFromAllNodes(mode: RoutingMode = 'driving') {
        const allNodes = this._collectionManager?.get('nodes').getFeatures() || [];
        const resultsByNodeId = {};
        // TODO: Replace with RoutingService function call, to not directly depend on OSRM
        const routingService = routingServiceManager.getRoutingServiceForEngine('engine');
        const routingResultJson = await routingService.tableTo({
            mode,
            origins: allNodes,
            destination: this.toGeojson()
        });
        const durations = _get(routingResultJson, 'durations');
        const distances = _get(routingResultJson, 'distances');
        for (let i = 0, count = allNodes.length; i < count; i++) {
            const node = allNodes[i];
            const travelTimeSeconds = _get(durations, `[${i}]`, null);
            if (!_isBlank(travelTimeSeconds)) {
                const distanceMeters = _get(distances, `[${i}]`, null);
                resultsByNodeId[node.properties.id] = {
                    travelTimeSeconds,
                    distanceMeters
                };
            }
        }
        return resultsByNodeId;
    }

    async getIsochroneGeojson(
        socket,
        mode = 'walking',
        durationsMinutes = [5, 10, 15, 20]
    ): Promise<{ [key: string]: any }> {
        return {};
        /* TODO Disabled since valhalla is broken
	const points = [this.toGeojson()];
    const params = {
      points,
      times : durationsMinutes,
      mode
    };
    return new Promise(function(resolve, reject) {
      if (!socket) {
        valhallaService.isochrone(params).then(function(response) {
          if (!response.error)
          {
            resolve(response);
          }
          else
          {
            reject(response.error);
          }
        }).catch(function(error) {
          console.error(error);
        });
      }
      else
      {
        socket.emit('service.valhallaRouting.isochrone', params, function(response) {
          if (!response.error)
          {
            resolve(response);
          }
          else
          {
            reject(response.error);
          }
        });
      }
    }.bind(this));*/
    }

    toString(showId = true) {
        const name = this.get('name');
        const code = this.get('code');
        if (name && code) {
            return `${name} [${code}]`;
        } else if (name) {
            return name;
        } else if (code) {
            return code;
        }
        return showId ? this._attributes.id : null;
    }

    countStops() {
        return (this.attributes.data.stops || []).length;
    }

    getStopsGeojson() {
        const stopsData = this.attributes.data.stops || [];
        const stopsGeojson: GeoJSON.Feature[] = [];
        for (let i = 0, count = stopsData.length; i < count; i++) {
            const stop = stopsData[i];
            const geojson = stop ? stop.geography : null;
            if (geojson) {
                stopsGeojson.push({
                    id: i + 1,
                    geometry: geojson,
                    type: 'Feature',
                    properties: Object.assign({}, stop)
                });
            }
        }
        return stopsGeojson;
    }

    private updateRadiusFromStops() {
        const stopsData = this.attributes.data.stops || [];
        const maxStopDistance = stopsData.reduce(
            (maxDistance, stopData) =>
                Math.max(
                    maxDistance,
                    turf.distance(this.getAttributes().geography, stopData.geography, { units: 'meters' })
                ),
            0
        );
        this.attributes.routing_radius_meters = Math.max(
            Math.ceil(maxStopDistance),
            this.attributes.routing_radius_meters
        );
        this._updateHistory();
    }

    addStop(stopAttributes: StopAttributes, options: { updateCentroid?: boolean } = {}) {
        this.updateStop(stopAttributes, options);
    }

    updateStop(stopAttributes: StopAttributes, options: { updateCentroid?: boolean } = {}) {
        const stopsData = this.attributes.data.stops || [];
        const newStopId = stopAttributes.id;
        const gtfsStopId = stopAttributes.data.gtfs?.stop_id;
        const existingStopIndex = stopsData.findIndex(
            (stopData) =>
                (stopData.id && stopData.id === newStopId) ||
                (_isEqual(stopData.geography, stopAttributes.geography) &&
                    stopData.code === stopAttributes.code &&
                    stopData.name === stopAttributes.name &&
                    stopData.data?.gtfs?.stop_id === gtfsStopId)
        );
        if (existingStopIndex >= 0) {
            stopsData[existingStopIndex] = stopAttributes;
        } else {
            stopsData.push(stopAttributes);
            this.attributes.data.stops = stopsData;
        }
        if (options.updateCentroid === true) {
            this.updateCentroidFromStops();
        }
        this.updateRadiusFromStops();
        return newStopId;
    }

    getStop(stopId: string): StopAttributes | undefined {
        const stopsData = this.attributes.data.stops || [];
        return stopsData.find((stop) => stop.id === stopId);
    }

    removeStop(stopId: string) {
        const stopsData = this.attributes.data.stops || [];
        let deleteStopIndex: number | null = null;
        for (let i = 0, count = stopsData.length; i < count; i++) {
            if (stopsData[i].id === stopId) {
                deleteStopIndex = i;
                break;
            }
        }
        if (deleteStopIndex !== null && deleteStopIndex >= 0) {
            stopsData.splice(deleteStopIndex, 1);
            this.setData('stops', stopsData);
            return stopId;
        } else {
            return null;
        }
    }

    private updateCentroidFromStops() {
        const stopsData = this.attributes.data.stops || [];
        if (stopsData.length > 1) {
            const stopsFeatures: GeoJSON.Feature[] = [];
            for (let i = 0, count = stopsData.length; i < count; i++) {
                const stop = stopsData[i];
                const geometry = stop.geography;
                if (geometry && geometry.coordinates) {
                    stopsFeatures.push({
                        type: 'Feature',
                        geometry: geometry,
                        properties: {}
                    });
                }
            }
            if (stopsFeatures.length > 1) {
                const featureCollection = {
                    type: 'FeatureCollection' as const,
                    features: stopsFeatures
                } as turf.AllGeoJSON;
                const centroid = turf.center(featureCollection);
                this.set('geography', centroid.geometry);
            }
        }
    }

    static fromGeojson(geojsonFeature, isNew = false, collectionManager?) {
        const node = new Node(
            { ...geojsonFeature.properties, geography: geojsonFeature.geometry },
            isNew,
            collectionManager
        );
        node.getRoutingRadiusPixelsAtMaxZoom();
        return node;
    }

    static symbol() {
        return 'q';
    }

    async delete(socket: EventEmitter): Promise<Status.Status<{ id: string | undefined }>> {
        return new Promise((resolve, reject) => {
            SaveUtils.delete(this, socket, 'transitNode', this._collectionManager?.get('nodes')).then(
                (response: Status.Status<{ id: string | undefined }>) => {
                    if (
                        Status.isStatusOk(response) &&
                        Status.unwrap(response).id !== undefined &&
                        this._collectionManager?.get('nodes')
                    ) {
                        this._collectionManager?.get('nodes').updateSpatialIndex();
                    }
                    resolve(response);
                }
            );
        });
    }

    public async save(socket: EventEmitter) {
        if (this.hasChanged() || this.isNew()) {
            try {
                const geography = this._attributes.geography;

                // TODO Keeping this for now, as it works and changing may have side effects, but the Node should not know about its collection. It's not its responsibility to do this. It could be a save callback though.
                if (this._collectionManager?.get('nodes')) {
                    const nodeGeojson = this._collectionManager?.get('nodes').getById(this._attributes.id);
                    if (nodeGeojson) {
                        const oldLat = nodeGeojson.geometry.coordinates[1];
                        const oldLon = nodeGeojson.geometry.coordinates[0];
                        const newLat = geography.coordinates[1];
                        const newLon = geography.coordinates[0];

                        if (newLat !== oldLat || newLon !== oldLon) {
                            nodeGeojson.geometry = geography;
                            this._collectionManager?.get('nodes').updateSpatialIndex();
                        }
                    }
                }
                this.updateRoutingRadiusInPixels();

                const response = await SaveUtils.save(
                    this,
                    socket,
                    'transitNode',
                    this._collectionManager?.get('nodes')
                );
                //resolve(response);
                /* console.log('saving cache for node', this.id); // we keep this second save for now, wo we can send the new integer id (node idx) to cache manager: */
                await this.saveToCache(socket);
                return response;
            } catch (error) {
                if (TrError.isTrError(error)) {
                    return error.export();
                }
                const trError = new TrError(
                    `cannot fetch nodes in radius because of an error: ${error}`,
                    'N0001',
                    'NodesInRadiusCouldNotBeFetchedBecauseError'
                );
                console.error(error);
                return trError.export();
            }
        } else {
            return { id: this._attributes.id };
        }
    }

    saveInMemory() {
        SaveUtils.saveInMemory(this, this._collectionManager?.get('nodes'));
    }

    deleteInMemory() {
        SaveUtils.deleteInMemory(this, this._collectionManager?.get('nodes'));
    }

    saveToCache(socket: EventEmitter) {
        return new Promise((resolve, reject) => {
            socket.emit('transitNode.saveCache', this._attributes, (response) => {
                if (!response.error) {
                    resolve(response);
                } else {
                    reject(response.error);
                }
            });
        });
    }

    loadFromCache(socket: EventEmitter) {
        return new Promise((resolve, reject) => {
            socket.emit(
                'transitNode.loadCache',
                this.get('id'),
                _get(this._attributes, 'data.customCachePath'),
                (response) => {
                    if (!response.error) {
                        //console.log(response);
                        // we need to use set to trigger history change before setting to edit:
                        if (response && response.node && response.node.data) {
                            if (response.node.data.transferableNodes) {
                                this._attributes.data.transferableNodes = response.node.data.transferableNodes;
                            }
                            if (response.node.data.accessiblePlaces) {
                                this._attributes.data.accessiblePlaces = response.node.data.accessiblePlaces;
                            }
                            if (response.node.data.accessibleResidentialEntrances) {
                                this._attributes.data.accessibleResidentialEntrances =
                                    response.node.data.accessibleResidentialEntrances;
                            }
                        }
                        response.node = this;
                        resolve(response);
                    } else {
                        reject(response.error);
                    }
                }
            );
        });
    }

    static getPluralName() {
        return 'nodes';
    }

    static getCapitalizedPluralName() {
        return 'Nodes';
    }

    static getDisplayName() {
        return Node.displayName;
    }
}

export default Node;
