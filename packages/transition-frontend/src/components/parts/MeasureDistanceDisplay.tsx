import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { formatDistance } from 'transition-common/lib/services/measureTool/MeasureTool';

interface MeasureDistanceDisplayProps extends WithTranslation {
    distance: number | undefined;
}

const MeasureDistanceDisplay: React.FC<MeasureDistanceDisplayProps> = ({ distance, t }) => {
    if (distance === undefined) return null;

    return (
        <div className="tr__measure-distance-display">
            {`${t('main:Total')} ${formatDistance(distance)}`}
        </div>
    );
};

export default withTranslation()(MeasureDistanceDisplay);
