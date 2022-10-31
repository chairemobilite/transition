/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { faArchive } from '@fortawesome/free-solid-svg-icons/faArchive';

import Button from 'chaire-lib-frontend/lib/components/input/Button';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import GenericCollection from 'chaire-lib-common/lib/utils/objects/GenericCollection';

interface CollectionSaveToCacheProps extends WithTranslation {
    collection?: GenericCollection<any>;
    labelPrefix: string;
}

// TODO: Remove when saving to cache is automatic
const CollectionSaveToCacheButtons: React.FunctionComponent<CollectionSaveToCacheProps> = (
    props: CollectionSaveToCacheProps
) => {
    const collection = props.collection;

    if (!collection || collection.size() === 0 || typeof (collection as any).saveCache !== 'function') {
        return null;
    }

    const collectionName = collection.displayName;
    const labelPrefix = props.labelPrefix;

    const onSaveToCacheClick = async () => {
        serviceLocator.eventManager.emit('progress', { name: `Saving${collectionName}Cache`, progress: 0.0 });
        await (collection as any).saveCache(serviceLocator.socketEventManager);
        serviceLocator.eventManager.emit('progress', { name: `Saving${collectionName}Cache`, progress: 1.0 });
    };

    return (
        <div>
            <div className="tr__form-buttons-container">
                <Button
                    color="blue"
                    icon={faArchive}
                    iconClass="_icon"
                    label={props.t(`${labelPrefix}.SaveToCache`)}
                    onClick={onSaveToCacheClick}
                />
            </div>
        </div>
    );
};

export default withTranslation(['transit', 'main', 'form'])(CollectionSaveToCacheButtons);
