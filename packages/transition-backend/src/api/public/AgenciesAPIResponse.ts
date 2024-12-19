/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import APIResponseBase from './APIResponseBase';
import { AgencyAttributes } from 'transition-common/lib/services/agency/Agency';

export type AgenciesAPIResponseFormat = Array<{
    id: string;
    name: string;
    acronym: string;
    description?: string;
}>;

export default class AgenciesAPIResponse extends APIResponseBase<AgenciesAPIResponseFormat, AgencyAttributes[]> {
    protected createResponse(input: AgencyAttributes[]): AgenciesAPIResponseFormat {
        return input.map((agency: AgencyAttributes) => ({
            id: agency.id,
            name: agency.name!,
            acronym: agency.acronym,
            description: agency.description
        }));
    }
}
