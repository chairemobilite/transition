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

import { startRegisterWithPassword, RegisterData } from '../../../../actions/Auth';
import Button from '../../../input/Button';
import FormErrors from '../../../pageParts/FormErrors';
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import CaptchaComponent, { validateCaptcha } from './CaptchaComponent';
import { _isEmail } from 'chaire-lib-common/lib/utils/LodashExtensions';

export interface RegisterFormProps {
    isAuthenticated?: boolean;
    history: History;
    startRegisterWithPassword: (data: RegisterData, callback?: () => void) => void;
    withCaptcha?: boolean;
    withEmailOnly?: boolean;
    register?: boolean;
    introductionText?: string;
}

type RegisterState = {
    username?: string;
    email?: string;
    password?: string;
    passwordConfirmation?: string;
    userCaptcha?: string;
    error?: ErrorMessage;
};

export class RegisterForm extends React.Component<RegisterFormProps & WithTranslation, RegisterState> {
    private submitButtonRef;
    private buttonProps;

    constructor(props: RegisterFormProps & WithTranslation) {
        super(props);
        this.state = {};

        this.submitButtonRef = React.createRef();

        this.buttonProps = {
            isVisible: true,
            onClick: this.onButtonClick
        };
    }

    onButtonClick = () => {
        if (this.props.withEmailOnly !== true && !this.state.username) {
            this.setState({
                error: 'auth:missingUsername'
            });
        } else if (!this.state.email) {
            this.setState({
                error: 'auth:missingEmail'
            });
        } else if (!this.state.password) {
            this.setState({
                error: 'auth:missingPasswordRegister'
            });
        } else if (this.state.password !== this.state.passwordConfirmation) {
            this.setState({
                error: 'auth:passwordsDoNotMatch'
            });
        } else if (this.state.password && this.state.password.length < 8) {
            this.setState({
                error: { text: 'auth:passwordMustHaveAtLeastNCharacters', params: { n: '8' } }
            });
        } else if (this.state.email && !_isEmail(this.state.email)) {
            this.setState(() => ({
                error: 'auth:invalidEmail'
            }));
        } else if (this.props.withCaptcha === true && !validateCaptcha(this.state.userCaptcha)) {
            // Compensating the impossibility for the user to reload the captcha by reloading a new captcha if invalid
            this.setState({
                userCaptcha: '',
                error: 'auth:captchaMismatch'
            });
        } else {
            this.setState({ error: undefined });
            this.props.startRegisterWithPassword({
                username: this.props.withEmailOnly === true ? this.state.email : (this.state.username as string),
                email: this.state.email,
                generatedPassword: null,
                password: this.state.password
            });
        }
    };

    onUsernameChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const username = e.target.value;
        if (username) {
            this.setState(() => ({ username: username }));
        } // allow empty string
        else {
            this.setState(() => ({ username: '' }));
        }
    };

    onEmailChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const usernameOrEmail = e.target.value.replaceAll(' ', ''); // E-mails and usernames can't have spaces
        if (usernameOrEmail) {
            this.setState(() => ({ email: usernameOrEmail }));
        } // allow empty string
        else {
            this.setState(() => ({ email: '' }));
        }
    };

    onPasswordChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const password = e.target.value;
        if (password) {
            this.setState(() => ({ password: password }));
        } // allow empty string
        else {
            this.setState(() => ({ password: '' }));
        }
    };

    onPasswordConfirmationChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const passwordConfirmation = e.target.value;
        if (passwordConfirmation) {
            this.setState(() => ({ passwordConfirmation: passwordConfirmation }));
        } // allow empty string
        else {
            this.setState(() => ({ passwordConfirmation: '' }));
        }
    };

    onCatpchaChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const captcha = e.target.value;
        if (captcha) {
            this.setState(() => ({ userCaptcha: captcha }));
        } else {
            this.setState(() => ({ userCaptcha: '' }));
        }
    };

    render = () => (
        <form className="apptr__form apptr__form-auth">
            <div className={'apptr__form-label-container center'}>
                <div className="apptr__form__label-standalone no-question">
                    <p>{this.props.introductionText || this.props.t('auth:pleaseEnterLoginCredentials')}</p>
                </div>
                {this.state.error && <FormErrors errors={[this.state.error]} />}
                {this.props.register && !this.props.isAuthenticated && (
                    <FormErrors errors={['auth:usernameOrEmailAlreadyExists']} />
                )}
            </div>
            <div className={'apptr__form-container question-empty'}>
                <div className="apptr__form-input-container">
                    <label htmlFor="email" className="_flex">
                        {this.props.t('auth:Email')}
                    </label>
                    <input
                        name="email"
                        id="email"
                        type="text"
                        inputMode="email"
                        className="apptr__form-input apptr__form-input-string apptr__input apptr__input-string"
                        autoFocus
                        value={this.state.email}
                        onChange={this.onEmailChange}
                    />
                </div>
            </div>
            {this.props.withEmailOnly !== true && (
                <div className={'apptr__form-container question-empty'}>
                    <div className="apptr__form-input-container">
                        <label htmlFor="username" className="_flex">
                            {this.props.t('auth:Username')}
                        </label>
                        <input
                            name="username"
                            id="username"
                            type="text"
                            className="apptr__form-input apptr__form-input-string apptr__input apptr__input-string"
                            value={this.state.username}
                            onChange={this.onUsernameChange}
                        />
                    </div>
                </div>
            )}
            <div className={'apptr__form-container question-empty'}>
                <div className="apptr__form-input-container">
                    <label htmlFor="password" className="_flex">
                        {this.props.t('auth:Password')}
                    </label>
                    <input
                        name="password"
                        id="password"
                        type="password"
                        className={
                            'apptr__form-input apptr__form-input-string apptr__input apptr__input-string _input-password'
                        }
                        value={this.state.password}
                        onChange={this.onPasswordChange}
                    />
                </div>
            </div>
            <div className={'apptr__form-container question-empty'}>
                <div className="apptr__form-input-container">
                    <label htmlFor="passwordConfirmation" className="_flex">
                        {this.props.t('auth:PasswordConfirmation')}
                    </label>
                    <input
                        name="passwordConfirmation"
                        id="passwordConfirmation"
                        type="password"
                        className={
                            'apptr__form-input apptr__form-input-string apptr__input apptr__input-string _input-password'
                        }
                        value={this.state.passwordConfirmation}
                        onChange={this.onPasswordConfirmationChange}
                    />
                </div>
            </div>
            {this.props.withCaptcha === true && (
                <div className={'apptr__form-container question-empty'}>
                    <CaptchaComponent value={this.state.userCaptcha} onChange={this.onCatpchaChange} />
                </div>
            )}
            <Button
                {...this.buttonProps}
                inputRef={this.submitButtonRef}
                label={this.props.t(['transition:auth:Register', 'auth:Register'])}
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
    return { isAuthenticated: state.auth.isAuthenticated, register: state.auth.register };
};

const mapDispatchToProps = (dispatch, props: Omit<RegisterFormProps, 'startRegisterWithPassword'>) => ({
    startRegisterWithPassword: (data: RegisterData, callback?: () => void) =>
        dispatch(startRegisterWithPassword(data, props.history, callback))
});

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation('auth')(RegisterForm));
