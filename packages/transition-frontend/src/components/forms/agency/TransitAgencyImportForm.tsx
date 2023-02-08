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

interface AgencyImportFormProps {
    setImporterSelected: (importerSelected: boolean) => void;
}

const AgenciesImportForm: React.FunctionComponent<AgencyImportFormProps & WithTranslation> = (
    props: AgencyImportFormProps & WithTranslation
) => {
    const closeImporter = () => props.setImporterSelected(false);

    const onImported = async () => {
        await serviceLocator.collectionManager
            .get('agencies')
            .loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);
        serviceLocator.collectionManager.refresh('agencies');
        serviceLocator.eventManager.emit('progress', { name: 'Importing', progress: 1.0 });
        closeImporter();
    };

    React.useEffect(() => {
        serviceLocator.socketEventManager.on('importer.agenciesImported', onImported);
        return () => {
            serviceLocator.socketEventManager.off('importer.agenciesImported', onImported);
        };
    }, []);

    return (
        <FileImportForm
            pluralizedObjectsName={'agencies'}
            fileNameWithExtension={'agencies.json'}
            label={props.t('main:JsonFile')}
            acceptsExtension={'.json'}
            closeImporter={closeImporter}
        />
    );
};

export default withTranslation(['transit', 'main'])(AgenciesImportForm);
