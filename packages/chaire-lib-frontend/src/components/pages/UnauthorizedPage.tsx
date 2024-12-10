/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

export const UnauthorizedPage: React.FC = () => {
    const { t } = useTranslation('auth');

    return (
        <div>
            {t('auth:Unauthorized')} - <Link to="/login">{t('auth:BackToLoginPage')}</Link>
        </div>
    );
};

export default UnauthorizedPage;
