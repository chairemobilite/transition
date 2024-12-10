import React from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { ThunkDispatch } from 'redux-thunk';
import { Action } from 'redux';

import { startConfirmUser, ConfirmCallbackType } from '../../actions/Auth';
import { RootState } from '../../store/configureStore';

type Status = 'Confirmed' | 'In Progress' | 'NotFound' | 'Error';

const VerifyPage: React.FC = () => {
    const { t } = useTranslation('auth');
    const dispatch = useDispatch<ThunkDispatch<RootState, unknown, Action>>();
    const { token } = useParams<{ token: string }>();

    const [status, setStatus] = React.useState<Status>('In Progress');

    const tokenVerified: ConfirmCallbackType = React.useCallback((response) => {
        if (
            response &&
            (response.status === 'Confirmed' ||
                response.status === 'In Progress' ||
                response.status === 'NotFound' ||
                response.status === 'Error')
        ) {
            setStatus(response.status);
        } else {
            setStatus('Error');
        }
    }, []);

    React.useEffect(() => {
        if (token) {
            dispatch(startConfirmUser({ token }, tokenVerified));
        }
    }, [dispatch, token, tokenVerified]);

    const getStatusMessage = React.useCallback((): string => {
        switch (status) {
        case 'In Progress':
            return 'auth:ConfirmationTokenConfirming';
        case 'Confirmed':
            return 'auth:ConfirmationTokenConfirmed';
        case 'NotFound':
            return 'auth:ConfirmationTokenNotFound';
        default:
            return 'auth:ConfirmationTokenError';
        }
    }, [status]);

    return (
        <div className="apptr__form apptr__form-auth apptr__form__label-standalone">
            <p className="apptr__form__label-standalone">{t(getStatusMessage())}</p>
            {status !== 'In Progress' && (
                <p className="apptr__form__label-standalone">
                    <Link to="/">{t('auth:BackToHomePage')}</Link>
                </p>
            )}
        </div>
    );
};

export default VerifyPage;
