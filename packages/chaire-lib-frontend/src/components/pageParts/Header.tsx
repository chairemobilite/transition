import React from 'react';
import { NavLink, useNavigate, NavigateFunction } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import moment from 'moment-business-days';
import { ThunkDispatch } from 'redux-thunk';
import { Action } from 'redux';

import ConfirmModal from '../modal/ConfirmModal';
import { startLogout } from '../../actions/Auth';
import config from 'chaire-lib-common/lib/config/shared/project.config';
import appConfiguration, { UserMenuItem } from '../../config/application.config';
import { CliUser } from 'chaire-lib-common/lib/services/user/userType';
import { RootState } from '../../store/configureStore';

export type HeaderProps = {
    path: string;
    appName: string;
};

type UserProps = {
    user: CliUser;
};

type UserMenuButtonProps = {
    menuItem: UserMenuItem;
    modalOpenedCallback: (isOpened: boolean) => void;
    closeMenu: () => void;
};

const UserMenuButton: React.FC<UserMenuButtonProps> = ({ menuItem, modalOpenedCallback, closeMenu }) => {
    const [modalIsOpened, setModalIsOpened] = React.useState(false);
    const { t, i18n } = useTranslation();

    const toggleModal = (opened: boolean) => {
        setModalIsOpened(opened);
        modalOpenedCallback(opened);
    };

    const executeAction: React.MouseEventHandler = (e) => {
        menuItem.action(e);
        if (menuItem.postExec === 'refreshLang') {
            i18n.changeLanguage(i18n.language);
        }
        closeMenu();
    };

    return (
        <>
            <button
                type="button"
                className="menu-button"
                onClick={menuItem.confirmModal === undefined ? executeAction : () => toggleModal(true)}
            >
                {menuItem.getText(t)}
            </button>
            {modalIsOpened && menuItem.confirmModal && (
                <ConfirmModal
                    isOpen={true}
                    title={menuItem.confirmModal.title(t)}
                    confirmAction={executeAction}
                    confirmButtonColor="red"
                    confirmButtonLabel={menuItem.confirmModal.label(t)}
                    closeModal={() => toggleModal(false)}
                />
            )}
        </>
    );
};

type UserMenuProps = {
    user: CliUser;
    wrapperRef: React.RefObject<HTMLDivElement>;
    closeMenu: () => void;
};

const UserMenu: React.FC<UserMenuProps> = ({ wrapperRef, closeMenu }) => {
    const [hasModalOpened, setHasModalOpened] = React.useState(false);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node) && !hasModalOpened) {
                closeMenu();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [wrapperRef, hasModalOpened, closeMenu]);

    return (
        <div className="menu userMenu" ref={wrapperRef}>
            {appConfiguration.userMenuItems.map((menuItem, index) => (
                <UserMenuButton
                    key={`header__nav-user${index}`}
                    menuItem={menuItem}
                    modalOpenedCallback={setHasModalOpened}
                    closeMenu={closeMenu}
                />
            ))}
        </div>
    );
};

const User: React.FC<UserProps> = ({ user }) => {
    const [display, setDisplay] = React.useState(false);
    const wrapperRef = React.useRef<HTMLDivElement>(null);
    const { t } = useTranslation('menu');

    return (
        <li className="tr__top-menu-element" id="item-nav-user">
            <button
                className="menu-button"
                type="button"
                onClick={appConfiguration.userMenuItems.length > 0 ? () => setDisplay(!display) : undefined}
            >
                {user.username || user.email || t('menu:User')}
            </button>
            {display && (
                <UserMenu
                    wrapperRef={wrapperRef as React.RefObject<HTMLDivElement>}
                    user={user}
                    closeMenu={() => setDisplay(false)}
                />
            )}
        </li>
    );
};

const Header: React.FC<HeaderProps> = ({ path }) => {
    const navigate = useNavigate();
    const dispatch = useDispatch<ThunkDispatch<RootState, unknown, Action>>();
    const { t, i18n } = useTranslation('menu');
    const user = useSelector((state: RootState) => state.auth.user);

    const handleLogout = () => {
        dispatch(startLogout(navigate as NavigateFunction));
    };

    const appTitle = config.appTitle;
    const title = config.title[i18n.language];

    return (
        <header className="header">
            <div className="header__content">
                <nav className="header__nav-left" id="item-nav-title">
                    {appTitle !== undefined ? (
                        <h1>
                            {appTitle} • <strong>{title}</strong>
                        </h1>
                    ) : (
                        <h1>{title}</h1>
                    )}
                </nav>
                <nav className="header__nav-right">
                    <ul>
                        {user &&
                            user.pages.map((page) => (
                                <li className="tr__top-menu-element" key={`item-${page.title}`}>
                                    <NavLink className="menu-button" to={page.path}>
                                        {t(page.title)}
                                    </NavLink>
                                </li>
                            ))}
                        {!user && path !== '/login' && config.showLogin !== false && (
                            <li className="tr__top-menu-element">
                                <NavLink className="menu-button" to="/login">
                                    {t('menu:login')}
                                </NavLink>
                            </li>
                        )}
                        {user && config.showLogout !== false && (
                            <li className="tr__top-menu-element">
                                <button type="button" className="menu-button" onClick={handleLogout}>
                                    {t('menu:logout')}
                                </button>
                            </li>
                        )}
                        {config.languages.map((language) =>
                            i18n.language !== language ? (
                                <li className="tr__top-menu-element" key={`lang-${language}`}>
                                    <button
                                        type="button"
                                        className="menu-button em"
                                        lang={language}
                                        onClick={() => {
                                            i18n.changeLanguage(language);
                                            moment.locale(i18n.language);
                                        }}
                                    >
                                        {config.languageNames[language]}
                                    </button>
                                </li>
                            ) : null
                        )}
                        {user && <User user={user} />}
                    </ul>
                </nav>
            </div>
        </header>
    );
};

export default Header;
