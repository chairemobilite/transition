/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { BackendCsvFileOptions } from 'chaire-lib-backend/lib/services/files/CsvFile';
import { CsvFileAttributes } from 'chaire-lib-common/lib/utils/files/CsvFile';
import { GtfsMessages } from 'transition-common/lib/services/gtfs/GtfsMessages';

/**
 * Build the options object passed to `parseCsvFile` from a GTFS importer.
 * Wires up the GTFS-specific `MalformedCsvFile` translation key so users see
 * a domain-appropriate error if the file's line endings are malformed.
 *
 * Use it like:
 *
 *     await parseCsvFile(filePath, rowCb, gtfsCsvOptions({ header: true }));
 */
export const gtfsCsvOptions = (
    options: Partial<CsvFileAttributes>
): Partial<CsvFileAttributes> & BackendCsvFileOptions => ({
    ...options,
    malformedCsvLocalizedMessage: (fileName) => ({
        text: GtfsMessages.MalformedCsvFile,
        params: { fileName }
    })
});
