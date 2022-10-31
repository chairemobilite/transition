/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { connect } from 'react-redux';
import { withTranslation, WithTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { History } from 'history';

import { startForgotPasswordRequest, ForgotPwdData } from '../../actions/Auth';
import Button, { ButtonProps } from '../input/Button';
import FormErrors from '../pageParts/FormErrors';
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';

export interface ForgotPasswordPageProps extends WithTranslation {
    isAuthenticated: boolean;
    history: History;
    startForgotPasswordRequest: (data: ForgotPwdData) => void;
    emailExists: boolean;
    config: {
        allowRegistration: boolean;
        registerWithEmailOnly: boolean;
    };
}

type ForgotPasswordState = {
    email?: string;
    error?: ErrorMessage;
};

export class ForgotPasswordPage extends React.Component<ForgotPasswordPageProps, ForgotPasswordState> {
    private submitButtonRef;
    private buttonProps: Partial<ButtonProps>;

    constructor(props) {
        super(props);
        this.state = {
            email: ''
        };

        this.submitButtonRef = React.createRef();

        this.buttonProps = {
            isVisible: true,
            align: 'center',
            onClick: this.onButtonClick
        };
    }

    onButtonClick = () => {
        if (!this.state.email) {
            this.setState({
                error: 'auth:missingEmail'
            });
        } else if (
            this.state.email &&
            !/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(
                this.state.email
            )
        ) {
            this.setState(() => ({
                error: 'auth:invalidEmail'
            }));
        } else {
            this.setState({ error: undefined });
            this.props.startForgotPasswordRequest({
                email: this.state.email
            });
        }
    };

    onKeyPress = (e) => {
        if (e.key === 'Enter' || e.which === 13) {
            this.submitButtonRef.current.click();
        }
    };

    onEmailChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const usernameOrEmail = e.target.value;
        if (usernameOrEmail) {
            this.setState(() => ({ email: usernameOrEmail }));
        } else {
            // allow empty string
            this.setState(() => ({ email: '' }));
        }
    };

    renderForm() {
        return (
            <form className="apptr__form apptr__form-auth" onKeyPress={this.onKeyPress}>
                <div className={'apptr__form-label-container center'}>
                    <div className="apptr__form__label-standalone">
                        <p>{this.props.t('auth:pleaseEnterYourAccountEmail')}</p>
                    </div>
                    {this.state.error && <FormErrors errors={[this.state.error]} />}
                    {this.props.emailExists === false && !this.props.isAuthenticated && (
                        <FormErrors errors={['auth:emailDoesNotExist']} />
                    )}
                </div>
                <div className={'apptr__form-container question-empty'}>
                    <div className="apptr__form-input-container">
                        <div className={'apptr__form-label-container'}>
                            <label htmlFor="email" className="_flex">
                                {this.props.t('auth:Email')}
                            </label>
                        </div>
                        <input
                            name="email"
                            id="email"
                            type="text"
                            className="apptr__form-input apptr__form-input-string apptr__input apptr__input-string"
                            autoFocus
                            value={this.state.email}
                            onChange={this.onEmailChange}
                        />
                    </div>
                </div>
                <Button
                    {...this.buttonProps}
                    inputRef={this.submitButtonRef}
                    label={this.props.t('auth:forgotPassword')}
                />
                <div className="apptr__separator-medium"></div>
                <div className="apptr__footer-link-container">
                    <a className="apptr__footer-link _oblique" href="/login">
                        {this.props.t('auth:Cancel')}
                    </a>
                </div>
            </form>
        );
    }

    renderNext() {
        return (
            <div className="apptr__form apptr__form-auth apptr__form__label-standalone">
                <p className="apptr__form__label-standalone">{this.props.t('auth:forgotPasswordEmailConfirmation')}</p>
                <div className="apptr__footer-link-container">
                    <Link className={'apptr__footer-link _oblique'} to="/login">
                        {this.props.t('auth:BackToLoginPage')}
                    </Link>
                </div>
            </div>
        );
    }

    render() {
        return this.props.emailExists === true ? this.renderNext() : this.renderForm();
    }
}

const mapStateToProps = (state) => {
    return {
        forgot: state.auth.forgot,
        emailExists: state.auth.emailExists,
        error: state.auth.error
    };
};

const mapDispatchToProps = (dispatch, props: Omit<ForgotPasswordPageProps, 'startForgotPasswordRequest'>) => ({
    startForgotPasswordRequest: (data: ForgotPwdData) => dispatch(startForgotPasswordRequest(data, props.history))
});

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation('auth')(ForgotPasswordPage));
