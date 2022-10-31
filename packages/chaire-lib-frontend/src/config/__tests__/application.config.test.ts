/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import appConfig, { setApplicationConfiguration } from '../application.config';

const newHomepage = '/homepage';
const pages = [{ path: '/myPage', permissions: {}, title: 'Foo' }];

test('Test default configuration', () => {
    expect(appConfig.homePage).toEqual('/');
    expect(appConfig.pages).toEqual([]);
})

test('Test setting full configuration', () => {
    setApplicationConfiguration({ homePage: newHomepage, pages });
    expect(appConfig.homePage).toEqual(newHomepage);
    expect(appConfig.pages).toEqual(pages);
});

test('Test setting partial configuration', () => {
    setApplicationConfiguration({ pages: [] });
    expect(appConfig.homePage).toEqual(newHomepage);
    expect(appConfig.pages).toEqual([]);
});