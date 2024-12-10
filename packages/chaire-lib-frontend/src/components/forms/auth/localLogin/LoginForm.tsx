import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, Link, NavigateFunction, Location } from 'react-router';

import FormErrors from '../../../pageParts/FormErrors';
import { startLogin } from '../../../../actions/Auth';
import Button from '../../../input/Button';
import { RootState } from '../../../../store/configureStore';
import { Action } from 'redux';
import { ThunkDispatch } from 'redux-thunk';

type LoginPageProps = {
    withForgotPassword?: boolean;
    headerText?: string;
};

const LoginPage: React.FC<LoginPageProps> = ({ withForgotPassword = false, headerText }) => {
    const { t } = useTranslation('auth');
    const dispatch = useDispatch<ThunkDispatch<RootState, unknown, Action>>();
    const location = useLocation();
    const navigate = useNavigate();
    const submitButtonRef = React.useRef<HTMLButtonElement>(null);

    const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
    const login = useSelector((state: RootState) => state.auth.login);

    const [formState, setFormState] = React.useState({
        usernameOrEmail: '',
        password: '',
        error: undefined as string | undefined
    });

    const validateForm = (): string | undefined => {
        if (!formState.usernameOrEmail) {
            return t('auth:missingUsernameOrEmail');
        }
        if (!formState.password) {
            return t('auth:missingPassword');
        }
        return undefined;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormState((prev) => ({
            ...prev,
            [name]: name === 'usernameOrEmail' ? value.replaceAll(' ', '') : value
        }));
    };

    const handleSubmit = () => {
        const error = validateForm();
        if (error) {
            setFormState((prev) => ({ ...prev, error }));
            return;
        }

        setFormState((prev) => ({ ...prev, error: undefined }));
        dispatch(
            startLogin(
                {
                    usernameOrEmail: formState.usernameOrEmail,
                    password: formState.password
                },
                location as Location,
                navigate as NavigateFunction
            )
        );
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLFormElement>) => {
        if (e.key === 'Enter' || e.which === 13) {
            submitButtonRef.current?.click();
        }
    };

    const handleKeyUp = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ' || e.which === 13 || e.which === 32) {
            handleSubmit();
        }
    };

    return (
        <form className="apptr__form apptr__form-auth" onKeyUp={handleKeyPress} onSubmit={(e) => e.preventDefault()}>
            <div className="apptr__form-label-container center">
                <div className="apptr__form__label-standalone no-question">
                    <p>{headerText || t('auth:pleaseEnterLoginCredentials')}</p>
                </div>
                {formState.error && <FormErrors errors={[formState.error]} />}
                {login && !isAuthenticated && <FormErrors errors={['auth:authenticationFailed']} />}
            </div>

            <div className="apptr__form-container question-empty">
                <div className="apptr__form-input-container">
                    <label htmlFor="usernameOrEmail" className="_flex">
                        {t('auth:UsernameOrEmail')}
                    </label>
                    <input
                        name="usernameOrEmail"
                        id="usernameOrEmail"
                        type="text"
                        className="apptr__form-input apptr__form-input-string apptr__input apptr__input-string"
                        autoFocus
                        value={formState.usernameOrEmail}
                        onChange={handleInputChange}
                    />
                </div>
            </div>

            <div className="apptr__form-container question-empty">
                <div className="apptr__form-input-container">
                    <label htmlFor="password" className="_flex">
                        {t('auth:Password')}
                    </label>
                    <input
                        name="password"
                        id="password"
                        type="password"
                        className="apptr__form-input apptr__form-input-string apptr__input apptr__input-string"
                        value={formState.password}
                        onChange={handleInputChange}
                    />
                    {withForgotPassword && (
                        <div className="right _small">
                            <Link className="_oblique" to="/forgot">
                                {t('auth:forgotPassword')}
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            <Button
                isVisible={true}
                onClick={handleSubmit}
                inputRef={submitButtonRef as React.RefObject<HTMLButtonElement>}
                label={t('auth:Login')}
                onKeyUp={handleKeyUp}
            />
        </form>
    );
};

export default LoginPage;
