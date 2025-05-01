/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import slugify from 'slugify';
// eslint-disable-next-line n/no-unpublished-import
import type * as GtfsTypes from 'gtfs-types';
import { unparse } from 'papaparse';
import moment from 'moment';

import { gtfsFiles } from 'transition-common/lib/services/gtfs/GtfsFiles';
import Service, { serviceDays } from 'transition-common/lib/services/service/Service';
import dbQueries from '../../models/db/transitServices.db.queries';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';

export interface ServiceGtfsAttributes extends GtfsTypes.Calendar {
    tr_service_color?: string;
    tr_service_desc?: string;
}

const getServiceId = (service: Service): string => {
    const name = service.attributes.name;
    return name ? slugify(name) : service.getId();
};

const objectToCalendarGtfs = (service: Service, includeCustomFields = false): ServiceGtfsAttributes => {
    const startDate = service.attributes.start_date;
    const endDate = service.attributes.end_date;

    const gtfsFields: Partial<ServiceGtfsAttributes> = {
        service_id: getServiceId(service),
        start_date: startDate ? moment(startDate).format('YYYYMMDD') : moment().format('YYYYMMDD'),
        end_date: endDate ? moment(endDate).format('YYYYMMDD') : moment().format('YYYYMMDD')
    };

    for (let i = 0, countI = serviceDays.length; i < countI; i++) {
        gtfsFields[serviceDays[i]] = service.attributes[serviceDays[i]] === true ? 1 : 0; // required
    }
    if (includeCustomFields) {
        gtfsFields.tr_service_desc = service.attributes.description;
        gtfsFields.tr_service_color = service.attributes.color;
    }
    return gtfsFields as ServiceGtfsAttributes;
};

// Export services to the calendar gtfs files
// TODO: implement calendar_dates with includes/exclude
export const exportService = async (
    serviceIds: string[],
    options: { directoryPath: string; quotesFct: (value: unknown) => boolean; includeTransitionFields?: boolean }
): Promise<{ status: 'success'; serviceToGtfsId: { [key: string]: string } } | { status: 'error'; error: unknown }> => {
    // Prepare the file stream
    const filePath = `${options.directoryPath}/${gtfsFiles.calendar.name}`;
    fileManager.truncateFileAbsolute(filePath);
    const calendarStream = fs.createWriteStream(filePath);

    // Fetch all the services
    const services = await dbQueries.collection();
    const serviceCollection = new ServiceCollection([], {});
    serviceCollection.loadFromCollection(services);
    const serviceToGtfsId: { [key: string]: string } = {};

    try {
        const gtfsServices = serviceIds.map((serviceId) => {
            const service = serviceCollection.getById(serviceId);
            if (!service) {
                throw new TrError(`Unknow service for GTFS export ${serviceId}`, 'GTFSEXP0006');
            }
            const gtfsService = objectToCalendarGtfs(service, options.includeTransitionFields || false);
            serviceToGtfsId[serviceId] = gtfsService.service_id;
            return gtfsService;
        });
        // Write the agencies to the gtfs file
        calendarStream.write(
            unparse(gtfsServices, {
                newline: '\n',
                quotes: options.quotesFct,
                header: true
            })
        );
        return { status: 'success', serviceToGtfsId: serviceToGtfsId };
    } catch (error) {
        return { status: 'error', error };
    } finally {
        calendarStream.end();
    }
};
