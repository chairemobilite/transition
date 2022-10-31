/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { GtfsInternalData } from './GtfsImportTypes';

/**
 * Base class to read and prepare GTFS objects. This class represents the first
 * phase of the import, when the file is read and the data prepared, either to
 * show to the user, or for other object importers.
 *
 * @export
 * @interface GtfsObjectPreparator
 * @template T The type of the import data from the GTFS
 */
export interface GtfsObjectPreparator<T> {
    /**
     * Prepare the data to import for the GTFS object. This does not import
     * data, but it reads the file and collects the data that is available for
     * import. It can also detects possible duplicates among the current data,
     * so the consumer of this data can act accordingly and offer proper
     * choices.
     *
     * @memberof GtfsObjectImporter
     */
    prepareImportData: (importData?: GtfsInternalData) => Promise<T[]>;
}
