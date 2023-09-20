/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import _get from 'lodash/get';
import _uniq from 'lodash/uniq';
import { EventEmitter } from 'events';

import { ObjectWithHistory } from 'chaire-lib-common/lib/utils/objects/ObjectWithHistory';
import TransitPath, { PathDirection, PathAttributes } from '../path/Path';
import Schedule, { ScheduleAttributes, SchedulePeriodTrip } from '../schedules/Schedule';
import SaveUtils from 'chaire-lib-common/lib/services/objects/SaveUtils';
import Saveable from 'chaire-lib-common/lib/utils/objects/Saveable';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import lineModes, { LineMode } from '../../config/lineModes';
import { LineCategory } from '../../config/lineCategories';
import { GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import routingServiceManager from 'chaire-lib-common/lib/services/routing/RoutingServiceManager';
import { featureCollection as turfFeatureCollection } from '@turf/turf';
import { Route as GtfsRoute } from 'gtfs-types';
import * as Status from 'chaire-lib-common/lib/utils/Status';

const lineModesConfigByMode = {};
for (let i = 0, countI = lineModes.length; i < countI; i++) {
    const lineMode = lineModes[i];
    lineModesConfigByMode[lineMode.value] = lineMode;
}

export interface LineAttributes extends GenericAttributes {
    agency_id: string;
    mode: LineMode;
    path_ids: string[];
    /** Array of service IDs for which there are lines in the database. This
     * should be present in lines coming from a collection query, but the
     * schedulesByServiceId should be used for line objects */
    service_ids?: string[];
    category: LineCategory;
    allow_same_line_transfers: boolean;
    is_autonomous: boolean;
    longname: string;
    is_enabled?: boolean;
    data: {
        gtfs?: GtfsRoute;
        deadHeadTravelTimesBetweenPathsByPathId?: { [key: string]: { [key: string]: number } };
        numberOfVehicles?: number;
        [key: string]: any;
    };
    scheduleByServiceId: {
        [key: string]: ScheduleAttributes;
    };
}

/**
 * A transit line
 * Has one or more paths (specific sequence of stops)
 * Belongs to an agency
 */
export class Line extends ObjectWithHistory<LineAttributes> implements Saveable {
    protected static displayName = 'Line';
    private _collectionManager: any;
    private _paths: TransitPath[] = [];

    constructor(attributes = {}, isNew, collectionManager?) {
        super(attributes, isNew);

        this._collectionManager = collectionManager ? collectionManager : serviceLocator.collectionManager;

        this.refreshPaths();
    }

    _prepareAttributes(attributes: Partial<LineAttributes>) {
        if (!attributes.data) {
            attributes.data = {};
        }
        if (!attributes.scheduleByServiceId) {
            attributes.scheduleByServiceId = {};
        }
        if (!attributes.path_ids) {
            attributes.path_ids = [];
        }

        if (Preferences.current) {
            if (_isBlank(attributes.mode)) {
                attributes.mode = Preferences.current.transit.lines.defaultMode || null;
            }
            if (_isBlank(attributes.category)) {
                attributes.category = Preferences.current.transit.lines.defaultCategory || null;
            }
            if (_isBlank(attributes.is_autonomous)) {
                attributes.is_autonomous = Preferences.current.transit.lines.defaultIsAutonomous;
            }
            if (_isBlank(attributes.allow_same_line_transfers)) {
                attributes.allow_same_line_transfers = Preferences.current.transit.lines.defaultAllowSameLineTransfers;
            }
        }

        return super._prepareAttributes(attributes);
    }

    getClonedAttributes(deleteSpecifics = true): Partial<LineAttributes> {
        const newAttributes = super.getClonedAttributes(deleteSpecifics);
        delete newAttributes.data?.gtfs;
        if (deleteSpecifics) {
            newAttributes.scheduleByServiceId = {};
            const data: any = newAttributes.data || {};
            newAttributes.data = data;
            newAttributes.path_ids = [];
        }
        return newAttributes;
    }

    get collectionManager(): any {
        // TODO: test or use dependency injection
        return this._collectionManager;
    }

    getCompletePaths() {
        // a complete path is a path with a shape and at least 2 nodes
        const completePaths: TransitPath[] = [];
        this._paths.forEach((path) => {
            if (path.isComplete()) {
                completePaths.push(path);
            }
        });
        return completePaths;
    }

    get paths(): TransitPath[] {
        return this._paths;
    }

    refreshPaths() {
        this._paths = [];
        if (this._collectionManager && this._collectionManager.get('paths')) {
            for (let i = 0, count = this.attributes.path_ids.length; i < count; i++) {
                const pathGeojson = this._collectionManager.get('paths').getById(this.attributes.path_ids[i]);
                if (pathGeojson) {
                    // when saving cache on backend, the paths collection will be empty
                    const path = new TransitPath(pathGeojson.properties, false, this._collectionManager);
                    path.attributes.geography = pathGeojson.geometry;
                    this._paths.push(path);
                }
            }
        }
    }

    refreshStats() {
        // TODO Actually implement, the code below was in the old Line.js, but did effectively nothing
        /*
        this.paths = [];
        if (this._collectionManager.get('paths')) {
            for (let i = 0, count = this.attributes.path_ids.length; i < count; i++) {
                const pathGeojson = this._collectionManager.get('paths').getById(this.attributes.path_ids[i]);
                if (pathGeojson) // when saving cache on backend, the paths collection will be empty
                {
                    const path = new TransitPath(pathGeojson.properties, false, this._collectionManager);
                    // todo: aggregate path stats
                }
            }
        }
        */
    }

    async calculateDeadHeadTravelTimesBetweenPaths(socket) {
        this.refreshPaths();
        const completePaths = this.getCompletePaths();
        const deadHeadTravelTimesBetweenPathsByPathId = {};

        for (const path1 of completePaths) {
            const path1Id = path1.getId();

            if (!deadHeadTravelTimesBetweenPathsByPathId[path1Id]) {
                deadHeadTravelTimesBetweenPathsByPathId[path1Id] = {};
            }

            const routingsByPairsOfNodes = {};

            const routingMode =
                path1.getAttributes().data.routingMode ||
                Preferences.get('transit.paths.data.defaultRoutingMode', 'driving');
            const routingEngine =
                path1.getAttributes().data.routingEngine ||
                Preferences.get('transit.paths.data.defaultRoutingEngine', 'manual');

            const path1TerminalNodeId = path1.getAttributes().nodes[path1.countNodes() - 1];
            const path1TerminalGeojson: GeoJSON.Feature<GeoJSON.Point> = this._collectionManager
                .get('nodes')
                .getById(path1TerminalNodeId);

            if (!routingsByPairsOfNodes[path1TerminalNodeId]) {
                routingsByPairsOfNodes[path1TerminalNodeId] = {};
            }

            for (const path2 of completePaths) {
                const path2Id = path2.getId();
                if (routingEngine === 'engine') {
                    const path2TerminalNodeId = path2.getAttributes().nodes[0];
                    const path2TerminalGeojson: GeoJSON.Feature<GeoJSON.Point> = this._collectionManager
                        .get('nodes')
                        .getById(path2TerminalNodeId);

                    if (path2TerminalNodeId === path1TerminalNodeId) {
                        deadHeadTravelTimesBetweenPathsByPathId[path1Id][path2Id] = 0;
                    } else if (routingsByPairsOfNodes[path1TerminalNodeId][path2TerminalNodeId]) {
                        deadHeadTravelTimesBetweenPathsByPathId[path1Id][path2Id] =
                            routingsByPairsOfNodes[path1TerminalNodeId][path2TerminalNodeId];
                    } else {
                        const routingService = routingServiceManager.getRoutingServiceForEngine('engine');
                        const routingResult = await routingService.route({
                            mode: routingMode,
                            points: turfFeatureCollection([path1TerminalGeojson, path2TerminalGeojson]),
                            overview: 'full'
                        });

                        const travelTimeSeconds = _get(routingResult, 'routes[0].duration', null);

                        if (travelTimeSeconds === null) {
                            console.error(
                                `line ${this.toString()} has a deadHeadTravelTime that could not be found (path1: ${path1Id} > path2: ${path2Id}), we will use travel time of first `
                            );
                        }

                        deadHeadTravelTimesBetweenPathsByPathId[path1Id][path2Id] =
                            travelTimeSeconds !== null ? Math.ceil(travelTimeSeconds) : null;
                        routingsByPairsOfNodes[path1TerminalNodeId][path2TerminalNodeId] =
                            deadHeadTravelTimesBetweenPathsByPathId[path1Id][path2Id];
                    }
                } else {
                    // routing engine is not engine, setting to 0
                    deadHeadTravelTimesBetweenPathsByPathId[path1Id][path2Id] = 0;
                }
            }
        }

        this.attributes.data.deadHeadTravelTimesBetweenPathsByPathId = deadHeadTravelTimesBetweenPathsByPathId;
        return deadHeadTravelTimesBetweenPathsByPathId;
    }

    async calculateRequiredFleetForService(socket, serviceId) {
        await this.refreshSchedules(socket);
        await this.calculateDeadHeadTravelTimesBetweenPaths(socket);
        if (this.attributes.scheduleByServiceId && this.attributes.scheduleByServiceId[serviceId]) {
            const schedule = new Schedule(
                this.attributes.scheduleByServiceId[serviceId],
                false,
                this._collectionManager
            );
            const periods = schedule.getAttributes().periods;
            const trips: SchedulePeriodTrip[] = [];
            const number_of_units: number[] = [];
            for (let i = 0, countI = periods.length; i < countI; i++) {
                const period = periods[i];
                if (period.number_of_units) {
                    number_of_units.push(period.number_of_units);
                }
                const periodTrips = _get(period, 'trips', []);
                if (periodTrips.length > 0) {
                    for (let j = 0, countJ = periodTrips.length; j < countJ; j++) {
                        trips.push(periodTrips[j]);
                    }
                }
            }

            if (number_of_units.length === periods.length) {
                return Math.max(...number_of_units);
            } else {
                console.log(`line ${this.toString()} does not have number_of_units set in schedule`);
            }

            const firstPath = this._collectionManager.get('paths').getById(trips[0].path_id);

            // create first unit that goes on the first trip of the period:
            const units = [
                {
                    completedPathId: trips[0].path_id,
                    readyAtSeconds: trips[0].arrival_time_seconds + firstPath.properties.data.layoverTimeSeconds
                }
            ];

            // create all units required to complete all trips for the period:
            for (let j = 1, countJ = trips.length; j < countJ; j++) {
                const trip = trips[j];
                const path = this._collectionManager.get('paths').getById(trip.path_id);

                // here we set default deadHeadTime to 0
                // (happens when deadHeadTime could not be calculated),
                // but we should find sometime more realistic for unroutable dead head paths
                const tripDepartureTimeSeconds = trip.departure_time_seconds;
                let foundUnit = false;
                for (let k = 0, countK = units.length; k < countK; k++) {
                    const unit = units[k];
                    const deadHeadTime =
                        this.getAttributes().data.deathis.getData('deadHeadTravelTimesBetweenPathsByPathId')[
                            unit.completedPathId
                        ][trip.path_id] || 0;
                    if (unit.readyAtSeconds + deadHeadTime <= tripDepartureTimeSeconds) {
                        foundUnit = true;
                        unit.readyAtSeconds = trip.arrival_time_seconds + path.properties.data.layoverTimeSeconds;
                        unit.completedPathId = trip.path_id;
                        break;
                    }
                }

                if (!foundUnit) {
                    units.push({
                        completedPathId: trip.path_id,
                        readyAtSeconds: trip.arrival_time_seconds + path.properties.data.layoverTimeSeconds
                    });
                }
            }

            return units.length;
        } else {
            return null;
        }
    }

    isFrozen() {
        if (this.get('is_frozen') === true) {
            return true;
        } else {
            const agency = this.getAgency();
            if (agency && agency.get('is_frozen') === true) {
                return true;
            }
        }
        return false;
    }

    getSchedule(serviceId: string): Schedule {
        return new Schedule(this.attributes.scheduleByServiceId[serviceId], false, this._collectionManager);
    }

    getSchedules(): { [key: string]: Schedule } {
        const scheduleByServiceId = this.getAttributes().scheduleByServiceId;
        const scheduleObjectsByServiceId = {};
        for (const serviceId in scheduleByServiceId) {
            scheduleObjectsByServiceId[serviceId] = this.getSchedule(serviceId);
        }
        return scheduleObjectsByServiceId;
    }

    // return all the path ids that are used by any line schedule
    getScheduledPathIds() {
        const schedules = this.getSchedules();
        const scheduledPathIds: string[] = [];
        for (const serviceId in schedules) {
            const schedule = schedules[serviceId];
            const associatedPathIds = schedule.getAssociatedPathIds();
            for (let i = 0, countI = associatedPathIds.length; i < countI; i++) {
                scheduledPathIds.push(associatedPathIds[i]);
            }
        }
        return _uniq(scheduledPathIds);
    }

    // returns the service ids that have associated schedules and that uses the path id parameter
    getScheduleServiceIdsForPathId(pathId) {
        const schedules = this.getSchedules();
        const serviceIds: string[] = [];
        for (const serviceId in schedules) {
            const schedule = schedules[serviceId];
            const associatedPathIds = schedule.getAssociatedPathIds();
            if (associatedPathIds.includes(pathId)) {
                serviceIds.push(serviceId);
            }
        }
        return _uniq(serviceIds);
    }

    /**
     * Adds a schedule to the line. It won't save the schedule to the database.
     * @param schedule The schedule to add to this line
     */
    addSchedule(schedule: Schedule) {
        this.attributes.scheduleByServiceId[schedule.attributes.service_id] = schedule.attributes;
        this.updateSchedule(schedule);
    }

    /**
     * Remove a schedule from the line. It won't delete the schedule from the database.
     * @param serviceId The schedule to remove from this line
     */
    removeSchedule(serviceId: string) {
        delete this.attributes.scheduleByServiceId[serviceId];
    }

    // update all schedules that uses the path id
    async updateSchedulesForPathId(pathId: string, saveSchedules = false) {
        const associatedServiceIds = this.getScheduleServiceIdsForPathId(pathId);
        if (associatedServiceIds.length > 0) {
            await this.updateSchedules(associatedServiceIds, saveSchedules);
        }
    }

    // source: https://stackoverflow.com/a/41491220
    // default threshold of 0.179 is from W3C
    // TODO This is a general utility method, move somewhere that can be re-used
    getPreferredTextColorBasedOnLineColor(
        lightColor = '#ffffff',
        darkColor = '#000000',
        threshold = 0.179
    ): string | undefined {
        const lineColor = this.attributes.color;
        if (!lineColor) {
            return undefined;
        }
        const color = lineColor.charAt(0) === '#' ? lineColor.substring(1, 7) : lineColor;
        const r = parseInt(color.substring(0, 2), 16); // hexToR
        const g = parseInt(color.substring(2, 4), 16); // hexToG
        const b = parseInt(color.substring(4, 6), 16); // hexToB
        const uicolors = [r / 255, g / 255, b / 255];
        const c = uicolors.map((col) => {
            if (col <= 0.03928) {
                return col / 12.92;
            }
            return Math.pow((col + 0.055) / 1.055, 2.4);
        });
        const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
        return L > threshold ? darkColor : lightColor;
    }

    async updateSchedules(serviceIds: string[] = [], saveSchedules = false) {
        // update all services if serviceIds is empty
        const schedulesObjectsByServiceId = this.getSchedules();
        if (serviceIds.length === 0) {
            serviceIds = Object.keys(schedulesObjectsByServiceId);
        }
        const savePromises: Promise<unknown>[] = [];
        for (const serviceId in schedulesObjectsByServiceId) {
            if (serviceIds.includes(serviceId)) {
                const schedule = schedulesObjectsByServiceId[serviceId];
                schedule.updateForAllPeriods();
                if (saveSchedules) {
                    savePromises.push(schedule.save(serviceLocator.socketEventManager));
                }
                this.attributes.scheduleByServiceId[serviceId] = schedule.attributes;
            }
        }
        await Promise.all(savePromises);
    }

    // TODO This function does not seem to be called anywhere
    async generateSchedule(
        serviceId: string,
        numberOfVehicles = this.attributes.data.numberOfVehicles,
        periodsGroupShortname: string,
        periodShortname: string
    ) {
        if (serviceId && numberOfVehicles && numberOfVehicles > 0 && periodsGroupShortname && periodShortname) {
            const periodsGroups = Preferences.current.transit.periods;
            const periodsGroup = periodsGroups[periodsGroupShortname];
            const periodIndex = Schedule.getPeriodIndex(periodShortname, periodsGroup.periods);

            if (periodIndex === null) {
                return;
            }

            const lineId = this.get('id');

            const outboundPaths = this.getOutboundPaths();
            const inboundPaths = this.getInboundPaths();
            const loopPaths = this.getLoopPaths();

            if (outboundPaths.length === 0 && loopPaths.length === 0) {
                console.log('missing outbound or loop path for line', this.toString());
            }

            const outboundPath = outboundPaths[0] || loopPaths[0];
            const inboundPath = inboundPaths[0]; // could be null if loop

            const hasAtLeastOnePath = outboundPath || inboundPath;

            if (!hasAtLeastOnePath) {
                console.error('line has no valid path', lineId, this.toString());
            }

            const schedule = new Schedule(
                {
                    line_id: lineId,
                    service_id: serviceId,
                    periods_group_shortname: periodsGroupShortname,
                    periods: [
                        {
                            period_shortname: periodShortname,
                            start_at_hour: periodsGroup.periods[periodIndex].startAtHour,
                            end_at_hour: periodsGroup.periods[periodIndex].endAtHour,
                            number_of_units: numberOfVehicles,
                            interval_seconds: null,
                            outbound_path_id: outboundPath.getId(),
                            inbound_path_id: inboundPath ? inboundPath.getId() : null
                        }
                    ]
                },
                false,
                this._collectionManager
            );

            if (hasAtLeastOnePath) {
                const trips = await schedule.generateForPeriod(periodShortname);
                schedule.attributes.periods[0].trips = trips.trips;
                this.attributes.data.calculatedIntervalSeconds =
                    schedule.attributes.periods[0].calculated_interval_seconds;
                this.updateSchedule(schedule);
            }
        } else {
            return null;
        }
    }

    updateSchedule(schedule: Schedule) {
        // remove old serviceId if it was changed:
        for (const serviceId in this.attributes.scheduleByServiceId) {
            if (
                serviceId !== schedule.get('service_id') &&
                this.attributes.scheduleByServiceId[serviceId].id === schedule.get('id')
            ) {
                delete this.attributes.scheduleByServiceId[serviceId];
            }
        }
        // Update the service's scheduled lines
        const service = this._collectionManager?.get('services')?.getById(schedule.getAttributes().service_id);
        if (service) service.addScheduledLine(this.getId());

        const serviceId = schedule.getAttributes().service_id;
        const periods = schedule.getAttributes().periods;
        // remove old periodsGroup if it was changed:
        if (periods.length > 0) {
            const periodsGroups = Preferences.current.transit.periods;
            const periodsGroupShortname = schedule.getAttributes().periods_group_shortname || '';
            const periodsGroup = periodsGroups[periodsGroupShortname];
            const periodsShortnames = periodsGroup.periods.map((period) => {
                return period.shortname;
            });
            if (periods.length !== periodsShortnames.length) {
                schedule.attributes.periods = []; // reset periods if period shortnames length do not match periods length
            } else {
                for (let i = 0, count = periods.length; i < count; i++) {
                    const period = periods[i];
                    if (!periodsShortnames.includes(period.period_shortname)) {
                        schedule.attributes.periods = []; // reset periods if period shortnames do not match
                        break;
                    }
                }
            }
        }

        this.attributes.scheduleByServiceId[serviceId] = _cloneDeep(schedule.attributes);
        this._updateHistory();
    }

    /**
     * Create a new path for this line. It does not add the path to the line,
     * just create a new path and correctly sets the default values according to
     * the line's attributes.
     *
     * @return {*}  {TransitPath} The new path with all its default values set
     * @memberof Line
     */
    newPath(pathData: Partial<PathAttributes> = {}): TransitPath {
        return new TransitPath(
            Object.assign(
                {
                    line_id: this.getId(),
                    mode: this._attributes.mode,
                    color: this._attributes.color
                },
                pathData
            ),
            true,
            this._collectionManager
        );
    }

    private _getPathForDirection(direction: PathDirection): TransitPath[] {
        const paths: TransitPath[] = [];
        this._paths.forEach((path) => {
            if (path.getAttributes().direction === direction) {
                paths.push(path);
            }
        });
        return paths;
    }

    getOutboundPaths(): TransitPath[] {
        return this._getPathForDirection('outbound');
    }

    getLoopPaths(): TransitPath[] {
        return this._getPathForDirection('loop');
    }

    getInboundPaths(): TransitPath[] {
        return this._getPathForDirection('inbound');
    }

    getPaths(): TransitPath[] {
        return this._paths;
    }

    hasSchedule(serviceId: string) {
        return this.attributes.scheduleByServiceId[serviceId] !== undefined;
    }

    hasPaths() {
        return this.attributes.path_ids.length > 0;
    }

    validate() {
        super.validate();
        if (!this.getAttributes().agency_id) {
            this._isValid = false;
            this._errors.push('transit:transitLine:errors:AgencyIsRequired');
        }
        if (!this.getAttributes().shortname && !this.getAttributes().longname) {
            this._isValid = false;
            this._errors.push('transit:transitLine:errors:ShortnameOrLongnameIsRequired');
        }
        if (!this.getAttributes().mode) {
            this._isValid = false;
            this._errors.push('transit:transitLine:errors:ModeIsRequired');
        }
        return this.isValid;
    }

    // used in simulations to calculate initial needed number of vehicles
    //   can be used only with lines with two paths (one outbound, one inbound) or one path (loop)
    getTotalWeightXTravelTimeSeconds() {
        if (this._paths.length === 1) {
            const outboundPath = this._paths[0];
            const totalWeight = outboundPath.getTotalWeight();
            const cycleTimeSeconds = outboundPath.getAttributes().data.totalTravelTimeWithReturnBackSeconds;

            if (totalWeight && cycleTimeSeconds) {
                return totalWeight * cycleTimeSeconds;
            }
        } else if (this._paths.length === 2) {
            if (
                (this._paths[0].get('direction') === 'outbound' && this._paths[1].get('direction') === 'inbound') ||
                (this._paths[0].get('direction') === 'inbound' && this._paths[1].get('direction') === 'outbound')
            ) {
                const firstPath = this._paths[0];
                const secondPath = this._paths[1];
                const firstPathWeight = firstPath.getTotalWeight();
                const secondPathWeight = secondPath.getTotalWeight();
                const cycleTimeSeconds =
                    (firstPath.getAttributes().data.operatingTimeWithoutLayoverTimeSeconds || 0) +
                    (secondPath.getAttributes().data.operatingTimeWithoutLayoverTimeSeconds || 0);
                if (firstPathWeight && secondPathWeight && cycleTimeSeconds) {
                    return (firstPathWeight + secondPathWeight) * cycleTimeSeconds;
                }
            }
        }
        return null;
    }

    // TODO Cannot get an object of class Agency from Line, need to replace these calls
    getAgency() {
        if (this._collectionManager?.get('agencies')) {
            return this._collectionManager.get('agencies').getById(this.get('agency_id'));
        } else {
            return null;
        }
    }

    async refreshSchedules(socket: EventEmitter): Promise<void> {
        return new Promise((resolve, reject) => {
            socket.emit(
                'transitSchedules.getForLine',
                this.getId(),
                (response: Status.Status<ScheduleAttributes[]>) => {
                    try {
                        const schedules = Status.unwrap(response);
                        const schedulesByServiceId = {};
                        schedules.forEach(
                            (schedule) => (schedulesByServiceId[schedule.service_id as string] = schedule)
                        );
                        this.attributes.scheduleByServiceId = schedulesByServiceId;
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                }
            );
        });
    }

    toString(showId = false) {
        const shortname = this.getAttributes().shortname;
        const longname = this.getAttributes().longname;
        const baseName =
            shortname && longname ? `${shortname} ${longname}` : shortname ? shortname : longname ? longname : '';
        return showId ? (_isBlank(baseName) ? this.id : `${baseName} ${this.id}`) : baseName;
    }

    static symbol() {
        return 'L';
    }

    async delete(socket): Promise<Status.Status<{ id: string | undefined }>> {
        const agency = this.getAgency();
        const paths = this._paths;
        const response = await SaveUtils.delete(this, socket, 'transitLine', this._collectionManager?.get('lines'));
        // todo: delete cache too
        if (Status.isStatusOk(response)) {
            if (this._collectionManager?.get('paths')) {
                for (let i = 0, count = paths.length; i < count; i++) {
                    const path = paths[i];
                    this._collectionManager.get('paths').removeById(path.id);
                }
            }
            // TODO Line cannot access agency like this, it's the other way around, use a deleteListener instead
            if (agency) {
                agency.attributes.line_ids = agency.attributes.line_ids.filter((lineId) => {
                    return lineId !== this.getId();
                });
                agency.refreshLines();
            }
            this._paths = [];
        }
        return response;
    }

    async save(socket) {
        if (this.hasChanged() || this.isNew()) {
            const agency = this.getAgency();
            const paths = this._paths;
            const color = this.get('color');
            const mode = this.get('mode');
            await this.calculateDeadHeadTravelTimesBetweenPaths(socket);
            const response = await SaveUtils.save(this, socket, 'transitLine', this._collectionManager?.get('lines'));
            if (!response.error) {
                if (agency) {
                    // here we should also remove the line from an old agency (if changing agency)
                    if (!agency.attributes.line_ids.includes(this.id)) {
                        agency.attributes.line_ids.push(this.id);
                    }
                    agency.refreshLines();
                }
                if (this._collectionManager?.get('paths')) {
                    for (let i = 0, count = paths.length; i < count; i++) {
                        const path = paths[i];
                        const pathId = path.get('id');
                        path.set('color', color);
                        path.set('mode', mode);
                        const pathGeojson = this._collectionManager.get('paths').getById(pathId);
                        pathGeojson.properties.color = color;
                        pathGeojson.properties.mode = mode;
                    }
                }
            }
            return response;
        } else {
            return { id: this.id };
        }
    }

    saveToCache(socket) {
        return new Promise((resolve, reject) => {
            socket.emit('transitLine.saveCache', this.attributes, (response) => {
                if (!response.error) {
                    resolve(response);
                } else {
                    reject(response.error);
                }
            });
        });
    }

    deleteCache(socket) {
        return new Promise((resolve, reject) => {
            socket.emit(
                'transitLine.deleteCache',
                this.get('id'),
                _get(this.attributes, 'data.customCachePath'),
                (response) => {
                    if (!response.error) {
                        resolve(response);
                    } else {
                        reject(response.error);
                    }
                }
            );
        });
    }

    loadFromCache(socket) {
        return new Promise((resolve, reject) => {
            socket.emit(
                'transitLine.loadCache',
                this.get('id'),
                _get(this.attributes, 'data.customCachePath'),
                (response) => {
                    if (!response.error) {
                        //console.log(response);
                        resolve(response);
                    } else {
                        reject(response.error);
                    }
                }
            );
        });
    }

    saveInMemory() {
        SaveUtils.saveInMemory(this, this._collectionManager ? this._collectionManager.get('lines') : undefined);
    }

    deleteInMemory() {
        SaveUtils.deleteInMemory(this, this._collectionManager ? this._collectionManager.get('lines') : undefined);
    }

    static getPluralName() {
        return 'lines';
    }

    static getCapitalizedPluralName() {
        return 'Lines';
    }

    static getDisplayName() {
        return Line.displayName;
    }
}

export default Line;
