/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import moment from 'moment';
import * as GtfsTypes from 'gtfs-types';
import _uniq from 'lodash/uniq';
import _isEqual from 'lodash/isEqual';

import { parseCsvFile } from 'chaire-lib-backend/lib/services/files/CsvFile';
import { gtfsFiles } from 'transition-common/lib/services/gtfs/GtfsFiles';
import Service, { ServiceAttributes, serviceDays } from 'transition-common/lib/services/service/Service';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { ServiceImportData, GtfsImportData } from 'transition-common/lib/services/gtfs/GtfsImportTypes';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { getUniqueServiceName } from '../transitObjects/transitServices/ServiceUtils';
import { GtfsObjectImporter } from './GtfsObjectImporter';
import { formatColor, GtfsInternalData } from './GtfsImportTypes';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import Line from 'transition-common/lib/services/line/Line';

export interface GtfsService extends GtfsTypes.Calendar {
    only_dates: string[];
    except_dates: string[];
    tr_service_desc?: string;
    tr_service_color?: string;
}

const gtfsDateToService = (gtfsDate: string): string => moment(gtfsDate, 'YYYYMMDD').format('YYYY-MM-DD');

export const gtfsToObjectAttributes = (gtfsObject: GtfsService): Partial<ServiceAttributes> => {
    const serviceAttributes: Partial<ServiceAttributes> = {
        name: gtfsObject.service_id,
        monday: gtfsObject.monday === 1,
        tuesday: gtfsObject.tuesday === 1,
        wednesday: gtfsObject.wednesday === 1,
        thursday: gtfsObject.thursday === 1,
        friday: gtfsObject.friday === 1,
        saturday: gtfsObject.saturday === 1,
        sunday: gtfsObject.sunday === 1,
        start_date: gtfsDateToService(gtfsObject.start_date),
        end_date: gtfsDateToService(gtfsObject.end_date),
        only_dates: gtfsObject.only_dates ? gtfsObject.only_dates.map(gtfsDateToService) : [],
        except_dates: gtfsObject.except_dates ? gtfsObject.except_dates.map(gtfsDateToService) : [],
        data: {
            gtfs: {
                service_id: gtfsObject.service_id
            }
        },
        color: formatColor(gtfsObject.tr_service_color)
    };
    if (gtfsObject.tr_service_desc) {
        serviceAttributes.description = gtfsObject.tr_service_desc;
    }

    return serviceAttributes;
};

export class ServiceImporter implements GtfsObjectImporter<ServiceImportData, Service> {
    private _calendarFilePath: string;
    private _calendarDateFilePath: string;
    private _existingServices: ServiceCollection;
    private _allLines: LineCollection;

    constructor(options: { directoryPath: string; services: ServiceCollection; lines: LineCollection }) {
        this._calendarFilePath = _isBlank(options.directoryPath)
            ? gtfsFiles.calendar.name
            : `${options.directoryPath}/${gtfsFiles.calendar.name}`;
        this._calendarDateFilePath = _isBlank(options.directoryPath)
            ? gtfsFiles.calendar_dates.name
            : `${options.directoryPath}/${gtfsFiles.calendar_dates.name}`;
        this._existingServices = options.services;
        this._allLines = options.lines;
    }

    private async prepareDataFromCalendar(): Promise<{ [key: string]: ServiceImportData }> {
        // Map the service IDs from calendar file to service import data
        const calendarServices: { [key: string]: ServiceImportData } = {};
        // The calendar file contains one line for each service with validity dates and days. This file may be empty
        await parseCsvFile(
            this._calendarFilePath,
            (data, _rowNum) => {
                const service: GtfsService = {
                    service_id: data.service_id,
                    start_date: data.start_date,
                    end_date: data.end_date,
                    monday: (data.monday === '1' ? 1 : 0) as 0 | 1,
                    tuesday: (data.tuesday === '1' ? 1 : 0) as 0 | 1,
                    wednesday: (data.wednesday === '1' ? 1 : 0) as 0 | 1,
                    thursday: (data.thursday === '1' ? 1 : 0) as 0 | 1,
                    friday: (data.friday === '1' ? 1 : 0) as 0 | 1,
                    saturday: (data.saturday === '1' ? 1 : 0) as 0 | 1,
                    sunday: (data.sunday === '1' ? 1 : 0) as 0 | 1,
                    only_dates: [],
                    except_dates: []
                };
                if (data.tr_service_color) {
                    service.tr_service_color = data.tr_service_color;
                }
                if (data.tr_service_desc) {
                    service.tr_service_desc = data.tr_service_desc;
                }
                calendarServices[data.service_id] = { service: gtfsToObjectAttributes(service) };
            },
            { header: true }
        );
        return calendarServices;
    }

    /**
     * The calendar_dates file contains specific days and exceptions. The
     * services in this file may or may not have been described in the
     * calendar file. Here, since we do not want exact dates, we just ignore
     * services described in calendar, and for others, we build the service
     * data, one line at a time, keeping track of serviced days and min and
     * max dates.
     */
    private async prepareDataFromCalendarDate(calendarServices: {
        [key: string]: ServiceImportData;
    }): Promise<{ [key: string]: ServiceImportData }> {
        // Map the service IDs to service import data
        const calendarDateServices: { [key: string]: ServiceImportData } = {};
        await parseCsvFile(
            this._calendarDateFilePath,
            (data, _rowNum) => {
                if (calendarServices[data.service_id]) {
                    // We already know about this service, just store the exception
                    if (data.exception_type === '2') {
                        (calendarServices[data.service_id].service.except_dates as string[]).push(
                            gtfsDateToService(data.date)
                        );
                    } else if (data.exception_type === '1') {
                        (calendarServices[data.service_id].service.only_dates as string[]).push(
                            gtfsDateToService(data.date)
                        );
                    }
                    return;
                }

                const calendarDateService = calendarDateServices[data.service_id] || {
                    service: gtfsToObjectAttributes({
                        service_id: data.service_id,
                        start_date: data.date,
                        end_date: data.date,
                        monday: 0,
                        tuesday: 0,
                        wednesday: 0,
                        thursday: 0,
                        friday: 0,
                        saturday: 0,
                        sunday: 0,
                        only_dates: [],
                        except_dates: []
                    })
                };
                if (data.exception_type === '2') {
                    (calendarDateService.service.except_dates as string[]).push(gtfsDateToService(data.date));
                } else if (data.exception_type === '1') {
                    (calendarDateService.service.only_dates as string[]).push(gtfsDateToService(data.date));
                }
                calendarDateServices[data.service_id] = calendarDateService;
            },
            { header: true }
        );
        Object.keys(calendarDateServices).forEach((key) => this.processService(calendarDateServices[key]));
        return calendarDateServices;
    }

    private processService(service: ServiceImportData): void {
        // Find the start and end dates from the service's only dates. Dates are
        // in YYYYMMDD format, so alphabetical sorting works
        const onlyDates = service.service.only_dates;
        if (!onlyDates || onlyDates.length === 0) {
            return;
        }
        onlyDates.sort();
        service.service.start_date = onlyDates[0];
        service.service.end_date = onlyDates[onlyDates.length - 1];
    }

    /**
     * Parse the data in the GTFS calendar and calendar_dates file and prepare
     * it for presentation to the user.
     *
     * @return {*}  {Promise<ServiceImportData[]>}
     * @memberof ServiceImporter
     */
    async prepareImportData(): Promise<ServiceImportData[]> {
        const calendarServices = await this.prepareDataFromCalendar();
        const calendarDateServices = await this.prepareDataFromCalendarDate(calendarServices);

        return Object.keys(calendarServices)
            .map((key) => calendarServices[key])
            .concat(Object.keys(calendarDateServices).map((key) => calendarDateServices[key]));
    }

    private getSelectedServicesToImport = (
        importServices: ServiceImportData[],
        groupCompatibleGtfsServices: boolean
    ): { mainService: Partial<ServiceAttributes>; compatibleServices: string[] }[] => {
        const toImport = importServices.filter((importObject) => importObject.selected === true);

        if (!groupCompatibleGtfsServices) {
            return toImport.map((service) => ({
                mainService: service.service,
                compatibleServices: [service.service.name as string]
            }));
        }

        // Services can be grouped together if all the following fields are equal
        const fieldsToEqual: (keyof ServiceAttributes)[] = [
            'monday',
            'tuesday',
            'wednesday',
            'thursday',
            'friday',
            'saturday',
            'sunday',
            'start_date',
            'end_date',
            'only_dates',
            'except_dates'
        ];
        const areServicesEqual = (service1: Partial<ServiceAttributes>, service2: Partial<ServiceAttributes>) =>
            fieldsToEqual.findIndex((field) => !_isEqual(service1[field], service2[field])) === -1;
        const datesAndServices: { mainService: Partial<ServiceAttributes>; compatibleServices: string[] }[] = [];
        toImport.forEach((importObject) => {
            const compatible = datesAndServices.find((dands) =>
                areServicesEqual(importObject.service, dands.mainService)
            );
            if (compatible) {
                compatible.compatibleServices.push(importObject.service.name as string);
            } else {
                datesAndServices.push({
                    mainService: importObject.service,
                    compatibleServices: [importObject.service.name as string]
                });
            }
        });
        return datesAndServices;
    };

    async import(importData: GtfsImportData, internalData: GtfsInternalData): Promise<{ [key: string]: Service }> {
        const importedServices: { [key: string]: Service } = {};

        const selectedServices = this.getSelectedServicesToImport(
            importData.services,
            importData.mergeSameDaysServices === true
        );

        const serviceImportPromises = selectedServices.map(async (importObject) => {
            const importedService = await this.importService(
                importObject.mainService,
                internalData,
                importObject.compatibleServices
            );
            importObject.compatibleServices.forEach((gtfsServiceId) => {
                importedServices[gtfsServiceId] = importedService;
            });
        });
        const result = await Promise.allSettled(serviceImportPromises);
        // Log errors from promises
        result
            .filter((res) => res.status === 'rejected')
            .forEach((res) => console.log('Error importing service: ', res));

        return importedServices;
    }

    // Verify if the 2 transition services are for the same dates, otherwise, they can't be merged
    private areServicesCompatible = (existing: ServiceAttributes, newService: Partial<ServiceAttributes>) => {
        // Check the weekdays of both services are compatible
        for (let i = 0, count = serviceDays.length; i < count; i++) {
            const hasService = existing[serviceDays[i]];
            const otherHasService = newService[serviceDays[i]];
            if (
                hasService !== undefined &&
                hasService === false &&
                otherHasService !== undefined &&
                otherHasService !== null &&
                hasService !== otherHasService
            ) {
                return false;
            }
        }
        // Check that the dates correspond
        const newServiceStartDate = newService.start_date;
        const newServiceEndDate = newService.end_date;
        if (newServiceStartDate === undefined || newServiceEndDate === undefined) {
            return false;
        }
        const start = Date.parse(existing.start_date);
        const end = Date.parse(existing.end_date);
        const otherStart = Date.parse(newServiceStartDate);
        const otherEnd = Date.parse(newServiceEndDate);
        if (otherEnd !== end || otherStart !== start) {
            return false;
        }

        return true;
    };

    private getServiceAgencies = (lineIds: string[]): string[] => {
        return _uniq(
            (
                lineIds.map((lineId) => this._allLines.getById(lineId)).filter((line) => line !== undefined) as Line[]
            ).map((line) => line?.attributes.agency_id)
        );
    };

    private async importService(
        serviceAttributes: Partial<ServiceAttributes>,
        internalData: GtfsInternalData,
        compatibleServices: string[]
    ): Promise<Service> {
        const importedAgencies = Object.values(internalData.agencyIdsByAgencyGtfsId);
        if (compatibleServices.length > 1) {
            serviceAttributes.description = `GTFS: [${compatibleServices.join(', ')}]`;
        }

        // Filter the service to overwrite, if any. The service exists if the
        // data's gtfs service_id is equal to the service_id to import and the
        // dates match. Also, the service must either be empty or already
        // include one of the agencies that is being imported, otherwise, we
        // create a new service
        const existingService = this._existingServices
            .getFeatures()
            .filter(
                (service) =>
                    service.getAttributes().data?.gtfs?.service_id === serviceAttributes.data?.gtfs?.service_id &&
                    this.areServicesCompatible(service.attributes, serviceAttributes)
            )
            .find((service) => {
                const serviceAgencies = this.getServiceAgencies(service.attributes.scheduled_line_ids);
                // Either there is no agency in the service (it can be re-used), or one of the imported agency is already included
                return (
                    serviceAgencies.length === 0 ||
                    this.getServiceAgencies(service.attributes.scheduled_line_ids).filter((serviceAgency) =>
                        importedAgencies.includes(serviceAgency)
                    ).length !== 0
                );
            });
        if (existingService) {
            return existingService;
        }
        serviceAttributes.name = await getUniqueServiceName(serviceAttributes.name || '');
        // Create a new service
        const newService = new Service(serviceAttributes, true);
        // TODO Save only at the end of the whole import, with a batch save
        await newService.save(serviceLocator.socketEventManager);
        return newService;
    }
}

export default ServiceImporter;
