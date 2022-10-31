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

import { startConfirmUser, ConfirmData, ConfirmCallbackType } from '../../actions/Auth';

export interface VerifyPageProps extends WithTranslation {
    isAuthenticated: boolean;
    history: History;
    startConfirmUser: (data: ConfirmData, callback?: ConfirmCallbackType) => void;
    token: string;
}

type VerifyState = {
    status: 'Confirmed' | 'In Progress' | 'NotFound' | 'Error';
};

export class VerifyPage extends React.Component<VerifyPageProps, VerifyState> {
    constructor(props: VerifyPageProps) {
        super(props);

        this.state = {
            status: 'In Progress'
        };
    }

    componentDidMount = () => {
        this.props.startConfirmUser({ token: this.props.token }, this.tokenVerified);
    };

    tokenVerified: ConfirmCallbackType = (response) => {
        if (
            response &&
            (response.status === 'Confirmed' ||
                response.status === 'In Progress' ||
                response.status === 'NotFound' ||
                response.status === 'Error')
        ) {
            this.setState({ status: response.status });
        } else {
            this.setState({ status: 'Error' });
        }
    };

    getStatusMessage = () => {
        const status = this.state.status;
        return status === 'In Progress'
            ? 'auth:ConfirmationTokenConfirming'
            : status === 'Confirmed'
                ? 'auth:ConfirmationTokenConfirmed'
                : status === 'NotFound'
                    ? 'auth:ConfirmationTokenNotFound'
                    : 'auth:ConfirmationTokenError';
    };

    render() {
        return (
            <div className="apptr__form apptr__form-auth apptr__form__label-standalone">
                <p className="apptr__form__label-standalone">{this.props.t(this.getStatusMessage())}</p>
                {this.state.status !== 'In Progress' && (
                    <p className="apptr__form__label-standalone">
                        <Link to="/">{this.props.t('auth:BackToHomePage')}</Link>
                    </p>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const {
        match: {
            params: { token }
        }
    } = ownProps;
    return { token };
};

const mapDispatchToProps = (dispatch) => ({
    startConfirmUser: (data: ConfirmData, callback?: ConfirmCallbackType) => dispatch(startConfirmUser(data, callback))
});

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation('auth')(VerifyPage));
