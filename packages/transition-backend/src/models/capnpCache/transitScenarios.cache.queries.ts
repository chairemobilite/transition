/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import Scenario from 'transition-common/lib/services/scenario/Scenario';
import ScenarioCollection from 'transition-common/lib/services/scenario/ScenarioCollection';
import {
    collectionToCache as defaultCollectionToCache,
    collectionFromCache as defaultCollectionFromCache
} from 'chaire-lib-backend/lib/models/capnp/default.cache.queries';
import {
    ScenarioCollection as CacheCollection,
    Scenario as CacheObject
} from '../capnpDataModel/scenarioCollection.capnp';
import { boolToInt8, int8ToBool } from 'chaire-lib-backend/lib/utils/json2capnp/CapnpConversionUtils';
import { _emptyStringToNull } from 'chaire-lib-common/lib/utils/LodashExtensions';

const collectionToCache = async (collection: ScenarioCollection, cachePathDirectory?: string) => {
    return defaultCollectionToCache({
        collection,
        cacheName: 'scenarios',
        cachePathDirectory,
        pluralizedCollectionName: 'Scenarios',
        maxNumberOfObjectsPerFile: 1000,
        CacheCollection,
        CollectionClass: ScenarioCollection,
        capnpParser: function (object: Scenario, cacheObject: CacheObject) {
            const attributes = object.attributes;

            cacheObject.setUuid(attributes.id);
            cacheObject.setName(attributes.name || '');
            cacheObject.setColor(attributes.color || '');
            cacheObject.setIsEnabled(boolToInt8(attributes.is_enabled));
            cacheObject.setDescription(attributes.description || '');
            cacheObject.setSimulationUuid(attributes.simulation_id || '');
            cacheObject.setIsFrozen(boolToInt8(attributes.is_frozen));
            cacheObject.setData(JSON.stringify(attributes.data || {}));

            const services = attributes.services || [];
            const servicesCount = services.length;
            const servicesUuids = cacheObject.initServicesUuids(servicesCount);
            for (let i = 0; i < servicesCount; i++) {
                servicesUuids.set(i, services[i]);
            }

            const onlyAgencies = attributes.only_agencies || [];
            const onlyAgenciesCount = onlyAgencies.length;
            const onlyAgenciesUuids = cacheObject.initOnlyAgenciesUuids(onlyAgenciesCount);
            for (let i = 0; i < onlyAgenciesCount; i++) {
                onlyAgenciesUuids.set(i, onlyAgencies[i]);
            }

            const exceptAgencies = attributes.except_agencies || [];
            const exceptAgenciesCount = exceptAgencies.length;
            const exceptAgenciesUuids = cacheObject.initExceptAgenciesUuids(exceptAgenciesCount);
            for (let i = 0; i < exceptAgenciesCount; i++) {
                exceptAgenciesUuids.set(i, exceptAgencies[i]);
            }

            const onlyLines = attributes.only_lines || [];
            const onlyLinesCount = onlyLines.length;
            const onlyLinesUuids = cacheObject.initOnlyLinesUuids(onlyLinesCount);
            for (let i = 0; i < onlyLinesCount; i++) {
                onlyLinesUuids.set(i, onlyLines[i]);
            }

            const exceptLines = attributes.except_lines || [];
            const exceptLinesCount = exceptLines.length;
            const exceptLinesUuids = cacheObject.initExceptLinesUuids(exceptLinesCount);
            for (let i = 0; i < exceptLinesCount; i++) {
                exceptLinesUuids.set(i, exceptLines[i]);
            }

            const onlyNodes = attributes.only_nodes || [];
            const onlyNodesCount = onlyNodes.length;
            const onlyNodesUuids = cacheObject.initOnlyNodesUuids(onlyNodesCount);
            for (let i = 0; i < onlyNodesCount; i++) {
                onlyNodesUuids.set(i, onlyNodes[i]);
            }

            const exceptNodes = attributes.except_nodes || [];
            const exceptNodesCount = exceptNodes.length;
            const exceptNodesUuids = cacheObject.initExceptNodesUuids(exceptNodesCount);
            for (let i = 0; i < exceptNodesCount; i++) {
                exceptNodesUuids.set(i, exceptNodes[i]);
            }

            const onlyModes = attributes.only_modes || [];
            const onlyModesCount = onlyModes.length;
            const onlyModesShortnames = cacheObject.initOnlyModesShortnames(onlyModesCount);
            for (let i = 0; i < onlyModesCount; i++) {
                onlyModesShortnames.set(i, onlyModes[i]);
            }

            const exceptModes = attributes.except_modes || [];
            const exceptModesCount = exceptModes.length;
            const exceptModesShortnames = cacheObject.initExceptModesShortnames(exceptModesCount);
            for (let i = 0; i < exceptModesCount; i++) {
                exceptModesShortnames.set(i, exceptModes[i]);
            }
        }
    });
};

const collectionFromCache = function (cachePathDirectory?: string) {
    return defaultCollectionFromCache({
        collection: new ScenarioCollection([], {}),
        CollectionClass: ScenarioCollection,
        cacheName: 'scenarios',
        cachePathDirectory,
        pluralizedCollectionName: 'Scenarios',
        CacheCollection,
        parser: function (object) {
            if (object.attributes) {
                return new Scenario(object.attributes, false);
            } else {
                return new Scenario(object, false);
            }
        },
        capnpParser: function (cacheObject: CacheObject) {
            return new Scenario(
                {
                    id: cacheObject.getUuid(),
                    name: _emptyStringToNull(cacheObject.getName()),
                    color: _emptyStringToNull(cacheObject.getColor()),
                    is_enabled: int8ToBool(cacheObject.getIsEnabled()),
                    is_frozen: int8ToBool(cacheObject.getIsFrozen()),
                    description: _emptyStringToNull(cacheObject.getDescription()),
                    simulation_id: _emptyStringToNull(cacheObject.getSimulationUuid()),
                    data: JSON.parse(cacheObject.getData()),
                    services: cacheObject.getServicesUuids().map((serviceUuid) => {
                        return serviceUuid;
                    }),

                    only_agencies: cacheObject.getOnlyAgenciesUuids().map((agencyUuid) => {
                        return agencyUuid;
                    }),
                    only_lines: cacheObject.getOnlyLinesUuids().map((lineUuid) => {
                        return lineUuid;
                    }),
                    only_nodes: cacheObject.getOnlyNodesUuids().map((nodeUuid) => {
                        return nodeUuid;
                    }),
                    only_modes: cacheObject.getOnlyModesShortnames().map((modeShortname) => {
                        return modeShortname;
                    }),

                    except_agencies: cacheObject.getExceptAgenciesUuids().map((agencyUuid) => {
                        return agencyUuid;
                    }),
                    except_lines: cacheObject.getExceptLinesUuids().map((lineUuid) => {
                        return lineUuid;
                    }),
                    except_nodes: cacheObject.getExceptNodesUuids().map((nodeUuid) => {
                        return nodeUuid;
                    }),
                    except_modes: cacheObject.getExceptModesShortnames().map((modeShortname) => {
                        return modeShortname;
                    })
                },
                false
            );
        }
    });
};

export { collectionToCache, collectionFromCache };
