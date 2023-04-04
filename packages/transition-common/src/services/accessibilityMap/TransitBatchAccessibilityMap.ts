/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import AccessibilityMapRouting from './TransitAccessibilityMapRouting';
import { TransitDemandFromCsv, DemandCsvAttributes } from '../transitDemand/TransitDemandFromCsv';

export interface TransitDemandFromCsvAccessMapAttributes extends DemandCsvAttributes {
    projection?: string;
    xAttribute?: string;
    yAttribute?: string;
}

export const accessibilityMapPreferencesPath = 'accessibilityMap.batch';

export class TransitBatchAccessibilityMap extends TransitDemandFromCsv<TransitDemandFromCsvAccessMapAttributes> {
    private _routing: AccessibilityMapRouting;

    constructor(
        attributes: Partial<TransitDemandFromCsvAccessMapAttributes>,
        isNew = false,
        routing: AccessibilityMapRouting
    ) {
        super(attributes, isNew, accessibilityMapPreferencesPath);

        this._routing = routing;
    }

    validate(): boolean {
        super.validate();
        this._routing.validate();
        this.errors.concat(this._routing.getErrors());
        const attributes = this.getAttributes();
        if (attributes.csvFile) {
            if (_isBlank(attributes.projection)) {
                this._isValid = false;
                this.errors.push('transit:transitRouting:errors:ProjectionIsMissing');
            }
            if (_isBlank(attributes.xAttribute)) {
                this._isValid = false;
                this.errors.push('transit:transitRouting:errors:XAttributeIsMissing');
            }
            if (_isBlank(attributes.yAttribute)) {
                this._isValid = false;
                this.errors.push('transit:transitRouting:errors:YAttributeIsMissing');
            }
        }
        return this._isValid;
    }

    get routingEngine(): AccessibilityMapRouting {
        return this._routing;
    }

    protected onCsvFileAttributesUpdated = (_csvFields: string[]): void => {
        if (this.attributes.xAttribute && !_csvFields.includes(this.attributes.xAttribute)) {
            this.attributes.xAttribute = undefined;
        }
        if (this.attributes.yAttribute && !_csvFields.includes(this.attributes.yAttribute)) {
            this.attributes.yAttribute = undefined;
        }
    };
}

export default TransitBatchAccessibilityMap;
