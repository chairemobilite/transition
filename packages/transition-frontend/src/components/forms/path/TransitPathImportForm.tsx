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
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';
import { MapUpdateLayerEventType } from 'chaire-lib-frontend/lib/services/map/events/MapEventsCallbacks';

interface PathImportFormProps {
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
        (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
            layerName: 'transitPaths',
            data: serviceLocator.collectionManager.get('paths').toGeojson()
        });
        serviceLocator.eventManager.emit('progress', { name: 'Importing', progress: 1.0 });
        closeImporter();
    };

    React.useEffect(() => {
        serviceLocator.socketEventManager.on('importer.pathsImported', onImported);
        return () => {
            serviceLocator.socketEventManager.off('importer.pathsImported', onImported);
        };
    }, []);

    return (
        <FileImportForm
            pluralizedObjectsName={'paths'}
            fileNameWithExtension={'paths.geojson'}
            acceptsExtension={'.json,.geojson'}
            label={props.t('main:GeojsonFile')}
            closeImporter={closeImporter}
        />
    );
};

export default withTranslation(['transit', 'main'])(PathsImportForm);
