/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _camelCase from 'lodash/camelCase';
import React from 'react';
import PreferencesResetToDefaultButton from './PreferencesResetToDefaultButton';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputColor from 'chaire-lib-frontend/lib/components/input/InputColor';
import PreferencesSectionProps from './PreferencesSectionProps';

type ColorPrefProps = {
    prefPath: string;
    label: string;
};

export const PreferencesColorComponent: React.FunctionComponent<PreferencesSectionProps & ColorPrefProps> = (
    props: PreferencesSectionProps & ColorPrefProps
) => (
    <InputWrapper twoColumns={true} label={props.label}>
        <InputColor
            defaultColor={props.preferences.get(props.prefPath)}
            id={`formFieldPreferences${_camelCase(props.prefPath)}`}
            value={props.preferences.get(props.prefPath)}
            onValueChange={(e) => props.onValueChange(props.prefPath, { value: e.target.value })}
        />
        <PreferencesResetToDefaultButton
            resetPrefToDefault={props.resetPrefToDefault}
            path={props.prefPath}
            preferences={props.preferences}
        />
    </InputWrapper>
);

export default PreferencesColorComponent;
