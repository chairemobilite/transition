/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { JSX } from 'react';

/** These are various locations in the layout where a widget can be drawn.
 *
 * TODO: These layout pieces are taken from the legacy layout, we could review
 * them to support more sidebars, but also add a main panel which would include
 * the map by default (whose location is hardcoded in the dashboard currently)
 */
export type layoutPieces = 'menu' | 'toolbar' | 'primarySidebar' | 'secondarySidebar' | 'bottomPanel' | 'mapOverlay';

/**
 * Default props that the contribution widgets will receive by default from the
 * main dashboard
 *
 * @export
 * @interface LayoutSectionProps
 * @extends {WithTranslation}
 */
export interface LayoutSectionProps {
    activeSection: string;
    key?: string;
}

export type PanelSectionProps = LayoutSectionProps & {
    parentRef?: React.RefObject<HTMLDivElement>;
};

/**
 * Interface to be implemented by contribution elements. Each widget that goes
 * in a specific location of the dashboard should be a single contribution
 * element implementing this. A module can have as many contribution as
 * necessary.
 *
 * TODO: This is not the final design of the contributions. When we have more
 * implementations than just transition dashboard, we can revisit the
 * architecture in general, or for specific contribution elements, like menus.
 *
 * @export
 * @interface Contribution
 * @template T
 */
export interface Contribution<T> {
    /** Unique identifier for this contribution, used as a key */
    id: string;
    /**
     * Optional section for which this contribution applies. It won't be
     * considered if the active section is not this section. If undefined, this
     * contribution will be displayed all the time.
     *
     * @type {string}
     * @memberof Contribution
     */
    section?: string;
    /**
     * Where to place this contribution in the dashboard layout
     *
     * @type {layoutPieces}
     * @memberof Contribution
     */
    placement: layoutPieces;
    /**
     * Function that creates the contributed widget. It will receive the props
     * from the layout
     *
     * @memberof Contribution
     */
    create: (props: T) => JSX.Element;
}

/**
 * Base class to be extended by modules to provide contribution to the
 * dashboard. This is the main class to extend for applications to display
 * content on the dashboard.
 *
 * Implementations can provide as many contributions as desired, they will be
 * displayed in each layout locations for the specific active sections. The
 * widgets themselves have total liberty on their behavior. There is not yet
 * much API they can hook to
 *
 * @export
 * @abstract
 * @class DashboardContribution
 */
export abstract class DashboardContribution {
    /**
     * Return all the layout contributions provided by this class.
     *
     * @memberof DashboardContribution
     */
    getLayoutContributions = (): Contribution<LayoutSectionProps>[] => {
        return [];
    };
}
