/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import ImporterValidator from 'chaire-lib-common/lib/services/importers/ImporterValidator';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import FileUploaderHOC, { FileUploaderHOCProps } from 'chaire-lib-frontend/lib/components/input/FileUploaderHOC';
import FileImportForm from '../../parts/FileImportForm';

interface ServicesImportFormProps extends FileUploaderHOCProps {
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
        props.addEventListeners();
        serviceLocator.socketEventManager.on('importer.servicesImported', onImported);
        return () => {
            props.removeEventListeners();
            serviceLocator.socketEventManager.off('importer.servicesImported', onImported);
        };
    }, []);

    return (
        <FileImportForm
            validator={props.validator as ImporterValidator}
            pluralizedObjectsName={'services'}
            fileNameWithExtension={'services.json'}
            fileUploader={props.fileUploader}
            fileImportRef={props.fileImportRef}
            onChange={props.onChange}
            label={props.t('main:JsonFile')}
            closeImporter={closeImporter}
        />
    );
};

export default FileUploaderHOC(withTranslation(['transit', 'main'])(ServicesImportForm), ImporterValidator);
