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

import ConfirmModal from '../modal/ConfirmModal';
import { startLogout, resetUserProfile } from '../../actions/Auth';
import config from 'chaire-lib-common/lib/config/shared/project.config';
import { History } from 'history';
import { CliUser } from 'chaire-lib-common/lib/services/user/userType';

export interface HeaderProps extends WithTranslation {
    user: CliUser;
    path: any;
    startLogout: () => void;
    resetUserProfile: () => void;
    appName: string;
    history: History;
}

interface UserProps {
    user: CliUser;
    resetUserProfile: () => void;
}

interface UserMenuProps {
    user: CliUser;
    resetUserProfile: () => void;
    wrapperRef: React.MutableRefObject<null>;
    closeMenu: () => void;
}

const UserMenu: React.FunctionComponent<UserMenuProps & WithTranslation> = (props: UserMenuProps & WithTranslation) => {
    const [resetModalIsOpened, setResetModalIsOpened] = React.useState(false);
    React.useLayoutEffect(() => {
        function handleClickOutside(event) {
            if (
                null !== props.wrapperRef &&
                props.wrapperRef.current &&
                !(props.wrapperRef.current as any).contains(event.target) &&
                !resetModalIsOpened
            ) {
                props.closeMenu();
            }
        }
        // Bind the event listener
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            // Unbind the event listener on clean up
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [props.wrapperRef, resetModalIsOpened]);
    return (
        <div className="menu" ref={props.wrapperRef} style={{ display: 'block' }}>
            <button
                type="button"
                className="menu-button"
                key={'header__nav-reset'}
                onClick={() => setResetModalIsOpened(true)}
            >
                {props.t('menu:Reset')}
            </button>
            {resetModalIsOpened && (
                <ConfirmModal
                    isOpen={true}
                    title={props.t('menu:ResetUserPrefsTitle')}
                    confirmAction={() => props.resetUserProfile()}
                    confirmButtonColor="red"
                    confirmButtonLabel={props.t('menu:ResetUserPrefsConfirm')}
                    closeModal={() => setResetModalIsOpened(false)}
                />
            )}
        </div>
    );
};
const TranslatableUserMenu = withTranslation('menu')(UserMenu);

const User: React.FunctionComponent<UserProps & WithTranslation> = (props: UserProps & WithTranslation) => {
    const [display, setDisplay] = React.useState('none');
    const wrapperRef = React.useRef(null);
    return (
        <li className="tr__top-menu-element" key={'item-nav-user'}>
            <button
                className="menu-button"
                type="button"
                onClick={() => setDisplay(display === 'none' ? 'block' : 'none')}
            >
                {props.user.username || props.user.email || props.t('menu:User')}
            </button>
            {display !== 'none' && (
                <TranslatableUserMenu
                    wrapperRef={wrapperRef}
                    user={props.user}
                    resetUserProfile={props.resetUserProfile}
                    closeMenu={() => setDisplay('none')}
                />
            )}
        </li>
    );
};

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
                    <ul>
                        {props.user &&
                            props.user.pages.map((page) => (
                                <li className="tr__top-menu-element" key={`item-${page.title}`}>
                                    <NavLink className="menu-button" key={page.title} to={page.path}>
                                        {props.t(page.title)}
                                    </NavLink>
                                </li>
                            ))}
                        {!props.user && props.path !== '/login' && config.showLogin !== false && (
                            <li className="tr__top-menu-element" key={'item-nav-login'}>
                                <NavLink className="menu-button" key={'header__nav-login'} to="/login">
                                    {props.t('menu:login')}
                                </NavLink>
                            </li>
                        )}
                        {props.user && config.showLogout !== false && (
                            <li className="tr__top-menu-element" key={'item-nav-logout'}>
                                <button
                                    type="button"
                                    className="menu-button"
                                    key={'header__nav-logout'}
                                    onClick={props.startLogout}
                                >
                                    {props.t('menu:logout')}
                                </button>
                            </li>
                        )}
                        {config.languages.map((language) => {
                            return props.i18n.language !== language ? (
                                <li className="tr__top-menu-element" key={'item-nav-lang'}>
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
                                </li>
                            ) : (
                                ''
                            );
                        })}
                        {props.user && <TranslatableUser user={props.user} resetUserProfile={props.resetUserProfile} />}
                    </ul>
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
