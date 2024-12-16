/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { RoutingMode } from '../../config/routingModes';
import { TransitRoutingResult, TransitRoutingResultData } from './TransitRoutingResult';
import { RoutingResult, UnimodalRoutingResult, UnimodalRoutingResultData } from './RoutingResult';

export type ResultsByMode = {
    [key in RoutingMode]?: UnimodalRoutingResult;
} & {
    transit?: TransitRoutingResult;
};

const resultIsUnimodal = (
    result: UnimodalRoutingResultData | TransitRoutingResultData
): result is UnimodalRoutingResultData => {
    return (result as any).routingMode !== undefined && (result as any).routingMode !== 'transit';
};

export const resultToObject = (resultData: UnimodalRoutingResultData | TransitRoutingResultData): RoutingResult => {
    if (resultIsUnimodal(resultData)) {
        return new UnimodalRoutingResult(resultData);
    }
    return new TransitRoutingResult(resultData);
};
