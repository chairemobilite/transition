/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash.clonedeep';

import { GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import { ObjectWithHistory } from 'chaire-lib-common/lib/utils/objects/ObjectWithHistory';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { parseCsvFile } from 'chaire-lib-common/lib/utils/files/CsvFile';

/**
 * Base attributes for any batch transit calculation, like routing or accessibility map
 */
export interface TransitDemandFromCsvAttributes extends GenericAttributes {
    calculationName?: string;
    csvFile?: string | File;
    idAttribute?: string;
    timeAttributeDepartureOrArrival?: 'arrival' | 'departure';
    timeFormat?: string;
    timeAttribute?: string;
    withGeometries?: boolean;
    detailed?: boolean;
    // TODO Remove these from this object once trRouting is parallel
    cpuCount?: number;
    maxCpuCount?: number;
}

export abstract class TransitDemandFromCsv<T extends TransitDemandFromCsvAttributes> extends ObjectWithHistory<T> {
    private _preferencesPath: string;

    constructor(attributes: Partial<T>, isNew = false, preferencesPath: string) {
        super(attributes, isNew);

        this._preferencesPath = preferencesPath;
    }

    validate(): boolean {
        this._isValid = true;
        this.errors = [];
        const attributes = this.getAttributes();
        if (attributes.csvFile) {
            if (_isBlank(attributes.calculationName)) {
                this._isValid = false;
                this.errors.push('transit:transitRouting:errors:CalculationNameIsMissing');
            }
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
        if (_isBlank(attributes.cpuCount) && !_isBlank(attributes.maxCpuCount)) {
            attributes.cpuCount = attributes.maxCpuCount;
        } else if (
            !_isBlank(attributes.cpuCount) &&
            !_isBlank(attributes.maxCpuCount) &&
            (attributes.cpuCount as number) > (attributes.maxCpuCount as number)
        ) {
            // Automatically set the number of CPU to the max count
            attributes.cpuCount = attributes.maxCpuCount;
        } else if (!_isBlank(attributes.cpuCount) && (attributes.cpuCount as number) <= 0) {
            // Minimum number of CPU is 1
            attributes.cpuCount = 1;
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
            Preferences.update(serviceLocator.socketEventManager, serviceLocator.eventManager, {
                [this._preferencesPath]: exportedAttributes
            });
        }
    }

    setCsvFile = async (file: string | File) => {
        let csvFileAttributes: string[] = [];
        this.attributes.csvFile = file;
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
