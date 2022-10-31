/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import { GtfsImportData } from 'transition-common/lib/services/gtfs/GtfsImportTypes';

import AgencyImporter from './AgencyImporter';
import LineImporter from './LineImporter';
import ServiceImporter from './ServiceImporter';

const getCurrentData = async () => {
    // TODO tahini: I don't like this code at all
    const socket = serviceLocator.socketEventManager;
    const eventManager = serviceLocator.eventManager;
    const collectionManager = new CollectionManager(eventManager);
    const agencies = new AgencyCollection([], {});
    await agencies.loadFromServer(socket, collectionManager);
    collectionManager.add('agencies', agencies);
    const lines = new LineCollection([], {});
    await lines.loadFromServer(socket, collectionManager);
    collectionManager.add('lines', lines);
    const services = new ServiceCollection([], {});
    await services.loadFromServer(socket, collectionManager);
    collectionManager.add('services', services);
    return { agencies, lines, services };
};

const prepare = async (directoryPath: string): Promise<GtfsImportData> => {
    const collections = await getCurrentData();
    const agencyImporter = new AgencyImporter({ directoryPath, agencies: collections.agencies });
    const agencyImportData = await agencyImporter.prepareImportData();
    const agencyIds = agencyImportData.map((agencyData) => agencyData.agency.agency_id);

    const lineImporter = new LineImporter({ directoryPath, lines: collections.lines, agencyIds });
    const lineImportData = await lineImporter.prepareImportData();

    const serviceImporter = new ServiceImporter({
        directoryPath,
        services: collections.services,
        lines: collections.lines
    });
    const serviceImportData = await serviceImporter.prepareImportData();

    return {
        agencies: agencyImportData,
        lines: lineImportData,
        services: serviceImportData
    };
};

export default {
    prepare
};
