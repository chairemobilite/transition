/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

const CheckMagicEmail: React.FC = () => {
    const { t } = useTranslation('auth');

    return (
        <div className="apptr__form apptr__form-auth apptr__form__label-standalone">
            <p className="apptr__form__label-standalone">{t('auth:CheckMagicEmail')}</p>
            <p className="apptr__form__label-standalone">
                <Link to="/login">{t('auth:BackToLoginPage')}</Link>
            </p>
        </div>
    );
};

export default CheckMagicEmail;
