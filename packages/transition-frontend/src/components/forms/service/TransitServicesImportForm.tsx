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

interface ServicesImportFormProps {
    setImporterSelected: (importerSelected: boolean) => void;
}

const ServicesImportForm: React.FunctionComponent<ServicesImportFormProps & WithTranslation> = (
    props: ServicesImportFormProps & WithTranslation
) => {
    const closeImporter = () => props.setImporterSelected(false);

    const onImported = async () => {
        await serviceLocator.collectionManager
            .get('services')
            .loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);
        serviceLocator.collectionManager.refresh('services');
        serviceLocator.eventManager.emit('progress', { name: 'Importing', progress: 1.0 });
        closeImporter();
    };

    React.useEffect(() => {
        serviceLocator.socketEventManager.on('importer.servicesImported', onImported);
        return () => {
            serviceLocator.socketEventManager.off('importer.servicesImported', onImported);
        };
    }, []);

    return (
        <FileImportForm
            pluralizedObjectsName={'services'}
            fileNameWithExtension={'services.json'}
            label={props.t('main:JsonFile')}
            closeImporter={closeImporter}
        />
    );
};

export default withTranslation(['transit', 'main'])(ServicesImportForm);
