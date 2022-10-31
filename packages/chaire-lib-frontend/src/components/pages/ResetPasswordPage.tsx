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

import Button, { ButtonProps } from '../input/Button';
import FormErrors from '../pageParts/FormErrors';
import { startResetPassword } from '../../actions/Auth';
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';

export interface ResetPasswordPageProps extends WithTranslation {
    isAuthenticated: boolean;
    history: History;
    startResetPassword: any;
    token: string;
    status?: 'Confirmed' | 'NotFound' | 'Expired' | 'PasswordChanged' | 'Error';
}

type ResetPasswordState = {
    password: string;
    passwordConfirmation: string;
    error?: ErrorMessage;
};

interface SimpleMessageProps extends WithTranslation {
    message: string;
}

const SimpleMessage: React.FunctionComponent<SimpleMessageProps> = (props: SimpleMessageProps) => {
    return (
        <div className="apptr__form apptr__form-auth apptr__form__label-standalone">
            <p className="apptr__form__label-standalone">{props.t(props.message)}</p>
            <div className="apptr__footer-link-container">
                <Link className={'apptr__footer-link _oblique'} to="/login">
                    {props.t('auth:BackToLoginPage')}
                </Link>
            </div>
        </div>
    );
};

const SimpleMessageWidget = withTranslation()(SimpleMessage);

export class ResetPasswordPage extends React.Component<ResetPasswordPageProps, ResetPasswordState> {
    private submitButtonRef;
    private buttonProps: Partial<ButtonProps>;

    constructor(props) {
        super(props);

        this.state = {
            password: '',
            passwordConfirmation: ''
        };

        this.submitButtonRef = React.createRef();

        this.buttonProps = {
            isVisible: true,
            align: 'center',
            onClick: this.onButtonClick
        };
    }

    onButtonClick = () => {
        if (!this.state.password) {
            this.setState(() => ({
                error: this.props.t('auth:missingPassword')
            }));
        } else if (this.state.password !== this.state.passwordConfirmation) {
            this.setState(() => ({
                error: this.props.t('auth:passwordsDoNotMatch')
            }));
        } else if (this.state.password && this.state.password.length < 8) {
            this.setState(() => ({
                error: this.props.t('auth:passwordMustHaveAtLeastNCharacters', { n: 8 })
            }));
        } else {
            this.setState({ error: undefined });
            this.props.startResetPassword(
                {
                    token: this.props.token,
                    password: this.state.password
                },
                this.props.history
            );
        }
    };

    onKeyPress(e) {
        if (e.which === 13 && e.target.tagName.toLowerCase() !== 'textarea' /* Enter */) {
            e.preventDefault();
        }
    }

    componentDidMount() {
        document.addEventListener('keydown', this.onKeyPress.bind(this));
        this.props.startResetPassword({ token: this.props.token });
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.onKeyPress.bind(this));
    }

    onPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const password = e.target.value;
        if (password) {
            this.setState(() => ({ password: password }));
        } // allow empty string
        else {
            this.setState(() => ({ password: '' }));
        }
    };

    onPasswordConfirmationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const passwordConfirmation = e.target.value;
        if (passwordConfirmation) {
            this.setState(() => ({ passwordConfirmation: passwordConfirmation }));
        } // allow empty string
        else {
            this.setState(() => ({ passwordConfirmation: '' }));
        }
    };

    getStatusMessage = () => {
        const status = this.props.status;
        return status === 'Expired'
            ? 'auth:ResetTokenExpired'
            : status === 'NotFound'
                ? 'auth:ResetTokenNotFound'
                : status === 'PasswordChanged'
                    ? 'auth:PasswordChangedSuccessfully'
                    : status === 'Error'
                        ? 'auth:ResetTokenError'
                        : undefined;
    };

    render() {
        const statusMessage = this.getStatusMessage();
        if (statusMessage) {
            return <SimpleMessageWidget message={statusMessage} />;
        }
        return (
            <form className="apptr__form apptr__form-auth" onKeyPress={this.onKeyPress}>
                <div className={'apptr__form-label-container center'}>
                    <div className="apptr__form__label-standalone">
                        <p>{this.props.t('auth:pleaseChooseANewPassword')}</p>
                    </div>
                    {this.state.error && <FormErrors errors={[this.state.error]} />}
                </div>
                <div className={'apptr__form-container question-empty'}>
                    <div className="apptr__form-input-container">
                        <div className={'apptr__form-label-container'}>
                            <label htmlFor="password" className="_flex">
                                {this.props.t('auth:Password')}
                            </label>
                        </div>
                        <input
                            name="password"
                            type="password"
                            id="password"
                            className={'apptr__form-input apptr__form-input-string apptr__input apptr__input-string'}
                            value={this.state.password}
                            onChange={this.onPasswordChange}
                        />
                    </div>
                </div>
                <div className={'apptr__form-container question-empty'}>
                    <div className="apptr__form-input-container">
                        <div className={'apptr__form-label-container'}>
                            <label htmlFor="passwordConfirmation" className="_flex">
                                {this.props.t('auth:PasswordConfirmation')}
                            </label>
                        </div>
                        <input
                            name="passwordConfirmation"
                            type="password"
                            id="passwordConfirmation"
                            className={'apptr__form-input apptr__form-input-string apptr__input apptr__input-string'}
                            value={this.state.passwordConfirmation}
                            onChange={this.onPasswordConfirmationChange}
                        />
                    </div>
                </div>
                <Button {...this.buttonProps} inputRef={this.submitButtonRef} label={this.props.t('auth:Confirm')} />
            </form>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const {
        match: {
            params: { token }
        }
    } = ownProps;
    return { token, isAuthenticated: state.auth.isAuthenticated, status: state.auth.status };
};

const mapDispatchToProps = (dispatch, props) => ({
    startResetPassword: (data, history) => dispatch(startResetPassword(data))
});

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation('auth')(ResetPasswordPage));
