/**
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/**
 * Describes a field that can be mapped to a CSV column
 */
export type CsvFieldMappingDescriptor = {
    /** The field key, to be used by the application */
    key: string;
    /** The i18n translation string to describe this field */
    i18nLabel: string;
    /** The i18n translation string to describe an error when this field is not
     * properly set */
    i18nErrorLabel?: string;
    /** The type of field.
     * * `single` is a single mapping to a field.
     * * `routingTime` means the mapping represents a time used for routing, so
     *   for each, there should be an additional question about the type of time
     *   (departure/arrival) and the format, that will be stored in keys
     *   `${key}Type` and `${key}Format`. The labels for the additional type and
     *   format questions is the `i18nLabel` value with `Type` and `Format`
     *   (HH:MM, HMM, secondsSinceMidnight) appended.
     * * `latLon` means there's a column mapping for latitude and another
     *   mapping for longitude.  This will result in two keys in the final
     *   mapping: `${key}Lat` and `${key}Lon`. There should also be a question
     *   about the projection in which those coordinates are coded. The labels
     *   for each field mapping is the `i18nLabel` value, with `Lat` and `Lon`
     *   appended respectively. */
    type: 'single' | 'routingTime' | 'latLon';
    /** Whether this mapping is required or if it is an optional field. If
     * required and not set, the i18nErrorLabel will be used to tell the user */
    required?: boolean;
};

/**
 * Type for csv file location configuration.
 *
 * `upload` means the file was just uploaded to the server and tasks using it
 * can copy it from there, `filename` is the original name of the file uploaded,
 * while `uploadFilename` is the name of the file on the server's upload folder.
 * As there is no way to manage the user's uploaded file, to avoid filling the
 * directory, files from a same context are always uploaded with the same name.
 *
 * `job` location means the file is already on the server and belongs to a
 * specific job, identified by `jobId` and the `fileKey` to identify the file in
 * the job.
 */
export type FileConfig =
    | { location: 'upload'; filename: string; uploadFilename: string }
    | { location: 'job'; jobId: number; fileKey: string };

/** Type for csv file and field mapping attributes. This tells the CSV file
 * consumer where to find the file and how to map field to each desired key */
export type FileAndMappingAttributes = {
    /** The CSV file location and name */
    csvFile: FileConfig;
    /** The key to CSV field mapping */
    fieldMappings: { [key: string]: string };
};

/**
 * Type for a csv file and mapping together with the list of fields available.
 * This type can be used where a CSV file is required along with its mapping and
 * the list of fields present in the file.
 */
export type CsvFileAndMapping = {
    type: 'csv';
    /** CSV file location and field mapping */
    fileAndMapping: FileAndMappingAttributes;
    /** List of csv fields in the file. The file can be anywhere, so consumers
     * don't necessarily have access to it. To avoid having to read the file to
     * display the fields, the list of available fields in the file will be
     * listed here */
    csvFields: string[];
};
