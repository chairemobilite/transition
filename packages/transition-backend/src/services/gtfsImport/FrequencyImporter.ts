/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// eslint-disable-next-line n/no-unpublished-import
import type * as GtfsTypes from 'gtfs-types';

import { parseCsvFile } from 'chaire-lib-backend/lib/services/files/CsvFile';
import { gtfsFiles } from 'transition-common/lib/services/gtfs/GtfsFiles';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { timeStrToSecondsSinceMidnight } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import { GtfsInternalData, FrequencyImportData, Frequencies } from './GtfsImportTypes';

import { GtfsObjectPreparator } from './GtfsObjectPreparator';

export class FrequencyImporter implements GtfsObjectPreparator<Frequencies> {
    private _filePath: string;

    constructor(options: { directoryPath: string }) {
        this._filePath = _isBlank(options.directoryPath)
            ? gtfsFiles.frequencies.name
            : `${options.directoryPath}/${gtfsFiles.frequencies.name}`;
    }

    private getTripIdsToImport(trips: GtfsTypes.Trip[]): { [key: string]: boolean } {
        const tripHashMap = {};
        trips.forEach((trip) => (tripHashMap[trip.trip_id] = true));
        return tripHashMap;
    }

    async prepareImportData(importData?: GtfsInternalData): Promise<Frequencies[]> {
        if (!importData || !importData.tripsToImport || importData.tripsToImport.length === 0) {
            console.log('Not importing frequencies, because there are no trips to import');
            return [];
        }
        const tripIds = this.getTripIdsToImport(importData.tripsToImport);
        const frequencies: Frequencies[] = [];
        await parseCsvFile(
            this._filePath,
            (data, rowNum) => {
                const { trip_id, start_time, end_time, headway_secs, exact_times } = data;
                // Ignore for trips not to import
                if (!tripIds[data.trip_id]) {
                    return;
                }
                const headwaySecs = parseInt(headway_secs);
                const exactTimes = parseInt(exact_times);
                const startTimeSeconds = timeStrToSecondsSinceMidnight(start_time);
                const endTimeSeconds = timeStrToSecondsSinceMidnight(end_time);

                if (isNaN(headwaySecs) || headwaySecs < 0 || startTimeSeconds === null || endTimeSeconds === null) {
                    console.log(`GTFS Frequency import: Invalid data on row ${rowNum}`);
                    return;
                }
                const frequency: Frequencies = {
                    trip_id,
                    start_time,
                    end_time,
                    headway_secs: headwaySecs,
                    exact_times: exactTimes >= 0 && exactTimes <= 1 ? (exactTimes as 0 | 1) : 0,
                    startTimeSeconds,
                    endTimeSeconds
                };

                frequencies.push(frequency);
            },
            { header: true }
        );
        return frequencies;
    }

    static groupAndSortByTripId(frequencies: Frequencies[]): FrequencyImportData {
        const frequenciesData: FrequencyImportData = {};
        frequencies.forEach((frequency) => {
            const frequenciesForTrip = frequenciesData[frequency.trip_id] || [];
            frequenciesForTrip.push(frequency);
            frequenciesData[frequency.trip_id] = frequenciesForTrip;
        });
        // Sort the trip's stop times by sequence number
        Object.keys(frequenciesData).forEach((key) => {
            frequenciesData[key].sort((freqA, freqB) => freqA.startTimeSeconds - freqB.startTimeSeconds);
        });
        return frequenciesData;
    }
}

export default FrequencyImporter;
