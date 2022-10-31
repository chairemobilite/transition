/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { connect } from 'react-redux';
import { withTranslation, WithTranslation } from 'react-i18next';
import { History } from 'history';

import appConfiguration from '../../config/application.config';
import RegisterForm from '../forms/auth/localLogin/RegisterForm';

export interface RegisterPageProps extends WithTranslation {
    isAuthenticated: boolean;
    history: History;
    config: {
        // @deprecated Use the value in auth instead
        allowRegistration?: boolean;
        // @deprecated Use the value in auth instead
        registerWithEmailOnly?: boolean;
        auth?: {
            localLogin: {
                allowRegistration?: boolean;
                registerWithEmailOnly?: boolean;
            };
        };
    };
}

export class RegisterPage extends React.Component<RegisterPageProps> {
    constructor(props: RegisterPageProps) {
        super(props);
        if (this.props.isAuthenticated) {
            this.props.history.push(appConfiguration.homePage);
        }
        this.state = {};
    }

    render() {
        const allowRegistration =
            this.props.config.allowRegistration !== false &&
            this.props.config.auth?.localLogin?.allowRegistration !== false;
        if (!allowRegistration) {
            return null;
        }

        return (
            <React.Fragment>
                <RegisterForm
                    history={this.props.history}
                    withCaptcha={true}
                    withEmailOnly={
                        this.props.config.registerWithEmailOnly ||
                        this.props.config.auth?.localLogin?.registerWithEmailOnly
                    }
                />
                <div className="apptr__separator-medium"></div>
                <div className="apptr__footer-link-container">
                    <a className="apptr__footer-link" href="/login">
                        {this.props.t('auth:iAlreadyHaveAnAccount')}
                    </a>
                </div>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    return { isAuthenticated: state.auth.isAuthenticated, register: state.auth.register };
};

export default connect(mapStateToProps)(withTranslation('auth')(RegisterPage));
