/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { validate as uuidValidate } from 'uuid';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import EventManager from 'chaire-lib-common/lib/services/events/EventManager';
import { MapFilterLayerEventType } from 'chaire-lib-frontend/lib/services/map/events/MapEventsCallbacks';

class TransitPathFilterManager {
    private _layerName = 'transitPaths';
    private _hiddenAgencyIds = new Map();
    private _hiddenLineIds = new Map();

    constructor() {
        this.updateFromPreferences();
    }

    updateFromPreferences() {
        const hiddenAgencyIds = Preferences.get('map.layers.hiddenAgencyIds', []);
        const hiddenLineIds = Preferences.get('map.layers.hiddenLineIds', []);
        for (let i = 0, countI = hiddenAgencyIds.length; i < countI; i++) {
            if (uuidValidate(hiddenAgencyIds[i])) {
                this._hiddenAgencyIds.set(hiddenAgencyIds[i], true);
            }
        }
        for (let i = 0, countI = hiddenLineIds.length; i < countI; i++) {
            if (uuidValidate(hiddenLineIds[i])) {
                this._hiddenLineIds.set(hiddenLineIds[i], true);
            }
        }
    }

    agencyIsVisible(agencyId: string) {
        return !this.agencyIsHidden(agencyId);
    }

    agencyIsHidden(agencyId: string) {
        return this._hiddenAgencyIds.has(agencyId);
    }

    lineIsVisible(lineId: string) {
        return !this.lineIsHidden(lineId);
    }

    lineIsHidden(lineId: string) {
        return this._hiddenLineIds.has(lineId);
    }

    showAgencyId(agencyId: string) {
        if (uuidValidate(agencyId) && this._hiddenAgencyIds.has(agencyId)) {
            this._hiddenAgencyIds.delete(agencyId);
            this.showAllLinesForAgency(agencyId);
        }
    }

    showAllAgencies() {
        if (serviceLocator.collectionManager.has('agencies')) {
            this._hiddenAgencyIds.clear();
            const agencies = serviceLocator.collectionManager.get('agencies').getFeatures();
            for (let i = 0, countI = agencies.length; i < countI; i++) {
                const agencyId = agencies[i].get('id');
                this.showAllLinesForAgency(agencyId, false);
            }
            this.updateFilter();
        }
    }

    hideAgencyId(agencyId: string) {
        if (uuidValidate(agencyId) && !this._hiddenAgencyIds.has(agencyId)) {
            this._hiddenAgencyIds.set(agencyId, true);
            this.hideAllLinesForAgency(agencyId);
        }
    }

    hideAllAgencies() {
        if (serviceLocator.collectionManager.has('agencies')) {
            this._hiddenAgencyIds.clear();
            const agencies = serviceLocator.collectionManager.get('agencies').getFeatures();
            for (let i = 0, countI = agencies.length; i < countI; i++) {
                const agencyId = agencies[i].get('id');
                this._hiddenAgencyIds.set(agencyId, true);
                this.hideAllLinesForAgency(agencyId, false);
            }
            this.updateFilter();
        }
    }

    showLineId(lineId: string) {
        if (uuidValidate(lineId)) {
            this._hiddenLineIds.delete(lineId);
            this.updateFilter();
        }
    }

    showAllLinesForAgency(agencyId: string, updateFilter = true) {
        if (serviceLocator.collectionManager.has('agencies')) {
            const agency = serviceLocator.collectionManager.get('agencies').getById(agencyId);
            if (agency) {
                const lineIds = agency.get('line_ids', []);
                lineIds.forEach((lineId: string) => {
                    if (uuidValidate(lineId)) {
                        this._hiddenLineIds.delete(lineId);
                    }
                });
            }
            if (updateFilter) {
                this.updateFilter();
            }
        }
    }

    hideLineId(lineId: string) {
        if (uuidValidate(lineId) && !this._hiddenLineIds.has(lineId)) {
            this._hiddenLineIds.set(lineId, true);
            this.updateFilter();
        }
    }

    hideAllLinesForAgency(agencyId: string, updateFilter = true) {
        if (serviceLocator.collectionManager.has('agencies')) {
            const agency = serviceLocator.collectionManager.get('agencies').getById(agencyId);
            if (agency) {
                const lineIds = agency.get('line_ids', []);
                lineIds.forEach((lineId: string) => {
                    if (uuidValidate(lineId)) {
                        this._hiddenLineIds.set(lineId, true);
                    }
                });
            }
            if (updateFilter) {
                this.updateFilter();
            }
        }
    }

    clearFilter() {
        this._hiddenAgencyIds.clear();
        this._hiddenLineIds.clear();
        this.updateFilter();
    }

    updateFilter() {
        const hiddenAgencyIds: string[] = [];
        const hiddenLineIds: string[] = [];

        this._hiddenAgencyIds.forEach((isHidden: boolean, hiddenAgencyId: string) => {
            if (isHidden === true && uuidValidate(hiddenAgencyId)) {
                hiddenAgencyIds.push(hiddenAgencyId);
            }
        });
        this._hiddenLineIds.forEach((isHidden: boolean, hiddenLineId: string) => {
            if (isHidden === true && uuidValidate(hiddenLineId)) {
                hiddenLineIds.push(hiddenLineId);
            }
        });
        (serviceLocator.eventManager as EventManager).emitEvent<MapFilterLayerEventType>('map.layers.updateFilter', {
            layerName: this._layerName,
            filter:
                this._hiddenLineIds.size === 0
                    ? undefined
                    : (feature) => (this._hiddenLineIds.get(feature.properties?.line_id) === true ? 0 : 1)
        });
        Preferences.update(
            {
                'map.layers.hiddenAgencyIds': hiddenAgencyIds,
                'map.layers.hiddenLineIds': hiddenLineIds
            },
            serviceLocator.socketEventManager
        );
    }
}

export default TransitPathFilterManager;
