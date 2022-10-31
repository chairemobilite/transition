/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
interface FileDescription {
    name: string;
    required: 'yes' | 'no' | 'cond';
}

export const GtfsFileType = [
    'agency',
    'stops',
    'routes',
    'trips',
    'stop_times',
    'calendar',
    'calendar_dates',
    'fare_attributes',
    'fare_rules',
    'shapes',
    'frequencies',
    'transfers',
    'pathways',
    'levels',
    'feed_info',
    'attributions'
];

export const gtfsFiles: { [key: typeof GtfsFileType[number]]: FileDescription } = {
    agency: {
        name: 'agency.txt',
        required: 'yes'
    },
    stops: {
        name: 'stops.txt',
        required: 'yes'
    },
    routes: {
        name: 'routes.txt',
        required: 'yes'
    },
    trips: {
        name: 'trips.txt',
        required: 'yes'
    },
    stop_times: {
        name: 'stop_times.txt',
        required: 'yes'
    },
    calendar: {
        name: 'calendar.txt',
        required: 'cond'
    },
    calendar_dates: {
        name: 'calendar_dates.txt',
        required: 'cond'
    },
    fare_attributes: {
        name: 'fare_attributes.txt',
        required: 'no'
    },
    fare_rules: {
        name: 'fare_rules.txt',
        required: 'no'
    },
    shapes: {
        name: 'shapes.txt',
        required: 'yes'
    },
    frequencies: {
        name: 'frequencies.txt',
        required: 'no'
    },
    transfers: {
        name: 'transfers.txt',
        required: 'no'
    },
    pathways: {
        name: 'pathways.txt',
        required: 'no'
    },
    levels: {
        name: 'levels.txt',
        required: 'no'
    },
    feed_info: {
        name: 'feed_info.txt',
        required: 'no'
    },
    attributions: {
        name: 'attributions.txt',
        required: 'no'
    }
};
