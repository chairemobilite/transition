/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import { withTranslation, WithTranslation } from 'react-i18next';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import Agency from 'transition-common/lib/services/agency/Agency';
import Line from 'transition-common/lib/services/line/Line';
import { duplicateAgency } from 'transition-common/lib/services/agency/AgencyDuplicator';
import Button from '../../parts/Button';
import ButtonCell from '../../parts/ButtonCell';
import ButtonList from '../../parts/ButtonList';
import TransitLineButton from '../line/TransitLineButton';

interface AgencyButtonProps extends WithTranslation {
    agency: Agency;
    selectedAgency?: Agency;
    selectedLine?: Line;
}

const TransitAgencyButton: React.FunctionComponent<AgencyButtonProps> = (props: AgencyButtonProps) => {
    const [agencyIsHidden, setAgencyIsHidden] = React.useState(
        serviceLocator.pathLayerManager.agencyIsHidden(props.agency.getId())
    );
    const agencyIsSelected = (props.selectedAgency && props.selectedAgency.getId() === props.agency.getId()) || false;

    const onSelect: React.MouseEventHandler = async (e: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }
        props.agency.startEditing();
        serviceLocator.selectedObjectsManager.select('agency', props.agency);
    };

    const onDelete: React.MouseEventHandler = async (e: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }

        const agencyHasLines = props.agency.hasLines();

        serviceLocator.eventManager.emit('progress', { name: 'DeletingAgency', progress: 0.0 });
        try {
            await props.agency.delete(serviceLocator.socketEventManager);
            if (agencyIsSelected) {
                serviceLocator.selectedObjectsManager.deselect('agency');
            }
            if (agencyHasLines) {
                // reload paths
                await serviceLocator.collectionManager.get('paths').loadFromServer(serviceLocator.socketEventManager);
                serviceLocator.collectionManager.refresh('paths');
                serviceLocator.eventManager.emit(
                    'map.updateLayer',
                    'transitPaths',
                    serviceLocator.collectionManager.get('paths').toGeojson()
                );
                await serviceLocator.collectionManager.get('lines').loadFromServer(serviceLocator.socketEventManager);
                serviceLocator.collectionManager.refresh('lines');
            }
        } catch (error) {
            console.error('Error deleting agency', error);
        } finally {
            serviceLocator.eventManager.emit('progress', { name: 'DeletingAgency', progress: 1.0 });
            serviceLocator.collectionManager.refresh('agencies');
        }
    };

    const onDuplicate: React.MouseEventHandler = async (e: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }

        serviceLocator.eventManager.emit('progress', { name: 'SavingAgency', progress: 0.0 });
        await duplicateAgency(props.agency, {
            socket: serviceLocator.socketEventManager,
            duplicateSchedules: true,
            duplicateServices: true,
            newName: `${props.agency.get('name')} (${props.t('main:Copy')})`,
            newServiceSuffix: props.t('main:Copy')
        });

        serviceLocator.collectionManager.refresh('paths');
        serviceLocator.collectionManager.refresh('lines');
        serviceLocator.collectionManager.refresh('agencies');
        serviceLocator.eventManager.emit(
            'map.updateLayer',
            'transitPaths',
            serviceLocator.collectionManager.get('paths').toGeojson()
        );
        serviceLocator.eventManager.emit('progress', { name: 'SavingAgency', progress: 1.0 });
    };

    const newLineForAgency = (e: React.MouseEvent) => {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }
        const defaultColor = Preferences.get('transit.lines.defaultColor', '#0086FF');
        const newTransitLine = new Line(
            { color: props.agency.get('color') || defaultColor, agency_id: props.agency.getId() },
            true,
            serviceLocator.collectionManager
        );
        newTransitLine.startEditing();
        serviceLocator.selectedObjectsManager.select('line', newTransitLine);
    };

    const showOnMap = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (serviceLocator.keyboardManager.keyIsPressed('alt')) {
            serviceLocator.pathLayerManager.showAllAgencies();
        } else {
            serviceLocator.pathLayerManager.showAgencyId(props.agency.getId());
        }
        setAgencyIsHidden(false);
    };

    const hideOnMap = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (serviceLocator.keyboardManager.keyIsPressed('alt')) {
            serviceLocator.pathLayerManager.hideAllAgencies();
        } else {
            serviceLocator.pathLayerManager.hideAgencyId(props.agency.getId());
        }
        setAgencyIsHidden(true);
    };

    const isFrozen = props.agency.isFrozen();
    const lines = props.agency.getLines();

    const linesButtons = lines.map((line) => (
        <TransitLineButton
            key={line.id}
            line={line}
            selectedLine={props.selectedLine}
            lineIsHidden={
                serviceLocator.pathLayerManager ? serviceLocator.pathLayerManager.lineIsHidden(line.id) : false
            }
        />
    ));

    return (
        <React.Fragment>
            <Button
                key={props.agency.getId()}
                isSelected={agencyIsSelected}
                flushActionButtons={false}
                onSelect={{ handler: onSelect }}
                onDuplicate={{ handler: onDuplicate, altText: props.t('transit:transitAgency:DuplicateAgency') }}
                onDelete={
                    !isFrozen && !agencyIsSelected
                        ? {
                            handler: onDelete,
                            message: props.t('transit:transitAgency:ConfirmDelete'),
                            altText: props.t('transit:transitAgency:Delete')
                        }
                        : undefined
                }
            >
                <ButtonCell alignment="left">
                    <span className="_circle-button" style={{ backgroundColor: props.agency.attributes.color }}></span>
                    {agencyIsHidden === true && (
                        <span className="_list-element" onClick={showOnMap} title={props.t('main:Show')}>
                            <img
                                className="_list-element _icon-alone"
                                src={'/dist/images/icons/interface/hidden_white.svg'}
                                alt={props.t('main:Show')}
                                title={props.t('main:Show')}
                            />
                        </span>
                    )}
                    {agencyIsHidden === false && (
                        <span className="_list-element" onClick={hideOnMap} title={props.t('main:Hide')}>
                            <img
                                className="_list-element _icon-alone"
                                src={'/dist/images/icons/interface/visible_white.svg'}
                                alt={props.t('main:Hide')}
                                title={props.t('main:Hide')}
                            />
                        </span>
                    )}
                </ButtonCell>
                {isFrozen && (
                    <ButtonCell alignment="left">
                        <img
                            className="_icon-alone"
                            src={'/dist/images/icons/interface/lock_white.svg'}
                            alt={props.t('main:Locked')}
                        />
                    </ButtonCell>
                )}
                <ButtonCell alignment="left">{props.agency.attributes.acronym}</ButtonCell>
                <ButtonCell alignment="left">{props.agency.attributes.name}</ButtonCell>
                <ButtonCell alignment="flush">
                    {lines.length > 1
                        ? props.t('transit:transitAgency:nLines', { n: lines.length })
                        : props.t('transit:transitAgency:nLine', { n: lines.length })}
                </ButtonCell>
                {!isFrozen && !agencyIsSelected && (
                    <ButtonCell alignment="right" onClick={newLineForAgency} title={props.t('transit:transitLine:New')}>
                        <img
                            className="_list-element _icon-alone"
                            src={'/dist/images/icons/transit/line_add_white.svg'}
                            alt={props.t('transit:transitLine:New')}
                            title={props.t('transit:transitLine:New')}
                        />
                    </ButtonCell>
                )}
            </Button>
            <div className="tr__form-agencies-panel-lines-list">
                <Button key={`lines${props.agency.getId()}`} isSelected={agencyIsSelected} flushActionButtons={false}>
                    <Collapsible
                        lazyRender={true}
                        trigger={props.t('transit:transitLine:List')}
                        open={false}
                        transitionTime={100}
                    >
                        <ButtonList key={`lines${props.agency.getId()}`}>
                            {linesButtons}
                            {!isFrozen && (
                                <Button isSelected={false} key="containerLink">
                                    <ButtonCell
                                        alignment="left"
                                        onClick={newLineForAgency}
                                        title={props.t('transit:transitLine:New')}
                                    >
                                        <img
                                            className="_list-element _icon-alone"
                                            src={'/dist/images/icons/transit/line_add_white.svg'}
                                            alt={props.t('transit:transitLine:New')}
                                            title={props.t('transit:transitLine:New')}
                                        />
                                        <span className="_list-element">{props.t('transit:transitLine:New')}</span>
                                    </ButtonCell>
                                </Button>
                            )}
                        </ButtonList>
                    </Collapsible>
                </Button>
            </div>
        </React.Fragment>
    );
};

export default withTranslation(['transit', 'main', 'form', 'notifications'])(TransitAgencyButton);
