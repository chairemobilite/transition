/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import PreferencesSectionProps from './PreferencesSectionProps';

interface PreferencesSectionLineModeProps extends PreferencesSectionProps {
    mode: string;
    lineModesConfigByMode: { [key: string]: any };
}

export default PreferencesSectionLineModeProps;
