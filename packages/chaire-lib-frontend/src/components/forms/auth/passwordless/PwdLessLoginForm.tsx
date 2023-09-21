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
import { startPwdLessLogin, LoginPwdlessData } from '../../../../actions/Auth';
import Button from '../../../input/Button';
import { _isBlank, _isEmail } from 'chaire-lib-common/lib/utils/LodashExtensions';

export interface LoginPageProps {
    isAuthenticated?: boolean;
    history: History;
    location: Location;
    startPwdLessLogin: (data: LoginPwdlessData, callback?: () => void) => void;
    login?: boolean;
    headerText?: string;
    buttonText?: string;
}

type LoginState = {
    email?: string;
    error?: string;
};

export class LoginPage extends React.Component<LoginPageProps & WithTranslation, LoginState> {
    private submitButtonRef;
    private buttonProps;

    constructor(props: LoginPageProps & WithTranslation) {
        super(props);

        this.state = {
            email: ''
        };

        this.submitButtonRef = React.createRef();

        this.buttonProps = {
            isVisible: true,
            onClick: this.onButtonClick
        };
    }

    onButtonClick = () => {
        if (!this.state.email) {
            this.setState(() => ({ error: this.props.t('auth:missingUsernameOrEmail') }));
        } else if (this.state.email && !_isEmail(this.state.email)) {
            this.setState(() => ({
                error: 'auth:invalidEmail'
            }));
        } else {
            this.setState(() => ({ error: undefined }));
            this.props.startPwdLessLogin({
                destination: this.state.email
            });
        }
    };

    onEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const email = e.target.value.replaceAll(' ', ''); // E-mail adresses cannot have spaces
        this.setState(() => ({ email }));
    };

    render = () => (
        <form className="apptr__form apptr__form-auth">
            <div className={'apptr__form-label-container'}>
                <div className="apptr__form__label-standalone no-question">
                    <p>{this.props.headerText}</p>
                </div>
                {this.state.error && <FormErrors errors={[this.state.error]} />}
                {this.props.login && !this.props.isAuthenticated && (
                    <FormErrors errors={['auth:MagicLinkUseAnotherMethod']} />
                )}
            </div>
            <div className={'apptr__form-container question-empty'}>
                <div className="apptr__form-input-container">
                    <label
                        htmlFor="email"
                        className="_flex"
                        dangerouslySetInnerHTML={{
                            __html: `${this.props.t(['survey:auth:Email', 'auth:Email'])} ${this.props.t([
                                'survey:auth:EmailSubLabel',
                                'auth:EmailSubLabel'
                            ])}`
                        }}
                    />
                    <input
                        name="email"
                        id="email"
                        type="text"
                        placeholder={this.props.t(['survey:auth:EmailPlaceholder', 'auth:EmailPlaceholder'])}
                        className="apptr__form-input apptr__form-input-string apptr__input apptr__input-string"
                        value={this.state.email}
                        onChange={this.onEmailChange}
                    />
                </div>
            </div>
            <Button
                {...this.buttonProps}
                inputRef={this.submitButtonRef}
                label={!_isBlank(this.props.buttonText) ? this.props.buttonText : this.props.t(['auth:Login'])}
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

const mapDispatchToProps = (dispatch, props: Omit<LoginPageProps, 'startPwdLessLogin'>) => ({
    startPwdLessLogin: (data: LoginPwdlessData, callback?: () => void) =>
        dispatch(startPwdLessLogin(data, props.history, props.location, callback))
});

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation('auth')(LoginPage));
