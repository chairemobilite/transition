/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { type ReactNode, type FunctionComponent, createContext, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

/**
 * Returns the system color scheme when available, otherwise 'dark'.
 */
function getSystemTheme(): Theme {
    if (typeof window === 'undefined' || !window.matchMedia) {
        return 'dark';
    }
    // Return the system theme
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * React context providing the current UI theme (dark/light) for styling and assets.
 */
export const ThemeContext = createContext<Theme>(getSystemTheme());

/**
 * Provider that uses the system theme by default and reacts to system changes.
 * Falls back to 'dark' when the system preference is not available (e.g. SSR).
 */
export const ThemeProvider: FunctionComponent<{ children: ReactNode }> = ({
    children
}) => {
    const [theme, setTheme] = useState<Theme>(getSystemTheme);

    // Check the system theme and update the theme when it changes
    useEffect(() => {
        if (!window.matchMedia) return;
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const listener = () => setTheme(getSystemTheme());
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, []);

    return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};
