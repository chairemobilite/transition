/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _chunk from 'lodash/chunk';
import moment from 'moment';
import { EventEmitter } from 'events';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import { ObjectWithHistory } from 'chaire-lib-common/lib/utils/objects/ObjectWithHistory';
// import TransitGarage from '../../../../../../src/models/transition/transit/Garage';
import SaveUtils from 'chaire-lib-common/lib/services/objects/SaveUtils';
import Saveable from 'chaire-lib-common/lib/utils/objects/Saveable';
import { GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Line from '../line/Line';

export const serviceDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export interface ServiceAttributes extends GenericAttributes {
    monday?: boolean;
    tuesday?: boolean;
    wednesday?: boolean;
    thursday?: boolean;
    friday?: boolean;
    saturday?: boolean;
    sunday?: boolean;
    start_date: string; // TODO: change to Date type
    end_date: string; // TODO: change to Date type
    only_dates?: string[]; // TODO: change to Date type
    except_dates?: string[]; // TODO: change to Date type
    simulation_id?: string;
    is_enabled?: boolean;
    data: {
        gtfs?: {
            service_id: string;
        };
        [key: string]: any;
    };
    scheduled_lines: string[];
}

class Service extends ObjectWithHistory<ServiceAttributes> implements Saveable {
    protected static displayName = 'Service';
    private _collectionManager: any;

    constructor(attributes = {}, isNew, collectionManager?) {
        super(attributes, isNew);

        this._collectionManager = collectionManager ? collectionManager : serviceLocator.collectionManager;
    }

    _prepareAttributes(attributes: Partial<ServiceAttributes>) {
        if (attributes.scheduled_lines === undefined) {
            attributes.scheduled_lines = [];
        }

        return super._prepareAttributes(attributes);
    }

    getClonedAttributes(deleteSpecifics = true): Partial<ServiceAttributes> {
        const newAttributes = super.getClonedAttributes(deleteSpecifics);
        delete newAttributes.data?.gtfs;
        return newAttributes;
    }

    get collectionManager(): any {
        // TODO: test or use dependency injection
        return this._collectionManager;
    }

    validate() {
        this._isValid = true;
        this._errors = [];
        if (!this.get('name')) {
            this._isValid = false;
            this._errors.push('transit:transitService:errors:NameIsRequired');
        } else {
            // See if this service name already exists
            const services = this._collectionManager?.get('services');
            if (
                services &&
                services.features.find(
                    (serv: Service) => serv.attributes.name === this.attributes.name && serv.getId() !== this.getId()
                )
            ) {
                this._isValid = false;
                this._errors.push('transit:transitService:errors:NameAlreadyExists');
            }
        }
        if (!this.get('start_date')) {
            this._isValid = false;
            this._errors.push('transit:transitService:errors:StartDateIsRequired');
        }
        if (!this.get('end_date')) {
            this._isValid = false;
            this._errors.push('transit:transitService:errors:EndDateIsRequired');
        }
        // TODO: check that start_date is before or equal to end_date (calendar range form input should validate this already, but we may get data from elsewhere)
        // TODO: check if at least one day is checked:
        /*for (let i = 0, count = serviceDays.length; i < count; i++) {
            const day = serviceDays[i];
            if (_isBlank(this.get(day))) { // incorrect, we need to loop then check if at least one is true: valid, otherwise, invalid
                this.isValid = false;
                this.errors.push('transit:transitService:errors:NameIsRequired');
                break;
            }
        }*/
        return this._isValid;
    }

    getSimulation() {
        // TODO: test
        if (this._collectionManager.get('simulations') && this.get('simulation_id')) {
            return this._collectionManager.get('simulations').getById(this.get('simulation_id'));
        } else {
            return null;
        }
    }

    scheduledLineIds(): string[] {
        return this.attributes.scheduled_lines;
    }

    hasScheduledLines() {
        return this.attributes.scheduled_lines.length > 0;
    }

    addScheduledLine(lineId: string) {
        if (!this.attributes.scheduled_lines.includes(lineId)) {
            this.attributes.scheduled_lines.push(lineId);
        }
    }

    removeScheduledLine(lineId: string) {
        const index = this.attributes.scheduled_lines.indexOf(lineId);
        if (index >= 0) {
            this.attributes.scheduled_lines.splice(index, 1);
        }
    }

    refreshStats(socket) {
        // TODO: test
        this.calculateRequiredFleets(socket);
    }

    async calculateRequiredFleets(socket) {
        // TODO: test
        if (this._collectionManager && this._collectionManager.get('lines')) {
            //const requiredFleetByLine = {};
            let totalRequiredFleet = 0;
            const lines = this._collectionManager.get('lines').getFeatures() as Line[];
            const batchSize = 10;
            const chunks = _chunk(lines, batchSize);

            for (let i = 0, countI = chunks.length; i < countI; i++) {
                console.log(`calculating required fleets batch ${i}/${batchSize}`);
                const chunkLines = chunks[i];
                for (let j = 0, countJ = chunkLines.length; j < countJ; j++) {
                    const line = chunkLines[j];
                    // TODO Make sure calculateRequiredFleetForService does not return null
                    totalRequiredFleet += (await line.calculateRequiredFleetForService(socket, this.get('id'))) || 0;
                }
            }

            return totalRequiredFleet;
        } else {
            return null;
        }
    }

    /**
     * Return whether a service is valid for a given date, looking at both the
     * range and the only/except dates.
     *
     * @param {Date} date Date at which to check the validity
     * @param {Date} [end] Optionally specify an end date to see if the
     * service is valid at least a day between the date and endDate
     * @memberof Service
     */
    isValidForDate(date: Date, end?: Date) {
        const rangeStart = moment(date);
        const rangeEnd = end ? moment(end) : moment(date);
        const startDate = moment(this._attributes.start_date);
        const endDate = moment(this._attributes.end_date);

        // Not in range
        if (startDate > rangeEnd || endDate < rangeStart) {
            return false;
        }

        // If no end specified, see if there's a exception for that date and the day of week is valid
        if (!end) {
            const exceptDates = this._attributes.except_dates || [];
            if (
                exceptDates.length > 0 &&
                exceptDates.find((date) => {
                    const exceptDate = moment(date);
                    return exceptDate.isSame(rangeStart);
                }) !== undefined
            ) {
                return false;
            }
        }

        // See if the service days correspond to the range
        const dowStart = rangeStart.day();
        const daysDiff = Math.min(6, rangeEnd.diff(rangeStart, 'days'));
        const hasServiceDays = (dowStart: number, daysDiff: number) => {
            for (let dow = dowStart; dow <= dowStart + daysDiff; dow++) {
                // 0 is sunday, here's it's monday
                const serviceDayIndex = dow % 7 === 0 ? 6 : (dow % 7) - 1;
                if (this._attributes[serviceDays[serviceDayIndex]] === true) {
                    return true;
                }
            }
            return false;
        };
        const serviceInRange = hasServiceDays(dowStart, daysDiff);

        // If there are only dates, make sure some are valid
        const onlyDates = this._attributes.only_dates || [];
        const onlyDateInRange =
            onlyDates.length > 0
                ? onlyDates.find((date) => {
                    const onlyDate = moment(date);
                    return onlyDate >= rangeStart && onlyDate <= rangeEnd;
                })
                : undefined;

        return onlyDateInRange !== undefined || serviceInRange;
    }

    toString(showId = false) {
        const name = this.get('name');
        if (name) {
            return name + (showId ? ` ${this.getId()}` : '');
        }
        return this.getId();
    }

    /**
     * Delete the service from the database
     *
     * @param {EventEmitter} socket The socket on which to send the delete
     * events
     */
    async delete(socket: EventEmitter): Promise<Status.Status<{ id: string | undefined }>> {
        return new Promise((resolve) => {
            SaveUtils.delete(this, socket, 'transitService', this._collectionManager?.get('services')).then(
                (ret: Status.Status<{ id: string | undefined }>) => {
                    if (this.attributes.scheduled_lines.length > 0) {
                        socket.emit('cache.saveLines', this.attributes.scheduled_lines, () => {
                            if (this._collectionManager) {
                                this._collectionManager
                                    .get('lines')
                                    .loadFromServer(serviceLocator.socketEventManager, this._collectionManager)
                                    .then(() => {
                                        this._collectionManager.refresh('lines');
                                        resolve(ret);
                                    });
                            } else {
                                resolve(ret);
                            }
                        });
                    } else {
                        resolve(ret);
                    }
                }
            );
        });
    }

    /**
     * Save the service to the database
     *
     * @param {EventEmitter} socket The socket on which to send the delete
     * events
     */
    async save(socket: EventEmitter) {
        return SaveUtils.save(this, socket, 'transitService', this._collectionManager?.get('services'));
    }

    saveInMemory() {
        SaveUtils.saveInMemory(this, this._collectionManager ? this._collectionManager?.get('services') : undefined);
    }

    deleteInMemory() {
        SaveUtils.deleteInMemory(this, this._collectionManager ? this._collectionManager?.get('services') : undefined);
    }

    static getPluralName() {
        return 'services';
    }

    static getCapitalizedPluralName() {
        return 'Services';
    }

    static getDisplayName() {
        return Service.displayName;
    }
}

export default Service;
