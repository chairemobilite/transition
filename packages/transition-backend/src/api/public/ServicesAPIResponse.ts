/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { ServiceAttributes } from 'transition-common/lib/services/service/Service';
import APIResponseBase from './APIResponseBase';

export type ServicesAPIResponseFormat = Array<{
    id: string;
    name: string;
}>;

export default class ServicesAPIResponse extends APIResponseBase<ServicesAPIResponseFormat, ServiceAttributes[]> {
    protected createResponse(input: ServiceAttributes[]): ServicesAPIResponseFormat {
        return input.map((service: ServiceAttributes) => ({
            id: service.id,
            name: service.name!
        }));
    }
}
