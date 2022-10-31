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
import { Link } from 'react-router-dom';

import FormErrors from '../../../pageParts/FormErrors';
import { startPwdLessVerify } from '../../../../actions/Auth';

export interface MagicLinkVerifyProps {
    isAuthenticated?: boolean;
    history: History;
    location: Location;
    startPwdLessVerify: (token: string, callback?: () => void) => void;
    login?: boolean;
    headerText?: string;
}

export const MagicLinkVerify: React.FunctionComponent<MagicLinkVerifyProps & WithTranslation> = (
    props: MagicLinkVerifyProps & WithTranslation
) => {
    const params = new URLSearchParams(props.location.search);
    const token = params.get('token');
    if (!token) {
        console.log('No token specified');
        props.history.push('/login');
    }

    React.useEffect(() => {
        if (token) {
            props.startPwdLessVerify(token);
        }
    }, [token]);

    return (
        <div className="apptr__form apptr__form-auth apptr__form__label-standalone">
            <p className="apptr__form__label-standalone">{props.t('auth:VerifyingEmailToken')}</p>
            {props.login && !props.isAuthenticated && <FormErrors errors={['auth:MagicLinkVerificationFailed']} />}
            <div className="apptr__footer-link-container">
                <Link className={'apptr__footer-link _oblique'} to="/login">
                    {props.t('auth:BackToLoginPage')}
                </Link>
            </div>
        </div>
    );
};

const mapStateToProps = (state) => {
    return { isAuthenticated: state.auth.isAuthenticated, login: state.auth.login };
};

const mapDispatchToProps = (dispatch, props: Omit<MagicLinkVerifyProps, 'startPwdLessVerify'>) => ({
    startPwdLessVerify: (token: string, callback?: () => void) =>
        dispatch(startPwdLessVerify(token, props.history, callback))
});

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation('auth')(MagicLinkVerify));
