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

interface NodeImportFormProps extends FileUploaderHOCProps {
    setImporterSelected: (importerSelected: boolean) => void;
}

const NodesImportForm: React.FunctionComponent<NodeImportFormProps & WithTranslation> = (
    props: NodeImportFormProps & WithTranslation
) => {
    const closeImporter = () => props.setImporterSelected(false);

    const onImported = async () => {
        await serviceLocator.collectionManager
            .get('nodes')
            .loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);
        serviceLocator.collectionManager.refresh('nodes');
        serviceLocator.eventManager.emit(
            'map.updateLayer',
            'transitNodes',
            serviceLocator.collectionManager.get('nodes').toGeojson()
        );
        serviceLocator.eventManager.emit('transferableNodes.dirty');
        serviceLocator.eventManager.emit('progress', { name: 'Importing', progress: 1.0 });
        closeImporter();
    };

    React.useEffect(() => {
        props.addEventListeners();
        serviceLocator.socketEventManager.on('importer.nodesImported', onImported);
        return () => {
            props.removeEventListeners();
            serviceLocator.socketEventManager.off('importer.nodesImported', onImported);
        };
    }, []);

    return (
        <FileImportForm
            validator={props.validator as ImporterValidator}
            pluralizedObjectsName={'nodes'}
            fileNameWithExtension={'nodes.geojson'}
            fileUploader={props.fileUploader}
            fileImportRef={props.fileImportRef}
            onChange={props.onChange}
            acceptsExtension={'.json,.geojson'}
            label={props.t('main:GeojsonFile')}
            closeImporter={closeImporter}
        />
    );
};

export default FileUploaderHOC(withTranslation(['transit', 'main'])(NodesImportForm), ImporterValidator);
