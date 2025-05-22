/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

interface MapButtonBaseProps {
    title: string;
    onClick: (e: MouseEvent) => void;
    className?: string;
    style?: any;
}

interface MapButtonProps extends MapButtonBaseProps {
    iconPath: string;
}

interface MapButtonWithIconProps extends MapButtonBaseProps {
    icon: IconProp;
}

const MapButtonBase = ({ title, onClick, children, className = '', style }: React.PropsWithChildren<MapButtonBaseProps>) => {
    const { t } = useTranslation();
    return (
        <button className={`tr__map-button ${className}`} onClick={onClick} title={t(title)} style={style}>
            {children}
        </button>
    );
};

export const MapButton: React.FC<MapButtonProps> = ({ title, onClick, iconPath, className = '', style }) => (
    <MapButtonBase title={title} onClick={onClick} className={className} style={style}>
        <img src={iconPath} alt={title} className="tr__map-button-icon" />
    </MapButtonBase>
);

export const MapButtonWithIcon: React.FC<MapButtonWithIconProps> = ({ title, onClick, icon, className = '' }) => (
    <MapButtonBase title={title} onClick={onClick} className={`center ${className}`}>
        <FontAwesomeIcon icon={icon} color="white" />
    </MapButtonBase>
);
