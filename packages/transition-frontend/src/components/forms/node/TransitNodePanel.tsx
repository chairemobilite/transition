/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import MathJax from 'react-mathjax';
import { faFileUpload } from '@fortawesome/free-solid-svg-icons/faFileUpload';
import { faCheck } from '@fortawesome/free-solid-svg-icons/faCheck';

import Button from 'chaire-lib-frontend/lib/components/input/Button';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import CollectionDownloadButtons from 'chaire-lib-frontend/lib/components/pageParts/CollectionDownloadButtons';
import ConfirmModal from 'chaire-lib-frontend/lib/components/modal/ConfirmModal';
import CollectionSaveToCacheButtons from '../../parts/CollectionSaveToCacheButtons';
import DocumentationTooltip from '../../parts/DocumentationTooltip';
import TransitNodeEdit from './TransitNodeEdit';
import TransitNodeCollectionEdit from './TransitNodeCollectionEdit';
import NodesImportForm from './TransitNodeImportForm';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import Node from 'transition-common/lib/services/nodes/Node';
import { deleteUnusedNodes } from '../../../services/transitNodes/transitNodesUtils';

// Using a state object instead of 2 useState hooks because we want this object
// to be modified and cause a re-render if the selection or collection was
// updated, even if the pointer to the collection/selected object do not change.
interface NodePanelState {
    nodeCollection: NodeCollection;
    selectedNode?: Node;
    selectedNodes: Node[] | string[]; // string[] is used to handle the draw_polygon mode
    stationCollection: any;
    selectedStation?: any;
    dataSourceCollection: any;
}

const NodePanel: React.FunctionComponent<WithTranslation> = (props: WithTranslation) => {
    const [importerSelected, setImporterSelected] = React.useState(false);
    const [lastOptionIsSelectedNodes, setLastOptionIsSelectedNodes] = React.useState(false);
    const [confirmDeleteModalIsOpened, setConfirmDeleteModalIsOpened] = React.useState(false);
    const [state, setState] = React.useState<NodePanelState>({
        stationCollection: serviceLocator.collectionManager.get('stations'),
        nodeCollection: serviceLocator.collectionManager.get('nodes'),
        dataSourceCollection: serviceLocator.collectionManager.get('dataSources'),
        selectedStation: serviceLocator.selectedObjectsManager.getSingleSelection('station'),
        selectedNode: serviceLocator.selectedObjectsManager.getSingleSelection('node'),
        selectedNodes: serviceLocator.selectedObjectsManager.getSelection('nodes') || []
    });

    React.useEffect(() => {
        const onStationCollectionUpdate = () => {
            setState((state) =>
                Object.assign({}, state, {
                    stationCollection: serviceLocator.collectionManager.get('stations')
                })
            );
        };

        const onNodeCollectionUpdate = () => {
            setState((state) =>
                Object.assign({}, state, {
                    nodeCollection: serviceLocator.collectionManager.get('nodes')
                })
            );
        };

        const onSelectedStationUpdate = () => {
            setState((state) =>
                Object.assign({}, state, {
                    selectedStation: serviceLocator.selectedObjectsManager.getSingleSelection('station')
                })
            );
        };

        const onSelectedNodeUpdate = () => {
            setState((state) =>
                Object.assign({}, state, {
                    selectedNode: serviceLocator.selectedObjectsManager.getSingleSelection('node')
                })
            );
            setLastOptionIsSelectedNodes(false);
        };

        const onSelectedNodesUpdate = () => {
            setState((state) =>
                Object.assign({}, state, {
                    selectedNodes: serviceLocator.selectedObjectsManager.getSelection('nodes') || []
                })
            );
            setLastOptionIsSelectedNodes(true);
        };
        serviceLocator.eventManager.on('collection.update.stations', onStationCollectionUpdate);
        serviceLocator.eventManager.on('collection.update.nodes', onNodeCollectionUpdate);
        serviceLocator.eventManager.on('collection.update.dataSources', onNodeCollectionUpdate);
        serviceLocator.eventManager.on('selected.update.station', onSelectedStationUpdate);
        serviceLocator.eventManager.on('selected.update.node', onSelectedNodeUpdate);
        serviceLocator.eventManager.on('map.editUpdateMultipleNodes', onSelectedNodesUpdate);
        serviceLocator.eventManager.on('selected.deselect.station', onSelectedStationUpdate);
        serviceLocator.eventManager.on('selected.deselect.node', onSelectedNodeUpdate);
        serviceLocator.eventManager.on('selected.update.nodes', onSelectedNodesUpdate);
        return () => {
            serviceLocator.eventManager.off('collection.update.stations', onStationCollectionUpdate);
            serviceLocator.eventManager.off('collection.update.nodes', onNodeCollectionUpdate);
            serviceLocator.eventManager.off('collection.update.dataSources', onNodeCollectionUpdate);
            serviceLocator.eventManager.off('selected.update.station', onSelectedStationUpdate);
            serviceLocator.eventManager.off('selected.update.node', onSelectedNodeUpdate);
            serviceLocator.eventManager.off('map.editUpdateMultipleNodes', onSelectedNodesUpdate);
            serviceLocator.eventManager.off('selected.deselect.station', onSelectedStationUpdate);
            serviceLocator.eventManager.off('selected.deselect.node', onSelectedNodeUpdate);
            serviceLocator.eventManager.off('selected.update.nodes', onSelectedNodesUpdate);
        };
    }, []);

    const closeUnsavedChangesModal = (e) => {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }
        if (lastOptionIsSelectedNodes) {
            serviceLocator.eventManager.emit('map.deleteSelectedPolygon');
        }
    };

    const deleteAllUnusedNodes = async (e) => {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }
        serviceLocator.eventManager.emit('progress', { name: 'DeletingNodes', progress: 0.0 });

        try {
            await deleteUnusedNodes();
            // FIXME This should be somehow automatic, we should not need to do those 2 calls
            serviceLocator.collectionManager.refresh('nodes');
            serviceLocator.eventManager.emit('map.updateLayers', {
                transitNodes: serviceLocator.collectionManager.get('nodes').toGeojson()
            });
        } catch (error) {
            // TODO Log errors
            console.log('Error deleting unused nodes', error);
        } finally {
            serviceLocator.eventManager.emit('progress', { name: 'DeletingNodes', progress: 1.0 });
        }
    };

    // TODO Review the conditions to define which part is opened. This is a bit complicated wrt the state. Can there really be both selectedNode and selectedNodes?
    console.log('TransitNodePanel render:', {
        selectedNodesCount: state.selectedNodes ? state.selectedNodes.length : 0,
        lastOptionIsSelectedNodes,
        importerSelected,
        firstNode: state.selectedNodes && state.selectedNodes.length > 0 ? state.selectedNodes[0] : 'N/A'
    });
    return (
        <div id="tr__form-transit-nodes-panel" className="tr__form-transit-nodes-panel tr__panel">
            {!state.selectedNode && state.selectedNodes.length === 0 && !state.selectedStation && !importerSelected && (
                <>
                    <h3>
                        <img
                            src={'/dist/images/icons/transit/node_white.svg'}
                            className="_icon"
                            alt={props.t('transit:transitNode:Nodes')}
                        />{' '}
                        {props.t('transit:transitNode:Nodes')}&nbsp;
                        <MathJax.Provider>
                            <MathJax.Node inline formula={'q'} data-tooltip-id="node-tooltip" />
                        </MathJax.Provider>
                    </h3>
                    <DocumentationTooltip dataTooltipId="node-tooltip" documentationLabel="node" />
                </>
            )}
            {state.selectedNodes.length > 0 &&
                state.selectedNodes[0] !== 'draw_polygon' &&
                state.selectedNode &&
                state.selectedNode.hasChanged() && (
                <ConfirmModal
                    isOpen={true}
                    title={props.t('main:UnsavedChanges')}
                    closeModal={closeUnsavedChangesModal}
                    confirmAction={closeUnsavedChangesModal}
                    confirmButtonColor="grey"
                    confirmButtonLabel={props.t('main:OK')}
                    showCancelButton={false}
                />
            )}
            {state.selectedNodes && state.selectedNodes.length > 0 && (
                <p>Selected nodes: {state.selectedNodes.length}</p>
            )}
            {((state.selectedNodes.length > 0 && lastOptionIsSelectedNodes) ||
                (state.selectedNodes.length > 0 && !importerSelected)) &&
                state.selectedNodes[0] !== 'draw_polygon' && (
                <TransitNodeCollectionEdit
                    key={(state.selectedNodes as Node[])
                        .map((n) =>
                            typeof n.getId === 'function'
                                ? n.getId()
                                : (n as any).id || (n as any).uuid || Math.random().toString()
                        )
                        .sort()
                        .join('-')}
                    nodes={state.selectedNodes as Node[]} // string[] is for draw_polygon only, so here we have Node[]
                    onBack={() => {
                        setLastOptionIsSelectedNodes(false);
                        setState((state) =>
                            Object.assign({}, state, {
                                selectedNodes: []
                            })
                        );
                        serviceLocator.eventManager.emit('map.deleteSelectedPolygon');
                    }}
                />
            )}
            {
                // TODO Add the station back
                /*stationSelected && !importerSelected && (
                <TransitStationEdit station={this.state.selectedStation} />
            )*/
            }
            {state.selectedNode && state.selectedNodes.length === 0 && !importerSelected && (
                <TransitNodeEdit node={state.selectedNode} />
            )}
            {!state.selectedNode && state.selectedNodes.length === 0 && !state.selectedStation && importerSelected && (
                <NodesImportForm setImporterSelected={setImporterSelected} />
            )}

            {!state.selectedNode && state.selectedNodes.length === 0 && !state.selectedStation && !importerSelected && (
                <div className="tr__form-buttons-container">
                    <Button
                        color="blue"
                        icon={faFileUpload}
                        iconClass="_icon"
                        label={props.t('transit:transitNode:ImportFromGeojson')}
                        onClick={() => setImporterSelected(true)}
                    />
                </div>
            )}

            {!state.selectedNode &&
                state.selectedNodes.length === 0 &&
                !state.selectedStation &&
                !importerSelected &&
                state.nodeCollection &&
                state.nodeCollection.size() > 0 && (
                <div className="tr__form-buttons-container">
                    <Button
                        color="green"
                        icon={faCheck}
                        iconClass="_icon"
                        label={props.t('transit:transitNode:SaveAllAndUpdateTransferableNodes')}
                        onClick={() => {
                            // notifications are handled inside saveAndUpdateAll function:
                            serviceLocator.socketEventManager.emit('transitNodes.updateTransferableNodes', () => {
                                serviceLocator.eventManager.emit('progress', {
                                    name: 'UpdatingTransferableNodes',
                                    progress: 1.0
                                }); // we need to repeat the notification since it can fail to reach 100%.
                            });
                        }}
                    />
                </div>
            )}

            {!state.selectedNode &&
                state.selectedNodes.length === 0 &&
                !state.selectedStation &&
                !importerSelected &&
                state.nodeCollection &&
                state.nodeCollection.size() > 0 && (
                <div className="tr__form-buttons-container">
                    <Button
                        color="red"
                        icon={faCheck}
                        iconClass="_icon"
                        label={props.t('transit:transitNode:DeleteAllUnusedNodes')}
                        onClick={() => setConfirmDeleteModalIsOpened(true)}
                    />
                </div>
            )}

            {!state.selectedNode && state.selectedNodes.length === 0 && !state.selectedStation && !importerSelected && (
                <CollectionSaveToCacheButtons collection={state.nodeCollection} labelPrefix={'transit:transitNode'} />
            )}

            {state.selectedNodes.length === 0 && !state.selectedNode && !importerSelected && (
                <CollectionDownloadButtons collection={state.nodeCollection} />
            )}

            {confirmDeleteModalIsOpened && (
                <ConfirmModal
                    title={props.t('transit:transitNode:ConfirmAllDelete')}
                    confirmAction={deleteAllUnusedNodes}
                    isOpen={true}
                    confirmButtonColor="red"
                    confirmButtonLabel={props.t('transit:transitNode:MultipleDelete')}
                    closeModal={() => setConfirmDeleteModalIsOpened(false)}
                />
            )}

            {/* disabled for now because it is too slow and unreliable (valhalla problem with some snodes) */}
            {/*!nodeSelected && !stationSelected && this.state.nodeCollection.size() > 0 && <div className="tr__form-buttons-container">
          <Button color="green" icon={faCheck} iconClass="_icon" label={this.props.t('transit:transitNode:UpdateNodesWalkingAccessibilityMap')} action={function() {
            serviceLocator.socketEventManager.emit('nodes.updateNodesAccessibilityMap', { mode: 'walking', durationsMinutes: [5,10]}, function(response) {
              console.log('nodes.updateNodesAccessibilityMap success');
            });
            // notifications are handled inside updateWalkingAccessibilityMap function:
            /*serviceLocator.collectionManager.get('nodes').updateNodesAccessibilityMap(serviceLocator.socketEventManager, serviceLocator.eventManager, 'walking', [5,10,15,20]).then(function(response) {
              if (response.geojson && response.geojson.features)
              {
                serviceLocator.eventManager.emit(`map.updateLayers`, {
                  isochronePolygons: response.geojson
                });
                serviceLocator.eventManager.emit('progress', { name: "UpdateNodesAccessibilityMap", progress: 1.0 }); // we need to repeat the notification since it can fail to reach 100%.
              }
              else
              {
                console.log('failed to generate nodes accessibility map');
              }
            });*/
            /*}} />
          <Button color="green" icon={faCheck} iconClass="_icon" label={this.props.t('transit:transitNode:GetNodesWalkingAccessibilityMapFromCache')} action={function() {
            serviceLocator.eventManager.emit('progress', { name: "LoadingNodesAccessibilityMapCache", progress: 0.0 }); // we need to repeat the notification since it can fail to reach 100%.
            serviceLocator.socketEventManager.emit('cache.getJsonFromFile', `nodesAccessibilityMap_walking.json`, function(geojson) {
              if (geojson && geojson.features)
              {
                serviceLocator.eventManager.emit(`map.updateLayers`, {
                  isochronePolygons: geojson
                });
              }
              else
              {
                console.log('could not get nodes accessibility map from cache');
              }
              serviceLocator.eventManager.emit('progress', { name: "LoadingNodesAccessibilityMapCache", progress: 1.0 });
            });
          }} />
        </div>*/}
        </div>
    );
};

export default withTranslation(['transit', 'main', 'notifications'])(NodePanel);
