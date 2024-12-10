/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

import { Contribution, LayoutSectionProps } from '../../services/dashboard/DashboardContribution';

interface BottomPanelProps extends LayoutSectionProps {
    activeSection: string;
    contributions: Contribution<LayoutSectionProps>[];
}

/**
 * Bottom panel widget displaying the contributions in parameter. This class is
 * not to be extended. @see Contribution for how to provide widgets to display
 * in the bottom panel
 * @param param0
 * @returns
 */
const BottomPanel: React.FunctionComponent<BottomPanelProps> = ({ contributions, ...props }: BottomPanelProps) => {
    const contributionElements = React.useMemo(
        () =>
            contributions
                .filter((contrib) => contrib.section === undefined || contrib.section === props.activeSection)
                .map((contrib) => contrib.create({ ...props, key: `bottomPanelEl${contrib.id}` })),
        [props.activeSection]
    );

    return <section id="tr__bottom-panel">{contributionElements}</section>;
};

export default BottomPanel;
