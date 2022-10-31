/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import Line from './Line';

/**
 * Get the weight of a line, ie a value representing its importance in the
 * network and allowing to compare lines together.
 *
 * TODO: Define the weight. Is it a potentially infinite number or should it be
 * normalized to something?
 *
 * @param line The line for which to get the weight
 */
export const getLineWeight = (line: Line) => {
    // TODO: For now, calling the current line weight function, but this
    // function may have more options and multiple specific implementations for
    // different purposes, depending for example on which factor gives more
    // weight (length of line, number of services around nodes, etc)
    return line.getTotalWeightXTravelTimeSeconds();
};
