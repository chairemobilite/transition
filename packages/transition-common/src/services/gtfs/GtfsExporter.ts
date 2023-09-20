/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _get from 'lodash/get';
import _cloneDeep from 'lodash/cloneDeep';

import { GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import { ObjectWithHistory } from 'chaire-lib-common/lib/utils/objects/ObjectWithHistory';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { GtfsConstants } from '../../api/gtfs';
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';

export interface GtfsExporterAttributes extends GenericAttributes {
    selectedAgencies: string[];
    filename: string;
    isPrepared?: boolean;
    exportErrors?: ErrorMessage[];
    data: {
        zipFilePath?: string;
    };
}

/*type GtfsData = {
    agency: {[key: string]: any}[],
    routes: {[key: string]: any}[],
    calendar: {[key: string]: any}[],
    shapes: {[key: string]: any}[],
    //trips: {[key: string]: any}[],
    //stop_times: {[key: string]: any}[],
    stops: {[key: string]: any}[]
};*/

export default class GtfsExporter extends ObjectWithHistory<GtfsExporterAttributes> {
    constructor(attributes: GtfsExporterAttributes, isNew = false) {
        attributes.isPrepared = attributes.isPrepared || false;
        super(attributes, isNew);
    }

    public validate(): boolean {
        this._isValid = true;
        this.errors = [];
        if (_isBlank(this.get('selectedAgencies'))) {
            this._isValid = false;
            this.errors.push('transit:gtfs:errors:SelectedAgenciesMissing');
        }
        if (_isBlank(this.get('filename'))) {
            this._isValid = false;
            this.errors.push('transit:gtfs:errors:FilenameMissing');
        }
        return this._isValid;
    }

    prepare() {
        this.setIsPrepared(false);
        this.attributes.exportErrors = undefined;
        serviceLocator.socketEventManager.emit(GtfsConstants.GTFS_EXPORT_PREPARE, {
            gtfsExporterId: this.id,
            selectedAgencies: this.get('selectedAgencies'),
            filename: this.get('filename')
        });
        return;
    }

    public setIsPrepared(isPrepared: boolean) {
        this.set('isPrepared', isPrepared);
    }

    public isPrepared() {
        return this.get('isPrepared');
    }
}
