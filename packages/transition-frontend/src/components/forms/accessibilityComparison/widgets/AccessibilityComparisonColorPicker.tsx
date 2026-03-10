/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _camelCase from 'lodash/camelCase';
import React from 'react';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputColor from 'chaire-lib-frontend/lib/components/input/InputColor';

type ColorPickerProps = {
    defaultColor: string;
    label: string;
    colorValue: string;
    onValueChange: (color) => void;
};

export const AccessibilityComparisonColorPicker: React.FunctionComponent<ColorPickerProps> = (
    props: ColorPickerProps
) => (
    <InputWrapper twoColumns={true} label={props.label}>
        <InputColor
            defaultColor={props.defaultColor}
            id={`accessibilityComparison${_camelCase(props.defaultColor)}`}
            value={props.colorValue}
            onValueChange={(color) => props.onValueChange(color.target.value)}
        />
    </InputWrapper>
);

export default AccessibilityComparisonColorPicker;
