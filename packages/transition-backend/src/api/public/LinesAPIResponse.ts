/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import APIResponseBase from './APIResponseBase';
import { LineAttributes } from 'transition-common/lib/services/line/Line';

export type LinesAPIResponseFormat = Array<{
    id: string;
    name: string;
    longname: string;
    agency_id: string;
    mode: string;
    category?: string;
}>;

export default class LinesAPIResponse extends APIResponseBase<LinesAPIResponseFormat, LineAttributes[]> {
    protected createResponse(input: LineAttributes[]): LinesAPIResponseFormat {
        return input.map((line: LineAttributes) => ({
            id: line.id,
            name: line.shortname!,
            longname: line.longname,
            agency_id: line.agency_id,
            mode: line.mode,
            category: line.category
        }));
    }
}
