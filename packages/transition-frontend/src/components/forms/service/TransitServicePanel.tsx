/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { faFileUpload } from '@fortawesome/free-solid-svg-icons/faFileUpload';

import Button from 'chaire-lib-frontend/lib/components/input/Button';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import CollectionDownloadButtons from 'chaire-lib-frontend/lib/components/pageParts/CollectionDownloadButtons';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import Service from 'transition-common/lib/services/service/Service';
import CollectionSaveToCacheButtons from '../../parts/CollectionSaveToCacheButtons';
import ServiceEdit from './TransitServiceEdit';
import ServicesList from './TransitServiceList';
import ServicesImportForm from './TransitServicesImportForm';
import LineCollection from 'transition-common/lib/services/line/LineCollection';

// Using a state object instead of 2 useState hooks because we want this object
// to be modified and cause a re-render if the selection or collection was
// updated, even if the pointer to the collection/selected object do not change.
interface ServicePanelState {
    lineCollection: LineCollection;
    serviceCollection: ServiceCollection;
    selectedService?: Service;
}

const ServicesPanel: React.FunctionComponent<WithTranslation> = (props: WithTranslation) => {
    const [importerSelected, setImporterSelected] = React.useState(false);
    const [state, setState] = React.useState<ServicePanelState>({
        lineCollection: serviceLocator.collectionManager.get('lines'),
        serviceCollection: serviceLocator.collectionManager.get('services'),
        selectedService: serviceLocator.selectedObjectsManager.get('service')
    });
    const onLineCollectionUpdate = () =>
        setState(({ serviceCollection, selectedService }) => ({
            serviceCollection,
            selectedService,
            lineCollection: serviceLocator.collectionManager.get('lines') 
    }));
    const onServiceCollectionUpdate = () =>
        setState(({ selectedService, lineCollection }) => ({
            selectedService,
            serviceCollection: serviceLocator.collectionManager.get('services'),
            lineCollection 
    }));
    const onSelectedServiceUpdate = () =>
        setState(({ serviceCollection, lineCollection }) => ({
            serviceCollection,
            selectedService: serviceLocator.selectedObjectsManager.get('service'),
            lineCollection 
        }));

    React.useEffect(() => {
        serviceLocator.eventManager.on('collection.update.services', onServiceCollectionUpdate);
        serviceLocator.eventManager.on('selected.update.service', onSelectedServiceUpdate);
        serviceLocator.eventManager.on('selected.deselect.service', onSelectedServiceUpdate);
        serviceLocator.eventManager.on('collection.update.lines', onLineCollectionUpdate); 
        // Reload the service collections at mount time, to make sure it is up to date
        if (state.serviceCollection) {
            state.serviceCollection.loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);
        }
        if (state.lineCollection) {
            state.lineCollection.loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager).then(() => {
            });
        } 
        return () => {
            serviceLocator.eventManager.off('collection.update.services', onServiceCollectionUpdate);
            serviceLocator.eventManager.off('selected.update.service', onSelectedServiceUpdate);
            serviceLocator.eventManager.off('selected.deselect.service', onSelectedServiceUpdate);
            serviceLocator.eventManager.off('collection.update.lines', onLineCollectionUpdate); 
        };
    }, []);

    return (
        <div id="tr__form-transit-services-panel" className="tr__form-transit-services-panel tr__panel">
            {!state.selectedService && !importerSelected && (
                <ServicesList
                    selectedService={state.selectedService}
                    serviceCollection={state.serviceCollection}
                    lineCollection={state.lineCollection} 
                />
            )}

            {state.selectedService && !importerSelected && (
                <ServiceEdit service={state.selectedService} serviceCollection={state.serviceCollection} />
            )}

            {!state.selectedService && importerSelected && (
                <ServicesImportForm setImporterSelected={setImporterSelected} />
            )}

            {!state.selectedService && !importerSelected && (
                <div className="tr__form-buttons-container">
                    <Button
                        color="blue"
                        icon={faFileUpload}
                        iconClass="_icon"
                        label={props.t('transit:transitService:ImportFromJson')}
                        onClick={() => setImporterSelected(true)}
                    />
                </div>
            )}

            {!state.selectedService && !importerSelected && (
                <React.Fragment>
                    <CollectionSaveToCacheButtons
                        collection={state.serviceCollection}
                        labelPrefix={'transit:transitService'}
                    />
                    <CollectionDownloadButtons collection={state.serviceCollection} />
                </React.Fragment>
            )}
        </div>
    );
};

export default withTranslation('transit')(ServicesPanel);
