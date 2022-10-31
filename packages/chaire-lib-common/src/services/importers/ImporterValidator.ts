/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { ObjectWithHistory } from '../../utils/objects/ObjectWithHistory';
import { GenericAttributes } from '../../utils/objects/GenericObject';

export type ImporterValidatorAttributes = GenericAttributes;

// TODO: This seems very useless, but it is used for the FileUploaderHOC. Do we need it?
class ImporterValidator extends ObjectWithHistory<ImporterValidatorAttributes> {
    constructor(attributes: Partial<ImporterValidatorAttributes>) {
        super(attributes, false);
    }
}

export default ImporterValidator;
