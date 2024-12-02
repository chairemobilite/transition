/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { PreferencesClass } from 'chaire-lib-common/lib/config/Preferences';

interface PreferencesSectionProps {
    preferences: PreferencesClass;
    onValueChange: (path: string, newValue: { value: any; valid?: boolean }) => void;
    resetPrefToDefault: (path: string) => void;
    resetChangesCount: number;
}

export default PreferencesSectionProps;
