/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import Collapsible from 'react-collapsible';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons/faArrowLeft';
import { faUndoAlt } from '@fortawesome/free-solid-svg-icons/faUndoAlt';
import { faRedoAlt } from '@fortawesome/free-solid-svg-icons/faRedoAlt';
import { faTrashAlt } from '@fortawesome/free-solid-svg-icons/faTrashAlt';
import { faCheckCircle } from '@fortawesome/free-solid-svg-icons/faCheckCircle';
import { faRoute } from '@fortawesome/free-solid-svg-icons/faRoute';
import _toString from 'lodash/toString';
import MathJax from 'react-mathjax';
import { point as turfPoint, featureCollection as turfFeatureCollection } from '@turf/turf';

//import lineRoutingEngines                                  from '../../../../config/transition/pathRoutingEngines';
import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';
import InputText from 'chaire-lib-frontend/lib/components/input/InputText';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import InputRadio from 'chaire-lib-frontend/lib/components/input/InputRadio';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import { InputCheckboxBoolean } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import PathStatistics from './TransitPathStatistics';
import ConfirmModal from 'chaire-lib-frontend/lib/components/modal/ConfirmModal';
import lineModesConfig from 'transition-common/lib/config/lineModes';
import { SaveableObjectForm, SaveableObjectState } from 'chaire-lib-frontend/lib/components/forms/SaveableObjectForm';
import { parseIntOrNull, parseFloatOrNull } from 'chaire-lib-common/lib/utils/MathUtils';
import Path, { pathDirectionArray } from 'transition-common/lib/services/path/Path';
import Line from 'transition-common/lib/services/line/Line';
import { NodeAttributes } from 'transition-common/lib/services/nodes/Node';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';
import { MapUpdateLayerEventType } from 'chaire-lib-frontend/lib/services/map/events/MapEventsCallbacks';

const lineModesConfigByMode = {};
for (let i = 0, countI = lineModesConfig.length; i < countI; i++) {
    const lineMode = lineModesConfig[i];
    lineModesConfigByMode[lineMode.value] = lineMode;
}

interface PathFormProps extends WithTranslation {
    path: Path;
    line: Line;
    availableRoutingModes: string[];
}

interface PathFormState extends SaveableObjectState<Path> {
    pathErrors: string[];
    confirmModalSchedulesAffectedlIsOpen: boolean;
}

class TransitPathEdit extends SaveableObjectForm<Path, PathFormProps, PathFormState> {
    private resetChangesCount = 0;

    constructor(props: PathFormProps) {
        super(props);

        this.state = {
            object: props.path,
            confirmModalDeleteIsOpen: false,
            confirmModalBackIsOpen: false,
            // FIXME tahini: Not using the form values here because fields may change from other places (like merging services)
            formValues: {},
            selectedObjectName: 'path',
            collectionName: 'paths',
            pathErrors: [],
            confirmModalSchedulesAffectedlIsOpen: false
        };
    }

    // TODO Not the suggested approach, the 'object' should not be in the state after all, it is a prop (see issue #307)
    static getDerivedStateFromProps(props: any, state: PathFormState) {
        if (props.path !== state.object) {
            return {
                object: props.path
            };
        }
        return null;
    }

    toggleTemporaryManualRouting = () => {
        this.onValueChange('data.temporaryManualRouting', {
            value: !this.props.path.getData('temporaryManualRouting')
        });
    };

    componentDidMount() {
        serviceLocator.eventManager.on('selected.deselect.path', this.onDeselect);
        serviceLocator.eventManager.on('waypoint.drag', this.onDragWaypoint);
        serviceLocator.eventManager.on('waypoint.update', this.onUpdateWaypoint);
        serviceLocator.eventManager.on('waypoint.replaceByNodeId', this.onReplaceWaypointByNodeId);
        serviceLocator.eventManager.on('selected.updateLayers.path', this.updateLayers);
        // Call the updateLayers method to display the path on the map, as the event may have been emitted before the listener was added
        this.updateLayers();
        serviceLocator.keyboardManager.on('m', this.toggleTemporaryManualRouting);
    }

    componentWillUnmount() {
        serviceLocator.eventManager.off('selected.deselect.path', this.onDeselect);
        serviceLocator.eventManager.off('waypoint.drag', this.onDragWaypoint);
        serviceLocator.eventManager.off('waypoint.update', this.onUpdateWaypoint);
        serviceLocator.eventManager.off('waypoint.replaceByNodeId', this.onReplaceWaypointByNodeId);
        serviceLocator.eventManager.off('selected.updateLayers.path', this.updateLayers);
        serviceLocator.keyboardManager.off('m');
    }

    updateLayers = () => {
        const geojson = this.props.path.toGeojson();
        const nodesGeojsons = this.props.path.nodesGeojsons();
        serviceLocator.eventManager.emit('map.updateLayers', {
            transitPathsSelected: turfFeatureCollection(geojson.geometry ? [geojson] : []),
            transitNodesSelected: turfFeatureCollection(nodesGeojsons),
            transitNodesRoutingRadius: turfFeatureCollection(nodesGeojsons),
            transitPathWaypoints: turfFeatureCollection(this.props.path.waypointsGeojsons()),
            transitNodesSelectedErrors: turfFeatureCollection(
                this.props.path.attributes.data.geographyErrors?.nodes
                    ? this.props.path.attributes.data.geographyErrors.nodes
                    : []
            ),
            transitPathWaypointsErrors: turfFeatureCollection(
                this.props.path.attributes.data.geographyErrors?.waypoints
                    ? this.props.path.attributes.data.geographyErrors.waypoints
                    : []
            )
        });
    };

    onValueChange = (path: string, value?: { value: any; isValid?: boolean }) => {
        super.onValueChange(path, value);
        this.updateLayers();
    };

    onHistoryChange = () => {
        // Reset invalid fields
        this.resetInvalidFields();
        this.resetChangesCount++;
    };

    openSchedulesAffectedConfirmModal = (e: React.MouseEvent) => {
        e.stopPropagation();
        this.setState({
            confirmModalSchedulesAffectedlIsOpen: true
        });
    };

    closeSchedulesAffectedConfirmModal = (e: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }
        this.setState({
            confirmModalSchedulesAffectedlIsOpen: false
        });
    };

    cancel = (e: React.MouseEvent) => {
        e.stopPropagation();
        this.props.path.cancelEditing();
        this.updateLayers();
        this.closeSchedulesAffectedConfirmModal(e);
    };

    onCancelAffectedSchedulesChanges = (e: React.MouseEvent) => {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }
        this.cancel(e);
        this.closeSchedulesAffectedConfirmModal(e);
    };

    onSaveAndIgnoreAffectedSchedules = async (e: React.MouseEvent) => {
        e.stopPropagation();

        const path = this.props.path;
        this.props.line.attributes.data._pathsChangeTimestamp = Date.now();
        serviceLocator.eventManager.emit('progress', { name: 'SavingPath', progress: 0.0 });
        await path.save(serviceLocator.socketEventManager);
        serviceLocator.selectedObjectsManager.deselect('path');
        this.props.line.refreshPaths();
        serviceLocator.eventManager.emit('progress', { name: 'SavingPath', progress: 1.0 });
        this.closeSchedulesAffectedConfirmModal(e);
    };

    onUpdateAffectedSchedules = async (e: React.MouseEvent) => {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }

        const path = this.props.path;
        const line = this.props.line;
        line.attributes.data._pathsChangeTimestamp = Date.now();
        serviceLocator.eventManager.emit('progress', { name: 'SavingPath', progress: 0.0 });
        await path.save(serviceLocator.socketEventManager);
        serviceLocator.selectedObjectsManager.deselect('path');
        serviceLocator.eventManager.emit('progress', { name: 'SavingPath', progress: 1.0 });
        serviceLocator.eventManager.emit('progress', { name: 'SavingLine', progress: 0.0 });
        await line.updateSchedulesForPathId(path.getId(), true);
        line.refreshPaths();
        serviceLocator.eventManager.emit('progress', { name: 'SavingLine', progress: 1.0 });
        this.closeSchedulesAffectedConfirmModal(e);
    };

    onDeselect = () => {
        serviceLocator.collectionManager.refresh('paths');
        serviceLocator.eventManager.emit('map.updateLayers', {
            transitPaths: serviceLocator.collectionManager.get('paths').toGeojson(),
            transitPathsSelected: turfFeatureCollection([]),
            transitNodesSelected: turfFeatureCollection([]),
            transitNodesRoutingRadius: turfFeatureCollection([]),
            transitPathWaypoints: turfFeatureCollection([])
        });
        serviceLocator.eventManager.emit('map.enableBoxZoom');
    };

    onDragWaypoint = (coordinates: [number, number]) => {
        if (this.props.path.isFrozen()) {
            (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
                layerName: 'transitPathWaypointsSelected',
                data: turfFeatureCollection([])
            });
            return true;
        }
        const waypointGeojson = turfPoint(coordinates);
        (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
            layerName: 'transitPathWaypointsSelected',
            data: turfFeatureCollection([waypointGeojson])
        });
    };

    onReplaceWaypointByNodeId = async (
        nodeId: string,
        waypointType = 'engine',
        waypointIndex: number,
        afterNodeIndex: number
    ) => {
        if (this.props.path.isFrozen()) {
            (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
                layerName: 'transitPathWaypointsSelected',
                data: turfFeatureCollection([])
            });
            return true;
        }
        await this.props.path.replaceWaypointByNodeId(nodeId, afterNodeIndex, waypointIndex, waypointType);
        this.props.path.validate();
        serviceLocator.selectedObjectsManager.update('path', this.props.path);
        (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
            layerName: 'transitPathWaypointsSelected',
            data: turfFeatureCollection([])
        });
        serviceLocator.eventManager.emit('selected.updateLayers.path');
    };

    onUpdateWaypoint = (coordinates: [number, number], waypointIndex: number, afterNodeIndex: number) => {
        (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
            layerName: 'transitPathWaypointsSelected',
            data: turfFeatureCollection([])
        });
        if (!this.props.path.isFrozen()) {
            this.props.path
                .updateWaypoint(coordinates, undefined, afterNodeIndex, waypointIndex)
                .then(() => {
                    this.props.path.validate();
                    serviceLocator.selectedObjectsManager.update('path', this.props.path);
                    serviceLocator.eventManager.emit('selected.updateLayers.path');
                })
                .catch((error) => {
                    console.error('cannot update path geography', error);
                });
        } else {
            serviceLocator.eventManager.emit('map.enableDragPan');
        }
    };

    render() {
        const path = this.props.path;
        const line = this.props.line;
        const mode = line.attributes.mode;
        const pathId = path.id;
        const pathData = path.attributes.data;
        const nodes = path.attributes.nodes;
        const isFrozen = path.isFrozen();

        const autocompleteNameChoices: { value: string; label: string }[] = [];
        ['North', 'NorthAbbr', 'South', 'SouthAbbr', 'East', 'EastAbbr', 'West', 'WestAbbr'].forEach(
            (cardinalPoint) => {
                const label = this.props.t(`main:${cardinalPoint}`);
                autocompleteNameChoices.push({
                    value: label,
                    label
                });
            }
        );
        let firstNode: GeoJSON.Feature<GeoJSON.Point, NodeAttributes> | undefined = undefined;
        let lastNode: GeoJSON.Feature<GeoJSON.Point, NodeAttributes> | undefined = undefined;
        if (nodes.length >= 2 && serviceLocator.collectionManager.get('nodes')) {
            firstNode = serviceLocator.collectionManager.get('nodes').getById(nodes[0]);
            lastNode = serviceLocator.collectionManager.get('nodes').getById(nodes[nodes.length - 1]);
            if (lastNode && lastNode.properties.name) {
                const label = this.props.t('main:Direction') + ' ' + lastNode.properties.name;
                autocompleteNameChoices.unshift({
                    value: label,
                    label
                });
            }
        }

        // TODO This whole routing mode compatibility check should probably be better managed directly in the backend
        const routingModes: { value: string; disabled?: boolean }[] = [];
        // Check the path's routing mode if available
        const pathRoutingMode = pathData.routingMode;
        const pathRoutingEngine =
            pathData.routingEngine ||
            Preferences.get(
                `transit.lines.lineModesDefaultValues.${mode}.routingEngine`,
                lineModesConfigByMode[mode].defaultValues.routingEngine
            );
        let routingModeFound = false;
        const compatibleRoutingModes = lineModesConfigByMode[mode].compatibleRoutingModes;
        for (let i = 0, countI = compatibleRoutingModes.length; i < countI; i++) {
            const routingModeShortname = compatibleRoutingModes[i];
            if (this.props.availableRoutingModes.includes(routingModeShortname)) {
                routingModeFound = routingModeFound || routingModeShortname === pathRoutingMode;
                routingModes.push({
                    value: routingModeShortname
                });
            }
        }
        if (!routingModeFound && pathRoutingEngine !== 'manual' && pathRoutingMode !== undefined) {
            routingModes.push({
                value: pathRoutingMode,
                disabled: true
            });
            path.addError('transit:transitPath:errors:RoutingModeNotAvailableOnServer');
            console.warn('Routing mode not available on this server: ' + pathRoutingMode);
        } else {
            path.removeError('transit:transitPath:errors:RoutingModeNotAvailableOnServer');
        }

        const routingEngines: { value: string }[] = [];
        // Check the path's routing engine if available

        const compatibleRoutingEngines = lineModesConfigByMode[mode].compatibleRoutingEngines;
        for (let i = 0, countI = compatibleRoutingEngines.length; i < countI; i++) {
            const routingEngine = compatibleRoutingEngines[i];
            // ignore engine and engineCustom if no routing mode available
            if ((routingEngine !== 'engine' && routingEngine !== 'engineCustom') || routingModes.length > 0) {
                routingEngines.push({
                    value: routingEngine
                });
            }
        }

        return (
            <React.Fragment>
                <MathJax.Provider>
                    <h3>
                        {path.isNew()
                            ? this.props.t('transit:transitPath:New')
                            : this.props.t('transit:transitPath:Edit')}
                        &nbsp;
                        <MathJax.Node inline formula={'p'} />
                        &nbsp;{path.toString(false) ? `• ${path.toString(false)}` : ''}
                    </h3>
                    <Collapsible trigger={this.props.t('form:basicFields')} open={true} transitionTime={100}>
                        <div className="tr__form-section">
                            <div className="apptr__form-input-container _two-columns">
                                <label>{this.props.t('transit:transitPath:Name')}</label>
                                <InputString
                                    id={`formFieldTransitPathEditName${pathId}`}
                                    disabled={isFrozen}
                                    value={path.attributes.name}
                                    onValueUpdated={(value) => this.onValueChange('name', value)}
                                    autocompleteChoices={autocompleteNameChoices}
                                />
                            </div>
                            <div className="apptr__form-input-container _two-columns">
                                <label>{this.props.t('transit:transitPath:Direction')}</label>
                                <InputSelect
                                    id={`formFieldTransitPathEditDirection${pathId}`}
                                    disabled={isFrozen}
                                    value={path.attributes.direction}
                                    choices={pathDirectionArray.map((dir) => ({ value: dir }))}
                                    localePrefix="transit:transitPath:directions"
                                    t={this.props.t}
                                    onValueChange={(e) => this.onValueChange('direction', { value: e.target.value })}
                                />
                            </div>
                            <div className="apptr__form-input-container _two-columns">
                                <label>{this.props.t('transit:transitPath:RoutingEngine')}</label>
                                <InputSelect
                                    id={`formFieldTransitPathEditRoutingEngine${pathId}`}
                                    disabled={isFrozen}
                                    value={pathRoutingEngine}
                                    choices={routingEngines}
                                    localePrefix="transit:transitPath:routingEngines"
                                    t={this.props.t}
                                    onValueChange={(e) =>
                                        this.onValueChange('data.routingEngine', { value: e.target.value })
                                    }
                                />
                            </div>
                            {pathRoutingEngine !== 'manual' && (
                                <div className="apptr__form-input-container _two-columns">
                                    <label>{this.props.t('transit:transitPath:RoutingMode')}</label>
                                    <InputSelect
                                        id={`formFieldTransitPathEditRoutingMode${pathId}`}
                                        disabled={isFrozen}
                                        value={pathRoutingMode}
                                        choices={routingModes}
                                        localePrefix="transit:transitPath:routingModes"
                                        t={this.props.t}
                                        onValueChange={(e) =>
                                            this.onValueChange('data.routingMode', { value: e.target.value })
                                        }
                                    />
                                </div>
                            )}
                            {pathRoutingEngine !== 'manual' && (
                                <div className="apptr__form-input-container">
                                    <InputCheckboxBoolean
                                        id={`formFieldTransitPathTemporaryManualRouting${pathId}`}
                                        label={`${this.props.t('transit:transitPath:TemporaryManualRouting')} [m]`}
                                        disabled={isFrozen}
                                        isChecked={pathData.temporaryManualRouting || false}
                                        onValueChange={(e) =>
                                            this.onValueChange('data.temporaryManualRouting', { value: e.target.value })
                                        }
                                    />
                                </div>
                            )}
                            {mode !== 'transferable' && (
                                <div className="apptr__form-input-container _two-columns">
                                    <InputWrapper
                                        label={this.props.t('transit:transitPath:MinDwellTimeSeconds')}
                                        help={this.props.t('transit:transitPath:MinDwellTimeSecondsHelp')}
                                    >
                                        <InputStringFormatted
                                            id={`formFieldTransitPathEditMinDwellTimeSeconds${pathId}`}
                                            disabled={isFrozen}
                                            value={path.getData('defaultDwellTimeSeconds')}
                                            onValueUpdated={(value) =>
                                                this.onValueChange('data.defaultDwellTimeSeconds', value)
                                            }
                                            key={`formFieldTransitPathEditMinDwellTimeSeconds${pathId}${this.resetChangesCount}`}
                                            stringToValue={parseIntOrNull}
                                            valueToString={(val) => _toString(parseIntOrNull(val))}
                                            type="number"
                                        />
                                    </InputWrapper>
                                </div>
                            )}
                            {mode !== 'transferable' && (
                                <div className="apptr__form-input-container">
                                    <InputCheckboxBoolean
                                        id={`formFieldTransitPathEditIgnoreNodesMinDwellTimeSeconds${pathId}`}
                                        disabled={isFrozen}
                                        label={this.props.t('transit:transitPath:IgnoreNodesMinDwellTimeSeconds')}
                                        isChecked={pathData.ignoreNodesDefaultDwellTimeSeconds || false}
                                        onValueChange={(e) =>
                                            this.onValueChange('data.ignoreNodesDefaultDwellTimeSeconds', {
                                                value: e.target.value
                                            })
                                        }
                                    />
                                </div>
                            )}
                            <div className="apptr__form-input-container _two-columns">
                                <label>{this.props.t('transit:transitPath:DefaultRunningSpeedKmH')}</label>
                                <InputStringFormatted
                                    id={`formFieldTransitPathEditDefaultRunningSpeedKmH${pathId}`}
                                    disabled={isFrozen /* || routingEngine === 'engine'*/}
                                    value={path.getData('defaultRunningSpeedKmH')}
                                    onValueUpdated={(value) => this.onValueChange('data.defaultRunningSpeedKmH', value)}
                                    key={`formFieldTransitPathEditDefaultRunningSpeedKmH${pathId}${this.resetChangesCount}`}
                                    stringToValue={parseFloatOrNull}
                                    valueToString={(val) => _toString(parseFloatOrNull(val))}
                                    // TODO type number only supports integer
                                    //type          = 'number'
                                />
                            </div>
                            {lineModesConfigByMode[mode].showAccelerationAndDeceleration !== false && (
                                <div className="apptr__form-input-container _two-columns">
                                    <label>{this.props.t('transit:transitPath:DefaultAcceleration')}</label>
                                    <InputStringFormatted
                                        id={`formFieldTransitPathEditDefaultAcceleration${pathId}`}
                                        disabled={isFrozen /* || routingEngine === 'engine'*/}
                                        value={path.getData('defaultAcceleration')}
                                        onValueUpdated={(value) =>
                                            this.onValueChange('data.defaultAcceleration', value)
                                        }
                                        key={`formFieldTransitPathEditDefaultAcceleration${pathId}${this.resetChangesCount}`}
                                        stringToValue={parseFloatOrNull}
                                        valueToString={(val) => _toString(parseFloatOrNull(val))}
                                        // TODO type number only supports integer
                                        //type          = 'number'
                                    />
                                </div>
                            )}
                            {lineModesConfigByMode[mode].showAccelerationAndDeceleration !== false && (
                                <div className="apptr__form-input-container _two-columns">
                                    <label>{this.props.t('transit:transitPath:DefaultDeceleration')}</label>
                                    <InputStringFormatted
                                        id={`formFieldTransitPathEditDefaultDeceleration${pathId}`}
                                        disabled={isFrozen /* || routingEngine === 'engine'*/}
                                        value={path.getData('defaultDeceleration')}
                                        onValueUpdated={(value) =>
                                            this.onValueChange('data.defaultDeceleration', value)
                                        }
                                        key={`formFieldTransitPathEditDefaultDeceleration${pathId}${this.resetChangesCount}`}
                                        stringToValue={parseFloatOrNull}
                                        valueToString={(val) => _toString(parseFloatOrNull(val))}
                                        // TODO type number only supports integer
                                        //type          = 'number'
                                    />
                                </div>
                            )}
                            {mode !== 'transferable' && (
                                <div className="apptr__form-input-container _two-columns">
                                    <label>{this.props.t('transit:transitPath:CustomLayover')}</label>
                                    <InputStringFormatted
                                        id={`formFieldTransitPathEditCustomLayoverMinutes${pathId}`}
                                        disabled={isFrozen}
                                        value={path.getData('customLayoverMinutes')}
                                        onValueUpdated={(value) =>
                                            this.onValueChange('data.customLayoverMinutes', value)
                                        }
                                        key={`formFieldTransitPathEditCustomLayoverMinutes${pathId}${this.resetChangesCount}`}
                                        stringToValue={parseIntOrNull}
                                        valueToString={(val) => _toString(parseIntOrNull(val))}
                                        type="number"
                                    />
                                </div>
                            )}
                            {pathRoutingEngine === 'engine' && (
                                <div className="apptr__form-input-container">
                                    <InputWrapper
                                        label={this.props.t(
                                            'transit:transitPath:IncreaseRoutingRadiiToIncludeExistingPathShape'
                                        )}
                                        help={this.props.t(
                                            'transit:transitPath:IncreaseRoutingRadiiToIncludeExistingPathShapeHelp'
                                        )}
                                    >
                                        <InputRadio
                                            id={`formFieldTransitPathEditIncreaseRoutingRadiiToIncludeExistingPathShape${pathId}`}
                                            value={pathData.increaseRoutingRadiiToIncludeExistingPathShape}
                                            sameLine={true}
                                            disabled={isFrozen}
                                            choices={[
                                                {
                                                    value: true
                                                },
                                                {
                                                    value: false
                                                }
                                            ]}
                                            localePrefix="transit:transitPath"
                                            t={this.props.t}
                                            isBoolean={true}
                                            onValueChange={(e) =>
                                                this.onValueChange(
                                                    'data.increaseRoutingRadiiToIncludeExistingPathShape',
                                                    { value: e.target.value }
                                                )
                                            }
                                        />
                                    </InputWrapper>
                                </div>
                            )}
                            {(pathData.from_gtfs as boolean) && (
                                <FormErrors errors={['transit:transitPath:warningFromGtfs']} errorType="Warning" />
                            )}
                        </div>
                    </Collapsible>

                    <Collapsible trigger={this.props.t('form:advancedFields')} transitionTime={100}>
                        <div className="tr__form-section">
                            <div className="apptr__form-input-container _two-columns">
                                <label>{this.props.t('transit:transitPath:Uuid')}</label>
                                <InputString
                                    disabled={true}
                                    id={`formFieldTransitPathEditUuid${pathId}`}
                                    value={pathId}
                                />
                            </div>
                            <div className="apptr__form-input-container _two-columns">
                                <label>{this.props.t('transit:transitPath:InternalId')}</label>
                                <InputString
                                    id={`formFieldTransitPathEditInternalId${pathId}`}
                                    disabled={isFrozen}
                                    value={path.attributes.internal_id}
                                    onValueUpdated={(value) => this.onValueChange('internal_id', value)}
                                />
                            </div>
                            <div className="apptr__form-input-container">
                                <label>{this.props.t('transit:transitPath:Description')}</label>
                                <InputText
                                    id={`formFieldTransitPathEditDescription${pathId}`}
                                    disabled={isFrozen}
                                    value={path.attributes.description}
                                    onValueChange={(e) => this.onValueChange('description', { value: e.target.value })}
                                />
                            </div>
                            <InputWrapper
                                twoColumns={false}
                                smallInput={true}
                                label={this.props.t('transit:transitPath:MinMatchingTimestamp')}
                                help={this.props.t('transit:transitPath:MinMatchingTimestampHelp')}
                            >
                                <InputStringFormatted
                                    id={`formFieldTransitPathEditMinMatchingTimestamp${pathId}`}
                                    disabled={isFrozen}
                                    value={path.getData('minMatchingTimestamp')}
                                    onValueUpdated={(value) => this.onValueChange('data.minMatchingTimestamp', value)}
                                    key={`formFieldTransitPathEditMinMatchingTimestamp${pathId}${this.resetChangesCount}`}
                                    stringToValue={parseIntOrNull}
                                    valueToString={(val) => _toString(parseIntOrNull(val))}
                                    type="number"
                                />
                            </InputWrapper>
                        </div>
                    </Collapsible>

                    {/* TODO Path generator goes here, inside a collapsible named transit:transitPath:Generate */}

                    {this.hasInvalidFields() && <FormErrors errors={['main:errors:InvalidFormFields']} />}
                    <FormErrors errors={path.errors} />
                    {(!path.errors || path.errors.length === 0) && firstNode && lastNode && (
                        <Collapsible
                            trigger={this.props.t('form:statistics')}
                            open={!!(pathData && pathData.variables?.d_p)}
                            transitionTime={100}
                        >
                            <div className="tr__form-section">
                                <PathStatistics path={path} firstNode={firstNode} lastNode={lastNode} />
                            </div>
                        </Collapsible>
                    )}
                    <div className="tr__form-buttons-container">
                        <span title={this.props.t('main:Back')}>
                            <Button
                                key="back"
                                color="blue"
                                icon={faArrowLeft}
                                iconClass="_icon-alone"
                                label=""
                                onClick={path.hasChanged() ? this.openBackConfirmModal : this.onBack}
                            />
                        </span>
                        <span title={this.props.t('main:Undo')}>
                            <Button
                                color="grey"
                                icon={faUndoAlt}
                                iconClass="_icon-alone"
                                label=""
                                disabled={!(path.canUndo() || this.hasInvalidFields())}
                                onClick={() => {
                                    // If there are invalid fields, just reset to the current object, to remove invalid values, otherwise, do a real undo
                                    const justResetInvalidFields = this.hasInvalidFields();
                                    this.onHistoryChange();
                                    if (!justResetInvalidFields) {
                                        path.undo();
                                        path.validate();
                                    }
                                    serviceLocator.selectedObjectsManager.update('path', path);
                                    serviceLocator.eventManager.emit('selected.updateLayers.path');
                                }}
                            />
                        </span>
                        <span title={this.props.t('main:Redo')}>
                            <Button
                                color="grey"
                                icon={faRedoAlt}
                                iconClass="_icon-alone"
                                label=""
                                disabled={!path.canRedo()}
                                onClick={() => {
                                    this.onHistoryChange();
                                    path.redo();
                                    path.validate();
                                    serviceLocator.selectedObjectsManager.update('path', path);
                                    serviceLocator.eventManager.emit('selected.updateLayers.path');
                                }}
                            />
                        </span>
                        {isFrozen !== true && (
                            <Button
                                color="blue"
                                icon={faRoute}
                                iconClass="_icon-alone"
                                label=""
                                disabled={!path.canRoute().canRoute}
                                onClick={() => {
                                    // recalculate routing with same nodes
                                    serviceLocator.eventManager.emit('progress', {
                                        name: 'UpdatingPathRoute',
                                        progress: 0.0
                                    });
                                    path.updateGeography()
                                        .then((_response) => {
                                            serviceLocator.selectedObjectsManager.update('path', path);
                                            this.updateLayers();
                                            serviceLocator.eventManager.emit('progress', {
                                                name: 'UpdatingPathRoute',
                                                progress: 1.0
                                            });
                                        })
                                        .catch((error) => {
                                            console.error('cannot update path geography', error);
                                        });
                                }}
                            />
                        )}
                        <span title={this.props.t('main:Save')}>
                            <Button
                                icon={faCheckCircle}
                                iconClass="_icon-alone"
                                label=""
                                onClick={(e) => {
                                    // save
                                    if (isFrozen === true && path.wasFrozen()) {
                                        serviceLocator.selectedObjectsManager.deselect('path');
                                        return true;
                                    }
                                    path.validate();
                                    if (path.isValid && !this.hasInvalidFields()) {
                                        if (path.hasChanged()) {
                                            const scheduledPathIds = line.getScheduledPathIds();
                                            if (scheduledPathIds.includes(path.getId())) {
                                                this.openSchedulesAffectedConfirmModal(e);
                                            } else {
                                                line.attributes.data._pathsChangeTimestamp = Date.now();
                                                serviceLocator.eventManager.emit('progress', {
                                                    name: 'SavingPath',
                                                    progress: 0.0
                                                });
                                                path.save(serviceLocator.socketEventManager).then((_response) => {
                                                    serviceLocator.selectedObjectsManager.deselect('path');
                                                    line.refreshPaths();
                                                    serviceLocator.eventManager.emit('progress', {
                                                        name: 'SavingPath',
                                                        progress: 1.0
                                                    });
                                                });
                                            }
                                        } else {
                                            serviceLocator.selectedObjectsManager.deselect('path');
                                        }
                                    } else {
                                        serviceLocator.selectedObjectsManager.update('path', path);
                                    }
                                }}
                            />
                        </span>
                        {isFrozen !== true && (
                            <span title={this.props.t('main:Delete')}>
                                <Button
                                    icon={faTrashAlt}
                                    iconClass="_icon-alone"
                                    label=""
                                    color="red"
                                    onClick={path.isNew() ? this.onDelete : this.openDeleteConfirmModal}
                                />
                            </span>
                        )}
                        {this.state.confirmModalDeleteIsOpen && (
                            <ConfirmModal
                                isOpen={true}
                                title={this.props.t('transit:transitPath:ConfirmDelete')}
                                confirmAction={this.onDelete}
                                confirmButtonColor="red"
                                confirmButtonLabel={this.props.t('transit:transitPath:Delete')}
                                closeModal={this.closeDeleteConfirmModal}
                            />
                        )}
                        {this.state.confirmModalSchedulesAffectedlIsOpen && (
                            <ConfirmModal
                                isOpen={true}
                                containsHtml={true}
                                title={this.props.t('transit:transitPath:SchedulesAffected')}
                                text={`<div class="center"><p style="margin-bottom: 1rem;">${this.props.t(
                                    'transit:transitPath:PathChangeWillAffectSchedulesWhatDoYouWantToDo'
                                )}</p></div>`}
                                buttons={{
                                    cancel: {
                                        label: this.props.t('transit:transitPath:CancelPathChanges'),
                                        color: 'grey',
                                        action: this.onCancelAffectedSchedulesChanges
                                    },
                                    ignore: {
                                        label: this.props.t('transit:transitPath:IgnorePathChangesOnSchedule'),
                                        color: 'red',
                                        action: this.onSaveAndIgnoreAffectedSchedules
                                    },
                                    update: {
                                        label: this.props.t('transit:transitPath:UpdateSchedules'),
                                        color: 'green',
                                        action: this.onUpdateAffectedSchedules
                                    }
                                }}
                                closeModal={this.closeSchedulesAffectedConfirmModal}
                            />
                        )}
                        {this.state.confirmModalBackIsOpen && (
                            <ConfirmModal
                                isOpen={true}
                                title={this.props.t('main:ConfirmBackModal')}
                                confirmAction={this.onBack}
                                confirmButtonColor="blue"
                                confirmButtonLabel={this.props.t('main:DiscardChanges')}
                                cancelButtonLabel={this.props.t('main:Cancel')}
                                closeModal={this.closeBackConfirmModal}
                            />
                        )}
                    </div>
                </MathJax.Provider>
            </React.Fragment>
        );
    }
}

export default withTranslation(['transit', 'main', 'form', 'notifications'])(TransitPathEdit);
