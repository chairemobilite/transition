/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { ScenarioAttributes } from 'transition-common/lib/services/scenario/Scenario';
import APIResponseBase from './APIResponseBase';

export type ScenariosAPIResponseFormat = Array<{
    id: string;
    name: string;
    services: string[];
    only_agencies: string[];
    except_agencies: string[];
    only_lines: string[];
    except_lines: string[];
    only_modes: string[];
    except_modes: string[];
}>;

export default class ScenariosAPIResponse extends APIResponseBase<ScenariosAPIResponseFormat, ScenarioAttributes[]> {
    protected createResponse(input: ScenarioAttributes[]): ScenariosAPIResponseFormat {
        return input.map((scenario: ScenarioAttributes) => ({
            id: scenario.id,
            name: scenario.name!,
            services: scenario.services,
            only_agencies: scenario.only_agencies,
            except_agencies: scenario.except_agencies,
            only_lines: scenario.only_lines,
            except_lines: scenario.except_lines,
            only_modes: scenario.only_modes,
            except_modes: scenario.except_modes
        }));
    }
}
