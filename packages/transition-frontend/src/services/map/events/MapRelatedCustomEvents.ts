/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/**
 * Those are events that are not triggered by the map, but involve th map
 *
 * TODO: Other parts of the app should not be "map-aware", there should be more
 * generic events to which the map can register
 */
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { EventEmitter } from 'events';
import Node from 'transition-common/lib/services/nodes/Node';

const events = function (eventManager: EventEmitter) {
    return {
        'path.hoverNode': function (node: Node, _nodeTitle = node.toString(false)) {
            // TODO Re-implement
            /*const popup = new Popup({
                offset: 10,
                anchor: 'bottom'
            });
            const nodeId = node.get('id');
            popup.setLngLat(node.attributes.geography.coordinates as [number, number]);
            if (
                serviceLocator &&
                serviceLocator.keyboardManager &&
                serviceLocator.keyboardManager.keyIsPressed('alt')
            ) {
                popup.setHTML(
                    `<p>${nodeTitle}<br />${nodeId}${
                        node.getAttributes().data.weight ? `<br />w${Math.round(node.getAttributes().data.weight)}` : ''
                    }</p>`
                );
            } else {
                popup.setHTML(`<p>${nodeTitle}</p>`);
            }
            eventManager.emit('map.addPopup', nodeId, popup);*/
        },

        'path.unhoverNode': function (nodeId: string) {
            if (
                serviceLocator &&
                serviceLocator.keyboardManager &&
                serviceLocator.keyboardManager.keyIsPressed('alt')
            ) {
                // keep popup for now when alt is pressed
            } else {
                eventManager.emit('map.removePopup', nodeId);
            }
        }
    };
};

export default {
    addEvents: function (eventManager: EventEmitter) {
        const _events = events(eventManager);
        for (const eventName in _events) {
            eventManager.on(eventName, _events[eventName]);
        }
    },

    removeEvents: function (eventManager: EventEmitter) {
        const _events = events(eventManager);
        for (const eventName in _events) {
            eventManager.off(eventName, _events[eventName]);
        }
    }
};
