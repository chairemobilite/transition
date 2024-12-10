import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import Button, { ButtonProps } from '../input/Button';
import FormErrors from '../pageParts/FormErrors';
import { startResetPassword } from '../../actions/Auth';
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import { RootState } from '../../store/configureStore';
import { ThunkDispatch } from 'redux-thunk';
import { Action } from 'redux';

type Status = 'Confirmed' | 'NotFound' | 'Expired' | 'PasswordChanged' | 'Error';

type SimpleMessageProps = {
    message: string;
};

const SimpleMessage: React.FC<SimpleMessageProps> = ({ message }) => {
    const { t } = useTranslation('auth');

    return (
        <div className="apptr__form apptr__form-auth apptr__form__label-standalone">
            <p className="apptr__form__label-standalone">{t(message)}</p>
            <div className="apptr__footer-link-container">
                <Link className="apptr__footer-link _oblique" to="/login">
                    {t('auth:BackToLoginPage')}
                </Link>
            </div>
        </div>
    );
};

const ResetPasswordPage: React.FC = () => {
    const { t } = useTranslation('auth');
    const dispatch = useDispatch<ThunkDispatch<RootState, unknown, Action>>();
    const { token } = useParams<{ token: string }>();
    const submitButtonRef = React.useRef<HTMLButtonElement>(null);

    const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
    const status = useSelector((state: RootState) => state.auth.status as Status);

    const [formState, setFormState] = React.useState({
        password: '',
        passwordConfirmation: '',
        error: undefined as ErrorMessage | undefined
    });

    React.useEffect(() => {
        if (token) {
            dispatch(startResetPassword({ token }));
        }
    }, [token, dispatch]);

    React.useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.which === 13 && e.target instanceof HTMLElement && e.target.tagName.toLowerCase() !== 'textarea') {
                e.preventDefault();
            }
        };

        document.addEventListener('keydown', handleKeyPress);
        return () => document.removeEventListener('keydown', handleKeyPress);
    }, []);

    const validateForm = (): ErrorMessage | undefined => {
        if (!formState.password) {
            return t('auth:missingPassword');
        }
        if (formState.password !== formState.passwordConfirmation) {
            return t('auth:passwordsDoNotMatch');
        }
        if (formState.password.length < 8) {
            return t('auth:passwordMustHaveAtLeastNCharacters', { n: 8 });
        }
        return undefined;
    };

    const handleSubmit = () => {
        const error = validateForm();
        if (error) {
            setFormState((prev) => ({ ...prev, error }));
            return;
        }

        setFormState((prev) => ({ ...prev, error: undefined }));
        dispatch(
            startResetPassword({
                token,
                password: formState.password
            })
        );
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormState((prev) => ({ ...prev, [name]: value }));
    };

    const getStatusMessage = (): string | undefined => {
        switch (status) {
        case 'Expired':
            return 'auth:ResetTokenExpired';
        case 'NotFound':
            return 'auth:ResetTokenNotFound';
        case 'PasswordChanged':
            return 'auth:PasswordChangedSuccessfully';
        case 'Error':
            return 'auth:ResetTokenError';
        default:
            return undefined;
        }
    };

    const buttonProps: Partial<ButtonProps> = {
        isVisible: true,
        align: 'center',
        onClick: handleSubmit
    };

    const statusMessage = getStatusMessage();
    if (statusMessage) {
        return <SimpleMessage message={statusMessage} />;
    }

    return (
        <form className="apptr__form apptr__form-auth" onSubmit={(e) => e.preventDefault()}>
            <div className="apptr__form-label-container center">
                <div className="apptr__form__label-standalone">
                    <p>{t('auth:pleaseChooseANewPassword')}</p>
                </div>
                {formState.error && <FormErrors errors={[formState.error]} />}
            </div>

            <div className="apptr__form-container question-empty">
                <div className="apptr__form-input-container">
                    <div className="apptr__form-label-container">
                        <label htmlFor="password" className="_flex">
                            {t('auth:Password')}
                        </label>
                    </div>
                    <input
                        name="password"
                        type="password"
                        id="password"
                        className="apptr__form-input apptr__form-input-string apptr__input apptr__input-string"
                        value={formState.password}
                        onChange={handleInputChange}
                    />
                </div>
            </div>

            <div className="apptr__form-container question-empty">
                <div className="apptr__form-input-container">
                    <div className="apptr__form-label-container">
                        <label htmlFor="passwordConfirmation" className="_flex">
                            {t('auth:PasswordConfirmation')}
                        </label>
                    </div>
                    <input
                        name="passwordConfirmation"
                        type="password"
                        id="passwordConfirmation"
                        className="apptr__form-input apptr__form-input-string apptr__input apptr__input-string"
                        value={formState.passwordConfirmation}
                        onChange={handleInputChange}
                    />
                </div>
            </div>

            <Button
                {...buttonProps}
                inputRef={submitButtonRef as React.RefObject<HTMLButtonElement>}
                label={t('auth:Confirm')}
            />
        </form>
    );
};

export default ResetPasswordPage;
