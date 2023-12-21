/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import Collapsible from 'react-collapsible';
import { faFileUpload } from '@fortawesome/free-solid-svg-icons/faFileUpload';

import Button from 'chaire-lib-frontend/lib/components/input/Button';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import CollectionDownloadButtons from 'chaire-lib-frontend/lib/components/pageParts/CollectionDownloadButtons';
import CollectionSaveToCacheButtons from '../../parts/CollectionSaveToCacheButtons';
import AgencyEdit from './TransitAgencyEdit';
import LineEdit from '../line/TransitLineEdit';
import AgenciesList, { AgencyListState } from './TransitAgencyList';
import AgencyImportForm from './TransitAgencyImportForm';
import LineImportForm from '../line/TransitLineImportForm';
import PathImportForm from '../path/TransitPathImportForm';
import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import Agency from 'transition-common/lib/services/agency/Agency';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import Line from 'transition-common/lib/services/line/Line';
import Path from 'transition-common/lib/services/path/Path';
import Schedule from 'transition-common/lib/services/schedules/Schedule';

interface AgencyPanelProps extends WithTranslation {
    availableRoutingModes: string[];
    parentRef?: React.RefObject<HTMLDivElement>;
}

interface AgencyPanelState {
    agencyCollection: AgencyCollection;
    lineCollection: LineCollection;
    pathCollection: PathCollection;
    selectedAgency?: Agency;
    selectedLine?: Line;
    selectedPath?: Path;
    selectedSchedule?: Schedule;
}

const AgencyPanel: React.FunctionComponent<AgencyPanelProps> = (props: AgencyPanelProps) => {
    const [agencyImporterSelected, setAgencyImporterSelected] = React.useState(false);
    const [lineImporterSelected, setLineImporterSelected] = React.useState(false);
    const [pathImporterSelected, setPathImporterSelected] = React.useState(false);
    const [agenciesListState, setAgenciesListState] = React.useState<AgencyListState>({
        expanded: [],
        currentScrollPosition: 0
    });
    const [rerender, setRerender] = React.useState(0);
    const [state, setState] = React.useState<AgencyPanelState>({
        agencyCollection: serviceLocator.collectionManager.get('agencies'),
        lineCollection: serviceLocator.collectionManager.get('lines'),
        pathCollection: serviceLocator.collectionManager.get('paths'),
        selectedAgency: serviceLocator.selectedObjectsManager.get('agency'),
        selectedLine: serviceLocator.selectedObjectsManager.get('line'),
        selectedPath: serviceLocator.selectedObjectsManager.get('path'),
        selectedSchedule: serviceLocator.selectedObjectsManager.get('schedule')
    });

    React.useEffect(() => {
        const onAgencyCollectionUpdate = () =>
            setState(({ agencyCollection, ...rest }) => ({
                ...rest,
                agencyCollection: serviceLocator.collectionManager.get('agencies')
            }));
        const onSelectedAgencyUpdate = () =>
            setState(({ selectedAgency, ...rest }) => ({
                ...rest,
                selectedAgency: serviceLocator.selectedObjectsManager.get('agency')
            }));
        const onLineCollectionUpdate = () =>
            setState(({ lineCollection, ...rest }) => ({
                ...rest,
                lineCollection: serviceLocator.collectionManager.get('lines')
            }));
        const onSelectedLineUpdate = () =>
            setState(({ selectedLine, ...rest }) => ({
                ...rest,
                selectedLine: serviceLocator.selectedObjectsManager.get('line')
            }));
        const onPathCollectionUpdate = () =>
            setState(({ pathCollection, ...rest }) => ({
                ...rest,
                pathCollection: serviceLocator.collectionManager.get('paths')
            }));
        const onSelectedPathUpdate = () =>
            setState(({ selectedPath, ...rest }) => ({
                ...rest,
                selectedPath: serviceLocator.selectedObjectsManager.get('path')
            }));
        const onSelectedScheduleUpdate = () =>
            setState(({ selectedSchedule, ...rest }) => ({
                ...rest,
                selectedSchedule: serviceLocator.selectedObjectsManager.get('schedule')
            }));
        const onUpdateLayersFilter = () => {
            setRerender(rerender + 1);
        };
        serviceLocator.eventManager.on('collection.update.agencies', onAgencyCollectionUpdate);
        serviceLocator.eventManager.on('selected.update.agency', onSelectedAgencyUpdate);
        serviceLocator.eventManager.on('selected.deselect.agency', onSelectedAgencyUpdate);
        serviceLocator.eventManager.on('collection.update.lines', onLineCollectionUpdate);
        serviceLocator.eventManager.on('selected.update.line', onSelectedLineUpdate);
        serviceLocator.eventManager.on('selected.deselect.line', onSelectedLineUpdate);
        serviceLocator.eventManager.on('collection.update.paths', onPathCollectionUpdate);
        serviceLocator.eventManager.on('selected.update.path', onSelectedPathUpdate);
        serviceLocator.eventManager.on('selected.deselect.path', onSelectedPathUpdate);
        serviceLocator.eventManager.on('selected.update.schedule', onSelectedScheduleUpdate);
        serviceLocator.eventManager.on('selected.deselect.schedule', onSelectedScheduleUpdate);
        serviceLocator.eventManager.on('map.layers.updateFilter', onUpdateLayersFilter);
        return () => {
            serviceLocator.eventManager.off('collection.update.agencies', onAgencyCollectionUpdate);
            serviceLocator.eventManager.off('selected.update.agency', onSelectedAgencyUpdate);
            serviceLocator.eventManager.off('selected.deselect.agency', onSelectedAgencyUpdate);
            serviceLocator.eventManager.off('collection.update.lines', onLineCollectionUpdate);
            serviceLocator.eventManager.off('selected.update.line', onSelectedLineUpdate);
            serviceLocator.eventManager.off('selected.deselect.line', onSelectedLineUpdate);
            serviceLocator.eventManager.off('collection.update.paths', onPathCollectionUpdate);
            serviceLocator.eventManager.off('selected.update.path', onSelectedPathUpdate);
            serviceLocator.eventManager.off('selected.deselect.path', onSelectedPathUpdate);
            serviceLocator.eventManager.off('selected.update.schedule', onSelectedScheduleUpdate);
            serviceLocator.eventManager.off('selected.deselect.schedule', onSelectedScheduleUpdate);
            serviceLocator.eventManager.off('map.layers.updateFilter', onUpdateLayersFilter);
        };
    }, []);

    const importerSelected = agencyImporterSelected || lineImporterSelected || pathImporterSelected;
    const objectSelected = state.selectedAgency || state.selectedLine || state.selectedPath;

    return (
        <div id="tr__form-transit-agencies-panel" className="tr__form-transit-agencies-panel tr__panel">
            {!state.selectedAgency && !state.selectedLine && !importerSelected && (
                <AgenciesList
                    agencyCollection={state.agencyCollection}
                    agenciesListState={agenciesListState}
                    updateAgenciesListState={setAgenciesListState}
                    parentRef={props.parentRef}
                />
            )}

            {state.selectedAgency && !importerSelected && <AgencyEdit agency={state.selectedAgency} />}

            {state.selectedLine && !importerSelected && (
                <LineEdit
                    line={state.selectedLine}
                    selectedPath={state.selectedPath}
                    selectedSchedule={!!state.selectedSchedule}
                    agencyCollection={state.agencyCollection}
                    availableRoutingModes={props.availableRoutingModes}
                />
            )}

            {!objectSelected && agencyImporterSelected && (
                <AgencyImportForm setImporterSelected={setAgencyImporterSelected} />
            )}

            {!objectSelected && lineImporterSelected && (
                <LineImportForm setImporterSelected={setLineImporterSelected} />
            )}

            {!objectSelected && pathImporterSelected && (
                <PathImportForm setImporterSelected={setPathImporterSelected} />
            )}

            {!objectSelected && !importerSelected && (
                <Collapsible trigger={props.t('form:importExport')} transitionTime={100}>
                    <h3 className="tr__form-buttons-container">{props.t('transit:transitAgency:Agencies')}</h3>
                    {!agencyImporterSelected && (
                        <div className="tr__form-buttons-container">
                            <Button
                                color="blue"
                                icon={faFileUpload}
                                iconClass="_icon"
                                label={props.t('transit:transitAgency:ImportFromJson')}
                                onClick={() => setAgencyImporterSelected(true)}
                            />
                        </div>
                    )}
                    <CollectionSaveToCacheButtons
                        collection={state.agencyCollection}
                        labelPrefix={'transit:transitAgency'}
                    />
                    <CollectionDownloadButtons collection={state.agencyCollection} />

                    <h3 className="tr__form-buttons-container">{props.t('transit:transitLine:Lines')}</h3>
                    {!lineImporterSelected && (
                        <div className="tr__form-buttons-container">
                            <Button
                                color="blue"
                                icon={faFileUpload}
                                iconClass="_icon"
                                label={props.t('transit:transitLine:ImportFromJson')}
                                onClick={() => setLineImporterSelected(true)}
                            />
                        </div>
                    )}
                    <CollectionSaveToCacheButtons
                        collection={state.lineCollection}
                        labelPrefix={'transit:transitLine'}
                    />
                    <CollectionDownloadButtons collection={state.lineCollection} />

                    <h3 className="tr__form-buttons-container">{props.t('transit:transitPath:Paths')}</h3>
                    {!pathImporterSelected && (
                        <div className="tr__form-buttons-container">
                            <Button
                                color="blue"
                                icon={faFileUpload}
                                iconClass="_icon"
                                label={props.t('transit:transitPath:ImportFromGeojson')}
                                onClick={() => setPathImporterSelected(true)}
                            />
                        </div>
                    )}
                    <CollectionSaveToCacheButtons
                        collection={state.pathCollection}
                        labelPrefix={'transit:transitPath'}
                    />
                    <CollectionDownloadButtons collection={state.pathCollection} />
                </Collapsible>
            )}
        </div>
    );
};

export default withTranslation(['transit', 'main', 'form'])(AgencyPanel);
