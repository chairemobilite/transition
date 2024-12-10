import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import { ThunkDispatch } from 'redux-thunk';
import { Action } from 'redux';

import FormErrors from '../../../pageParts/FormErrors';
import { startPwdLessVerify } from '../../../../actions/Auth';
import { RootState } from '../../../../store/configureStore';

type MagicLinkVerifyProps = {
    headerText?: string;
};

const MagicLinkVerify: React.FC<MagicLinkVerifyProps> = ({ headerText }) => {
    const { t } = useTranslation('auth');
    const dispatch = useDispatch<ThunkDispatch<RootState, unknown, Action>>();
    const location = useLocation();
    const navigate = useNavigate();

    const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
    const login = useSelector((state: RootState) => state.auth.login);

    // Extract token from URL params
    const token = React.useMemo(() => {
        const params = new URLSearchParams(location.search);
        return params.get('token');
    }, [location.search]);

    React.useEffect(() => {
        if (token) {
            dispatch(startPwdLessVerify(token, location, navigate));
        } else {
            navigate('/login');
        }
    }, [token]);

    return (
        <div className="apptr__form apptr__form-auth apptr__form__label-standalone">
            <p className="apptr__form__label-standalone">{headerText || t('auth:VerifyingEmailToken')}</p>

            {login && !isAuthenticated && <FormErrors errors={['auth:MagicLinkVerificationFailed']} />}

            <div className="apptr__footer-link-container">
                <Link className="apptr__footer-link _oblique" to="/login">
                    {t('auth:BackToLoginPage')}
                </Link>
            </div>
        </div>
    );
};

export default MagicLinkVerify;
