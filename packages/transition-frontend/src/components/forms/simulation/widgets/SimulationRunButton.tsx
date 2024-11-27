/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import moment from 'moment';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import SimulationRun from 'transition-common/lib/services/simulation/SimulationRun';
import Button from '../../../parts/Button';
import ConfirmModal from 'chaire-lib-frontend/lib/components/modal/ConfirmModal';
import ButtonCell from '../../../parts/ButtonCell';
import Preferences from 'chaire-lib-common/lib/config/Preferences';

interface SimulationRunButtonProps extends WithTranslation {
    simulationRun: SimulationRun;
    setSelected: (run: SimulationRun | undefined) => void;
    updateList: () => void;
    isSelected: boolean;
}

const SimulationRunButton: React.FunctionComponent<SimulationRunButtonProps> = (props: SimulationRunButtonProps) => {
    const [deleteCascadeModalIsOpen, setDeleteCascadeModalIsOpen] = React.useState(false);

    const simulationRun = props.simulationRun;

    const openDeleteCascadeModal: React.MouseEventHandler = React.useCallback((e: React.MouseEvent) => {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }
        setDeleteCascadeModalIsOpen(true);
    }, []);

    const closeDeleteCascadeModal: React.MouseEventHandler = React.useCallback((e: React.MouseEvent) => {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }
        setDeleteCascadeModalIsOpen(false);
    }, []);

    const onSelect: React.MouseEventHandler = (e: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }
        props.setSelected(props.simulationRun);
    };

    const deleteRun = async (e: React.MouseEvent, deleteCascade) => {
        if (e) {
            e.stopPropagation();
        }

        setDeleteCascadeModalIsOpen(false);
        serviceLocator.eventManager.emit('progress', { name: 'DeletingSimulationRun', progress: 0.0 });
        await props.simulationRun.delete(serviceLocator.socketEventManager, deleteCascade);
        if (props.isSelected) {
            props.setSelected(undefined);
        }
        props.updateList();
        if (deleteCascade) {
            // reload scenarios and services
            const promises = [
                serviceLocator.collectionManager.get('scenarios').loadFromServer(serviceLocator.socketEventManager),
                serviceLocator.collectionManager.get('services').loadFromServer(serviceLocator.socketEventManager)
            ];
            await Promise.all(promises);
            serviceLocator.collectionManager.refresh('scenarios');
            serviceLocator.collectionManager.refresh('services');
        }
        serviceLocator.eventManager.emit('progress', { name: 'DeletingSimulationRun', progress: 1.0 });
    };

    return (
        <React.Fragment>
            <Button key={simulationRun.id} isSelected={false} onSelect={{ handler: onSelect }}>
                <ButtonCell alignment="left">{simulationRun.getId().substring(0, 8)}</ButtonCell>
                <ButtonCell alignment="left">{simulationRun.attributes.status}</ButtonCell>
                <ButtonCell alignment="left">
                    {moment(
                        simulationRun.attributes.completed_at ||
                            simulationRun.attributes.started_at ||
                            simulationRun.attributes.created_at
                    ).format(Preferences.get('dateTimeFormat'))}
                </ButtonCell>
                <ButtonCell
                    key={`${simulationRun.id}delete`}
                    alignment={'flush'}
                    onClick={openDeleteCascadeModal}
                    title={props.t('transit:simulation:SimulationRunDelete')}
                >
                    <img
                        className="_icon-alone"
                        src={'/dist/images/icons/interface/delete_white.svg'}
                        alt={props.t('transit:simulation:SimulationRunDelete')}
                    />
                </ButtonCell>
            </Button>
            {deleteCascadeModalIsOpen && (
                <ConfirmModal
                    isOpen={true}
                    title={props.t('transit:simulation:SimulationRunDelete')}
                    text={props.t('transit:simulation:SimulationRunDeleteScenariosAndServices')}
                    closeModal={closeDeleteCascadeModal}
                    buttons={{
                        cancel: {
                            label: props.t('transit:simulation:SimulationRunDeleteCancel'),
                            color: 'grey',
                            action: (e) => setDeleteCascadeModalIsOpen(false)
                        },
                        ignore: {
                            label: props.t('transit:simulation:SimulationRunDeleteNoCascade'),
                            color: 'blue',
                            action: (e) => deleteRun(e, false)
                        },
                        update: {
                            label: props.t('transit:simulation:SimulationRunDeleteCascade'),
                            color: 'blue',
                            action: (e) => deleteRun(e, true)
                        }
                    }}
                />
            )}
        </React.Fragment>
    );
};

export default withTranslation(['transit', 'notifications'])(SimulationRunButton);
