import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { startForgotPasswordRequest } from '../../actions/Auth';
import Button, { ButtonProps } from '../input/Button';
import FormErrors from '../pageParts/FormErrors';
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import { RootState } from '../../store/configureStore';
import { Action } from 'redux';
import { ThunkDispatch } from 'redux-thunk';

type ForgotPasswordPageProps = {
    config: {
        allowRegistration: boolean;
        registerWithEmailOnly: boolean;
    };
};

const emailRegex =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ config }) => {
    const { t } = useTranslation('auth');
    const dispatch = useDispatch<ThunkDispatch<RootState, unknown, Action>>();

    const submitButtonRef = React.useRef<HTMLButtonElement>(null);

    const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
    const emailExists = useSelector((state: RootState) => state.auth.emailExists);

    const [formState, setFormState] = React.useState({
        email: '',
        error: undefined as ErrorMessage | undefined
    });

    const validateEmail = (email: string): ErrorMessage | undefined => {
        if (!email) {
            return 'auth:missingEmail';
        }
        if (!emailRegex.test(email)) {
            return 'auth:invalidEmail';
        }
        return undefined;
    };

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const email = e.target.value;
        setFormState((prev) => ({ ...prev, email }));
    };

    const handleSubmit = () => {
        const error = validateEmail(formState.email);
        if (error) {
            setFormState((prev) => ({ ...prev, error }));
            return;
        }

        setFormState((prev) => ({ ...prev, error: undefined }));
        dispatch(
            startForgotPasswordRequest({
                email: formState.email
            })
        );
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLFormElement>) => {
        if (e.key === 'Enter' || e.which === 13) {
            submitButtonRef.current?.click();
        }
    };

    const buttonProps: Partial<ButtonProps> = {
        isVisible: true,
        align: 'center',
        onClick: handleSubmit
    };

    if (emailExists) {
        return (
            <div className="apptr__form apptr__form-auth apptr__form__label-standalone">
                <p className="apptr__form__label-standalone">{t('auth:forgotPasswordEmailConfirmation')}</p>
                <div className="apptr__footer-link-container">
                    <Link className="apptr__footer-link _oblique" to="/login">
                        {t('auth:BackToLoginPage')}
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <form className="apptr__form apptr__form-auth" onKeyPress={handleKeyPress} onSubmit={(e) => e.preventDefault()}>
            <div className="apptr__form-label-container center">
                <div className="apptr__form__label-standalone">
                    <p>{t('auth:pleaseEnterYourAccountEmail')}</p>
                </div>
                {formState.error && <FormErrors errors={[formState.error]} />}
                {emailExists === false && !isAuthenticated && <FormErrors errors={['auth:emailDoesNotExist']} />}
            </div>

            <div className="apptr__form-container question-empty">
                <div className="apptr__form-input-container">
                    <div className="apptr__form-label-container">
                        <label htmlFor="email" className="_flex">
                            {t('auth:Email')}
                        </label>
                    </div>
                    <input
                        name="email"
                        id="email"
                        type="text"
                        inputMode="email"
                        className="apptr__form-input apptr__form-input-string apptr__input apptr__input-string"
                        autoFocus
                        value={formState.email}
                        onChange={handleEmailChange}
                    />
                </div>
            </div>

            <Button
                {...buttonProps}
                inputRef={submitButtonRef as React.RefObject<HTMLButtonElement>}
                label={t('auth:forgotPassword')}
            />

            <div className="apptr__separator-medium" />

            <div className="apptr__footer-link-container">
                <Link className="apptr__footer-link _oblique" to="/login">
                    {t('auth:Cancel')}
                </Link>
            </div>
        </form>
    );
};

export default ForgotPasswordPage;
