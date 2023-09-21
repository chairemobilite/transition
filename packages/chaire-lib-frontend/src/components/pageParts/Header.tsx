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
import { startLogout } from '../../actions/Auth';
import config from 'chaire-lib-common/lib/config/shared/project.config';
import appConfiguration, { UserMenuItem } from '../../config/application.config';
import { History } from 'history';
import { CliUser } from 'chaire-lib-common/lib/services/user/userType';

export interface HeaderProps extends WithTranslation {
    user: CliUser;
    path: any;
    startLogout: () => void;
    appName: string;
    history: History;
}

interface UserProps {
    user: CliUser;
}

interface UserMenuButtonProps {
    menuItem: UserMenuItem;
    modalOpenedCallback: (isOpened: boolean) => void;
    closeMenu: () => void;
}

const UserMenuButton: React.FunctionComponent<UserMenuButtonProps & WithTranslation> = (
    props: UserMenuButtonProps & WithTranslation
) => {
    const [modalIsOpened, setModalIsOpened] = React.useState(false);
    const toggleModal = (opened: boolean) => {
        setModalIsOpened(opened);
        props.modalOpenedCallback(opened);
    };
    const executeAction: React.MouseEventHandler = (e) => {
        props.menuItem.action(e);
        if (props.menuItem.postExec === 'refreshLang') {
            // This will trigger a refresh of all i18n strings on the page
            props.i18n.changeLanguage(props.i18n.language);
        }
        props.closeMenu();
    };
    return (
        <React.Fragment>
            <button
                type="button"
                className="menu-button"
                key={'header__nav-reset'}
                onClick={props.menuItem.confirmModal === undefined ? executeAction : () => toggleModal(true)}
            >
                {props.menuItem.getText(props.t)}
            </button>
            {modalIsOpened && props.menuItem.confirmModal !== undefined && (
                <ConfirmModal
                    isOpen={true}
                    title={props.menuItem.confirmModal.title(props.t)}
                    confirmAction={executeAction}
                    confirmButtonColor="red"
                    confirmButtonLabel={props.menuItem.confirmModal.label(props.t)}
                    closeModal={() => toggleModal(false)}
                />
            )}
        </React.Fragment>
    );
};
const TranslatableUserMenuButton = withTranslation('menu')(UserMenuButton);

interface UserMenuProps {
    user: CliUser;
    wrapperRef: React.MutableRefObject<null>;
    closeMenu: () => void;
}

const UserMenu: React.FunctionComponent<UserMenuProps & WithTranslation> = (props: UserMenuProps & WithTranslation) => {
    const [hasModalOpened, setHasModalOpened] = React.useState(false);
    React.useLayoutEffect(() => {
        function handleClickOutside(event) {
            if (
                null !== props.wrapperRef &&
                props.wrapperRef.current &&
                !(props.wrapperRef.current as any).contains(event.target) &&
                !hasModalOpened
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
    }, [props.wrapperRef, hasModalOpened]);
    return (
        <div className="menu userMenu" ref={props.wrapperRef}>
            {appConfiguration.userMenuItems.map((menuItem, index: number) => (
                <TranslatableUserMenuButton
                    key={`header__nav-user${index}`}
                    menuItem={menuItem}
                    modalOpenedCallback={setHasModalOpened}
                    closeMenu={props.closeMenu}
                />
            ))}
        </div>
    );
};
const TranslatableUserMenu = withTranslation('menu')(UserMenu);

const User: React.FunctionComponent<UserProps & WithTranslation> = (props: UserProps & WithTranslation) => {
    const [display, setDisplay] = React.useState('none');
    const wrapperRef = React.useRef(null);
    return (
        <li className="tr__top-menu-element" key={'item-nav-user'} id="item-nav-user">
            <button
                className="menu-button"
                type="button"
                onClick={
                    appConfiguration.userMenuItems.length > 0
                        ? () => setDisplay(display === 'none' ? 'block' : 'none')
                        : undefined
                }
            >
                {props.user.username || props.user.email || props.t('menu:User')}
            </button>
            {display !== 'none' && (
                <TranslatableUserMenu wrapperRef={wrapperRef} user={props.user} closeMenu={() => setDisplay('none')} />
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
                        {props.user && <TranslatableUser user={props.user} />}
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
    startLogout: () => dispatch(startLogout(props.history))
});

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation('menu')(Header));
