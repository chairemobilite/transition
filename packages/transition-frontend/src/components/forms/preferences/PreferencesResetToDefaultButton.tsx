/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import { PreferencesClass } from 'chaire-lib-common/lib/config/Preferences';

interface PreferencesResetToDefaultButtonProps extends WithTranslation {
    path: string;
    preferences: PreferencesClass;
    resetPrefToDefault: (path: string) => void;
}

const PreferencesResetToDefaultButton: React.FunctionComponent<PreferencesResetToDefaultButtonProps> = (
    props: PreferencesResetToDefaultButtonProps
) => {
    return (
        <Button
            align="left"
            color="blue"
            disabled={
                props.preferences.getFromProjectDefaultOrDefault(props.path) === props.preferences.get(props.path)
            }
            iconPath={'/dist/images/icons/interface/gear_reset_white.svg'}
            iconClass="_icon-alone"
            onClick={(e) => props.resetPrefToDefault(props.path)}
            title={props.t('main:preferences:ResetToDefault')}
        />
    );
};

export default withTranslation('main')(PreferencesResetToDefaultButton);
