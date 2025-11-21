/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';

import { GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import { ObjectWithHistory } from 'chaire-lib-common/lib/utils/objects/ObjectWithHistory';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { parseCsvFile } from 'chaire-lib-common/lib/utils/files/CsvFile';
import { TransitDemandFromCsvAttributes } from './types';

/**
 * Base attributes for any batch transit calculation, like routing or accessibility map
 */
export interface DemandCsvAttributes extends GenericAttributes, Partial<TransitDemandFromCsvAttributes> {
    /* Nothing else to add */
}

export abstract class TransitDemandFromCsv<T extends DemandCsvAttributes> extends ObjectWithHistory<T> {
    private _preferencesPath: string;

    constructor(attributes: Partial<T>, isNew = false, preferencesPath: string) {
        super(attributes, isNew);

        this._preferencesPath = preferencesPath;
    }

    validate(): boolean {
        this._isValid = true;
        this.errors = [];
        const attributes = this.attributes;
        if (attributes.csvFile) {
            if (_isBlank(attributes.idAttribute)) {
                this._isValid = false;
                this.errors.push('transit:transitRouting:errors:IdAttributeIsMissing');
            }
            if (_isBlank(attributes.timeAttributeDepartureOrArrival)) {
                this._isValid = false;
                this.errors.push('transit:transitRouting:errors:TimeAttributeDepartureOrArrivalIsMissing');
            }
            if (_isBlank(attributes.timeFormat)) {
                this._isValid = false;
                this.errors.push('transit:transitRouting:errors:TimeFormatIsMissing');
            }
            if (_isBlank(attributes.timeAttribute)) {
                this._isValid = false;
                this.errors.push('transit:transitRouting:errors:TimeAttributeIsMissing');
            }
        }

        return this._isValid;

        // TODO: add validations for all attributes fields
    }

    updateRoutingPrefs() {
        if (serviceLocator.socketEventManager) {
            const exportedAttributes: T = _cloneDeep(this._attributes);
            if (exportedAttributes.data && exportedAttributes.data.results) {
                delete exportedAttributes.data.results;
            }
            delete exportedAttributes.csvFile;
            Preferences.update(
                {
                    [this._preferencesPath]: exportedAttributes
                },
                serviceLocator.socketEventManager
            );
        }
    }

    setCsvFile = async (
        file: string | File | NodeJS.ReadableStream,
        fileLocation: { location: 'upload' } | { location: 'job'; jobId: number; fileKey: string; }
    ) => {
        let csvFileAttributes: string[] = [];
        this.attributes.csvFile =
            fileLocation.location === 'upload'
                ? { location: 'upload', filename: typeof file === 'string' ? file : (file as File).name }
                : fileLocation;
        await parseCsvFile(
            file,
            (data) => {
                csvFileAttributes = Object.keys(data);
                if (this.attributes.idAttribute && !csvFileAttributes.includes(this.attributes.idAttribute)) {
                    this.attributes.idAttribute = undefined;
                }
                if (this.attributes.timeAttribute && !csvFileAttributes.includes(this.attributes.timeAttribute)) {
                    this.attributes.timeAttribute = undefined;
                }
                this.onCsvFileAttributesUpdated(csvFileAttributes);
            },
            {
                header: true,
                nbRows: 1 // only get the header
            }
        );
        return csvFileAttributes;
    };

    /**
     * Method called when a file has been parsed. This can be overwritten to
     * validate the field names from the file
     *
     * @param _csvFields Field names from the CSV file (first row)
     */
    protected abstract onCsvFileAttributesUpdated: (_csvFields: string[]) => void;
}

export default TransitDemandFromCsv;
