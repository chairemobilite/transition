/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { CsvFieldMappingDescriptor, CsvFileAndMapping, CsvFileMapper } from '../csv';

export const demandFieldDescriptors: CsvFieldMappingDescriptor[] = [
    {
        key: 'id',
        i18nLabel: 'transit:transitRouting:IdField',
        i18nErrorLabel: 'transit:transitRouting:IdFieldIsMissing',
        type: 'single',
        required: true
    },
    {
        key: 'origin',
        type: 'latLon',
        i18nLabel: 'transit:transitRouting:OriginFieldMapping',
        i18nErrorLabel: 'transit:transitRouting:errors:OriginIsMissing',
        required: true
    },
    {
        key: 'destination',
        type: 'latLon',
        i18nLabel: 'transit:transitRouting:DestinationFieldMapping',
        i18nErrorLabel: 'transit:transitRouting:errors:DestinationIsMissing',
        required: true
    },
    {
        key: 'time',
        type: 'time',
        i18nLabel: 'transit:transitRouting:TimeFieldMapping',
        i18nErrorLabel: 'transit:transitRouting:errors:TimeFieldDepartureOrArrivalIsMissing',
        required: true
    }
];

/**
 * Describe a CSV file field mapping for a transition origin/destination pair file
 */
export class TransitOdDemandFromCsv extends CsvFileMapper {
    constructor(csvFileAndMapping?: CsvFileAndMapping | undefined) {
        super(demandFieldDescriptors, csvFileAndMapping);
    }
}

export default TransitOdDemandFromCsv;
