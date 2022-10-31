/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { ObjectWithHistory } from 'chaire-lib-common/lib/utils/objects/ObjectWithHistory';
import { GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';

// TODO Make validator attributes match the gtfs importers of the objects when
// they move to typescript, it may need some logical refactoring
export interface GtfsImporterValidatorAttributes extends GenericAttributes {
    isUploaded: boolean;
    isPrepared: boolean;
    periodsGroupShortname?: string;
    warnings: any[];
}

class GtfsValidator extends ObjectWithHistory<GtfsImporterValidatorAttributes> {
    constructor(attributes: Partial<GtfsImporterValidatorAttributes>) {
        super(attributes, false);
    }

    _prepareAttributes(attributes: Partial<GtfsImporterValidatorAttributes>) {
        const { isUploaded, isPrepared, ...rest } = attributes;
        const newAttribs = {
            isUploaded: isUploaded || false,
            isPrepared: isPrepared || false,
            ...rest
        } as Partial<GtfsImporterValidatorAttributes>;
        return super._prepareAttributes(newAttribs);
    }

    validate() {
        this._isValid = true;
        this.errors = [];
        if (!this.getAttributes().isUploaded) {
            this._isValid = false;
            this.errors.push('main:errors:ZipFileIsRequired');
        }
        return this._isValid;
    }

    validatePeriodsGroup() {
        this.validate();
        if (_isBlank(this.getAttributes().periodsGroupShortname)) {
            this._isValid = false;
            this.errors.push('transit:gtfs:errors:PeriodsGroupIsRequired');
        }
        return this._isValid;
    }
}

export default GtfsValidator;
