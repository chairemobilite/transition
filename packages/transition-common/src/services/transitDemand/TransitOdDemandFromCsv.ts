/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { TransitDemandFromCsv, DemandCsvAttributes } from './TransitDemandFromCsv';
import { TransitDemandFromCsvRoutingAttributes } from './types';

export type TransitOdDemandFromCsvAttributes = DemandCsvAttributes & Partial<TransitDemandFromCsvRoutingAttributes>;

/**
 * Describe a CSV file field mapping for a transition origin/destination pair file
 */
export class TransitOdDemandFromCsv extends TransitDemandFromCsv<TransitOdDemandFromCsvAttributes> {
    constructor(attributes: Partial<TransitOdDemandFromCsvAttributes>, isNew = false) {
        super(attributes, isNew, 'transit.routing.batch');
    }

    validate(): boolean {
        super.validate();
        const attributes = this.attributes;
        if (attributes.csvFile) {
            if (_isBlank(attributes.projection)) {
                this._isValid = false;
                this.errors.push('transit:transitRouting:errors:ProjectionIsMissing');
            }
            if (_isBlank(attributes.originXAttribute)) {
                this._isValid = false;
                this.errors.push('transit:transitRouting:errors:OriginXAttributeIsMissing');
            }
            if (_isBlank(attributes.originYAttribute)) {
                this._isValid = false;
                this.errors.push('transit:transitRouting:errors:OriginYAttributeIsMissing');
            }
            if (_isBlank(attributes.destinationXAttribute)) {
                this._isValid = false;
                this.errors.push('transit:transitRouting:errors:DestinationXAttributeIsMissing');
            }
            if (_isBlank(attributes.destinationYAttribute)) {
                this._isValid = false;
                this.errors.push('transit:transitRouting:errors:DestinationYAttributeIsMissing');
            }
        }

        return this._isValid;

        // TODO: add validations for all attributes fields
    }

    protected onCsvFileAttributesUpdated = (_csvFields: string[]): void => {
        if (this.attributes.originXAttribute && !_csvFields.includes(this.attributes.originXAttribute)) {
            this.attributes.originXAttribute = undefined;
        }
        if (this.attributes.originYAttribute && !_csvFields.includes(this.attributes.originYAttribute)) {
            this.attributes.originYAttribute = undefined;
        }
        if (this.attributes.destinationXAttribute && !_csvFields.includes(this.attributes.destinationXAttribute)) {
            this.attributes.destinationXAttribute = undefined;
        }
        if (this.attributes.destinationYAttribute && !_csvFields.includes(this.attributes.destinationYAttribute)) {
            this.attributes.destinationYAttribute = undefined;
        }
    };
}

export default TransitOdDemandFromCsv;
