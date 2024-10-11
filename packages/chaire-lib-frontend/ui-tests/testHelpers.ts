/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import moment from 'moment';
import { test, expect, Page, Browser, Locator } from '@playwright/test';
import { env } from 'process';


// Types for the tests
export type CommonTestParameters = {
    context: {
        // The main test page
        page: Page;
        // Store a counter for test names, to avoid duplicate test names. We have many objects to test and they may result in identical test names.
        widgetTestCounters: { [testKey: string]: number };
    };
};
type Value = string;
type StringOrBoolean = string | boolean;
type Text = string;
type Url = string;
type Title = string;
type Path = string;
type Email = string;
type LeftMenuSections = 'agencies' | 'nodes' | 'services' | 'scenarios' | 'routing' | 'accessibilityMap' | 'batchCalculation' | 'gtfsImport' | 'gtfsExport' | 'preferences';
type HasTitleTest = (params: { title: Title } & CommonTestParameters) => void;
type IsLanguageTest = (params: { expectedLanguage: "en" | "fr" } & CommonTestParameters) => void;
type SwitchLanguageTest = (params: { languageToSwitch: "en" | "fr" } & CommonTestParameters) => void;
type HasUrlTest = (params: { expectedUrl: Url } & CommonTestParameters) => void;
type LoginTest = (params: CommonTestParameters) => void;
type LogoutTest = (params: CommonTestParameters) => void;
type LeftMenuTest = (params: { section: LeftMenuSections } & CommonTestParameters) => void;
type PickGtfsFeedTest = (params: { fileName: Path, valid: boolean } & CommonTestParameters) => void;
type ImportGtfsFeedTest = (params: CommonTestParameters) => void;


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
    browser.close;
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
        const language = await context.page.locator("//html").getAttribute("lang");
        expect(language).toBe(expectedLanguage);
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
 */
export const loginTest: LoginTest = ({ context }) => {
    test(`Login to the test account`, async () => {
        const userNameField = context.page.locator("id=usernameOrEmail");
        await userNameField.fill(process.env.PLAYWRIGHT_TEST_USER as string);
        const passwordField = context.page.locator("id=password");
        await passwordField.fill(process.env.PLAYWRIGHT_TEST_PASSWORD as string);
        const loginButton = context.page.getByRole('button', { name: 'Login' });
        await loginButton.click();
        //await expect(context.page).toHaveURL(/\/#10\//); //Check that /#10/ is present in the url after logging in
        const logoutButton = context.page.getByRole('button', { name: 'Logout' });
        await expect(logoutButton).toBeVisible();
        const userButton = context.page.getByRole('button', { name: process.env.PLAYWRIGHT_TEST_USER });
        await expect(userButton).toBeVisible();
    });
};

/**
 * Logout, and verify we end up back on the login page.
 * @param {Object} options - The options for the test.
 */
export const logoutTest: LogoutTest = ({ context }) => {
    test('Logout from survey', async () => {
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
        //test.setTimeout(60000);
        const leftMenu = context.page.locator("//nav[@id='tr__left-menu']/ul[@class='tr__left-menu-container']");
        const sectionButton = leftMenu.locator(`//li/button[@data-section='${section}']`);
        await sectionButton.click();
        const rightPanel = context.page.locator("//section[@id='tr__right-panel']/div[@class='tr__right-panel-inner']");
        const rightPanelTitle = await rightPanel.locator("//h3").nth(0).textContent();
        let expectedRightPanelTitle;
        switch(section) {
            case 'agencies':
                expectedRightPanelTitle = 'Agencies';
                break;
            case 'nodes':
                expectedRightPanelTitle = 'Stop nodes';
                break;
            case 'services':
                expectedRightPanelTitle = 'Services';
                break;
            case 'scenarios':
                expectedRightPanelTitle = 'Scenarios';
                break;
            case 'routing':
                expectedRightPanelTitle = 'Routing';
                break;
            case 'accessibilityMap':
                expectedRightPanelTitle = 'Accessibility map';
                break;
            case 'batchCalculation':
                expectedRightPanelTitle = 'Calculation jobs';
                break;
            case 'gtfsImport':
                expectedRightPanelTitle = 'Import from a GTFS feed';
                break;
            case 'gtfsExport':
                expectedRightPanelTitle = 'Export as a GTFS feed';
                break;
            case 'preferences':
                expectedRightPanelTitle = 'Preferences';
                break;
        }
        expect(rightPanelTitle?.trim()).toBe(expectedRightPanelTitle);
    });
};

/**
 * Pick and upload a zip file as a GTFS feed. Check that the file is valid or not.
 * @param {Object} options - The options for the test.
 * @param {string} options.fileName - The filename of the file to pick. Must be in the 'ui-tests-ressources' directory.
 * @param {boolean} options.valid - Wether the file is a valid GTFS feed or not.
 */
export const pickGtfsFeed: PickGtfsFeedTest = ({ context, fileName, valid }) => {
    test(`Try to import a zip file (${fileName}) and check that is ${valid ? 'valid' : 'invalid'} - ${getTestCounter(context, `${fileName} - ${valid}`)}`, async () => {
        const leftMenu = context.page.locator("//nav[@id='tr__left-menu']/ul[@class='tr__left-menu-container']");
        const sectionButton = leftMenu.locator(`//li/button[@data-section='gtfsImport']`);
        await sectionButton.click();
        const fileChooserPromise = context.page.waitForEvent('filechooser');
        await context.page.locator("//input[contains(@id, 'formFieldTransitGtfsImporter')]").click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(__dirname + "/../ui-tests-resources/" + fileName);

        await context.page.locator("//button[@class='button blue large']").click();

        const importText = context.page.getByText(/Select the elements to import from the GTFS./);
        await expect(importText).toBeVisible();
        const importOptions = context.page.locator("//form[@id='tr__form-transit-gtfs-import']/div[@class='tr__form-section']").nth(1);
        const optionsCount = await importOptions.locator(">div").count(); //A selector starting with > will only count direct children
        expect(optionsCount).toBe(valid ? 6 : 1);
    });
};

/**
 * After picking a valid gtfs feed, import it by selecting all and picking the Default periods group.
 * @param {Object} options - The options for the test.
 */
export const importGtfsFeed: ImportGtfsFeedTest = ({ context }) => {
    test(`Choose all the right options and finish the import process - ${getTestCounter(context, "")}`, async () => {
        await context.page.locator("//input[contains(@id, 'GtfsImporterSelectedAgencies') and @type='button']").click();
        await context.page.locator("//input[contains(@id, 'GtfsImporterSelectedLines') and @type='button']").click();
        await context.page.locator("//input[contains(@id, 'GtfsImporterSelectedServices') and @type='button']").click();
        await context.page.locator("//select[contains(@id, 'GtfsImporterPeriodsGroup')]").selectOption('default');
        await context.page.getByRole('button', { name: 'Import data' }).click();
        const importInProgress = context.page.getByText('Import operation in progress');
        await expect(importInProgress).toBeVisible();
        const importFinished = context.page.getByText('Importing GTFS data: 100%');
        await expect(importFinished).toBeVisible();
    });
};