/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Line } from './Line';
import { Path as TransitPath } from '../path/Path';
import { duplicateService } from '../service/ServiceDuplicator';
import { duplicateSchedule } from '../schedules/ScheduleDuplicator';

export interface DuplicateLineOptions {
    socket: any;
    duplicateSchedules?: boolean;
    duplicateServices?: boolean;
    agencyId?: string | false;
    serviceIdsMapping?: { [key: string]: string };
    newShortname?: string;
    newLongname?: string;
    newServiceSuffix?: string;
}

export const duplicateLine = async (
    baseLine: Line,
    {
        socket,
        duplicateSchedules = false,
        duplicateServices = false,
        agencyId = false,
        serviceIdsMapping = {},
        newShortname = '',
        newLongname = '',
        newServiceSuffix = ''
    }: DuplicateLineOptions
) => {
    // TODO tahini: the duplication process should be a transaction. If a database error occurs, it should not proceed.

    const oldNewServiceidsMapping = serviceIdsMapping || {};

    baseLine.refreshPaths();
    const pathsCount = baseLine.paths.length;
    const collectionManager = baseLine.collectionManager;

    // clone line and change or reinitialize the attributes that need to be changed (eg. schedules and paths)
    const newAttributes = baseLine.getClonedAttributes(true);
    if (agencyId) {
        newAttributes.agency_id = agencyId;
    }
    newAttributes.shortname = `${newShortname ? newShortname : newAttributes.shortname}`;
    newAttributes.longname = `${newLongname ? newLongname : newAttributes.longname}`;
    const duplicatedLine = new Line(newAttributes, true, collectionManager);

    // Save the line a first time to have its id in the database
    await duplicatedLine.save(socket);
    const lineCollection = collectionManager.get('lines');
    lineCollection.add(duplicatedLine);

    const oldPaths = baseLine.paths;
    const newPathIds: string[] = [];
    const oldNewPathIdsMapping = {}; // for schedules

    for (let i = 0; i < pathsCount; i++) {
        const oldPath = oldPaths[i];
        const newPathAttributes = oldPath.getClonedAttributes(true);

        newPathAttributes.line_id = duplicatedLine.getId();
        const duplicatedPath = new TransitPath(newPathAttributes, true, collectionManager);
        await duplicatedPath.save(socket);
        newPathIds.push(duplicatedPath.getId());
        oldNewPathIdsMapping[oldPath.getId()] = duplicatedPath.getId();
        collectionManager.get('paths').add(duplicatedPath);
    }

    duplicatedLine.attributes.path_ids = newPathIds;
    duplicatedLine.refreshPaths();

    const serviceIdsUsed: string[] = [];
    const newDuplicatedSchedules = {};

    // duplicate schedules:
    if (duplicateSchedules) {
        await baseLine.refreshSchedules(socket);

        const oldSchedules = baseLine.getSchedules();

        for (const serviceId in oldSchedules) {
            let newServiceId = serviceId;

            if (duplicateServices && oldNewServiceidsMapping[serviceId]) {
                newServiceId = oldNewServiceidsMapping[serviceId];
            } else if (duplicateServices) {
                const oldService = collectionManager.get('services').getById(serviceId);
                const newService = await duplicateService(oldService, {
                    socket,
                    newServiceSuffix,
                    serviceCollection: collectionManager.get('services')
                });
                newServiceId = newService.getId();
                oldNewServiceidsMapping[serviceId] = newServiceId;
            }

            const oldSchedule = oldSchedules[serviceId];
            const newSchedule = await duplicateSchedule(oldSchedule, {
                lineId: duplicatedLine.getId(),
                serviceId: newServiceId,
                pathIdsMapping: oldNewPathIdsMapping
            });
            await newSchedule.save(socket);
            duplicatedLine.addSchedule(newSchedule);
            serviceIdsUsed.push(newServiceId);
            newDuplicatedSchedules[newServiceId] = newSchedule.getAttributes();
        }
    }

    return duplicatedLine;
};
