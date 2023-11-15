/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import nodeSectionMapEvents from './NodeSectionMapEvents';
import nodeLayerMapEvents from './NodeLayerMapEvents';
import routingSectionMapEvents from './RoutingSectionMapEvents';
import pathLayerMapEvents from './PathLayerMapEvents';
import pathSectionMapEvents from './PathSectionMapEvents';
import scenarioSectionMapEvents from './ScenarioSectionMapEvents';
import accessMapSectionMapEvents from './AccessibilityMapSectionMapEvents';

const transitionEvents = [
    nodeSectionMapEvents,
    nodeLayerMapEvents,
    routingSectionMapEvents,
    accessMapSectionMapEvents,
    pathLayerMapEvents,
    pathSectionMapEvents,
    scenarioSectionMapEvents
];
const transitionEventsArr = transitionEvents.flatMap((ev) => ev);
export default transitionEventsArr;
