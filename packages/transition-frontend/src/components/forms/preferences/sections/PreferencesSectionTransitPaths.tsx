/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import { withTranslation } from 'react-i18next';
import PreferencesResetToDefaultButton from '../PreferencesResetToDefaultButton';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputColor from 'chaire-lib-frontend/lib/components/input/InputColor';
import PreferencesSectionProps from '../PreferencesSectionProps';

const PreferencesSectionTransitPaths: React.FunctionComponent<PreferencesSectionProps> = (
    props: PreferencesSectionProps
) => {
    const prefs = props.preferences.getAttributes();

    return null;
};

export default withTranslation(['main', 'transit'])(PreferencesSectionTransitPaths);
