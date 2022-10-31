/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation } from 'react-i18next';

import { Contribution, LayoutSectionProps } from '../../services/dashboard/DashboardContribution';

interface FullSizePanelProps extends LayoutSectionProps {
    contributions: Contribution<LayoutSectionProps>[];
}

/**
 * Full size panel widget displaying the contributions in parameter. This class
 * is not to be extended. @see Contribution for how to provide widgets at this
 * location.
 *
 * TODO: Rename as the layout evolve. We can't say it's "full size". It's a
 * secondary panel that displays next to some other and over the map
 * @param param0
 * @returns
 */
const FullSizePanel: React.FunctionComponent<FullSizePanelProps> = ({
    contributions,
    ...props
}: FullSizePanelProps) => {
    const contributionElements = React.useMemo(
        () =>
            contributions
                .filter((contrib) => contrib.section === undefined || contrib.section === props.activeSection)
                .map((contrib) => contrib.create({ ...props, key: `fullSizeEl${contrib.id}` })),
        [props.activeSection]
    );

    return <section id="tr__full-size-panel">{contributionElements}</section>;
};

export default withTranslation(['transit', 'main'])(FullSizePanel);
