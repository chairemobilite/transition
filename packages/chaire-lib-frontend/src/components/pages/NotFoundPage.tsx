/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

export const NotFoundPage: React.FC = () => {
    const { t } = useTranslation('auth');

    return (
        <div>
            404 - <Link to="/">{t('auth:BackToHomePage')}</Link>
        </div>
    );
};

export default NotFoundPage;
