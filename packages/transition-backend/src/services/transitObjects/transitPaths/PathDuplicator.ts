/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { WithTransaction } from 'chaire-lib-backend/lib/models/db/types.db';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import transitPathsDbQueries from '../../../models/db/transitPaths.db.queries';

/**
 * Type of the options for the path duplication.
 */
export type DuplicatePathOptions = {
    /**
     * The IDs of the paths to duplicate
     */
    pathIds?: string[];
    /**
     * A mapping of duplicated lines for which to also duplicate paths. The key
     * is the original line ID and the value is the duplicated line ID
     */
    lineIdMapping?: { [key: string]: string };
    /**
     * An optional suffix to append to duplicated path names
     */
    newPathSuffix?: string;
};

/**
 * Duplicate paths in the database
 * @param {DuplicatePathOptions} options The path duplication options. Either or
 * both pathIds and lineIdMapping must bet set.
 * @param {WithTransaction} arg.transaction The transaction this duplication
 * is part of, if any
 * @returns A status object a mapping of the previous path IDs to the new
 * ones
 */
export const duplicatePaths = async (
    options: DuplicatePathOptions,
    { transaction }: WithTransaction = {}
): Promise<Status.Status<{ [originalPathId: string]: string }>> => {
    try {
        const { pathIds, lineIdMapping } = options;
        if (
            (pathIds === undefined || pathIds.length === 0) &&
            (lineIdMapping === undefined || Object.keys(lineIdMapping).length === 0)
        ) {
            throw new TrError('Path duplication argument error: either pathIds or lineIds must be set', 'PATHDUP001');
        }
        const result = await transitPathsDbQueries.duplicate({ ...options, transaction });
        return Status.createOk(result);
    } catch (error) {
        console.log('An error occurred while duplicating paths: ', error);
        return Status.createError('An error occurred while duplicating paths');
    }
};
