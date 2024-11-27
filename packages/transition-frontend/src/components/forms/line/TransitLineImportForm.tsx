/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import FileImportForm from '../../parts/FileImportForm';

interface LineImportFormProps {
    setImporterSelected: (importerSelected: boolean) => void;
}

const LineImportForm: React.FunctionComponent<LineImportFormProps & WithTranslation> = (
    props: LineImportFormProps & WithTranslation
) => {
    const closeImporter = () => props.setImporterSelected(false);

    const onImported = async () => {
        await serviceLocator.collectionManager
            .get('lines')
            .loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);
        await serviceLocator.collectionManager
            .get('agencies')
            .loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);
        serviceLocator.collectionManager.refresh('agencies');
        serviceLocator.collectionManager.refresh('lines');
        serviceLocator.eventManager.emit('progress', { name: 'Importing', progress: 1.0 });
        closeImporter();
    };

    React.useEffect(() => {
        serviceLocator.socketEventManager.on('importer.linesImported', onImported);
        return () => {
            serviceLocator.socketEventManager.off('importer.linesImported', onImported);
        };
    }, []);

    return (
        <FileImportForm
            pluralizedObjectsName={'lines'}
            fileNameWithExtension={'lines.json'}
            label={props.t('main:JsonFile')}
            acceptsExtension={'.json'}
            closeImporter={closeImporter}
        />
    );
};

export default withTranslation(['main', 'notifications'])(LineImportForm);
