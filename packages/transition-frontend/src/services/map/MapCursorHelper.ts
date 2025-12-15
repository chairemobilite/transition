/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/**
 * Helper functions for managing map cursor via CSS classes.
 *
 * Deck.gl's getCursor sets canvas.style.cursor on every render, so we use CSS
 * classes on the map container with !important to override it. The classes are:
 * - .cursor-pointer: for hovering over interactive features
 * - .cursor-grabbing: for dragging features
 */

const MAP_CONTAINER_ID = 'tr__main-map';

/**
 * Get the map container element.
 */
const getMapContainer = (): HTMLElement | null => {
    return document.getElementById(MAP_CONTAINER_ID);
};

/**
 * Set pointer cursor (called on mouseenter of interactive features).
 */
export const setPointerCursor = (): void => {
    const container = getMapContainer();
    if (container) {
        container.classList.add('cursor-pointer');
    }
};

/**
 * Reset pointer cursor (called on mouseleave of interactive features).
 */
export const resetCursor = (): void => {
    const container = getMapContainer();
    if (container) {
        container.classList.remove('cursor-pointer', 'cursor-grabbing');
    }
};

/**
 * Set grabbing cursor (called when starting to drag a feature).
 */
export const setDraggingCursor = (): void => {
    const container = getMapContainer();
    if (container) {
        container.classList.add('cursor-grabbing');
    }
};

/**
 * Reset dragging cursor (called when drag ends).
 */
export const resetDraggingCursor = (): void => {
    const container = getMapContainer();
    if (container) {
        container.classList.remove('cursor-grabbing');
    }
};
