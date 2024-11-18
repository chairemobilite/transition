/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import { parse } from '@unified-latex/unified-latex-util-parse';
import { parseAlignEnvironment } from '@unified-latex/unified-latex-util-align';
import { toString } from '@unified-latex/unified-latex-util-to-string';
import { Dictionary } from 'lodash';

/**
 * Get both the french and english version of a definition from the latex files.
 * @param label The label indicating the row of the Latex document that we want to obtain as a definition.
 * @returns A dictionary with a 'fr' and 'en' attribute.
 */
export const getDefinitionInAllLanguages = async (label: string): Promise<Dictionary<any>> => {
    return {
        fr: getDefinitionInOneLanguage('fr', label),
        en: getDefinitionInOneLanguage('en', label)
    };
};

/**
 * Get a definition from one of the latex files in a specific language.
 * @param language The language we want to get the definition in. Right now, supported for 'fr' and 'en'.
 * @param label The label indicating the row of the Latex document that we want to obtain as a definition.
 * @returns A dictionary containing the definition. Has a title, symbol, unit, formula, and description attribute.
 */
export const getDefinitionInOneLanguage = (language: string, label: string): Dictionary<any> => {
    const latexText = readFile(language);
    const AST = parse(latexText).content;
    const separatedTable = getSeparatedTable(AST);
    return getOneDefinition(separatedTable, label);
};

/**
 * Get the content of one of the definitions latex file in string form.
 * @param language The version of the file with a specific language we want to read. Right now, supported for 'fr' and 'en'.
 * @returns The string content of the file.
 */
export const readFile = (language: string): string => {
    const filePath = `${__dirname}/../../../file/definitions/definitions-${language}.tex`;
    const text = fs.readFileSync(filePath, 'utf-8');
    return text;
};

/**
 * After parsing the latex file, return just the table rows containing the definitions we want.
 * @param AST An array containing the parsed content of the entire latex file.
 * @returns An array containing the data of all the definitions.
 */
const getSeparatedTable = (AST: any[]): any[] => {
    let document;

    for (let i = 0; i < AST.length; i++) {
        if (AST[i]['env'] === 'document') {
            // The element with the env attribute equal to 'document' is the informational content of the file, as opposed to the metadata and formatting info.
            document = AST[i]['content'];
        }
    }

    const separatedTable: any[] = [];

    for (let i = 0; i < document.length; i++) {
        // Elements with the 'longtable' env are the tables that contain the information we want.
        if (document[i]['env'] === 'longtable') {
            const table = document[i]['content'];
            const parsedTable = parseAlignEnvironment(table); // This function will automatically split the table in rows and columns.
            for (let j = 0; j < parsedTable.length; j++) {
                // Rows with 5 cells are the ones that contain the information we want. The others are just latex syntax.
                if (parsedTable[j].cells.length === 5) {
                    separatedTable.push(parsedTable[j].cells);
                }
            }
        }
    }

    return separatedTable;
};

/**
 * Get a specific definition from a pre-treated array that contains all the definition data.
 * @param separatedTable An AST (abstract syntax tree) array containing the data of all the definitions.
 * @param label The label indicating the row of the Latex document that we want to obtain as a definition.
 * @returns A dictionary containing the definition. Has a title, symbol, unit, formula, and description attribute. If the label could not be found, throws an error instead.
 */
const getOneDefinition = (separatedTable: any[], label: string): Dictionary<any> => {
    for (let i = 0; i < separatedTable.length; i++) {
        const row = separatedTable[i];
        if (
            // Depending on if this row was the first in a table or not, the label will be at a different index.
            (row[0][1].content === 'label' && row[0][1].args[2].content[0].content === label) ||
            (row[0][3].content === 'label' && row[0][3].args[2].content[0].content === label)
        ) {
            // The row contains 5 cells, each of them having one of the attributes we want.
            return {
                title: getTitle(row[0]),
                // Since the symbol, unit, and formula are mathematical expressions, we have to use an extra step to obtain their content.
                symbol: toString(row[1][1].content).trim(),
                unit: toString(row[2][1].content).trim(),
                formula: toString(row[3][1].content).trim(),
                description: stringifyArray(row[4])
            };
        }
    }

    throw new Error(`Could not find definition with label '${label}'.`);
};

/**
 * Get the title from the cell that contains it.
 * @param titleCell An array representing the cell containing the title.
 * @returns The title in string form.
 */
const getTitle = (titleCell: any[]): string | undefined => {
    for (let i = 0; i < titleCell.length; i++) {
        const node = titleCell[i];
        // The title is contained in the specific node with the type attribute 'group'. Since the index is not constant, this loop is necessary to find it.
        if (node.type === 'group') {
            return stringifyArray(node.content);
        }
    }
};

/**
 * Return the string content of an AST array.
 * We use this function instead of unified-latex's toString because toString would include the english translation of the title in the italics tag for the french file,
 * as well as return characters for long strings.
 * @param astArray The AST array that contains the string.
 * @returns The content of the array in string form.
 */
const stringifyArray = (astArray: any[]): string => {
    let assembledString = '';
    for (let i = 0; i < astArray.length; i++) {
        const wordOrSpace = astArray[i];
        if (wordOrSpace.type === 'string') {
            assembledString += wordOrSpace.content;
        } else if (wordOrSpace.type === 'whitespace') {
            assembledString += ' ';
        }
    }

    return assembledString.trim();
};
