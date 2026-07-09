/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { CsvFieldMappingDescriptor, CsvFileAndFieldMapper } from '../csv';
import { BatchRoutingOdDemandFromCsvAttributes, TransitDemandFromCsvRoutingAttributes } from './types';

export const demandFieldDescriptors: CsvFieldMappingDescriptor[] = [
    {
        key: 'id',
        i18nLabel: 'transit:transitRouting:IdField',
        i18nErrorLabel: 'transit:transitRouting:errors:IdFieldIsMissing',
        type: 'single',
        required: true,
        autoMatch: ['id', 'uuid', 'ID']
    },
    {
        key: 'origin',
        type: 'latLon',
        i18nLabel: 'transit:transitRouting:OriginFieldMapping',
        i18nErrorLabel: 'transit:transitRouting:errors:OriginIsMissing',
        required: true,
        autoMatchLat: ['o_lat', 'origin_lat', 'olat', 'originlat', 'lat_o', 'lat_origin'],
        autoMatchLon: ['o_lon', 'origin_lon', 'olon', 'originlon', 'lon_o', 'lon_origin', 'o_lng', 'origin_lng']
    },
    {
        key: 'destination',
        type: 'latLon',
        i18nLabel: 'transit:transitRouting:DestinationFieldMapping',
        i18nErrorLabel: 'transit:transitRouting:errors:DestinationIsMissing',
        required: true,
        autoMatchLat: ['d_lat', 'destination_lat', 'dlat', 'destinationlat', 'dest_lat', 'lat_d', 'lat_dest'],
        autoMatchLon: [
            'd_lon',
            'destination_lon',
            'dlon',
            'destinationlon',
            'dest_lon',
            'lon_d',
            'lon_dest',
            'd_lng',
            'destination_lng',
            'dest_lng'
        ]
    },
    {
        key: 'time',
        type: 'routingTime',
        i18nLabel: 'transit:transitRouting:TimeFieldMapping',
        i18nErrorLabel: 'transit:transitRouting:errors:TimeFieldDepartureOrArrivalIsMissing',
        required: true,
        autoMatch: ['time', 'departure_time', 'arrival_time', 'dep_time', 'arr_time']
    }
];

/**
 * Describe a CSV file field mapping for a transition origin/destination pair file
 */
export class TransitOdDemandFromCsv extends CsvFileAndFieldMapper<TransitDemandFromCsvRoutingAttributes> {
    constructor(csvFileAndMapping?: BatchRoutingOdDemandFromCsvAttributes | undefined) {
        super(demandFieldDescriptors, csvFileAndMapping);
    }
}

export default TransitOdDemandFromCsv;
