/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { JSX } from 'react';
import { WithTranslation, withTranslation } from 'react-i18next';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { LayoutSectionProps } from 'chaire-lib-frontend/lib/services/dashboard/DashboardContribution';
import Preferences from 'chaire-lib-common/lib/config/Preferences';

// TODO Menu items should not be provided directly by widgets, it should be
// built from descriptive elements, or contributions should register their own
// menu. This is just a copy-paste from the legacy workspace.
const MenuBar: React.FunctionComponent<LayoutSectionProps & WithTranslation> = (
    props: LayoutSectionProps & WithTranslation
) => {
    const sectionsConfig = Preferences.get('sections.transition');

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
                                src={sectionsConfig[sectionShortname].icon}
                                alt={props.t(sectionsConfig[sectionShortname].localizedTitle)}
                            />
                        </span>
                        <span className="tr__left-menu-button-name">
                            {props.t(sectionsConfig[sectionShortname].localizedTitle)}
                        </span>
                    </button>
                </li>
            );
        }
    }

    return <ul className="tr__left-menu-container">{sectionLists}</ul>;
};

export default withTranslation(['transit', 'main', 'form'])(MenuBar);
