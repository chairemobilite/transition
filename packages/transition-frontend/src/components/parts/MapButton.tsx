/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

interface MapButtonProps extends WithTranslation {
    title: string;
    onClick: () => void;
    iconPath: string;
    className?: string;
}

const MapButton: React.FC<MapButtonProps> = ({ t, title, onClick, iconPath, className = '' }) => {
    return (
        <button
            className={`tr__map-button ${className}`}
            onClick={onClick}
            title={t(title)}
        >
            <img src={iconPath} alt={title} className="tr__map-button-icon" />
        </button>
    );
};

export default withTranslation()(MapButton);
