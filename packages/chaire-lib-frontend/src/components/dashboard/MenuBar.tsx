/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

import { Contribution, LayoutSectionProps } from '../../services/dashboard/DashboardContribution';

interface MenuBarProps extends LayoutSectionProps {
    contributions: Contribution<LayoutSectionProps>[];
}

/**
 * Menu bar widget displaying the contributions in parameter. This class is not
 * to be extended. @see Contribution for how to provide menu widgets.
 * @param param0
 * @returns
 */
const MenuBar: React.FunctionComponent<MenuBarProps> = ({ contributions, ...props }: MenuBarProps) => {
    const contributionElements = React.useMemo(
        () =>
            contributions
                .filter((contrib) => contrib.section === undefined || contrib.section === props.activeSection)
                .map((contrib) => contrib.create({ ...props, key: `menuBarEl${contrib.id}` })),
        [props.activeSection]
    );

    return <nav id="tr__left-menu">{contributionElements}</nav>;
};

export default MenuBar;
