import React from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { ThunkDispatch } from 'redux-thunk';
import { Action } from 'redux';
import Button from '../input/Button';

import {
    startConfirmUser,
    startGetConfirmUserInfo,
    ConfirmCallbackType,
    ConfirmInfoCallbackType
} from '../../actions/Auth';
import { RootState } from '../../store/configureStore';

type Status = 'Loading' | 'Ready' | 'Confirming' | 'Confirmed' | 'NotFound' | 'MissingToken' | 'Error';

const getStatusMessage = (status: Status): string => {
    switch (status) {
    case 'Loading':
        return 'auth:ConfirmationTokenLoading';
    case 'Confirming':
        return 'auth:ConfirmationTokenConfirming';
    case 'Confirmed':
        return 'auth:ConfirmationTokenConfirmed';
    case 'NotFound':
        return 'auth:ConfirmationTokenNotFound';
    case 'MissingToken':
        return 'auth:ConfirmationTokenMissing';
    default:
        return 'auth:ConfirmationTokenError';
    }
};

const VerifyPage: React.FC = () => {
    const { t } = useTranslation('auth');
    const dispatch = useDispatch<ThunkDispatch<RootState, unknown, Action>>();
    const { token } = useParams<{ token: string }>();

    const [status, setStatus] = React.useState<Status>('Loading');
    const [email, setEmail] = React.useState<string | undefined>(undefined);

    const tokenVerified: ConfirmCallbackType = React.useCallback((response) => {
        if (
            response &&
            (response.status === 'Confirmed' || response.status === 'NotFound' || response.status === 'Error')
        ) {
            setStatus(response.status);
        } else {
            setStatus('Error');
        }
    }, []);

    const tokenInfoLoaded: ConfirmInfoCallbackType = React.useCallback((response) => {
        if (response && response.status === 'Found' && response.email) {
            setEmail(response.email);
            setStatus('Ready');
        } else if (response && response.status === 'NotFound') {
            setEmail(undefined);
            setStatus('NotFound');
        } else {
            setEmail(undefined);
            setStatus('Error');
        }
    }, []);

    React.useEffect(() => {
        if (token) {
            dispatch(startGetConfirmUserInfo({ token }, tokenInfoLoaded));
        } else {
            setStatus('Error');
        }
    }, [dispatch, token, tokenInfoLoaded]);

    const confirmUser = React.useCallback(() => {
        if (token) {
            setStatus('Confirming');
            dispatch(startConfirmUser({ token }, tokenVerified));
        }
    }, [dispatch, token, tokenVerified]);

    const statusMessage = getStatusMessage(status);

    return (
        <div className="apptr__form apptr__form-auth apptr__form__label-standalone">
            {status !== 'Ready' && <p className="apptr__form__label-standalone">{t(statusMessage)}</p>}
            {status === 'Ready' && email && (
                <>
                    <p className="apptr__form__label-standalone">{t('auth:ConfirmationTokenBelongsTo')}</p>
                    <p className="apptr__form__label-standalone" style={{ textAlign: 'center' }}>
                        <strong>{email}</strong>
                    </p>
                    <p className="apptr__form__label-standalone">{t('auth:ConfirmationTokenAskToConfirm')}</p>
                    <p className="apptr__form__label-standalone">
                        <Button
                            type="button"
                            onClick={confirmUser}
                            label={t('auth:Confirm')}
                            style={{ display: 'inline-block' }}
                        />
                    </p>
                </>
            )}
            {status !== 'Loading' && (
                <p className="apptr__form__label-standalone">
                    <Link to="/">{t('auth:BackToHomePage')}</Link>
                </p>
            )}
        </div>
    );
};

export default VerifyPage;
