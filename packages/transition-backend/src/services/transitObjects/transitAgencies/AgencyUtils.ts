/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { _makeStringUnique } from 'chaire-lib-common/lib/utils/LodashExtensions';
import transitAgenciesDbQueries from '../../../models/db/transitAgencies.db.queries';

/**
 * Get a unique acronym for an agency by looking for duplicate acronyms in the
 * collection and adding a suffix to the acronym.
 *
 * @param {string} acronym The acronym to make unique
 */
export const getUniqueAgencyAcronym = async (acronym: string): Promise<string> => {
    const agencies = await transitAgenciesDbQueries.collection();
    return _makeStringUnique(
        acronym,
        agencies.map((agency) => agency.acronym)
    );
};
