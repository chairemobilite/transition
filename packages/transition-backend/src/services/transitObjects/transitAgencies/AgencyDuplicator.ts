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
import transitAgenciesDbQueries from '../../../models/db/transitAgencies.db.queries';
import { duplicateLines } from '../transitLines/LineDuplicator';

/**
 * Type of the options for the agency duplication.
 */
export type DuplicateAgencyOptions = {
    /**
     * The IDs of the agencies to duplicate
     */
    agencyIds: string[];
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
     * An suffix to append to duplicated object names
     */
    newObjectsSuffix: string;
};

/**
 * Duplicate lines in the database
 * @param {DuplicateAgencyOptions} options The agency duplication options.
 * @param {WithTransaction} arg.transaction The transaction this duplication
 * is part of, if any. The function returns a Status, so if an error occurs, it is
 * the caller's responsibility to detect it and rollback if necessary.
 * @returns A status object with the mapping of the previous agency IDs to the new
 * ones, or an error if anything happened during the function execution.
 */
export const duplicateAgencies = async (
    options: DuplicateAgencyOptions,
    { transaction }: WithTransaction = {}
): Promise<Status.Status<{ [originalLineId: string]: string }>> => {
    try {
        const { agencyIds } = options;
        const newAgencySuffix = await getCommonSuffix(options, { transaction });
        const duplicateWithTransaction = async (trx: Knex.Transaction) => {
            // Duplicate the requested lines
            const agencyIdMapping = await transitAgenciesDbQueries.duplicate({
                agencyIds,
                newAgencySuffix,
                transaction: trx
            });
            if (Object.keys(agencyIdMapping).length === 0) {
                return Status.createOk(agencyIdMapping);
            }
            // Duplicate the agencies' line, without suffix as they are in new lines, they will keep their former names
            Status.unwrap(
                await duplicateLines(
                    {
                        agencyIdMapping,
                        duplicateSchedules: options.duplicateSchedules,
                        duplicateServices: options.duplicateServices
                    },
                    { transaction: trx }
                )
            );

            return Status.createOk(agencyIdMapping);
        };
        return transaction
            ? await duplicateWithTransaction(transaction)
            : await knex.transaction(duplicateWithTransaction);
    } catch (error) {
        console.log('An error occurred while duplicating agencies: ', error);
        return Status.createError('An error occurred while duplicating agencies');
    }
};

const maxIterationForCommonSuffix = 20;
/**
 * Get a unique name for a service by looking for duplicate names in the
 * database and adding a suffix to the name.
 */
const getCommonSuffix = async (
    options: DuplicateAgencyOptions,
    { transaction }: WithTransaction = {}
): Promise<string> => {
    let iteration = 0;
    let hasClash = false;
    do {
        const suffix = iteration === 0 ? options.newObjectsSuffix : `${options.newObjectsSuffix}-${iteration}`;
        hasClash = await transitAgenciesDbQueries.isAcronymSuffixClash({
            agencyIds: options.agencyIds,
            suffix,
            transaction
        });
        if (!hasClash) {
            return suffix;
        }
        iteration++;
    } while (iteration <= maxIterationForCommonSuffix);
    throw new Error(
        `Getting agency suffix for duplication. Cannot find a suffix for agency duplication after ${maxIterationForCommonSuffix}. Please delete or rename a few agencies`
    );
};
