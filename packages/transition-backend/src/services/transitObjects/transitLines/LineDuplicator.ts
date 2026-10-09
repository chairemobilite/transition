/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Knex } from 'knex';
import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { WithTransaction } from 'chaire-lib-backend/lib/models/db/types.db';
import transitLinesDbQueries from '../../../models/db/transitLines.db.queries';
import { duplicatePaths } from '../transitPaths/PathDuplicator';
import { duplicateServices } from '../transitServices/ServiceDuplicator';
import { duplicateSchedules, getServiceIdsForLines } from '../transitSchedules/ScheduleUtils';

// Arbitrary value, there was not much tests done for it, the impact on
// performance was not significant no matter the value tried. Should be not too
// low to not increase the number of queries by too much, nor too high to avoid
// potential memory overhead if the chunks end up with too many trips to
// duplicate.
const MAPPING_CHUNK_SIZE = 20;

const chunkIds = (ids: string[]): string[][] => {
    const chunks: string[][] = [];
    for (let index = 0; index < ids.length; index += MAPPING_CHUNK_SIZE) {
        chunks.push(ids.slice(index, index + MAPPING_CHUNK_SIZE));
    }
    return chunks;
};

/**
 * Type of the options for the line duplication.
 */
export type DuplicateLineOptions = {
    /**
     * The IDs of the lines to duplicate
     */
    lineIds?: string[];
    /**
     * A mapping of duplicated agencies for which to also duplicate lines. The key
     * is the original agency ID and the value is the duplicated agency ID
     */
    agencyIdMapping?: { [currentAgencyId: string]: string };
    /**
     * Whether to copy the schedules
     */
    duplicateSchedules?: boolean;
    /**
     * Whether to duplicate the services when duplicating the schedules
     * FIXME Should this be implied? Could one really want to copy schedules in the _same_ service and add more service from a copy?
     */
    duplicateServices?: boolean;
    /**
     * An optional suffix to append to duplicated object names
     */
    newObjectsSuffix?: string;
};

/**
 * Duplicate lines in the database
 * @param {DuplicateLineOptions} options The line duplication options. Either or
 * both lineIds and agencyIdMapping must bet set.
 * @param {WithTransaction} arg.transaction The transaction this duplication
 * is part of, if any. The function returns a Status, so if an error occurs, it is
 * the caller's responsibility to detect it and rollback if necessary.
 * @returns A status object with the mapping of the previous line IDs to the new
 * ones, or an error if anything happened during the function execution
 */
export const duplicateLines = async (
    options: DuplicateLineOptions,
    { transaction }: WithTransaction = {}
): Promise<Status.Status<{ [originalLineId: string]: string }>> => {
    try {
        const { lineIds, agencyIdMapping, newObjectsSuffix } = options;
        const duplicateWithTransaction = async (trx: Knex.Transaction) => {
            // Duplicate the requested lines
            const lineIdMapping = await transitLinesDbQueries.duplicate({
                lineIds,
                agencyIdMapping,
                newLineSuffix: newObjectsSuffix,
                transaction: trx
            });
            if (Object.keys(lineIdMapping).length === 0) {
                return Status.createOk(lineIdMapping);
            }

            const serviceIdMapping: { [originalServiceId: string]: string } = {};
            for (const lineIdsChunk of chunkIds(Object.keys(lineIdMapping))) {
                const lineMappingChunk = Object.fromEntries(
                    lineIdsChunk.map((lineId) => [lineId, lineIdMapping[lineId]])
                );
                // Restrict path duplication to the current lines so schedule
                // mappings only contain paths belonging to this line batch.
                const pathIdMapping = Status.unwrap(
                    await duplicatePaths({ lineIdMapping: lineMappingChunk }, { transaction: trx })
                );

                if (options.duplicateSchedules) {
                    const serviceIds = await getServiceIdsForLines(lineIdsChunk, { transaction: trx });
                    const serviceChunks = options.duplicateServices ? chunkIds(serviceIds) : [[]];

                    for (const serviceIdsChunk of serviceChunks) {
                        if (options.duplicateServices) {
                            const newServiceIds = serviceIdsChunk.filter(
                                (serviceId) => serviceIdMapping[serviceId] === undefined
                            );
                            if (newServiceIds.length > 0) {
                                Object.assign(
                                    serviceIdMapping,
                                    Status.unwrap(
                                        await duplicateServices(
                                            { serviceIds: newServiceIds, newServiceSuffix: newObjectsSuffix },
                                            { transaction: trx }
                                        )
                                    )
                                );
                            }
                        }

                        const serviceIdMappingChunk = Object.fromEntries(
                            serviceIdsChunk
                                .filter((serviceId) => serviceIdMapping[serviceId] !== undefined)
                                .map((serviceId) => [serviceId, serviceIdMapping[serviceId]])
                        );
                        Status.unwrap(
                            await duplicateSchedules(
                                {
                                    lineIdMapping: lineMappingChunk,
                                    pathIdMapping,
                                    serviceIdMapping: serviceIdMappingChunk
                                },
                                { transaction: trx }
                            )
                        );
                    }
                }
            }

            return Status.createOk(lineIdMapping);
        };
        return transaction
            ? await duplicateWithTransaction(transaction)
            : await knex.transaction(duplicateWithTransaction);
    } catch (error) {
        console.log('An error occurred while duplicating lines: ', error);
        return Status.createError('An error occurred while duplicating lines');
    }
};
