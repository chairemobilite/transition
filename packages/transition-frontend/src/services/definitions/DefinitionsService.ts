/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import React from 'react';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { Dictionary } from 'lodash';

export const getDefinitionFromServer = (
    label: string,
    setDefinition: React.Dispatch<React.SetStateAction<Dictionary<string>>>,
    setGotError: React.Dispatch<React.SetStateAction<boolean>>
) => {
    serviceLocator.socketEventManager.emit(
        'service.getOneDefinition',
        label,
        (definitionFromServer: Status.Status<Dictionary<any>>) => {
            if (Status.isStatusOk(definitionFromServer)) {
                setDefinition(Status.unwrap(definitionFromServer));
            } else {
                setGotError(true);
            }
        }
    );
};
