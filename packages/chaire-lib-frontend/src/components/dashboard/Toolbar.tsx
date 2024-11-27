/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation } from 'react-i18next';

import { Contribution, LayoutSectionProps } from '../../services/dashboard/DashboardContribution';
import NotificationArea from './NotificationArea';

interface MenuBarProps extends LayoutSectionProps {
    contributions: Contribution<LayoutSectionProps>[];
}

/**
 * Toolbar widget displaying the contributions in parameter. This class is not
 * to be extended. @see Contribution for how to provide toolbar widgets.
 * @param param0
 * @returns
 */
const Toolbar: React.FunctionComponent<MenuBarProps> = ({ contributions, ...props }: MenuBarProps) => {
    const contributionElements = React.useMemo(
        () =>
            contributions
                .filter((contrib) => contrib.section === undefined || contrib.section === props.activeSection)
                .map((contrib) => contrib.create({ ...props, key: `toolbarEl${contrib.id}` })),
        [props.activeSection]
    );

    return (
        <nav id="tr__top-menu">
            <div className="tr__top-menu-buttons">{contributionElements}</div>
            <NotificationArea />
        </nav>
    );
};

export default withTranslation()(Toolbar);
