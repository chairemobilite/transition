/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ThemeContext, ThemeProvider } from '../ThemeContext';
import Preferences from 'chaire-lib-common/lib/config/Preferences';

jest.mock('chaire-lib-common/lib/config/Preferences', () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        addChangeListener: jest.fn(),
        removeChangeListener: jest.fn()
    }
}));

function ThemeConsumer() {
    const theme = React.useContext(ThemeContext);
    return <span data-testid="theme">{theme}</span>;
}

function renderWithProvider() {
    return render(
        <ThemeProvider>
            <ThemeConsumer />
        </ThemeProvider>
    );
}

describe('ThemeContext', () => {
    const originalMatchMedia = typeof window !== 'undefined' ? window.matchMedia : undefined;

    beforeEach(() => {
        (Preferences.get as jest.Mock).mockClear();
        (Preferences.addChangeListener as jest.Mock).mockClear();
        (Preferences.removeChangeListener as jest.Mock).mockClear();
        if (originalMatchMedia !== undefined) {
            Object.defineProperty(window, 'matchMedia', {
                value: originalMatchMedia,
                configurable: true,
                writable: true
            });
        }
    });

    afterEach(() => {
        if (originalMatchMedia !== undefined) {
            Object.defineProperty(window, 'matchMedia', {
                value: originalMatchMedia,
                configurable: true,
                writable: true
            });
        }
    });

    describe('Dynamic theme changes', () => {
        let preferenceChangeCallback: (() => void) | null = null;
        let mediaChangeListener: (() => void) | null = null;
        let systemPrefersDark = false;

        test('Context updates when preference change listener is invoked', () => {
            (Preferences.get as jest.Mock).mockImplementation((path: string) =>
                path === 'isDarkTheme' ? true : undefined
            );
            (Preferences.addChangeListener as jest.Mock).mockImplementation((cb: () => void) => {
                preferenceChangeCallback = cb;
            });
            (Preferences.removeChangeListener as jest.Mock).mockImplementation(() => {
                preferenceChangeCallback = null;
            });

            renderWithProvider();
            expect(screen.getByTestId('theme')).toHaveTextContent('dark');

            (Preferences.get as jest.Mock).mockImplementation((path: string) =>
                path === 'isDarkTheme' ? false : undefined
            );
            act(() => {
                preferenceChangeCallback?.();
            });
            expect(screen.getByTestId('theme')).toHaveTextContent('light');
        });

        test('Context updates when matchMedia change listener is invoked', () => {
            systemPrefersDark = false;
            (Preferences.get as jest.Mock).mockImplementation((path: string) =>
                path === 'isDarkTheme' ? undefined : undefined
            );
            Object.defineProperty(window, 'matchMedia', {
                value: jest.fn().mockImplementation(() => ({
                    get matches() {
                        return systemPrefersDark;
                    },
                    addEventListener: (_event: string, listener: () => void) => {
                        mediaChangeListener = listener;
                    },
                    removeEventListener: jest.fn()
                })),
                configurable: true,
                writable: true
            });
            (Preferences.addChangeListener as jest.Mock).mockImplementation(() => {});

            renderWithProvider();
            expect(screen.getByTestId('theme')).toHaveTextContent('light');

            systemPrefersDark = true;
            act(() => {
                mediaChangeListener?.();
            });
            expect(screen.getByTestId('theme')).toHaveTextContent('dark');
        });
    });

    test.each([
        {
            scenario: 'User selected light',
            isDarkTheme: false,
            systemPrefersDark: undefined,
            expectedTheme: 'light'
        },
        {
            scenario: 'User selected dark',
            isDarkTheme: true,
            systemPrefersDark: undefined,
            expectedTheme: 'dark'
        },
        {
            scenario: 'User has not selected, browser is light',
            isDarkTheme: undefined,
            systemPrefersDark: false,
            expectedTheme: 'light'
        },
        {
            scenario: 'User has not selected, browser is dark',
            isDarkTheme: undefined,
            systemPrefersDark: true,
            expectedTheme: 'dark'
        }
    ])('$scenario → theme is $expectedTheme', ({ isDarkTheme, systemPrefersDark, expectedTheme }) => {
        (Preferences.get as jest.Mock).mockImplementation((path: string) =>
            path === 'isDarkTheme' ? isDarkTheme : undefined
        );
        if (systemPrefersDark !== undefined) {
            Object.defineProperty(window, 'matchMedia', {
                value: jest.fn().mockImplementation(() => ({
                    matches: systemPrefersDark,
                    addEventListener: jest.fn(),
                    removeEventListener: jest.fn()
                })),
                configurable: true,
                writable: true
            });
        }

        renderWithProvider();
        expect(screen.getByTestId('theme')).toHaveTextContent(expectedTheme);
    });

    test('User has not selected and no browser preference → default theme is dark', () => {
        (Preferences.get as jest.Mock).mockImplementation(() => undefined);
        Object.defineProperty(window, 'matchMedia', {
            value: undefined,
            configurable: true,
            writable: true
        });

        renderWithProvider();
        expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    });
});
