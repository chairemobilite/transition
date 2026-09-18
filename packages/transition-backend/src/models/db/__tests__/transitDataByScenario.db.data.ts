/*
 * Copyright 2022-2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';
import knex from 'chaire-lib-backend/lib/config/shared/db.config';

import schedulesDbQueries from '../transitSchedules.db.queries';
import linesDbQueries from '../transitLines.db.queries';
import agenciesDbQueries from '../transitAgencies.db.queries';
import servicesDbQueries from '../transitServices.db.queries';
import pathsDbQueries from '../transitPaths.db.queries';
import scenariosDbQueries from '../transitScenarios.db.queries';
import pathDbQueries from '../transitPaths.db.queries'

const agencyId = uuidV4();
const agencyId2 = uuidV4();
const unusedAgencyId = uuidV4();
const lineId = uuidV4();
const lineId2 = uuidV4();
const serviceId = uuidV4();
const serviceId2 = uuidV4();
const path1Line1Id = uuidV4();
const path2Line2Id = uuidV4();
const unusedServiceId = uuidV4();
const scenarioIdWithService2 = uuidV4();
const scenarioIdWithBothServices = uuidV4();
const scenarioIdWithBothServicesOnlyAgency1 = uuidV4();
const scenarioIdWithBothServicesWithoutAgency1 = uuidV4();
const scenarioIdWithBothServicesOnlyLine1 = uuidV4();
const scenarioIdWithBothServicesWithoutLine1 = uuidV4();
const scenarioIdWithEmptyServices = uuidV4();
const scenarioIdWith2LinesExcluded = uuidV4();
const scenarioIdWith2LinesIncluded = uuidV4();

// This file tests queries cases for various objects that need specific scenarios   

/**
 * Insert data for scenarios that require specific objects in the database. This
 * can be used in tests that filter on scenarios.
 *
 * There are 2 agencies, 2 lines (one per agency), 2 services (serviceId is used
 * by both lines, serviceId2 is used by lineId only).
 */
export const insertDataForScenarios = async () => {
    jest.setTimeout(10000);
    // Add agencies, services and lines
    await agenciesDbQueries.create({
        id: agencyId,
        acronym: 'AG1'
    } as any);
    await agenciesDbQueries.create({
        id: agencyId2,
        acronym: 'AG2'
    } as any);
    await agenciesDbQueries.create({
        id: unusedAgencyId,
        acronym: 'unused'
    } as any);
    await linesDbQueries.create({
        id: lineId,
        agency_id: agencyId
    } as any);
    await linesDbQueries.create({
        id: lineId2,
        agency_id: agencyId2
    } as any);
    await servicesDbQueries.create({
        id: serviceId,
        name: 'service 1 for scenario'
    } as any);
    await servicesDbQueries.create({
        id: serviceId2,
        name: 'service 2 for scenario'
    } as any);
    await servicesDbQueries.create({
        id: unusedServiceId,
        name: 'unused service for scenario'
    } as any);
    await pathDbQueries.createMultiple([{
        id: path1Line1Id,
        line_id: lineId,
        name: 'path 1 for line 1',
        geography: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }
    } as any, {
        id: path2Line2Id,
        line_id: lineId2,
        name: 'path 2 for line 2',
        geography: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }
    } as any])

    // Add schedules
    await schedulesDbQueries.save({
        line_id: lineId,
        service_id: serviceId,
        id: uuidV4(),
        periods_group_shortname: 'default',
        periods: [{
            id: uuidV4(),
            period_shortname: 'default',
            start_time: '08:00',
            end_time: '09:00',
            trips: [{
                id: uuidV4(),
                departure_time_seconds: 0,
                arrival_time_seconds: 1000,
                path_id: path1Line1Id,
            }]
        }]
    } as any);
    await schedulesDbQueries.save({
        line_id: lineId,
        service_id: serviceId2,
        id: uuidV4(),
        periods_group_shortname: 'default',
        periods: []
    } as any);
    await schedulesDbQueries.save({
        line_id: lineId2,
        service_id: serviceId,
        id: uuidV4(),
        periods_group_shortname: 'default',
        periods: [{
            id: uuidV4(),
            period_shortname: 'default',
            start_time: '08:00',
            end_time: '09:00',
            trips: [{
                id: uuidV4(),
                departure_time_seconds: 0,
                arrival_time_seconds: 1000,
                path_id: path2Line2Id,
            }]
        }]
    } as any);

    // Add the scenarios
    await scenariosDbQueries.createMultiple([{
        id: scenarioIdWithService2,
        name: 'scenarioIdWithService2AndNullFilters',
        services: [serviceId2],
        data: {}
    } as any, {
        id: scenarioIdWithBothServices,
        name: 'scenarioIdWithBothServices',
        services: [serviceId, serviceId2],
        only_agencies: [],
        except_agencies: [],
        only_lines: [],
        except_lines: [],
        only_nodes: [],
        except_nodes: [],
        only_modes: [],
        except_modes: [],
        data: {}
    }, {
        id: scenarioIdWithBothServicesOnlyAgency1,
        name: 'scenarioIdWithBothServicesOnlyAgency1',
        services: [serviceId, serviceId2],
        only_agencies: [agencyId],
        except_agencies: [],
        only_lines: [],
        except_lines: [],
        only_nodes: [],
        except_nodes: [],
        only_modes: [],
        except_modes: [],
        data: {}
    }, {
        id: scenarioIdWithBothServicesWithoutAgency1,
        name: 'scenarioIdWithBothServicesWithoutAgency1',
        services: [serviceId, serviceId2],
        only_agencies: [],
        except_agencies: [agencyId],
        only_lines: [],
        except_lines: [],
        only_nodes: [],
        except_nodes: [],
        only_modes: [],
        except_modes: [],
        data: {}
    }, {
        id: scenarioIdWithBothServicesOnlyLine1,
        name: 'scenarioIdWithBothServicesOnlyLine1',
        services: [serviceId, serviceId2],
        only_agencies: [],
        except_agencies: [],
        only_lines: [lineId],
        except_lines: [],
        only_nodes: [],
        except_nodes: [],
        only_modes: [],
        except_modes: [],
        data: {}
    }, {
        id: scenarioIdWithBothServicesWithoutLine1,
        name: 'scenarioIdWithBothServicesWithoutLine1',
        services: [serviceId, serviceId2],
        only_agencies: [],
        except_agencies: [],
        only_lines: [],
        except_lines: [lineId],
        only_nodes: [],
        except_nodes: [],
        only_modes: [],
        except_modes: [],
        data: {}
    }, {
        id: scenarioIdWithEmptyServices,
        name: 'scenarioIdWithEmptyServices',
        services: [unusedServiceId],
        only_agencies: [],
        except_agencies: [],
        only_lines: [],
        except_lines: [],
        only_nodes: [],
        except_nodes: [],
        only_modes: [],
        except_modes: [],
        data: {}
    }, {
        id: scenarioIdWith2LinesExcluded,
        name: 'scenarioIdWith2LinesExcluded',
        services: [serviceId, serviceId2],
        only_agencies: [],
        except_agencies: [],
        only_lines: [],
        except_lines: [lineId, lineId2],
        only_nodes: [],
        except_nodes: [],
        only_modes: [],
        except_modes: [],
        data: {}
    }, {
        id: scenarioIdWith2LinesIncluded,
        name: 'scenarioIdWith2LinesIncluded',
        services: [serviceId, serviceId2],
        only_agencies: [],
        except_agencies: [],
        only_lines: [lineId, lineId2],
        except_lines: [],
        only_nodes: [],
        except_nodes: [],
        only_modes: [],
        except_modes: [],
        data: {}
    }])

    return {
        agencyIds: [agencyId, agencyId2],
        lineIds: [lineId, lineId2],
        serviceIds: [serviceId, serviceId2, unusedServiceId],
        pathIds: [path1Line1Id, path2Line2Id],
        scenarios: {
            scenarioIdWithService2,
            scenarioIdWithBothServices,
            scenarioIdWithBothServicesOnlyAgency1,
            scenarioIdWithBothServicesWithoutAgency1,
            scenarioIdWithBothServicesOnlyLine1,
            scenarioIdWithBothServicesWithoutLine1,
            scenarioIdWithEmptyServices,
            scenarioIdWith2LinesExcluded,
            scenarioIdWith2LinesIncluded
        }
    };
}

export const cleanScenarioData = async () => {
    await schedulesDbQueries.truncateSchedules();
    await schedulesDbQueries.truncateSchedulePeriods();
    await schedulesDbQueries.truncateScheduleTrips();
    await servicesDbQueries.truncate();
    await pathsDbQueries.truncate();
    await linesDbQueries.truncate();
    await agenciesDbQueries.truncate();
    await scenariosDbQueries.truncate();
}

test('dummy test', () => {
    // Nothing to do, this file just needs to have one test
});