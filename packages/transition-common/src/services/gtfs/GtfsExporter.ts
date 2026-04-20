/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import { ObjectWithHistory } from 'chaire-lib-common/lib/utils/objects/ObjectWithHistory';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { GtfsConstants } from '../../api/gtfs';
import { TranslatableMessage } from 'chaire-lib-common/lib/utils/TranslatableMessage';

export interface GtfsExporterAttributes extends GenericAttributes {
    selectedAgencies: string[];
    selectedServices: string[];
    filename: string;
    isPrepared?: boolean;
    exportErrors?: TranslatableMessage[];
    includeTransitionCustomFields: boolean;
    data: {
        zipFilePath?: string;
    };
}

export default class GtfsExporter extends ObjectWithHistory<GtfsExporterAttributes> {
    constructor(attributes: GtfsExporterAttributes, isNew = false) {
        attributes.isPrepared = attributes.isPrepared || false;
        super(attributes, isNew);
    }

    protected _prepareAttributes(attributes: Partial<GtfsExporterAttributes>): GtfsExporterAttributes {
        const preparedAttributes = super._prepareAttributes(attributes);
        return {
            ...preparedAttributes,
            selectedAgencies: attributes.selectedAgencies || [],
            selectedServices: attributes.selectedServices || [],
            includeTransitionCustomFields: attributes.includeTransitionCustomFields ?? false
        };
    }

    public validate(): boolean {
        this._isValid = true;
        this.errors = [];
        if (_isBlank(this.get('selectedAgencies')) && _isBlank(this.get('selectedServices'))) {
            this._isValid = false;
            this.errors.push('transit:gtfs:errors:SelectedElementMissing');
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
            selectedServices: this.get('selectedServices'),
            includeTransitionCustomFields: this.get('includeTransitionCustomFields'),
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
