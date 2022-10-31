import each from 'jest-each';
import { join } from 'path';

import i18n, { registerTranslationDir, addTranslationNamespace } from '../i18next';

// Register translation directories and namespaces before running the test
registerTranslationDir(join(
    __dirname,
    './localesTest/'
));
addTranslationNamespace('ymltest');
addTranslationNamespace('jsontest');

const lang = 'en';
each([
    ['unexisting string', 'foo:bar', 'bar'],
    ['string from yml', 'ymltest:yml', 'yml test'],
    ['unexisting string', 'jsontest:json', 'JSON text']
]).test('Server i18next %s', (_title, translationString, expected) => {
    const translate = i18n().getFixedT(lang);
    expect(translate(translationString)).toEqual(expected);
})