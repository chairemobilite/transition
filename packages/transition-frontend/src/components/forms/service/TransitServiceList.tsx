/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useState } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faTrash } from '@fortawesome/free-solid-svg-icons/faTrash';

import ConfirmModal from 'chaire-lib-frontend/lib/components/modal/ConfirmModal';
import TransitService from 'transition-common/lib/services/service/Service';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import TransitServiceButton from './TransitServiceButton';
import ButtonList from '../../parts/ButtonList';
import LineCollection from 'transition-common/lib/services/line/LineCollection';

interface ServiceListProps extends WithTranslation {
    lineCollection: LineCollection;
    serviceCollection: ServiceCollection;
    selectedService?: TransitService;
}

const TransitServiceList: React.FunctionComponent<ServiceListProps> = (props: ServiceListProps) => {
    const [showModal, setShowModal] = useState(false);
    
    const getLinesForService = (serviceId: string) => {
        return props.lineCollection
            .getFeatures()
            .filter((line) => line.attributes.service_ids?.includes(serviceId));
    };

    const newService = function () {
        const defaultColor = Preferences.get('transit.services.defaultColor', '#0086FF');
        const newService = new TransitService({ color: defaultColor }, true, serviceLocator.collectionManager);
        newService.startEditing();
        serviceLocator.selectedObjectsManager.select('service', newService);
    };

    const deleteUnused = async () => {
        if (props.serviceCollection) {
            serviceLocator.eventManager.emit('progress', {
                name: 'DeletingUnusedServices',
                progress: 0.0
            });
            await props.serviceCollection.deleteUnused(serviceLocator.socketEventManager);
            await props.serviceCollection.loadFromServer(
                serviceLocator.socketEventManager,
                serviceLocator.collectionManager
            );
            serviceLocator.collectionManager.refresh('services');

            serviceLocator.eventManager.emit('progress', {
                name: 'DeletingUnusedServices',
                progress: 1.0
            });
        }
    };

    const hasUnused = props.serviceCollection
        ? props.serviceCollection
            .getFeatures()
            .find((service) => !service.isFrozen() && !service.hasScheduledLines()) !== undefined
        : false;

    return (
        <div className="tr__list-transit-services-container">
            <h3>
                <img
                    src={'/dist/images/icons/transit/service_white.svg'}
                    className="_icon"
                    alt={props.t('transit:transitService:Service')}
                />{' '}
                {props.t('transit:transitService:List')}
            </h3>
            <ButtonList key="services">
                {props.serviceCollection &&
                    props.serviceCollection
                        .getFeatures()
                        .map((service: TransitService) => (
                            <TransitServiceButton
                                key={service.id}
                                service={service}
                                selectedService={props.selectedService}
                                lines={getLinesForService(service.id)}
                            />
                        ))}
            </ButtonList>

            {!props.selectedService && (
                <div className="tr__form-buttons-container">
                    <Button
                        color="blue"
                        icon={faPlus}
                        iconClass="_icon"
                        label={props.t('transit:transitService:New')}
                        onClick={newService}
                    />
                    {hasUnused && (
                        <Button
                            color="red"
                            icon={faTrash}
                            iconClass="_icon"
                            label={props.t('transit:transitService:DeleteUnused')}
                            onClick={() => setShowModal(true)}
                        />
                    )}
                    {hasUnused && showModal && (
                        <ConfirmModal
                            isOpen={true}
                            title={props.t('transit:transitService:ConfirmDeleteUnused')}
                            confirmAction={deleteUnused}
                            confirmButtonColor="red"
                            confirmButtonLabel={props.t('main:Delete')}
                            closeModal={() => setShowModal(false)}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default withTranslation(['transit', 'main', 'notifications'])(TransitServiceList);
