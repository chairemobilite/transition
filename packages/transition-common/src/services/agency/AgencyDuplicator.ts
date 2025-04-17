/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Agency, AgencyAttributes } from './Agency';
import { duplicateService } from '../service/ServiceDuplicator';
import { duplicateLine } from '../line/LineDuplicator';
import { getUniqueAgencyAcronym } from './AgencyUtils';
import Line from '../line/Line';

export interface DuplicateAgencyOptions {
    socket: any;
    duplicateSchedules?: boolean;
    duplicateServices?: boolean;
    newAcronym?: string;
    newName?: string;
    newServiceSuffix?: string;
}

export const duplicateAgency = async (
    baseAgency: Agency,
    {
        socket,
        duplicateSchedules = false,
        duplicateServices = false,
        newAcronym = '',
        newName = '',
        newServiceSuffix = ''
    }: DuplicateAgencyOptions
) => {
    // TODO tahini: the duplication process should be a transaction. If a database error occurs, it should not proceed.
    const newAttributes: Partial<AgencyAttributes> = baseAgency.getClonedAttributes(true);

    const agencies = baseAgency.collectionManager.get('agencies');
    // Make sure acronym is unique
    newAttributes.acronym = getUniqueAgencyAcronym(agencies, `${newAcronym ? newAcronym : newAttributes.acronym}`);
    newAttributes.name = `${newName ? newName : newAttributes.name}`;
    const duplicatedAgency = new Agency(newAttributes, true, baseAgency.collectionManager);
    await duplicatedAgency.save(socket);

    const duplicatedAgencyId = duplicatedAgency.getId();
    agencies.add(duplicatedAgency);

    let oldNewServiceidsMapping = {};

    const lines = baseAgency.getLines(true);
    // First duplicate the services involved, otherwise each line will duplicate all the services involved
    if (duplicateServices) {
        oldNewServiceidsMapping = await duplicateAgencyServices(lines, {
            socket,
            newServiceSuffix: newServiceSuffix + (newAttributes.acronym ? ' (' + newAttributes.acronym + ')' : ''),
            collectionManager: baseAgency.collectionManager
        });
    }

    const newLineIds: any[] = [];
    for (let i = 0, countI = lines.length; i < countI; i++) {
        const line = lines[i];
        const duplicatedLine = await duplicateLine(line, {
            socket,
            duplicateSchedules,
            duplicateServices,
            agencyId: duplicatedAgencyId,
            serviceIdsMapping: oldNewServiceidsMapping,
            newServiceSuffix
        });
        newLineIds.push(duplicatedLine.get('id'));
    }

    // TODO Duplicate garages and units

    duplicatedAgency.attributes.line_ids = newLineIds;
    duplicatedAgency.refreshLines();

    await duplicatedAgency.save(socket);

    return duplicatedAgency;
};

const duplicateAgencyServices = async (
    lines: Line[],
    options: { socket: any; newServiceSuffix: string; collectionManager: any }
): Promise<{ [key: string]: string }> => {
    const oldNewServiceMapping: { [key: string]: string } = {};

    const serviceCollection = options.collectionManager.get('services');

    // TODO We directly access the line's attributes here, we shouldn't
    for (let i = 0, countI = lines.length; i < countI; i++) {
        const line = lines[i];
        await line.refreshSchedules(options.socket);

        const schedules = line.attributes.scheduleByServiceId;

        for (const serviceId in schedules) {
            if (oldNewServiceMapping[serviceId]) {
                continue;
            }
            const oldService = serviceCollection.getById(serviceId);

            const newService = await duplicateService(oldService, {
                socket: options.socket,
                serviceCollection,
                newServiceSuffix: options.newServiceSuffix
            });

            const newServiceId = newService.getId();
            oldNewServiceMapping[serviceId] = newServiceId;
        }
    }
    return oldNewServiceMapping;
};
