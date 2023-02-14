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

interface ScenarioImportFormProps {
    setImporterSelected: (importerSelected: boolean) => void;
}

const ScenariosImportForm: React.FunctionComponent<ScenarioImportFormProps & WithTranslation> = (
    props: ScenarioImportFormProps & WithTranslation
) => {
    const closeImporter = () => props.setImporterSelected(false);

    const onImported = async () => {
        await serviceLocator.collectionManager
            .get('scenarios')
            .loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);
        serviceLocator.collectionManager.refresh('scenarios');
        serviceLocator.eventManager.emit('progress', { name: 'Importing', progress: 1.0 });
        closeImporter();
    };

    React.useEffect(() => {
        serviceLocator.socketEventManager.on('importer.scenariosImported', onImported);
        return () => {
            serviceLocator.socketEventManager.off('importer.scenariosImported', onImported);
        };
    }, []);

    return (
        <FileImportForm
            pluralizedObjectsName={'scenarios'}
            fileNameWithExtension={'scenarios.json'}
            label={props.t('main:JsonFile')}
            closeImporter={closeImporter}
        />
    );
};

export default withTranslation(['transit', 'main'])(ScenariosImportForm);
