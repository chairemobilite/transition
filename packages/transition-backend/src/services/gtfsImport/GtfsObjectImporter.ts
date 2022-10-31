/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { GenericAttributes, GenericObject } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import { GtfsImportData } from 'transition-common/lib/services/gtfs/GtfsImportTypes';
import { GtfsInternalData } from './GtfsImportTypes';
import { GtfsObjectPreparator } from './GtfsObjectPreparator';

/**
 * Base class to import GTFS objects. The import is done in 2 phases, one
 * preparation phase, in which the data can be read from the GTFS and prepared
 * for the user to decide what to import. Another phase is the import phase,
 * which imports into Transition the GTFS data requested by the user. The GTFS
 * file does not have to be read at each phase if all the data is already
 * available from the first phase.
 *
 * @export
 * @interface GtfsObjectImporter
 * @template T The type of the import data from the GTFS
 * @template U The type of the object in transition, once imported
 */
export interface GtfsObjectImporter<T, U extends GenericObject<GenericAttributes>> extends GtfsObjectPreparator<T> {
    /**
     * Import the desired gtfs data and return a map of ID of the GTFS objects
     * imported, with the corresponding transition object
     *
     * @memberof GtfsObjectImporter
     */
    import: (importData: GtfsImportData, internalData: GtfsInternalData) => Promise<{ [key: string]: U }>;
}
