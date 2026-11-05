import React from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router';

import appConfiguration from '../../config/application.config';
import RegisterForm from '../forms/auth/localLogin/RegisterForm';
import type { RootState } from '../../store/configureStore';

type RegisterPageProps = {
    config: {
        auth?: {
            localLogin: {
                allowRegistration?: boolean;
                registerWithEmailOnly?: boolean;
            };
        };
    };
};

const RegisterPage: React.FC<RegisterPageProps> = ({ config }) => {
    const { t } = useTranslation('auth');
    const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

    // Check if registration is allowed based on config
    const allowRegistration = React.useMemo(() => config.auth?.localLogin?.allowRegistration !== false, [config]);

    // Handle email-only registration configuration
    const withEmailOnly = React.useMemo(() => config.auth?.localLogin?.registerWithEmailOnly, [config]);

    // Redirect if authenticated
    if (isAuthenticated) {
        return <Navigate to={appConfiguration.homePage} replace />;
    }

    // Return null if registration is not allowed
    if (!allowRegistration) {
        return null;
    }

    return (
        <>
            <RegisterForm withCaptcha={true} withEmailOnly={withEmailOnly} />
            <div className="apptr__separator-medium" />
            <div className="apptr__footer-link-container">
                <Link className="apptr__footer-link" to="/login">
                    {t('auth:iAlreadyHaveAnAccount')}
                </Link>
            </div>
        </>
    );
};

export default RegisterPage;
