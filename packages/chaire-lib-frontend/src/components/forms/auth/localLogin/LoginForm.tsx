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

import FormErrors from '../../../pageParts/FormErrors';
import { startLogin, LoginData } from '../../../../actions/Auth';
import Button from '../../../input/Button';

export interface LoginPageProps {
    isAuthenticated?: boolean;
    history: History;
    location: Location;
    startLogin: (data: LoginData, callback?: () => void) => void;
    login?: boolean;
    withForgotPassword?: boolean;
    headerText?: string;
}

type LoginState = {
    usernameOrEmail?: string;
    password?: string;
    error?: string;
};

export class LoginPage extends React.Component<LoginPageProps & WithTranslation, LoginState> {
    private submitButtonRef;
    private buttonProps;

    constructor(props: LoginPageProps & WithTranslation) {
        super(props);

        this.state = {
            usernameOrEmail: '',
            password: ''
        };

        this.submitButtonRef = React.createRef();

        this.buttonProps = {
            isVisible: true,
            onClick: this.onButtonClick
        };
    }

    onButtonClick = () => {
        if (!this.state.usernameOrEmail) {
            this.setState(() => ({ error: this.props.t('auth:missingUsernameOrEmail') }));
        } else if (!this.state.password) {
            this.setState(() => ({ error: this.props.t('auth:missingPassword') }));
        } else {
            this.setState(() => ({ error: undefined }));
            this.props.startLogin({
                usernameOrEmail: this.state.usernameOrEmail,
                password: this.state.password
            });
        }
    };

    onUsernameOrEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const usernameOrEmail = e.target.value;
        this.setState(() => ({ usernameOrEmail }));
    };

    onPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const password = e.target.value;
        this.setState(() => ({ password }));
    };

    onKeyPress = (e: React.KeyboardEvent<HTMLFormElement>) => {
        if (e.key === 'Enter' || e.which === 13) {
            this.submitButtonRef.current.click();
        }
    };

    render = () => (
        <form className="apptr__form apptr__form-auth" onKeyPress={this.onKeyPress}>
            <div className={'apptr__form-label-container center'}>
                <div className="apptr__form__label-standalone no-question">
                    <p>{this.props.headerText || this.props.t('auth:pleaseEnterLoginCredentials')}</p>
                </div>
                {this.state.error && <FormErrors errors={[this.state.error]} />}
                {this.props.login && !this.props.isAuthenticated && (
                    <FormErrors errors={['auth:authenticationFailed']} />
                )}
            </div>
            <div className={'apptr__form-container question-empty'}>
                <div className="apptr__form-input-container">
                    <label htmlFor="usernameOrEmail" className="_flex">
                        {this.props.t('auth:UsernameOrEmail')}
                    </label>
                    <input
                        name="usernameOrEmail"
                        id="usernameOrEmail"
                        type="text"
                        className="apptr__form-input apptr__form-input-string apptr__input apptr__input-string"
                        autoFocus
                        value={this.state.usernameOrEmail}
                        onChange={this.onUsernameOrEmailChange}
                    />
                </div>
            </div>
            <div className={'apptr__form-container question-empty'}>
                <div className="apptr__form-input-container">
                    <label htmlFor="password" className="_flex">
                        {this.props.t('auth:Password')}
                    </label>
                    <input
                        name="password"
                        id="password"
                        type="password"
                        className="apptr__form-input apptr__form-input-string apptr__input apptr__input-string"
                        autoFocus
                        onChange={this.onPasswordChange}
                    />
                    {this.props.withForgotPassword === true && (
                        <div className="right _small">
                            <a className="_oblique" href="/forgot">
                                {this.props.t('auth:forgotPassword')}
                            </a>
                        </div>
                    )}
                </div>
            </div>
            <Button
                {...this.buttonProps}
                inputRef={this.submitButtonRef}
                label={this.props.t(['auth:Login'])}
                onKeyUp={(e) => {
                    if (e.key === 'enter' || e.key === 'space' || e.which === 13 || e.which === 32) {
                        this.onButtonClick();
                    } else {
                        return;
                    }
                }}
            />
        </form>
    );
}

const mapStateToProps = (state) => {
    return { isAuthenticated: state.auth.isAuthenticated, login: state.auth.login };
};

const mapDispatchToProps = (dispatch, props: Omit<LoginPageProps, 'startLogin'>) => ({
    startLogin: (data: LoginData, callback?: () => void) =>
        dispatch(startLogin(data, props.history, props.location, callback))
});

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation('auth')(LoginPage));
