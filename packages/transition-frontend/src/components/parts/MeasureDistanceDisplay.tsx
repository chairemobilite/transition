/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatDistance } from 'transition-common/lib/services/measureTool/MeasureTool';

type MeasureDistanceDisplayProps = {
    distance: number | undefined;
};

const MeasureDistanceDisplay: React.FC<MeasureDistanceDisplayProps> = ({ distance }) => {
    const { t } = useTranslation('main');
    if (distance === undefined) return null;

    return <div className="tr__measure-distance-display">{`${t('main:Total')} ${formatDistance(distance)}`}</div>;
};

export default MeasureDistanceDisplay;
