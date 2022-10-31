/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { connect } from 'react-redux';
import { withTranslation, WithTranslation } from 'react-i18next';
import { History, Location } from 'history';
import appConfiguration from '../../config/application.config';
import LoginForm from '../forms/auth/localLogin/LoginForm';

export interface LoginPageProps {
    isAuthenticated?: boolean;
    history: History;
    location: Location;
    config: {
        allowRegistration?: boolean;
        forgotPasswordPage?: boolean;
        auth?: {
            localLogin: {
                allowRegistration?: boolean;
                forgotPasswordPage?: boolean;
            };
        };
    };
    login?: boolean;
}

export const LoginPage: React.FunctionComponent<LoginPageProps & WithTranslation> = (
    props: LoginPageProps & WithTranslation
) => {
    React.useEffect(() => {
        if (props.isAuthenticated) {
            props.history.push(appConfiguration.homePage);
        }
    }, []);

    const allowRegistration =
        props.config.allowRegistration !== false && props.config.auth?.localLogin?.allowRegistration !== false;

    return (
        <React.Fragment>
            <LoginForm
                history={props.history}
                location={props.location}
                withForgotPassword={
                    props.config.forgotPasswordPage === true ||
                    props.config.auth?.localLogin?.forgotPasswordPage === true
                }
            />
            <div className="apptr__separator-medium"></div>
            <div className="apptr__footer-link-container">
                {allowRegistration && (
                    <a className="register-link _oblique" href="/register">
                        {props.t('auth:registerIfYouHaveNoAccount')}
                    </a>
                )}
            </div>
        </React.Fragment>
    );
};

const mapStateToProps = (state) => {
    return { isAuthenticated: state.auth.isAuthenticated, login: state.auth.login };
};

export default connect(mapStateToProps)(withTranslation('auth')(LoginPage));
