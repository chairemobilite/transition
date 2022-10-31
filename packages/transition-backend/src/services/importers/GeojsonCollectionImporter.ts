/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import { FileReaderCallback } from 'chaire-lib-backend/lib/services/files/JsonFileReader';
import { parseGeojsonFileFeatures } from 'chaire-lib-backend/lib/services/files/GeojsonFileReader';
import CollectionImporter from './CollectionImporter';

class GeojsonCollectionImporter<T extends GenericAttributes> extends CollectionImporter<T> {
    protected callFileParser(filePath: string, callback: FileReaderCallback) {
        return parseGeojsonFileFeatures(filePath, (object, rowNumber) => {
            // Transform the feature into a map object attributes, where properties become the root object and the geometry is the geography
            if (object.type !== 'Feature' || !object.geometry) {
                throw `Error validating data for object at position ${rowNumber}: Object is not a feature`;
            }
            const baseObject = Object.assign({}, object.properties, { geography: object.geometry });
            callback(baseObject, rowNumber);
        });
    }
}

export default GeojsonCollectionImporter;
