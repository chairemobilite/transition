/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

import { Contribution, LayoutSectionProps, PanelSectionProps } from '../../services/dashboard/DashboardContribution';
import ErrorBoundary from '../pageParts/ErrorBoundary';

interface RightPanelProps extends LayoutSectionProps {
    // TODO This prop should be in a context or some other global scheme
    availableRoutingModes: string[];
    contributions: Contribution<PanelSectionProps>[];
}

/**
 * Right panel widget displaying the contributions in parameter. This class is
 * not to be extended. @see Contribution for how to provide widgets at this
 * location.
 *
 * @param param0
 * @returns
 */
const RightPanel: React.FunctionComponent<RightPanelProps> = ({ contributions, ...props }: RightPanelProps) => {
    const rightPanelRef = React.useRef<HTMLDivElement>(null);
    const contributionElements = React.useMemo(
        () =>
            contributions
                .filter((contrib) => contrib.section === undefined || contrib.section === props.activeSection)
                .map((contrib) =>
                    contrib.create({
                        ...props,
                        key: `rightPanelEl${contrib.id}`,
                        parentRef: rightPanelRef as React.RefObject<HTMLDivElement>
                    })
                ),
        [props.activeSection, props.availableRoutingModes]
    );
    // Reset ref scroll position when changing section
    React.useEffect(() => rightPanelRef.current?.scrollTo({ left: 0, top: 0 }), [props.activeSection]);

    return (
        <section ref={rightPanelRef} id="tr__right-panel">
            <div className="tr__right-panel-inner">
                <ErrorBoundary key={props.activeSection}>{contributionElements}</ErrorBoundary>
            </div>
        </section>
    );
};

export default RightPanel;
