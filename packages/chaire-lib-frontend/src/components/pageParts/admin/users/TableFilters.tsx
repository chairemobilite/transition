/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

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
