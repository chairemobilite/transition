/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface MapButtonBaseProps {
    title: string;
    onClick: () => void;
    className?: string;
}

interface MapButtonProps extends MapButtonBaseProps {
    iconPath: string;
}

interface MapButtonWithIconProps extends MapButtonBaseProps {
    icon: IconProp;
}

const MapButtonBase = ({ title, onClick, children, className = '' }: React.PropsWithChildren<MapButtonBaseProps>) => {
    const { t } = useTranslation();
    return (
        <button className={`tr__map-button ${className}`} onClick={onClick} title={t(title)}>
            {children}
        </button>
    );
};

export const MapButton: React.FC<MapButtonProps> = ({ title, onClick, iconPath, className = '' }) => (
    <MapButtonBase title={title} onClick={onClick} className={className}>
        <img src={iconPath} alt={title} className="tr__map-button-icon" />
    </MapButtonBase>
);

export const MapButtonWithIcon: React.FC<MapButtonWithIconProps> = ({ title, onClick, icon, className = '' }) => (
    <MapButtonBase title={title} onClick={onClick} className={`center ${className}`}>
        <FontAwesomeIcon icon={icon} color="white" />
    </MapButtonBase>
);
