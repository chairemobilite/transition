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

interface PathImportFormProps extends FileUploaderHOCProps {
    setImporterSelected: (importerSelected: boolean) => void;
}

const PathsImportForm: React.FunctionComponent<PathImportFormProps & WithTranslation> = (
    props: PathImportFormProps & WithTranslation
) => {
    const closeImporter = () => props.setImporterSelected(false);

    const onImported = async () => {
        await serviceLocator.collectionManager
            .get('paths')
            .loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);
        await serviceLocator.collectionManager
            .get('lines')
            .loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);
        await serviceLocator.collectionManager
            .get('agencies')
            .loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);
        serviceLocator.collectionManager.refresh('paths');
        serviceLocator.collectionManager.refresh('lines');
        serviceLocator.collectionManager.refresh('agencies');
        serviceLocator.eventManager.emit(
            'map.updateLayer',
            'transitPaths',
            serviceLocator.collectionManager.get('paths').toGeojson()
        );
        serviceLocator.eventManager.emit('progress', { name: 'Importing', progress: 1.0 });
        closeImporter();
    };

    React.useEffect(() => {
        props.addEventListeners();
        serviceLocator.socketEventManager.on('importer.pathsImported', onImported);
        return () => {
            props.removeEventListeners();
            serviceLocator.socketEventManager.off('importer.pathsImported', onImported);
        };
    }, []);

    return (
        <FileImportForm
            validator={props.validator as ImporterValidator}
            pluralizedObjectsName={'paths'}
            fileNameWithExtension={'paths.geojson'}
            fileUploader={props.fileUploader}
            fileImportRef={props.fileImportRef}
            onChange={props.onChange}
            acceptsExtension={'.json,.geojson'}
            label={props.t('main:GeojsonFile')}
            closeImporter={closeImporter}
        />
    );
};

export default FileUploaderHOC(withTranslation(['transit', 'main'])(PathsImportForm), ImporterValidator);
