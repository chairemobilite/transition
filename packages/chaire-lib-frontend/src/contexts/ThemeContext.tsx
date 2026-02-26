/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { type ReactNode, type FunctionComponent, createContext, useEffect, useState } from 'react';
// TODO: We could refactor this to an API or something like that in the future, so we won't use chaire-lib-common anymore
import Preferences from 'chaire-lib-common/lib/config/Preferences';

export type Theme = 'dark' | 'light';

/**
 * Returns the system color scheme when available, otherwise 'dark'.
 */
function getSystemTheme(): Theme {
    if (typeof window === 'undefined' || !window.matchMedia) {
        return 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Resolves the effective theme from preferences: isDarkTheme true → dark, false → light,
 * undefined → follow system preference.
 */
function getThemeFromPreferences(): Theme {
    const isDarkTheme = Preferences.get('isDarkTheme');
    if (isDarkTheme === false) {
        return 'light';
    }
    if (isDarkTheme === true) {
        return 'dark';
    }
    return getSystemTheme();
}

/**
 * React context providing the current UI theme (dark/light) for styling and assets.
 */
export const ThemeContext = createContext<Theme>(getThemeFromPreferences());

/**
 * Provider that uses the saved preference (isDarkTheme) when set, otherwise follows the system
 * theme. Reacts to preference changes and to system theme changes when preference is unset.
 */
export const ThemeProvider: FunctionComponent<{ children: ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<Theme>(getThemeFromPreferences);

    // Subscribe to preference changes (saved preferences and initial load)
    useEffect(() => {
        const onPreferencesChange = () => {
            setTheme(getThemeFromPreferences());
        };
        Preferences.addChangeListener(onPreferencesChange);
        return () => Preferences.removeChangeListener(onPreferencesChange);
    }, []);

    // React to system theme changes (getThemeFromPreferences uses system only when isDarkTheme is unset)
    useEffect(() => {
        if (!window.matchMedia) return;
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const listener = () => setTheme(getThemeFromPreferences());
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, []);

    // Apply theme to the document so CSS :root[data-color-scheme="dark|light"] takes effect
    useEffect(() => {
        if (typeof document !== 'undefined' && document.documentElement && theme !== undefined) {
            document.documentElement.setAttribute('data-color-scheme', theme);
        }
    }, [theme]);

    return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};
