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
import FileUploaderHOC from 'chaire-lib-frontend/lib/components/input/FileUploaderHOC';
import FileImportForm from '../../parts/FileImportForm';

interface AgencyImportFormProps extends WithTranslation {
    addEventListeners: () => void;
    removeEventListeners: () => void;
    onChange: React.ChangeEventHandler;
    setImporterSelected: (importerSelected: boolean) => void;
    fileUploader?: any;
    fileImportRef?: any;
    validator: ImporterValidator;
}

const AgenciesImportForm: React.FunctionComponent<AgencyImportFormProps> = (props: AgencyImportFormProps) => {
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
        props.addEventListeners();
        serviceLocator.socketEventManager.on('importer.agenciesImported', onImported);
        return () => {
            props.removeEventListeners();
            serviceLocator.socketEventManager.off('importer.agenciesImported', onImported);
        };
    }, []);

    return (
        <FileImportForm
            validator={props.validator}
            pluralizedObjectsName={'agencies'}
            fileNameWithExtension={'agencies.json'}
            fileUploader={props.fileUploader}
            fileImportRef={props.fileImportRef}
            onChange={props.onChange}
            label={props.t('main:JsonFile')}
            acceptsExtension={'.json'}
            closeImporter={closeImporter}
        />
    );
};

export default FileUploaderHOC(withTranslation(['transit', 'main'])(AgenciesImportForm), ImporterValidator);
