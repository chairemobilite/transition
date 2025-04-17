/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under le MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Line from 'transition-common/lib/services/line/Line';
import Agency from 'transition-common/lib/services/agency/Agency';
import Button from '../../parts/Button';
import ButtonCell from '../../parts/ButtonCell';

interface TransitServiceLineItemProps {
    line: Line;
}

const TransitServiceLineItem: React.FunctionComponent<TransitServiceLineItemProps> = ({ line }) => {
    const { t } = useTranslation('transit');

    const agencyCollection = serviceLocator.collectionManager.get('agencies');
    const agency: Agency | undefined = agencyCollection?.getById(line.attributes.agency_id);

    return (
        <Button key={line.getId()} isSelected={false} flushActionButtons={false}>
            <ButtonCell alignment="left">
                <img
                    className="_list-element _icon-alone"
                    src={`/dist/images/icons/transit/modes/${line.attributes.mode}_white.svg`}
                    alt={t(`transit:transitLine:modes:${line.attributes.mode}`)}
                    title={t(`transit:transitLine:modes:${line.attributes.mode}`)}
                />
            </ButtonCell>
            <ButtonCell alignment="left">
                <span className="_circle-button" style={{ backgroundColor: line.attributes.color }}></span>
            </ButtonCell>
            <ButtonCell alignment="left">{line.attributes.shortname}</ButtonCell>
            <ButtonCell alignment="left">{line.attributes.longname}</ButtonCell>
            <ButtonCell alignment="left">{agency ? agency.attributes.name : t('transit:UnknownAgency')}</ButtonCell>
        </Button>
    );
};

export default TransitServiceLineItem;
