/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import { getDefinitionInAllLanguages } from '../services/documentation/Definitions';
import { Dictionary } from 'lodash';
import * as Status from 'chaire-lib-common/lib/utils/Status';

export default function (socket: EventEmitter) {
    socket.on(
        'service.getOneDefinition',
        async (label: string, callback: (status: Status.Status<Dictionary<any>>) => void) => {
            try {
                const definitionWithLabel = await getDefinitionInAllLanguages(label);
                callback(Status.createOk(definitionWithLabel));
            } catch (error) {
                console.error(`An error occurred while fetching the definition with label '${label}': ${error}`);
                callback(Status.createError(`Error fetching the definition with label '${label}'`));
            }
        }
    );
}
