import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import FormErrors from '../../../pageParts/FormErrors';
import { startPwdLessLogin } from '../../../../actions/Auth';
import Button from '../../../input/Button';
import { _isBlank, _isEmail } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { RootState } from '../../../../store/configureStore';
import { ThunkDispatch } from 'redux-thunk';
import { Action } from 'redux';
import { useNavigate, useLocation } from 'react-router';

type LoginPageProps = {
    headerText?: string;
    buttonText?: string;
};

const LoginPage: React.FC<LoginPageProps> = ({ headerText, buttonText }) => {
    const { t } = useTranslation(['auth', 'survey']);
    const dispatch = useDispatch<ThunkDispatch<RootState, unknown, Action>>();
    const submitButtonRef = React.useRef<HTMLButtonElement>(null);
    const location = useLocation();
    const navigate = useNavigate();

    const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
    const login = useSelector((state: RootState) => state.auth.login);

    // email is the email entered by the user. error is the error localizable string to be displayed
    const [formState, setFormState] = React.useState({
        email: '',
        error: undefined as string | undefined
    });

    // Return the localizable error message if the email is invalid, otherwise return undefined if valid
    const validateEmail = (email: string): string | undefined => {
        if (!email) {
            return 'auth:missingUsernameOrEmail';
        }
        if (!_isEmail(email)) {
            return 'auth:invalidEmail';
        }
        return undefined;
    };

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const email = e.target.value.replaceAll(' ', ''); // Email addresses cannot have spaces
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
            startPwdLessLogin(
                {
                    destination: formState.email
                },
                location,
                navigate
            )
        );
    };

    const handleKeyUp = (e: React.KeyboardEvent) => {
        // Submit form on enter or space keys
        // FIXME Remove deprecated `which` property
        if (e.key === 'Enter' || e.key === ' ' || e.which === 13 || e.which === 32) {
            handleSubmit();
        }
    };

    return (
        <form className="apptr__form apptr__form-auth" onSubmit={(e) => e.preventDefault()}>
            <div className="apptr__form-label-container">
                <div className="apptr__form__label-standalone no-question">
                    <p>{headerText}</p>
                </div>
                {formState.error && <FormErrors errors={[formState.error]} />}
                {login && !isAuthenticated && <FormErrors errors={['auth:MagicLinkUseAnotherMethod']} />}
            </div>

            <div className="apptr__form-container question-empty">
                <div className="apptr__form-input-container">
                    <label
                        htmlFor="email"
                        className="_flex"
                        dangerouslySetInnerHTML={{
                            __html: `${t(['survey:auth:Email', 'auth:Email'])} ${t([
                                'survey:auth:EmailSubLabel',
                                'auth:EmailSubLabel'
                            ])}`
                        }}
                    />
                    <input
                        name="email"
                        id="email"
                        inputMode="email"
                        type="text"
                        placeholder={t(['survey:auth:EmailPlaceholder', 'auth:EmailPlaceholder'])}
                        className="apptr__form-input apptr__form-input-string apptr__input apptr__input-string"
                        value={formState.email}
                        onChange={handleEmailChange}
                    />
                </div>
            </div>

            <Button
                isVisible={true}
                onClick={handleSubmit}
                inputRef={submitButtonRef as React.RefObject<HTMLButtonElement>}
                label={!_isBlank(buttonText) ? buttonText : t('auth:Login')}
                onKeyUp={handleKeyUp}
            />
        </form>
    );
};

export default LoginPage;
