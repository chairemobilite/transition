/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { test, expect, Page, Browser } from '@playwright/test';

// Types for the tests
export type CommonTestParameters = {
    context: {
        // The main test page
        page: Page;
        // Store a counter for test names, to avoid duplicate test names. We have many objects to test and they may result in identical test names.
        widgetTestCounters: { [testKey: string]: number };
    };
};
export type LoginMethods = 'clickLoginButton' | 'enterOnPasswordField' | 'enterOnUsernameField';
type Url = string;
type Title = string;
type LeftMenuSections = 'agencies' | 'nodes' | 'services' | 'scenarios' | 'routing' | 'comparison' | 'accessibilityMap' | 'batchCalculation' | 'gtfsImport' | 'gtfsExport' | 'preferences';
type AvailableLanguages = 'fr' | 'en';
type HasTitleTest = (params: { title: Title } & CommonTestParameters) => void;
type IsLanguageTest = (params: { expectedLanguage: AvailableLanguages } & CommonTestParameters) => void;
type SwitchLanguageTest = (params: { languageToSwitch: AvailableLanguages } & CommonTestParameters) => void;
type HasUrlTest = (params: { expectedUrl: Url } & CommonTestParameters) => void;
type LoginTest = (params: { loginMethod: LoginMethods } & CommonTestParameters) => void;
type LogoutTest = (params: CommonTestParameters) => void;
type LeftMenuTest = (params: { section: LeftMenuSections } & CommonTestParameters) => void;

const testUsername = process.env.PLAYWRIGHT_TEST_USER || 'testUser';
const testPassword = process.env.PLAYWRIGHT_TEST_PASSWORD || 'testPassword';

/**
 * Open the browser before all the tests and go to the login page
 *
 * @param {Browser} browser - The test browser object
 * @param {Object} options - The options for the test.
 * @param {{ [param: string]: string} } options.urlSearchParams - Additional
 * parameters to add to the URL as query string question.
 * @param {boolean} options.ignoreHTTPSErrors - Whether to ignore HTTPS errors.
 * These can happen if running the tests on a remote server with HTTPs (for
 * example test instances)
 */
export const initializeTestPage = async (
    browser: Browser,
    options: { urlSearchParams?: { [param: string]: string }, ignoreHTTPSErrors?: boolean } = {}
): Promise<Page> => {
    const context = await browser.newContext({ ignoreHTTPSErrors: options.ignoreHTTPSErrors === true });
    const page = await context.newPage();

    const baseUrlString = test.info().project.use.baseURL;
    if (typeof baseUrlString === 'string' && options.urlSearchParams) {
        // Add the search params to the base URL
        const baseURL = new URL(baseUrlString);
        Object.keys(options.urlSearchParams).forEach((param) => {
            baseURL.searchParams.append(param, options.urlSearchParams![param]);
        });
        await page.goto(baseURL.toString());
    } else {
        // Go to home page
        await page.goto('/');
    }

    return page;
};

// Close the browser after all the tests
test.afterAll(async ({ browser }) => {
    browser.close();
});

const getTestCounter = (context: CommonTestParameters['context'], testKey: string) => {
    const testIdx = context.widgetTestCounters[testKey] || 0;
    context.widgetTestCounters[testKey] = testIdx + 1;
    return context.widgetTestCounters[testKey];
};

/**
 * Test that the current page has a specific title.
 * @param {Object} options - The options for the test.
 * @param {string} options.title - The title of the page.
 */
export const hasTitleTest: HasTitleTest = ({ context, title }) => {
    test(`Has title ${title} - ${getTestCounter(context, `${title}`)}`, async () => {
        await expect(context.page).toHaveTitle(title);
    });
};

/**
 * Test that the current page has a specific url.
 * @param {Object} options - The options for the test.
 * @param {string} options.expectedUrl - The url of the page.
 */
export const hasUrlTest: HasUrlTest = ({ context, expectedUrl }) => {
    test(`Current page has the url ${expectedUrl} - ${getTestCounter(context, `${expectedUrl}`)}`, async () => {
        await expect(context.page).toHaveURL(expectedUrl);
    });
};

/**
 * Test that the language is what we expect.
 * @param {Object} options - The options for the test.
 * @param {string} options.expectedLanguage - The language we expect. Can be either 'en' or 'fr'.
 */
export const isLanguageTest: IsLanguageTest = ({ context, expectedLanguage }) => {
    test(`The page is in ${expectedLanguage === 'fr' ? 'French' : 'English'} - ${getTestCounter(context, `${expectedLanguage}`)}`, async () => {
        const language = context.page.locator('//html');
        await expect(language).toHaveAttribute('lang', expectedLanguage);
        const languageButton = context.page.getByRole('button', { name: (expectedLanguage === 'fr' ? 'English' : 'Français') });
        await expect(languageButton).toBeVisible();
    });
};

/**
 * Switch to a language by clicking the button in the top right.
 * @param {Object} options - The options for the test.
 * @param {string} options.languageToSwitch - The language to switch to. Can be either 'en' or 'fr'.
 */
export const switchLanguageTest: SwitchLanguageTest = ({ context, languageToSwitch }) => {
    test(`Switch to the other language (${languageToSwitch === 'fr' ? 'French' : 'English'}) - ${getTestCounter(context, `${languageToSwitch}`)}`, async () => {
        const languageButton = context.page.getByRole('button', { name: (languageToSwitch === 'fr' ? 'Français' : 'English') });
        await languageButton.click();
    });
};

/**
 * Login to the test account, and verify we end up on the right page.
 * @param {Object} options - The options for the test.
 * @param {LoginMethods} options.loginMethod - The method used to log in. By default, presses the login button.
 */
export const loginTest: LoginTest = ({ context, loginMethod }) => {
    test(`Login to the test account with method ${loginMethod} - ${getTestCounter(context, `${loginMethod}`)}`, async () => {
        const userNameField = context.page.locator('id=usernameOrEmail');
        await userNameField.fill(testUsername);
        const passwordField = context.page.locator('id=password');
        await passwordField.fill(testPassword);
        switch(loginMethod) {
        case 'clickLoginButton': {
            const loginButton = context.page.getByRole('button', { name: 'Login' });
            await loginButton.click();
            break;
        }
        case 'enterOnUsernameField': {
            await userNameField.click();
            await context.page.keyboard.press('Enter');
            break;
        }
        case 'enterOnPasswordField': {
            await passwordField.click();
            await context.page.keyboard.press('Enter');
            break;
        }
        }

        const logoutButton = context.page.getByRole('button', { name: 'Logout' });
        await expect(logoutButton).toBeVisible();
        const userButton = context.page.getByRole('button', { name: testUsername });
        await expect(userButton).toBeVisible();
    });
};

/**
 * Logout, and verify we end up back on the login page.
 * @param {Object} options - The options for the test.
 */
export const logoutTest: LogoutTest = ({ context }) => {
    test(`Logout from survey - ${getTestCounter(context, '')}`, async () => {
        const logoutButton = context.page.getByRole('button', { name: 'Logout' });
        await logoutButton.click();
        await expect(context.page).toHaveURL('/login');
    });
};

/**
 * Click on one of the sections on the left menu, and check that the right panel is the correct one.
 * @param {Object} options - The options for the test.
 * @param {string} options.section - The section we click.
 */
export const clickLeftMenuTest: LeftMenuTest = ({ context, section }) => {
    test(`Click the ${section} section of the left menu - ${getTestCounter(context, `${section}`)}`, async () => {
        const leftMenu = context.page.locator('//nav[@id="tr__left-menu"]/ul[@class="tr__left-menu-container"]');
        const sectionButton = leftMenu.locator(`//li/button[@data-section='${section}']/span/img`);
        await sectionButton.click();
        const rightPanel = context.page.locator('//section[@id="tr__right-panel"]/div[@class="tr__right-panel-inner"]');
        const rightPanelTitle = rightPanel.getByRole('heading').nth(0);
        let expectedRightPanelTitle;
        // To avoid making this function hard to maintain, we only leave the options that are clicked on during the "Test left menu" test, which are commonly used options whose title is unlikely to change
        // The expectedRightPanelTitle is the english title of each panel, taken directly from the translation files
        switch(section) {
        case 'agencies':
            expectedRightPanelTitle = 'Agencies';
            break;
        case 'routing':
            expectedRightPanelTitle = 'Routing';
            break;
        case 'preferences':
            expectedRightPanelTitle = 'Preferences';
            break;
        }
        await expect(rightPanelTitle).toContainText(expectedRightPanelTitle);
    });
};
