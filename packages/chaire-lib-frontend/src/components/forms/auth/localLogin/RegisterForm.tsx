import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router';
import { ThunkDispatch } from 'redux-thunk';
import { Action } from 'redux';

import { startRegisterWithPassword } from '../../../../actions/Auth';
import Button from '../../../input/Button';
import FormErrors from '../../../pageParts/FormErrors';
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import CaptchaComponent from '../../../captcha/CaptchaComponent';
import { _isEmail } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { RootState } from '../../../../store/configureStore';

type RegisterFormProps = {
    withCaptcha?: boolean;
    withEmailOnly?: boolean;
    introductionText?: string;
};

type FormState = {
    username: string;
    email: string;
    password: string;
    passwordConfirmation: string;
    captchaValid: boolean;
    captchaReloadKey: number;
    error?: ErrorMessage;
};

const RegisterForm: React.FC<RegisterFormProps> = ({
    withCaptcha = false,
    withEmailOnly = false,
    introductionText
}) => {
    const { t } = useTranslation('auth');
    const dispatch = useDispatch<ThunkDispatch<RootState, unknown, Action>>();
    const submitButtonRef = React.useRef<HTMLButtonElement>(null);
    const navigate = useNavigate();
    const location = useLocation();

    const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
    const register = useSelector((state: RootState) => state.auth.register);

    const [formState, setFormState] = React.useState<FormState>({
        username: '',
        email: '',
        password: '',
        passwordConfirmation: '',
        captchaValid: false,
        captchaReloadKey: 0
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const { name, value } = e.target;
        setFormState((prev) => ({
            ...prev,
            [name]: name === 'email' ? value.replaceAll(' ', '') : value
        }));
    };

    const validateForm = (): ErrorMessage | undefined => {
        if (!withEmailOnly && !formState.username) {
            return 'auth:missingUsername';
        }
        if (!formState.email) {
            return 'auth:missingEmail';
        }
        if (!formState.password) {
            return 'auth:missingPasswordRegister';
        }
        if (formState.password !== formState.passwordConfirmation) {
            return 'auth:passwordsDoNotMatch';
        }
        if (formState.password.length < 8) {
            return { text: 'auth:passwordMustHaveAtLeastNCharacters', params: { n: '8' } };
        }
        if (!_isEmail(formState.email)) {
            return 'auth:invalidEmail';
        }
        if (withCaptcha && formState.captchaValid !== true) {
            return 'auth:captchaMismatch';
        }
        return undefined;
    };

    const handleSubmit = () => {
        const error = validateForm();
        if (error) {
            setFormState((prev) => ({
                ...prev,
                error,
                // Increment captcha reload key for the captcha who may need to
                // reload. Do not invalidate as some captchas, like
                // pow-captchas, don't need reloading. Let captcha component
                // decide what to do
                ...(withCaptcha ? { captchaReloadKey: prev.captchaReloadKey + 1 } : {})
            }));
            return;
        }

        setFormState((prev) => ({ ...prev, error: undefined }));
        dispatch(
            startRegisterWithPassword(
                {
                    username: withEmailOnly ? formState.email : formState.username,
                    email: formState.email,
                    generatedPassword: null,
                    password: formState.password
                },
                location,
                navigate
            )
        );
    };

    const handleEnterKeyUp = (e: React.KeyboardEvent) => {
        // Submit form on 'Enter' inside the element
        if (e.key === 'Enter') {
            submitButtonRef.current?.click();
        }
    };

    return (
        <form className="apptr__form apptr__form-auth" onSubmit={(e) => e.preventDefault()}>
            <div className="apptr__form-label-container center">
                <div className="apptr__form__label-standalone no-question">
                    <p>{introductionText || t('auth:pleaseEnterLoginCredentials')}</p>
                </div>
                {formState.error && <FormErrors errors={[formState.error]} />}
                {register && !isAuthenticated && <FormErrors errors={['auth:usernameOrEmailAlreadyExists']} />}
            </div>
            <div className="apptr__form-container question-empty">
                <div className="apptr__form-input-container">
                    <label htmlFor="email" className="_flex">
                        {t('auth:Email')}
                    </label>
                    <input
                        name="email"
                        id="email"
                        type="text"
                        inputMode="email"
                        className="apptr__form-input apptr__form-input-string apptr__input apptr__input-string"
                        autoFocus
                        value={formState.email}
                        onChange={handleInputChange}
                    />
                </div>
            </div>
            {!withEmailOnly && (
                <div className="apptr__form-container question-empty">
                    <div className="apptr__form-input-container">
                        <label htmlFor="username" className="_flex">
                            {t('auth:Username')}
                        </label>
                        <input
                            name="username"
                            id="username"
                            type="text"
                            className="apptr__form-input apptr__form-input-string apptr__input apptr__input-string"
                            value={formState.username}
                            onChange={handleInputChange}
                        />
                    </div>
                </div>
            )}
            <div className="apptr__form-container question-empty">
                <div className="apptr__form-input-container">
                    <label htmlFor="password" className="_flex">
                        {t('auth:Password')}
                    </label>
                    <input
                        name="password"
                        id="password"
                        type="password"
                        className="apptr__form-input apptr__form-input-string apptr__input apptr__input-string _input-password"
                        value={formState.password}
                        onChange={handleInputChange}
                    />
                </div>
            </div>
            <div className="apptr__form-container question-empty">
                <div className="apptr__form-input-container">
                    <label htmlFor="passwordConfirmation" className="_flex">
                        {t('auth:PasswordConfirmation')}
                    </label>
                    <input
                        name="passwordConfirmation"
                        id="passwordConfirmation"
                        type="password"
                        className="apptr__form-input apptr__form-input-string apptr__input apptr__input-string _input-password"
                        value={formState.passwordConfirmation}
                        onChange={handleInputChange}
                        {...(withCaptcha ? {} : { onKeyUp: handleEnterKeyUp })} // Only add onKeyUp if not using captcha
                    />
                </div>
            </div>
            {withCaptcha && (
                <div className="apptr__form-container question-empty">
                    <CaptchaComponent
                        onCaptchaValid={(isValid) =>
                            setFormState((prev) => ({
                                ...prev,
                                captchaValid: isValid
                            }))
                        }
                        reloadKey={formState.captchaReloadKey}
                    />
                </div>
            )}
            <Button
                type="submit"
                isVisible={true}
                onClick={handleSubmit}
                inputRef={submitButtonRef as React.RefObject<HTMLButtonElement>}
                label={t(['transition:auth:Register', 'auth:Register'])}
            />
        </form>
    );
};

export default RegisterForm;
