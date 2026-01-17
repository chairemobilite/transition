/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import { withTranslation, WithTranslation } from 'react-i18next';
import { faTrashAlt } from '@fortawesome/free-solid-svg-icons/faTrashAlt';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons/faArrowLeft';
import { faCheckCircle } from '@fortawesome/free-solid-svg-icons/faCheckCircle';
import _cloneDeep from 'lodash/cloneDeep';
import _get from 'lodash/get';
import _toString from 'lodash/toString';
import { featureCollection as turfFeatureCollection } from '@turf/turf';

import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';
import InputColor from 'chaire-lib-frontend/lib/components/input/InputColor';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import { InputCheckboxBoolean } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import { _toInteger } from 'chaire-lib-common/lib/utils/LodashExtensions';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import ConfirmModal from 'chaire-lib-frontend/lib/components/modal/ConfirmModal';
import LoadingPage from 'chaire-lib-frontend/lib/components/pages/LoadingPage';
import Node from 'transition-common/lib/services/nodes/Node';
import Preferences from 'chaire-lib-common/lib/config/Preferences';

interface TransitNodeCollectionEditProps extends WithTranslation {
    nodes: Node[];
    onBack: (e: React.MouseEvent) => void;
}

type editableFields = 'color' | 'routing_radius_meters' | 'default_dwell_time_seconds' | 'is_frozen';

interface TransitNodeCollectionEditState {
    nodeErrors?: string[];
    color?: string;
    routing_radius_meters?: number;
    default_dwell_time_seconds?: number;
    is_frozen?: boolean;
    confirmModalDeleteIsOpen: boolean;
    confirmModalBackIsOpen: boolean;
    editableNodeCount: number;
}

// TODO Add simple unit tests for this form, before fixing other todos, it's quite straightforward to do
class TransitNodeCollectionEdit extends React.Component<
    TransitNodeCollectionEditProps,
    TransitNodeCollectionEditState
> {
    constructor(props: TransitNodeCollectionEditProps) {
        super(props);
        console.log('nodes TransitNodeCollectionEditProps', this.props.nodes);

        // TODO Values should be blank if they are not exactly the same for all nodes, otherwise, they take the common value
        // TODO How to handle frozen nodes in the selection, the user should be warned there are frozen nodes and if the is_frozen is not explicitly changed, those nodes should not be affected
        const node = this.props.nodes[0];
        // Set the nodes as editing
        const unfrozenNodes = this.props.nodes.filter((node) => !node.isFrozen());
        unfrozenNodes.forEach((node) => node.startEditing());
        this.state = {
            confirmModalDeleteIsOpen: false,
            confirmModalBackIsOpen: false,
            color: node ? node.attributes.color : undefined,
            routing_radius_meters: node ? node.attributes.routing_radius_meters : undefined,
            default_dwell_time_seconds: node ? node.attributes.default_dwell_time_seconds : undefined,
            is_frozen: node ? node.attributes.is_frozen || undefined : undefined,
            nodeErrors: undefined,
            editableNodeCount: unfrozenNodes.length
        };
    }

    componentDidMount() {
        serviceLocator.eventManager.emit('map.updateLayers', {
            transitNodes250mRadius: turfFeatureCollection([]), // TODO: merge radius nodes to a single collection/layer
            transitNodes500mRadius: turfFeatureCollection([]),
            transitNodes750mRadius: turfFeatureCollection([]),
            transitNodes1000mRadius: turfFeatureCollection([]),
            transitNodesRoutingRadius: turfFeatureCollection([])
        });
    }

    private openDeleteConfirmModal = (e: React.MouseEvent) => {
        e.stopPropagation();
        this.setState({
            confirmModalDeleteIsOpen: true
        });
    };

    private closeDeleteConfirmModal = (e: React.MouseEvent) => {
        e.stopPropagation();
        this.setState({
            confirmModalDeleteIsOpen: false
        });
    };

    private onDelete = (e: React.MouseEvent) => {
        // TODO Do not delete used nodes
        e.stopPropagation();
        serviceLocator.eventManager.emit('map.deleteSelectedNodes');
    };

    private openBackConfirmModal = (e: React.MouseEvent) => {
        e.stopPropagation();
        this.setState({
            confirmModalBackIsOpen: true
        });
    };

    private closeBackConfirmModal = (e: React.MouseEvent) => {
        e.stopPropagation();
        this.setState({
            confirmModalBackIsOpen: false
        });
    };

    private onBack = (e: React.MouseEvent) => {
        e.stopPropagation();

        this.props.nodes.forEach((node) => {
            if (!node.isFrozen() || !node.wasFrozen()) {
                if (node.hasChanged()) {
                    node.cancelEditing();
                }
            }
        });
        this.props.onBack(e);
    };

    private onValueChange = (path: editableFields, value: { value: any; valid: boolean }) => {
        // TODO Converting to any because it gives compilation error otherwise
        this.setState({ [path]: value.value } as any);
        if (value.valid) {
            this.props.nodes.forEach((node) => {
                node.set(path, value.value);
                node.validate();
            });
            // TODO Show each error once, but mention the number of nodes with this error
            this.setState({ nodeErrors: this.props.nodes[0].errors });
            if (['color', 'routing_radius_meters'].includes(path)) {
                this.updateLayers();
            }
        }
    };

    private updateLayers() {
        const geojson = this.props.nodes.map((node) => {
            return _cloneDeep(node.toGeojson());
        });
        serviceLocator.eventManager.emit('map.updateLayers', {
            transitNodesSelected: turfFeatureCollection(geojson)
        });
    }

    private onSave = async (_e: React.MouseEvent) => {
        const nodePromises: Promise<any>[] = [];

        this.props.nodes.forEach((node) => {
            if (node.get('is_frozen', false) === false || !node.wasFrozen()) {
                node.validate();
                if (node.isValid) {
                    if (node.hasChanged()) {
                        nodePromises.push(node.save(serviceLocator.socketEventManager));
                    }
                }
            }
        });

        if (nodePromises.length > 0) {
            serviceLocator.eventManager.emit('progress', { name: 'SavingNode', progress: 0.0 });
            // TODO here to handle rejected promises properly
            await Promise.allSettled(nodePromises);
            serviceLocator.collectionManager.refresh('nodes');
            serviceLocator.eventManager.emit('map.updateLayers', {
                transitNodes: serviceLocator.collectionManager.get('nodes').toGeojson(),
                transitNodesSelected: turfFeatureCollection([]),
                transitNodes250mRadius: turfFeatureCollection([]),
                transitNodes500mRadius: turfFeatureCollection([]),
                transitNodes750mRadius: turfFeatureCollection([]),
                transitNodes1000mRadius: turfFeatureCollection([]),
                transitNodesRoutingRadius: turfFeatureCollection([])
            });
            serviceLocator.eventManager.emit('progress', { name: 'SavingNode', progress: 1.0 });
        }

        if (!this.state.nodeErrors || (this.state.nodeErrors && this.state.nodeErrors.length === 0)) {
            serviceLocator.eventManager.emit('map.deleteSelectedPolygon');
            serviceLocator.selectedObjectsManager.deselect('nodes');
        }
    };

    render() {
        if (this.props.nodes.length === 0) {
            return <LoadingPage />;
        }

        const node = this.props.nodes[0];
        const isFrozen = node.attributes.is_frozen || false;
        const nodeId = node.getId();
        const hasPaths = node.hasPaths();
        const isContainSelectedFrozenNodes =
            serviceLocator.selectedObjectsManager.getSingleSelection('isContainSelectedFrozenNodes');
        const changed = this.props.nodes.findIndex((node) => node.hasChanged()) !== -1;

        return (
            <form id="tr__form-transit-node-multi" className="tr__form-transit-node-edit apptr__form">
                <h3>{this.props.t('transit:transitNode:editSelectedNodes')}</h3>
                <p>
                    &nbsp;
                    {this.props.t('transit:transitNode:selectedNodesCount', { count: this.state.editableNodeCount })}
                </p>
                <Collapsible trigger={this.props.t('form:basicFields')} open={true} transitionTime={100}>
                    <div className="tr__form-section">
                        {isFrozen !== true && (
                            <InputWrapper label={this.props.t('transit:transitNode:Color')}>
                                <InputColor
                                    id={`formFieldTransitNodeEditColor${nodeId}`}
                                    value={this.state.color}
                                    defaultColor={_get(Preferences.current, 'transit.nodes.defaultColor', '#0086FF')}
                                    onValueChange={(e) =>
                                        this.onValueChange('color', { value: e.target.value, valid: true })
                                    }
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
                                stringToValue={_toInteger}
                                valueToString={_toString}
                                value={this.state.routing_radius_meters}
                                onValueUpdated={(value) => this.onValueChange('routing_radius_meters', value)}
                            />
                        </InputWrapper>
                        <InputWrapper label={this.props.t('transit:transitNode:DefaultDwellTimeSeconds')}>
                            <InputStringFormatted
                                id={`formFieldTransitNodeEditDefaultDwellTimeSeconds${nodeId}`}
                                disabled={isFrozen}
                                stringToValue={_toInteger}
                                valueToString={_toString}
                                value={this.state.default_dwell_time_seconds}
                                onValueUpdated={(value) => this.onValueChange('default_dwell_time_seconds', value)}
                            />
                        </InputWrapper>
                    </div>
                </Collapsible>

                <Collapsible trigger={this.props.t('form:advancedFields')} transitionTime={100}>
                    <div className="tr__form-section">
                        <InputWrapper label={this.props.t('main:Locked')}>
                            <InputCheckboxBoolean
                                id={`formFieldTransitNodeEditIsFrozen${nodeId}`}
                                label=" "
                                isChecked={node.isFrozen()}
                                onValueChange={(e) =>
                                    this.onValueChange('is_frozen', { value: e.target.value, valid: true })
                                }
                            />
                        </InputWrapper>
                    </div>
                </Collapsible>
                {isContainSelectedFrozenNodes && (
                    <FormErrors errors={['transit:transitNode:editFrozenSelectedNodesWarning']} errorType="Warning" />
                )}
                {this.state.nodeErrors && <FormErrors errors={this.state.nodeErrors} />}

                <div className="tr__form-buttons-container">
                    <span title={this.props.t('main:Back')}>
                        <Button
                            key="back"
                            color="blue"
                            icon={faArrowLeft}
                            iconClass="_icon-alone"
                            label=""
                            onClick={changed ? this.openBackConfirmModal : this.onBack}
                        />
                    </span>
                    <span title={this.props.t('main:Save')}>
                        <Button icon={faCheckCircle} iconClass="_icon-alone" label="" onClick={this.onSave} />
                    </span>
                    {isFrozen !== true && !hasPaths && (
                        <span title={this.props.t('main:Delete')}>
                            <Button
                                icon={faTrashAlt}
                                iconClass="_icon-alone"
                                label=""
                                color="red"
                                onClick={this.openDeleteConfirmModal}
                            />
                        </span>
                    )}
                </div>
                {this.state.confirmModalDeleteIsOpen && (
                    <ConfirmModal
                        isOpen={true}
                        title={this.props.t('transit:transitNode:ConfirmMultipleDelete')}
                        confirmAction={this.onDelete}
                        confirmButtonColor="red"
                        confirmButtonLabel={this.props.t('transit:transitNode:MultipleDelete')}
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
            </form>
        );
    }
}

export default withTranslation(['transit', 'main', 'form', 'notifications'])(TransitNodeCollectionEdit);
