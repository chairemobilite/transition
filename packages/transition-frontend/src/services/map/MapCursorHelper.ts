/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/**
 * Helper functions for managing map cursor via CSS classes.
 *
 * Uses reference counting to handle overlapping features correctly.
 * When hovering two overlapping features and leaving one, the cursor stays
 * as pointer because the count is still > 0.
 *
 * CSS classes applied to the map container:
 * - .hovering: for hovering over any interactive feature (shows pointer cursor)
 * - .dragging: for dragging features (shows grabbing cursor)
 */

const MAP_CONTAINER_ID = 'tr__main-map';

/** Single hover counter for all feature types (handles overlapping features) */
let hoverCount = 0;

/**
 * Get the map container element.
 */
const getMapContainer = (): HTMLElement | null => {
    return document.getElementById(MAP_CONTAINER_ID);
};

/**
 * Called when mouse enters any interactive feature.
 * Adds CSS class on first hover, increments count for subsequent overlapping features.
 */
const addHoverClass = (): void => {
    hoverCount++;
    if (hoverCount === 1) {
        const container = getMapContainer();
        if (container) {
            container.classList.add('hovering');
        }
    }
};

/**
 * Called when mouse leaves any interactive feature.
 * Only removes CSS class when count reaches 0 (no more features being hovered).
 */
const removeHoverClass = (): void => {
    hoverCount = Math.max(0, hoverCount - 1);
    if (hoverCount === 0) {
        const container = getMapContainer();
        if (container) {
            container.classList.remove('hovering');
        }
    }
};

const addDraggingClass = (): void => {
    const container = getMapContainer();
    if (container) {
        container.classList.add('dragging');
    }
};

const removeDraggingClass = (): void => {
    const container = getMapContainer();
    if (container) {
        container.classList.remove('dragging');
    }
};

/**
 * Reset all hover/dragging states. Call on section change or map cleanup.
 */
const resetClasses = (): void => {
    const container = getMapContainer();
    if (container) {
        container.classList.remove('hovering', 'dragging');
    }
    hoverCount = 0;
};

export { addHoverClass, removeHoverClass, addDraggingClass, removeDraggingClass, resetClasses };
