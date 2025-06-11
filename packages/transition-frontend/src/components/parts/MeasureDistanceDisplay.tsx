/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatDistance, MeasureTool } from 'transition-common/lib/services/measureTool/MeasureTool';

type MeasureDistanceDisplayProps = {
    measureTool: MeasureTool;
};

const MeasureDistanceDisplay: React.FC<MeasureDistanceDisplayProps> = ({ measureTool }) => {
    const { t } = useTranslation('main');
    const distances = measureTool.getDistances();
    if (distances.totalDistanceM === undefined) return null;

    return (
        <div className="tr__measure-distance-display">{`${t('main:Total')} ${formatDistance(distances.totalDistanceM)}`}</div>
    );
};

export default MeasureDistanceDisplay;
