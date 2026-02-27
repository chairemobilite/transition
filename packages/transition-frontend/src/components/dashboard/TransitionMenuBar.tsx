/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { JSX, use } from 'react';
import { useTranslation } from 'react-i18next';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { LayoutSectionProps } from 'chaire-lib-frontend/lib/services/dashboard/DashboardContribution';
import { ThemeContext } from 'chaire-lib-frontend/lib/contexts/ThemeContext';
import config from 'chaire-lib-common/lib/config/shared/project.config';

// TODO Menu items should not be provided directly by widgets, it should be
// built from descriptive elements, or contributions should register their own
// menu. This is just a copy-paste from the legacy workspace.
const MenuBar: React.FunctionComponent<LayoutSectionProps> = (props) => {
    const { t } = useTranslation(['transit', 'main', 'form']);
    // Get the sections configuration
    const sectionsConfig = config.sections ?? {};

    // Get the current theme (light or dark)
    const theme = use(ThemeContext);
    const sectionIcon = (sectionShortname: string): string => {
        const section = sectionsConfig[sectionShortname];
        return theme === 'dark' ? section.iconWhite : section.iconBlack;
    };

    const onClickHandler = function (e) {
        e.preventDefault();
        const sectionShortname = e.currentTarget.getAttribute('data-section');
        serviceLocator.eventManager.emit(
            'section.change',
            sectionShortname,
            sectionsConfig[sectionShortname].showFullSizePanel
        );
    };

    const sectionLists: JSX.Element[] = [];
    for (const sectionShortname in sectionsConfig) {
        if (sectionsConfig[sectionShortname].enabled !== false) {
            sectionLists.push(
                <li className="tr__left-menu-element" key={sectionShortname}>
                    <button
                        className={`tr__left-menu-button${props.activeSection === sectionShortname ? ' active' : ''}`}
                        data-section={sectionShortname}
                        onClick={onClickHandler}
                    >
                        <span className="tr__left-menu-button-icon">
                            <img
                                className="_icon"
                                src={sectionIcon(sectionShortname)}
                                alt={t(sectionsConfig[sectionShortname].localizedTitle)}
                            />
                        </span>
                        <span className="tr__left-menu-button-name">
                            {t(sectionsConfig[sectionShortname].localizedTitle)}
                        </span>
                    </button>
                </li>
            );
        }
    }

    return <ul className="tr__left-menu-container">{sectionLists}</ul>;
};

export default MenuBar;
