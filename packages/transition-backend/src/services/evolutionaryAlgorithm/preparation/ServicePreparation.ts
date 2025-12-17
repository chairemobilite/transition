/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import Line from 'transition-common/lib/services/line/Line';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import Service from 'transition-common/lib/services/service/Service';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import { secondsSinceMidnightToTimeStr } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import Schedule from 'transition-common/lib/services/schedules/Schedule';
import moment from 'moment';
import * as AlgoTypes from '../internalTypes';
import Scenario from 'transition-common/lib/services/scenario/Scenario';
import { EvolutionaryTransitNetworkDesignJobType } from '../../networkDesign/transitNetworkDesign/evolutionary/types';
import { TransitNetworkDesignJobWrapper } from '../../networkDesign/transitNetworkDesign/TransitNetworkDesignJobWrapper';
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';

const PERIOD_GROUP_SHORTNAME = 'complete_day';

const DEFAULT_MIN_TIME_BETWEEN_PASSAGES = 5;
const DEFAULT_MAX_TIME_BETWEEN_PASSAGES = 60;

const prepareServicesForLines = async (
    line: Line,
    services: Service[],
    periodAttributes: {
        period_shortname?: string;
        start_at_hour: number;
        end_at_hour: number;
        custom_start_at_str: string;
        custom_end_at_str: string;
    },
    jobWrapper: TransitNetworkDesignJobWrapper<EvolutionaryTransitNetworkDesignJobType>
): Promise<AlgoTypes.LineLevelOfService[]> => {
    const transitNetworkParameters = jobWrapper.parameters.transitNetworkDesignParameters;
    const minTime = (transitNetworkParameters.minTimeBetweenPassages || DEFAULT_MIN_TIME_BETWEEN_PASSAGES) * 60;
    const maxTime = (transitNetworkParameters.maxTimeBetweenPassages || DEFAULT_MAX_TIME_BETWEEN_PASSAGES) * 60;
    const lineServices: AlgoTypes.LineLevelOfService[] = [];

    const inboundPaths = line.getInboundPaths();
    const outboundPaths = line.getOutboundPaths();
    const loop = line.getLoopPaths();

    const [outboundPathId, inboundPathId] =
        loop.length > 0
            ? [loop[0].getId(), undefined]
            : inboundPaths.length > 0 && outboundPaths.length > 0
                ? [outboundPaths[0].getId(), inboundPaths[0].getId()]
                : [undefined, undefined];
    if (inboundPathId === undefined && outboundPathId === undefined) {
        throw `Path not properly configured for ${line.toString()}. There needs to be either a loop, or an inbound and outbound paths. Simulation will not run properly`;
    }

    // TODO Instead of by number of vehicles, just try a level of service and
    // round at number of vehicles. For this, we need to add a parameter where
    // the user can enter a comma-separated array of requested services.
    let timeBetweenPassages = Number.MAX_VALUE;
    let nbVehicles = 1;
    let lastTimeBetweenPassages = timeBetweenPassages;
    while (timeBetweenPassages > minTime && nbVehicles < transitNetworkParameters.nbOfVehicles) {
        const serviceName = `networkDesign_${line.toString()}_${nbVehicles}`;
        const existingService = services.find((service) => service.attributes.name === serviceName);
        // Create a service to store this schedule
        const service = existingService
            ? existingService
            : new Service(
                {
                    name: serviceName,
                    monday: true,
                    start_date: moment().format('YYYY-MM-DD'),
                    end_date: moment().format('YYYY-MM-DD'),
                    data: { forJob: jobWrapper.job.id }
                },
                true
            );

        // TODO Allow second based schedules for high frequency lines like
        // metros, or when we support requested levels of services, there may be
        // fractions of time. Now this value is false

        // Create the schedule
        const schedule = new Schedule(
            {
                allow_seconds_based_schedules: false,
                line_id: line.getId(),
                service_id: service.getId(),
                periods_group_shortname: PERIOD_GROUP_SHORTNAME,
                periods: []
            },
            true,
            line.collectionManager
        );
        schedule.attributes.periods.push(
            Object.assign({}, periodAttributes, {
                id: uuidV4(),
                schedule_id: schedule.attributes.integer_id || -1,
                outbound_path_id: outboundPathId,
                inbound_path_id: inboundPathId,
                number_of_units: nbVehicles,
                trips: [],
                data: {}
            })
        );
        const { trips } = schedule.generateForPeriod(PERIOD_GROUP_SHORTNAME);
        const outboundTrips = trips.filter((trip) => trip.path_id === outboundPathId);
        // We expect more than one trip, otherwise, throw an error, something happened
        if (outboundTrips.length < 2) {
            throw `Too few trips were generated for line ${line.toString()} and number of vehicles ${nbVehicles}. Simulation will not run properly`;
        }
        timeBetweenPassages = outboundTrips[1].departure_time_seconds - outboundTrips[0].departure_time_seconds;

        if (
            timeBetweenPassages !== lastTimeBetweenPassages &&
            timeBetweenPassages > minTime &&
            timeBetweenPassages < maxTime
        ) {
            // Keep this schedule and service if the time between passages is within range
            lineServices.push({
                numberOfVehicles: nbVehicles,
                service
            });
            line.addSchedule(schedule);
            lastTimeBetweenPassages = timeBetweenPassages;
        }
        nbVehicles++;
    }
    return lineServices;
};

/**
 * Get the longest path operating time in seconds from a line collection
 * @param lineCollection
 * @returns
 */
const getLongestPath = (lineCollection: LineCollection) =>
    lineCollection
        .getFeatures()
        .map((line) =>
            line
                .getPaths()
                .map((path) => path.attributes.data.operatingTimeWithLayoverTimeSeconds || 0)
                .reduce((totalTime, value) => Math.max(value, totalTime), 0)
        )
        .reduce((maxPathTime, currentMax) => Math.max(maxPathTime, currentMax), 0);

/**
 * Prepares the services for all lines in the line collection, given the
 * algorithm parameters. It creates schedules for a short period of time around
 * 8AM and 9AM and creates different levels of services by adding a vehicle at a
 * time for each line. Those services and schedules are not stored in the
 * database
 * @param simulatedLineCollection The collection containing all simulated lines
 * @param services The current service collection, with all services already
 * loaded
 * @param jobWrapper The job wrapper containing the job and its parameters
 * @returns The various levels of services for each line, the updated service
 * collection, and any error encountered during preparation
 */
export const prepareServices = async (
    simulatedLineCollection: LineCollection,
    services: ServiceCollection,
    jobWrapper: TransitNetworkDesignJobWrapper<EvolutionaryTransitNetworkDesignJobType>
): Promise<{ lineServices: AlgoTypes.LineServices; services: ServiceCollection; errors: ErrorMessage[] }> => {
    const lineServices: AlgoTypes.LineServices = {};
    const errors: ErrorMessage[] = [];
    // FIXME Previously, when run with simulation, we could re-use services created
    // for the simulation. Now with jobs, each is independent, but we can recover services from previous run job (if incomplete)
    const simulationServices = services
        .getFeatures()
        .filter((service) => service.attributes.data.forJob === jobWrapper.job.id);

    const periodGroups = Preferences.current.transit.periods[PERIOD_GROUP_SHORTNAME];
    if (!periodGroups || (periodGroups.periods || []).length === 0) {
        throw `Undefined or empty period for ${PERIOD_GROUP_SHORTNAME}`;
    }
    const longestPath = getLongestPath(simulatedLineCollection);
    // We don't need to create schedules for all day, just enough to cover the longest path round trip before 8AM et after 9AM.
    const defaultPeriodAttributes = {
        period_shortname: PERIOD_GROUP_SHORTNAME,
        start_at_hour: periodGroups.periods[0].startAtHour,
        end_at_hour: periodGroups.periods[0].endAtHour,
        custom_start_at_str: secondsSinceMidnightToTimeStr(8 * 60 * 60 - longestPath * 2),
        custom_end_at_str: secondsSinceMidnightToTimeStr(9 * 60 * 60 + longestPath * 2),
        trips: []
    };

    const lines = simulatedLineCollection.getFeatures();
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        try {
            const servicesForLine = await prepareServicesForLines(
                line,
                simulationServices,
                defaultPeriodAttributes,
                jobWrapper
            );
            // Add or update the service to the service collection
            servicesForLine.forEach((lvlOfService) =>
                services.getById(lvlOfService.service.getId()) !== undefined
                    ? services.updateById(lvlOfService.service.getId(), lvlOfService.service)
                    : services.add(lvlOfService.service)
            );
            lineServices[line.getId()] = servicesForLine;
        } catch (error) {
            // FIXME Add a handler to return localized message from TrError is available and do something else otherwise
            errors.push(error instanceof Error ? error.message : String(error));
        }
    }
    return { lineServices, services, errors };
};

/**
 * Save a simulation scenario to the database. It will create a single service
 * for the scenario that will contain the schedules for each simulated line
 * service.
 *
 * @param scenario Scenario to copy and save to the database
 * @param options Simulation run options
 * @returns The ID of the new scenario created or undefined if no scenario could
 * be saved
 */
export const saveSimulationScenario = async (
    scenario: Scenario,
    jobWrapper: TransitNetworkDesignJobWrapper<EvolutionaryTransitNetworkDesignJobType>
): Promise<string | undefined> => {
    try {
        console.log('saving simulation scenario');
        // Find all simulated services to merge as one
        const simulatedServiceIds = scenario.attributes.services.filter(
            (serviceId) =>
                !(jobWrapper.parameters.transitNetworkDesignParameters.nonSimulatedServices || []).includes(serviceId)
        );
        if (simulatedServiceIds.length === 0) {
            console.log('no simulated services to save for scenario', scenario.attributes.name);
            return undefined;
        }

        // Create a new service for this scenario and save to DB
        const service = new Service(
            {
                name: `GALND_${scenario.attributes.name}`,
                monday: true,
                tuesday: true,
                wednesday: true,
                thursday: true,
                friday: true,
                saturday: true,
                sunday: true,
                start_date: moment().format('YYYY-MM-DD'),
                end_date: moment().format('YYYY-MM-DD'),
                data: { forJob: jobWrapper.job.id }
            },
            true
        );
        await service.save(serviceLocator.socketEventManager);

        // For each service to merge and save, find the lines that has them
        for (let i = 0; i < simulatedServiceIds.length; i++) {
            const servicedLines = jobWrapper.simulatedLineCollection
                .getFeatures()
                .filter((line) => line.attributes.scheduleByServiceId[simulatedServiceIds[i]] !== undefined);
            // Copy the schedules for those services, add the service to the line, then save to the database
            for (let lineIdx = 0; lineIdx < servicedLines.length; lineIdx++) {
                const currentSchedule = new Schedule(
                    servicedLines[lineIdx].attributes.scheduleByServiceId[simulatedServiceIds[i]],
                    true
                );
                const scheduleAttributes = currentSchedule.getClonedAttributes(true);
                scheduleAttributes.service_id = service.getId();
                const schedule = new Schedule(scheduleAttributes, true);
                servicedLines[lineIdx].addSchedule(schedule);
                // Save the schedules to DB
                await schedule.save(serviceLocator.socketEventManager);
            }
        }

        // Create a new scenario, using the new service, as well as non-simulated services and save to DB
        const newScenario = new Scenario(
            {
                name: scenario.attributes.name,
                services: [
                    service.getId(),
                    ...(jobWrapper.parameters.transitNetworkDesignParameters.nonSimulatedServices || [])
                ],
                data: { forJob: jobWrapper.job.id }
            },
            true
        );
        await newScenario.save(serviceLocator.socketEventManager);

        return newScenario.getId();
    } catch (error) {
        console.error('Error saving simulation scenario:', error);
        return undefined;
    }
};
