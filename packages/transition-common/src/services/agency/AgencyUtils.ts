/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import AgencyCollection from './AgencyCollection';
import { _makeStringUnique } from 'chaire-lib-common/lib/utils/LodashExtensions';

/**
 * Get a unique acronym for an agency by looking for duplicate acronyms in the
 * collection and adding a suffix to the acronym.
 *
 * @param {AgencyCollection} agencies The agency collection to look for similar
 * acronyms
 * @param {string} acronym The acronym to make unique
 */
export const getUniqueAgencyAcronym = (agencies: AgencyCollection, acronym: string): any => {
    return _makeStringUnique(
        acronym,
        agencies.features.map((agency) => agency.attributes.acronym)
    );
};
