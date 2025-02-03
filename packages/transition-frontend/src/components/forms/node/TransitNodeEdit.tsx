/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import { withTranslation, WithTranslation } from 'react-i18next';
import _cloneDeep from 'lodash/cloneDeep';
import _toString from 'lodash/toString';
import { featureCollection as turfFeatureCollection } from '@turf/turf';

import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import InputText from 'chaire-lib-frontend/lib/components/input/InputText';
import InputColor from 'chaire-lib-frontend/lib/components/input/InputColor';
import InputRadio from 'chaire-lib-frontend/lib/components/input/InputRadio';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import { getAutocompleteList } from 'chaire-lib-frontend/lib/services/autoCompleteNextService';
import { InputCheckboxBoolean } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import { _isBlank, _toInteger } from 'chaire-lib-common/lib/utils/LodashExtensions';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { roundToDecimals } from 'chaire-lib-common/lib/utils/MathUtils';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import ConfirmModal from 'chaire-lib-frontend/lib/components/modal/ConfirmModal';
import { SaveableObjectForm, SaveableObjectState } from 'chaire-lib-frontend/lib/components/forms/SaveableObjectForm';
import LoadingPage from 'chaire-lib-frontend/lib/components/pages/LoadingPage';
import Node, { NodeAttributes } from 'transition-common/lib/services/nodes/Node';
import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';
import SelectedObjectButtons from 'chaire-lib-frontend/lib/components/pageParts/SelectedObjectButtons';
import NodeStatistics from './TransitNodeStatistics';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { proposeNames } from 'transition-common/lib/services/nodes/NodeGeographyUtils';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';
import { MapUpdateLayerEventType } from 'chaire-lib-frontend/lib/services/map/events/MapEventsCallbacks';

interface NodeFormProps extends WithTranslation {
    node: Node;
}

interface NodeFormState extends SaveableObjectState<Node> {
    nodeErrors: string[];
    nameAutocompleteChoices: string[];
    codeAutocompleteChoices: string[];
    associatedPathIds: string[] | undefined; // undefined means not yet fetched. An empty array would be ambiguous (no associated path ids or not yet fetched?)
}

class TransitNodeEdit extends SaveableObjectForm<Node, NodeFormProps, NodeFormState> {
    private resetChangesCount = 0;

    constructor(props: NodeFormProps) {
        super(props);

        const node = this.props.node;
        this.state = {
            object: node,
            confirmModalDeleteIsOpen: false,
            confirmModalBackIsOpen: false,
            // FIXME tahini: Not using the form values here because fields may change from other places (like merging services)
            formValues: {},
            selectedObjectName: 'node',
            collectionName: 'nodes',
            nodeErrors: [],
            nameAutocompleteChoices: [],
            codeAutocompleteChoices: [],
            associatedPathIds: undefined
        };

        this.updateLayers();
    }

    componentDidMount() {
        const nodeId = this.props.node?.getId();
        serviceLocator.eventManager.on('selected.deselect.node', this.onDeselect);
        serviceLocator.eventManager.on('selected.drag.node', this.onDrag);
        serviceLocator.eventManager.on('selected.dragEnd.node', this.onDragEnd);
        this.fillAutocompleteCode();
        if (this.props.node?.isNew()) {
            this.fillAutocompleteName();
        }
        serviceLocator.socketEventManager.emit(
            'transitNodes.getAssociatedPathIdsByNodeId',
            [nodeId],
            (status: Status.Status<{ [key: string]: string[] }>) => {
                if (Status.isStatusOk(status)) {
                    this.setState({
                        associatedPathIds: Status.unwrap(status)[nodeId] || []
                    });
                } else {
                    // TODO: trigger error
                }
            }
        );
    }

    componentWillUnmount() {
        serviceLocator.eventManager.off('selected.deselect.node', this.onDeselect);
        serviceLocator.eventManager.off('selected.drag.node', this.onDrag);
        serviceLocator.eventManager.off('selected.dragEnd.node', this.onDragEnd);
    }

    protected async onDelete(e: any): Promise<void> {
        await super.onDelete(e);
        serviceLocator.eventManager.emit('map.updateLayers', {
            transitNodes: serviceLocator.collectionManager.get('nodes').toGeojson(),
            transitNodesSelected: turfFeatureCollection([]),
            transitNodes250mRadius: turfFeatureCollection([]),
            transitNodes500mRadius: turfFeatureCollection([]),
            transitNodes750mRadius: turfFeatureCollection([]),
            transitNodes1000mRadius: turfFeatureCollection([]),
            transitNodesRoutingRadius: turfFeatureCollection([])
        });
    }

    protected onValueChange(path: string, newValue: { value: any; valid?: boolean } = { value: null, valid: true }) {
        super.onValueChange(path, newValue);
        if (['color', 'geography', 'geography.coordinates', 'routing_radius_meters'].includes(path)) {
            this.updateLayers();
        }
        if (['geography', 'geography.coordinates'].includes(path)) {
            // get nearest street intersections:
            this.fillAutocompleteName();
        }
    }

    protected onHistoryChange = () => {
        this.resetChangesCount++;
        serviceLocator.selectedObjectsManager.update('node', this.state.object);
        this.updateLayers();
    };

    updateLayers() {
        const geojson = _cloneDeep(this.props.node.toGeojson());
        serviceLocator.eventManager.emit('map.updateLayers', {
            transitNodes: serviceLocator.collectionManager.get('nodes').toGeojson(),
            transitNodesSelected: turfFeatureCollection(geojson.geometry ? [geojson] : []),
            transitNodes250mRadius: turfFeatureCollection(geojson.geometry ? [geojson] : []),
            transitNodes500mRadius: turfFeatureCollection(geojson.geometry ? [geojson] : []),
            transitNodes750mRadius: turfFeatureCollection(geojson.geometry ? [geojson] : []),
            transitNodes1000mRadius: turfFeatureCollection(geojson.geometry ? [geojson] : []),
            transitNodesRoutingRadius: turfFeatureCollection(geojson.geometry ? [geojson] : [])
        });
    }

    onDragEnd = (coordinates: [number, number]) => {
        this.resetChangesCount++;
        this.onValueChange('geography.coordinates', { value: coordinates });
    };

    onDeselect() {
        serviceLocator.eventManager.emit('map.updateLayers', {
            transitNodes: serviceLocator.collectionManager.get('nodes').toGeojson(),
            transitNodesSelected: turfFeatureCollection([]),
            transitNodes250mRadius: turfFeatureCollection([]),
            transitNodes500mRadius: turfFeatureCollection([]),
            transitNodes750mRadius: turfFeatureCollection([]),
            transitNodes1000mRadius: turfFeatureCollection([]),
            transitNodesRoutingRadius: turfFeatureCollection([])
        });
    }

    onDrag(coordinates) {
        (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
            layerName: 'transitNodesSelected',
            data: (oldGeojson: GeoJSON.FeatureCollection) => {
                (oldGeojson.features[0].geometry as GeoJSON.Point).coordinates = coordinates;
                return turfFeatureCollection([oldGeojson.features[0]]);
            }
        });
    }

    private fillAutocompleteCode = async () => {
        // Get the autocomplete choices for node code

        const nodeCodes: string[] = [];
        serviceLocator.collectionManager
            .get('nodes')
            .getFeatures()
            .forEach((nodeFeature: GeoJSON.Feature<GeoJSON.Point, NodeAttributes>) => {
                if (nodeFeature.properties?.code) {
                    nodeCodes.push(nodeFeature.properties.code);
                }
            });
        const codeAutocompleteChoices = await getAutocompleteList(nodeCodes, this.props.node.attributes.code);
        this.setState({
            codeAutocompleteChoices: codeAutocompleteChoices
        });
    };

    private fillAutocompleteName = async () => {
        /* TODO: enable progress event. Right now in Chrome, the result appears before the progress event completion is emitted.
            but as soone as the progress event completion is emitted, it refreshes the state or chrome detects
            a change and the autocomplete menu is closed, which is weird. In Firefox, the two events seems
            to be waiting for each other, so no problem.
            Other TODO: fetch addresses nearest to node if no intersection found.
        */
        /*serviceLocator.eventManager.emit('progress', {
            name: 'SearchingNearestStreetsAndIntersections',
            progress: 0.0
        });*/
        this.setState({
            nameAutocompleteChoices: []
        });

        // get nearest street intersections from osm:
        const intersectionNames: string[] | undefined = await proposeNames(
            serviceLocator.socketEventManager,
            this.state.object,
            200
        );

        if (intersectionNames !== undefined) {
            this.setState({
                nameAutocompleteChoices: intersectionNames as string[]
            });
        }
        /*serviceLocator.eventManager.emit('progress', {
            name: 'SearchingNearestStreetsAndIntersections',
            progress: 1.0
        });*/
    };

    render() {
        if (!serviceLocator.collectionManager.get('nodes')) {
            return <LoadingPage />;
        }

        const node = this.props.node;
        const isNew = node.isNew();
        const isFrozen = node.isFrozen();
        const nodeGeography = node.attributes.geography;
        const nodeId = node.getId();
        const nodeWeight = node.attributes.data.weight;
        const nodeRelativeWeight = node.attributes.data.relativeWeight;
        const hasPaths = node.hasPaths();

        return (
            <form
                id={isNew ? 'tr__form-transit-node-new' : `tr__form-transit-node-edit__id_${nodeId}`}
                className="tr__form-transit-node-edit apptr__form"
            >
                <div className="tr__form-sticky-header-container">
                    <h3>
                        {isNew ? this.props.t('transit:transitNode:New') : this.props.t('transit:transitNode:Edit')}
                        {node.toString(false) ? ` • ${node.toString(false)}` : ''}
                    </h3>
                    <SelectedObjectButtons
                        onDelete={this.onDelete}
                        openDeleteConfirmModal={this.openDeleteConfirmModal}
                        backAction={this.onBack}
                        openBackConfirmModal={this.openBackConfirmModal}
                        object={node}
                        hideDelete={isFrozen === true || hasPaths}
                        saveAction={async () => {
                            // save
                            if (isFrozen === true && node.wasFrozen()) {
                                serviceLocator.selectedObjectsManager.deselect('node');
                                return true;
                            }
                            node.validate();
                            if (node.isValid) {
                                if (node.hasChanged()) {
                                    serviceLocator.eventManager.emit('progress', {
                                        name: 'SavingNode',
                                        progress: 0.0
                                    });
                                    try {
                                        const nbNodeAffected = await node.save(serviceLocator.socketEventManager);
                                        serviceLocator.selectedObjectsManager.deselect('node');
                                        serviceLocator.collectionManager.refresh('nodes');
                                        console.log('saved nodes', nbNodeAffected);
                                    } catch (error) {
                                        console.log('error saving node', error);
                                    } finally {
                                        serviceLocator.eventManager.emit('progress', {
                                            name: 'SavingNode',
                                            progress: 1.0
                                        });
                                    }
                                } else {
                                    serviceLocator.selectedObjectsManager.deselect('node');
                                }
                            } else {
                                serviceLocator.selectedObjectsManager.update('node', node);
                                this.updateLayers();
                            }
                        }}
                        onUndo={this.onHistoryChange}
                        onRedo={this.onHistoryChange}
                    />
                </div>
                <Collapsible trigger={this.props.t('form:basicFields')} open={true} transitionTime={100}>
                    <div className="tr__form-section">
                        <InputWrapper label={this.props.t('transit:transitNode:Name')}>
                            <InputString
                                id={`formFieldTransitNodeEditName${nodeId}`}
                                disabled={isFrozen}
                                value={node.attributes.name}
                                onValueUpdated={(value) => this.onValueChange('name', value)}
                                autocompleteChoices={this.state.nameAutocompleteChoices}
                            />
                        </InputWrapper>
                        <InputWrapper label={this.props.t('transit:transitNode:Code')}>
                            <InputString
                                id={`formFieldTransitNodeEditCode${nodeId}`}
                                disabled={isFrozen}
                                value={node.attributes.code}
                                onValueUpdated={(value) => this.onValueChange('code', value)}
                                autocompleteChoices={this.state.codeAutocompleteChoices}
                            />
                        </InputWrapper>
                        {isFrozen !== true && (
                            <InputWrapper label={this.props.t('transit:transitNode:Color')}>
                                <InputColor
                                    id={`formFieldTransitNodeEditColor${nodeId}`}
                                    value={node.attributes.color}
                                    defaultColor={Preferences.current.transit?.nodes?.defaultColor || '#0086FF'}
                                    onValueChange={(e) => this.onValueChange('color', { value: e.target.value })}
                                />
                            </InputWrapper>
                        )}
                        <InputWrapper
                            label={this.props.t('transit:transitNode:RoutingRadiusMeters')}
                            help={this.props.t('transit:transitNode:NodeRadiusExampleDistance')}
                        >
                            <InputStringFormatted
                                id={`formFieldTransitNodeEditRoutingRadiusMeters${nodeId}`}
                                disabled={isFrozen}
                                value={node.get('routing_radius_meters')}
                                stringToValue={_toInteger}
                                valueToString={_toString}
                                key={`formFieldTransitNodeEditRoutingRadiusMeters${nodeId}${this.resetChangesCount}`}
                                onValueUpdated={(value) => this.onValueChange('routing_radius_meters', value)}
                            />
                        </InputWrapper>
                        <InputWrapper label={this.props.t('transit:transitNode:DefaultDwellTimeSeconds')}>
                            <InputStringFormatted
                                id={`formFieldTransitNodeEditDefaultDwellTimeSeconds${nodeId}`}
                                disabled={isFrozen}
                                stringToValue={_toInteger}
                                valueToString={_toString}
                                value={node.getAttributes().default_dwell_time_seconds}
                                key={`formFieldTransitNodeEditDefaultDwellTimeSeconds${nodeId}${this.resetChangesCount}`}
                                onValueUpdated={(value) => this.onValueChange('default_dwell_time_seconds', value)}
                            />
                        </InputWrapper>
                    </div>
                    {Preferences.get('transit.showEvolutionaryAlgorithmsFields') && (
                        <InputWrapper label={this.props.t('transit:transitNode:CanBeUsedAsTerminal')}>
                            <InputRadio
                                id={`formFieldTransitNodeEditInternalId${nodeId}`}
                                value={node.attributes.data.canBeUsedAsTerminal}
                                sameLine={true}
                                disabled={isFrozen}
                                choices={[{ value: true }, { value: false }]}
                                localePrefix="transit:transitNode"
                                isBoolean={true}
                                onValueChange={(e) =>
                                    this.onValueChange('data.canBeUsedAsTerminal', { value: e.target.value })
                                }
                            />
                        </InputWrapper>
                    )}
                </Collapsible>

                <Collapsible trigger={this.props.t('form:advancedFields')} transitionTime={100}>
                    <div className="tr__form-section">
                        <InputWrapper label={this.props.t('main:Locked')}>
                            <InputCheckboxBoolean
                                id={`formFieldTransitNodeEditIsFrozen${nodeId}`}
                                label=" "
                                isChecked={isFrozen}
                                onValueChange={(e) => this.onValueChange('is_frozen', { value: e.target.value })}
                            />
                        </InputWrapper>
                        <InputWrapper label={this.props.t('transit:transitNode:Uuid')}>
                            <InputString disabled={true} id={`formFieldTransitNodeEditUuid${nodeId}`} value={nodeId} />
                        </InputWrapper>
                        {nodeGeography && nodeGeography.coordinates && (
                            <InputWrapper label={this.props.t('transit:transitNode:Longitude')}>
                                <InputStringFormatted
                                    disabled={true}
                                    id={`formFieldTransitNodeEditLongitude${nodeId}`}
                                    value={nodeGeography.coordinates[0]}
                                    stringToValue={_toInteger}
                                    valueToString={_toString}
                                    key={`formFieldTransitNodeEditLongitude${nodeId}${this.resetChangesCount}`}
                                    type={'number'}
                                />
                            </InputWrapper>
                        )}
                        {nodeGeography && nodeGeography.coordinates && (
                            <InputWrapper label={this.props.t('transit:transitNode:Latitude')}>
                                <InputStringFormatted
                                    disabled={true}
                                    id={`formFieldTransitNodeEditLatitude${nodeId}`}
                                    value={nodeGeography.coordinates[1]}
                                    stringToValue={_toInteger}
                                    valueToString={_toString}
                                    key={`formFieldTransitNodeEditLatitude${nodeId}${this.resetChangesCount}`}
                                    type={'number'}
                                />
                            </InputWrapper>
                        )}
                        <InputWrapper label={this.props.t('transit:transitNode:InternalId')}>
                            <InputString
                                id={`formFieldTransitNodeEditInternalId${nodeId}`}
                                disabled={isFrozen}
                                value={node.attributes.internal_id}
                                onValueUpdated={(value) => this.onValueChange('internal_id', value)}
                            />
                        </InputWrapper>
                        <div className="apptr__form-input-container">
                            <InputWrapper label={this.props.t('transit:transitNode:Description')}>
                                <InputText
                                    id={`formFieldTransitNodeEditDescription${nodeId}`}
                                    disabled={isFrozen}
                                    value={node.attributes.description}
                                    onValueChange={(e) => this.onValueChange('description', { value: e.target.value })}
                                />
                            </InputWrapper>
                        </div>
                    </div>
                </Collapsible>
                <FormErrors errors={node.errors} />
                {(!node.errors || node.errors.length === 0) && (
                    <Collapsible trigger={this.props.t('form:statistics')} open={true} transitionTime={100}>
                        <div className="tr__form-section">
                            <NodeStatistics
                                node={node}
                                associatedPathIds={this.state.associatedPathIds || []}
                                pathCollection={serviceLocator.collectionManager.get('paths')}
                            />
                        </div>
                        {!_isBlank(nodeWeight) && (
                            <div className="tr__form-section">
                                <table className="_statistics">
                                    <tbody>
                                        <tr>
                                            <th>{this.props.t('transit:transitNode:Weight')}</th>
                                            <td>{roundToDecimals(nodeWeight, 1)}</td>
                                        </tr>
                                        {!_isBlank(nodeRelativeWeight) && (
                                            <tr>
                                                <th>{this.props.t('transit:transitNode:RelativeWeight')}</th>
                                                <td>{roundToDecimals(nodeRelativeWeight, 2)}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Collapsible>
                )}
                <div>
                    {this.state.confirmModalDeleteIsOpen && (
                        <ConfirmModal
                            isOpen={true}
                            title={this.props.t('transit:transitNode:ConfirmDelete')}
                            confirmAction={this.onDelete}
                            confirmButtonColor="red"
                            confirmButtonLabel={this.props.t('transit:transitNode:Delete')}
                            closeModal={this.closeDeleteConfirmModal}
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
            </form>
        );
    }
}

export default withTranslation(['transit', 'main', 'form', 'notifications'])(TransitNodeEdit);
