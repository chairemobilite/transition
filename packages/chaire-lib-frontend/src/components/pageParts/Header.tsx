/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { NavLink } from 'react-router-dom';
import { connect } from 'react-redux';
import { withTranslation, WithTranslation } from 'react-i18next';
import moment from 'moment-business-days';

import { startLogout, resetUserProfile } from '../../actions/Auth';
import config from 'chaire-lib-common/lib/config/shared/project.config';
import { FrontendUser } from '../../services/auth/user';
import { History } from 'history';

export interface HeaderProps extends WithTranslation {
    user: FrontendUser;
    path: any;
    startLogout: () => void;
    resetUserProfile: () => void;
    appName: string;
    history: History;
}

interface UserProps {
    user: FrontendUser;
}

const User: React.FunctionComponent<UserProps & WithTranslation> = (props: UserProps & WithTranslation) => (
    <div className="menu-button" key={'header__nav-username'}>
        {props.user.showUserInfo && (props.user.username || props.user.email || props.t('menu:User'))}
    </div>
);

const TranslatableUser = withTranslation('menu')(User);

const Header: React.FunctionComponent<HeaderProps> = (props: HeaderProps) => {
    const appTitle = config.appTitle;
    const title = config.title[props.i18n.language];
    return (
        <header className="header">
            <div className="header__content">
                <nav className="header__nav-left">
                    {appTitle !== undefined && (
                        <h1>
                            {appTitle} • <strong>{title}</strong>
                        </h1>
                    )}
                    {appTitle === undefined && <h1>{title}</h1>}
                </nav>
                <nav className="header__nav-right">
                    {props.user &&
                        props.user.pages.map((page) => (
                            <NavLink className="menu-button" key={page.title} to={page.path}>
                                {props.t(page.title)}
                            </NavLink>
                        ))}
                    {!props.user && props.path !== '/login' && config.showLogin !== false && (
                        <NavLink className="menu-button" key={'header__nav-login'} to="/login">
                            {props.t('menu:login')}
                        </NavLink>
                    )}
                    {props.user && config.showLogout !== false && (
                        <button
                            type="button"
                            className="menu-button"
                            key={'header__nav-logout'}
                            onClick={props.startLogout}
                        >
                            {props.t('menu:logout')}
                        </button>
                    )}
                    {props.user && config.showLogout !== false && (
                        <button
                            type="button"
                            className="menu-button"
                            key={'header__nav-reset'}
                            onClick={props.resetUserProfile}
                        >
                            {props.t('menu:Reset')}
                        </button>
                    )}
                    {config.languages.map((language) => {
                        return props.i18n.language !== language ? (
                            <button
                                type="button"
                                className="menu-button em"
                                key={`header__nav-language-${language}`}
                                lang={language}
                                onClick={() => {
                                    props.i18n.changeLanguage(language);
                                    moment.locale(props.i18n.language);
                                }}
                            >
                                {config.languageNames[language]}
                            </button>
                        ) : (
                            ''
                        );
                    })}
                    {props.user && <TranslatableUser user={props.user} />}
                </nav>
            </div>
        </header>
    );
};

const mapStateToProps = (state) => {
    return { user: state.auth.user };
};

const mapDispatchToProps = (dispatch, props: Omit<HeaderProps, 'startLogout'>) => ({
    startLogout: () => dispatch(startLogout(props.history)),
    resetUserProfile: () => dispatch(resetUserProfile(props.history))
});

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation('menu')(Header));
