import fs from 'fs';

// Language configuration - TODO: this should be moved to a separate config file
const languages = [
    'en', // first language is used as the reference for the consistency tests below.
    'fr'
];

/*
    this finds all the labels in the file
    the labels are used to connect to help popups in the transition UI
    - {([^}]+)} is searching for content between curly braces {} with specific components:
    - [^}] means "match any character that is NOT a closing curly brace"
    - } - Matches a closing curly brace literally
*/
const labelRegex = /\\label{([^}]+)}/g;

describe('LaTeX Label Consistency Tests', () => {
    // Helper function to extract labels from LaTeX content
    function extractLabels(content) {

        const labels = new Set();
        let match;

        while ((match = labelRegex.exec(content)) !== null) {
            labels.add(match[1]);
        }

        return labels;
    }

    // Store file contents and labels
    const fileContents = {};
    const labelSets = {};
    const referenceLanguage = languages[0];

    beforeAll(() => {
        // Load all language files
        languages.forEach((lang) => {
            fileContents[lang] = fs.readFileSync(`file/definitions/definitions-${lang}.tex`, 'utf8');
            labelSets[lang] = extractLabels(fileContents[lang]);
        });
    });

    // Test each non-reference language against reference language
    describe.each(languages.slice(1))('Testing $code against reference language ${referenceLanguage}', (lang) => {
        test(`all reference language ${referenceLanguage} labels exist in ${lang} file`, () => {
            const missingLabels = [...labelSets[referenceLanguage]].filter(
                (label) => !labelSets[lang].has(label)
            );

            if (missingLabels.length > 0) {
                throw new Error(
                    `Missing labels in ${lang}:\n${missingLabels.join('\n')}`
                );
            }
        });

        test(`all ${lang} labels exist in reference language ${referenceLanguage} file`, () => {
            const extraLabels = [...labelSets[lang]].filter(
                (label) => !labelSets[referenceLanguage].has(label)
            );

            if (extraLabels.length > 0) {
                throw new Error(
                    `Extra labels in ${lang} not present in reference language ${referenceLanguage}:\n${extraLabels.join('\n')}`
                );
            }
        });

        test(`${lang} has same number of labels as reference language ${referenceLanguage}`, () => {
            expect(labelSets[lang].size).toBe(labelSets[referenceLanguage].size);
        });

        test(`labels appear in same order as reference language ${referenceLanguage} in ${lang} file`, () => {
            const langLabels = [...labelSets[lang]];
            const referenceLabels = [...labelSets[referenceLanguage]];
            expect(langLabels).toEqual(referenceLabels);
        });
    });

    // Test each language for duplicates
    test.each(languages)('no duplicate labels in $code file', (lang) => {
        const duplicates = new Set();
        const seen = new Set();
        /*
            this finds all the labels in the file
            the labels are used to connect to help popups in the transition UI
            - {([^}]+)} is searching for content between curly braces {} with specific components:
            - [^}] means "match any character that is NOT a closing curly brace"
            - } - Matches a closing curly brace literally
        */
        let match;

        while ((match = labelRegex.exec(fileContents[lang])) !== null) {
            const label = match[1];
            if (seen.has(label)) {
                duplicates.add(label);
            }
            seen.add(label);
        }

        if (duplicates.size > 0) {
            throw new Error(
                `Duplicate labels found in ${lang}:\n${[...duplicates].join('\n')}`
            );
        }
    });
});
