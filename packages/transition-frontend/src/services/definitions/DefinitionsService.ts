/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { Dictionary } from 'lodash';

// Cache the definitions once they are fetched. This is to avoid fetching the
// same definition multiple times. 'loading' means a request to the server is
// ongoing and further requests for the same label can wait for it to return.
// 'error' means the server returned an error for this definition. If the
// definition is not in this cache, it has not been fetched yet.
const definitionCache: { [label: string]: Dictionary<string> | 'loading' | 'error' } = {};

export const getDefinitionFromServer = (
    label: string,
    setDefinition: (arg: Dictionary<string>) => void,
    setGotError: (arg: boolean) => void
) => {
    if (definitionCache[label] === 'loading') {
        // Wait for the previous call to complete
        const interval = setInterval(() => {
            if (definitionCache[label] !== 'loading') {
                clearInterval(interval);
                if (definitionCache[label] === 'error') {
                    setGotError(true);
                } else {
                    setDefinition(definitionCache[label] as Dictionary<string>);
                }
            }
        }, 500);
    } else if (definitionCache[label] !== undefined && definitionCache[label] !== 'error') {
        // If the definition is already loaded, return it
        setDefinition(definitionCache[label] as Dictionary<string>);
    } else {
        // FIXME In case the label is in error, we should throttle the retries, now it just retries indefinitely
        // Set the definition as 'loading' and fetch the definition from server
        definitionCache[label] = 'loading';
        serviceLocator.socketEventManager.emit(
            'service.getOneDefinition',
            label,
            (definitionFromServer: Status.Status<Dictionary<string>>) => {
                if (Status.isStatusOk(definitionFromServer)) {
                    const definition = Status.unwrap(definitionFromServer);
                    definitionCache[label] = definition;
                    setDefinition(definition);
                    setGotError(false);
                } else {
                    definitionCache[label] = 'error';
                    setGotError(true);
                }
            }
        );
    }
};
