/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

type DefaultColumnFilterProps = {
    column: {
        filterValue: any;
        _preFilteredRows: any;
        setFilter: any;
    };
};

/**
 * Textbox input for column filter
 *
 * @param param0 description of the filtered column
 * @returns
 */
export const DefaultColumnFilter = ({
    column: { filterValue, _preFilteredRows, setFilter }
}: DefaultColumnFilterProps) => {
    return (
        <input
            value={filterValue || ''}
            onChange={(e) => {
                setFilter(e.target.value || undefined); // Set undefined to remove the filter entirely
            }}
            placeholder={''}
        />
    );
};

/**
 * Select input to filter a boolean column. The filter value is the 'true' or
 * 'false' string, or undefined to show all rows.
 *
 * @param param0 description of the filtered column
 * @returns
 */
export const BooleanColumnFilter = ({ column: { filterValue, setFilter } }: DefaultColumnFilterProps) => {
    const { t } = useTranslation('admin');
    return (
        <select
            value={filterValue || ''}
            onChange={(e) => {
                setFilter(e.target.value || undefined); // Set undefined to remove the filter entirely
            }}
        >
            <option value="">{t('admin:user:FilterAll')}</option>
            <option value="true">{t('admin:user:FilterYes')}</option>
            <option value="false">{t('admin:user:FilterNo')}</option>
        </select>
    );
};
