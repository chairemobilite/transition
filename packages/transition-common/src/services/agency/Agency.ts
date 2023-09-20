/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import { Agency as GtfsAgency } from 'gtfs-types';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import { ObjectWithHistory } from 'chaire-lib-common/lib/utils/objects/ObjectWithHistory';
// import TransitGarage from '../../../../../../src/models/transition/transit/Garage';
import SaveUtils from 'chaire-lib-common/lib/services/objects/SaveUtils';
import Saveable from 'chaire-lib-common/lib/utils/objects/Saveable';
import { GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Line from '../line/Line';
import LineCollection from '../line/LineCollection';
import { Path, PathAttributes } from '../path/Path';
import PathCollection from '../path/PathCollection';

/**
 * TODO tahini: the Agency class was copied from js. Need to: type the attributes, refactor some methods, take out of this class some algorithms
 */
export interface AgencyAttributes extends GenericAttributes {
    acronym: string;
    line_ids?: string[];
    unit_ids?: string[];
    garage_ids?: string[];
    simulation_id?: string;
    is_enabled?: true;
    data: {
        gtfs?: GtfsAgency;
    };
}

export interface AgencyGtfsAttributes {
    agency_id: string;
    agency_name: string;
    agency_url: string; // TODO: add validation and format for this field
    agency_timezone: string; // TODO: add validation and format for this field
    agency_lang: string; // TODO: add validation and format for this field
    agency_phone: string; // TODO: add validation and format for this field
    agency_fare_url: string; // TODO: add validation and format for this field
    agency_email: string; // TODO: add validation and format for this field
    tr_agency_uuid?: string;
    tr_agency_color?: string;
    tr_agency_desc?: string;
    tr_agency_internal_id?: string;
}

export class Agency extends ObjectWithHistory<AgencyAttributes> implements Saveable {
    protected static displayName = 'Agency';

    private lines: Line[] = [];
    private _collectionManager: any;
    // TODO Units and garages are unused for now
    private units: any[] = []; // TODO: replace by Unit type
    private garages: any[] = []; // TODO: replace by Garage type

    constructor(attributes = {}, isNew, collectionManager?) {
        super(attributes, isNew);

        // TODO Not all current code paths pass the collection manager, get it from the serviceLocator if not passed
        this._collectionManager = collectionManager ? collectionManager : serviceLocator.collectionManager;

        if (this._attributes.line_ids && this._attributes.line_ids.length > 0) {
            this.refreshLines();
        } else {
            this._attributes.line_ids = [];
            this.lines = [];
        }

        if (this._attributes.unit_ids && this._attributes.unit_ids.length > 0) {
            this.refreshUnits();
        } else {
            this._attributes.unit_ids = [];
            this.units = [];
        }

        if (this._attributes.garage_ids && this._attributes.garage_ids.length > 0) {
            this.refreshGarages();
        } else {
            this._attributes.garage_ids = [];
            this.garages = [];
        }
    }

    get collectionManager(): any {
        // TODO: test or use dependency injection
        return this._collectionManager;
    }

    getClonedAttributes(deleteSpecifics = true): Partial<AgencyAttributes> {
        const newAttributes = super.getClonedAttributes(deleteSpecifics);
        delete newAttributes.data?.gtfs;
        if (deleteSpecifics) {
            newAttributes.line_ids = [];
            newAttributes.unit_ids = [];
            newAttributes.garage_ids = [];
        }
        return newAttributes;
    }

    getSimulation() {
        // TODO: test
        if (this._collectionManager && this._collectionManager.get('simulations') && this.get('simulation_id')) {
            return this._collectionManager.get('simulations').getById(this.get('simulation_id'));
        } else {
            return null;
        }
    }

    hasLines() {
        return this._attributes.line_ids && this._attributes.line_ids.length > 0;
    }

    /**
     * Get the lines for this agency
     *
     * TODO Do we need the refresh, shouldn't the lines be automatically
     * populated when we have line_ids? Or just get them on demand from the ids?
     * @param refresh Whether to refresh the line array to match the line_ids
     * @returns An array of line attributes object (not Line objects)
     */
    getLines(refresh = false): Line[] {
        // TODO: test with collection manager
        if (refresh) {
            this.refreshLines();
        }
        return this.lines;
    }

    getLineIds(): string[] {
        const lines = this.getLines();
        return lines.length > 0
            ? lines.map((line) => {
                return line.getId();
            })
            : this._attributes.line_ids || [];
    }

    getLineCollection(): LineCollection {
        return new LineCollection(this.getLines(), {}, serviceLocator.eventManager);
    }

    getPathCollection(): PathCollection {
        return new PathCollection(this.getPathGeojsons(), {}, serviceLocator.eventManager);
    }

    getPaths(): Path[] {
        const lines = this.getLines();
        const paths: Path[] = [];
        for (let i = 0, countI = lines.length; i < countI; i++) {
            const linePaths = lines[i].getPaths();
            for (let j = 0, countJ = linePaths.length; j < countJ; j++) {
                paths.push(linePaths[j]);
            }
        }
        return paths;
    }

    getPathGeojsons(): GeoJSON.Feature<GeoJSON.LineString, PathAttributes>[] {
        const lines = this.getLines();
        const paths: GeoJSON.Feature<GeoJSON.LineString, PathAttributes>[] = [];
        for (let i = 0, countI = lines.length; i < countI; i++) {
            const linePaths = lines[i].getPaths();
            for (let j = 0, countJ = linePaths.length; j < countJ; j++) {
                paths.push(linePaths[j].toGeojson());
            }
        }
        return paths;
    }

    refreshLines() {
        // TODO: test with collection manager
        this.lines = [];
        if (this._collectionManager && this._collectionManager.get('lines') && this._attributes.line_ids) {
            for (let i = 0, count = this._attributes.line_ids.length; i < count; i++) {
                const line = this._collectionManager.get('lines').getById(this._attributes.line_ids[i]);
                if (line) {
                    // when saving cache on backend, the agency collection will be empty
                    this.lines.push(line);
                }
            }
        }
    }

    hasUnits() {
        return this._attributes.unit_ids && this._attributes.unit_ids.length > 0;
    }

    getUnits(refresh = false): any[] {
        // TODO: test with collection manager
        if (refresh) {
            this.refreshUnits();
        }
        return this.units;
    }

    getUnitIds(): any[] {
        const units = this.getUnits();
        return units.length > 0
            ? units.map((unit) => {
                return unit.get('id');
            })
            : this._attributes.unit_ids || [];
    }

    refreshUnits() {
        // TODO: test with collection manager
        this.units = [];
        if (this._collectionManager && this._collectionManager.get('units') && this._attributes.unit_ids) {
            for (let i = 0, count = this._attributes.unit_ids.length; i < count; i++) {
                const unit = this._collectionManager.get('units').getById(this._attributes.unit_ids[i]);
                if (unit) {
                    // when saving cache on backend, the unit collection will be empty
                    this.units.push(unit);
                }
            }
        }
    }

    hasGarages() {
        return this._attributes.garage_ids && this._attributes.garage_ids.length > 0;
    }

    getGarages() {
        // TODO: test with collection manager
        if (!this.garages) {
            this.refreshGarages();
        }
        return this.garages;
    }

    getGarageIds(): any[] {
        const garages = this.getGarages();
        return garages.length > 0
            ? garages.map((garage) => {
                return garage.get('id');
            })
            : this._attributes.garage_ids || [];
    }

    refreshGarages() {
        // TODO Support garages
        /*
        this.garages = [];
        if (this._collectionManager && this._collectionManager.get('garages') && this.attributes.garage_ids) {
            for (let i = 0, count = this.attributes.garage_ids.length; i < count; i++) {
                const garageGeojson = this._collectionManager.get('garages').getById(this.attributes.garage_ids[i]);
                if (garageGeojson)// when saving cache on backend, the garage collection will be empty
                {
                    const garage = new TransitGarage(garageGeojson.properties, false);
                    this.garages.push(garage);
                }
            }
        }
        */
    }

    validate(): boolean {
        this._isValid = true;
        this.errors = [];
        const acronym = this.get('acronym');
        if (!acronym) {
            // TODO: test with collectionManager (test for acronym unicity)
            this._isValid = false;
            this.errors.push('transit:transitAgency:errors:AcronymIsRequired');
        } else {
            const agencyCollection = this._collectionManager ? this._collectionManager.get('agencies') : null;
            if (agencyCollection && agencyCollection.size() > 0) {
                const agencies = agencyCollection.getFeatures();
                for (let i = 0, count = agencies.length; i < count; i++) {
                    const agencyAcronym = agencies[i].get('acronym');
                    const agencyId = agencies[i].getId();
                    if (agencyId !== this.id && agencyAcronym === acronym) {
                        this._isValid = false;
                        this.errors.push('transit:transitAgency:errors:AcronymMustBeUnique');
                    }
                }
            }
        }
        return this._isValid;
    }

    toString(showId = false): string {
        const acronym = this.get('acronym');
        const name = this.get('name');
        if (acronym && name) {
            return `${acronym} ${name}${showId ? ` ${this.getId()}` : ''}`;
        } else if (acronym) {
            return `${acronym}${showId ? ` ${this.getId()}` : ''}`;
        }
        return this.getId();
    }

    async delete(socket): Promise<Status.Status<{ id: string | undefined }>> {
        // TODO: test, needs collectionManager
        const lineIds = this.getLineIds();

        if (lineIds.length > 0) {
            const firstLine = this.getLines()[0];
            const customCachePath = firstLine ? firstLine.getData('customCachePath', null) : undefined;

            return new Promise((resolve, reject) => {
                socket.emit('transitLine.deleteMultipleCache', lineIds, customCachePath, (linesCacheDeleteResponse) => {
                    if (!linesCacheDeleteResponse.error) {
                        SaveUtils.delete(this, socket, 'transitAgency', this._collectionManager?.get('agencies')).then(
                            (agencyDeleteResponse: Status.Status<{ id: string | undefined }>) => {
                                resolve(agencyDeleteResponse);
                            }
                        );
                    } else {
                        resolve(linesCacheDeleteResponse);
                    }
                });
            });
        } else {
            return SaveUtils.delete(this, socket, 'transitAgency', this._collectionManager?.get('agencies'));
        }
    }

    async save(socket) {
        // TODO: test, needs collectionManager
        return SaveUtils.save(this, socket, 'transitAgency', this._collectionManager?.get('agencies'));
    }

    saveInMemory() {
        // TODO: test with collectionManager
        SaveUtils.saveInMemory(this, this._collectionManager ? this._collectionManager.get('agencies') : undefined);
    }

    deleteInMemory() {
        // TODO: test with collectionManager
        SaveUtils.deleteInMemory(this, this._collectionManager ? this._collectionManager.get('agencies') : undefined);
    }

    getPluralName() {
        return 'agencies'; // needed so we don't get agencys
    }

    getCapitalizedPluralName() {
        return 'Agencies'; // needed so we don't get Agencys
    }

    static getPluralName() {
        return 'agencies';
    }

    static getCapitalizedPluralName() {
        return 'Agencies';
    }

    static getDisplayName() {
        return Agency.displayName;
    }
}

export default Agency;
