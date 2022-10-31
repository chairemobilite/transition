/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
interface directedTreeNum {
    lastNumber?: number;
    prefix?: string;
    tree: {
        [key: string]: directedTreeNum;
    };
}

const prepareData = (values: (string | number)[]): directedTreeNum => {
    const autoCompleteTree: directedTreeNum = { tree: {} };
    values.forEach((fieldValue) => {
        const value: { alpha: string; numeric: number } = { alpha: '', numeric: 0 };
        if (typeof fieldValue === 'number') {
            value.numeric = fieldValue;
        } else {
            const res = fieldValue.match(/[a-z]+|\d+/gi);
            if (!res) {
                return;
            }
            const res0 = res[0] ? parseInt(res[0]) : NaN;
            const res1 = res[1] ? parseInt(res[1]) : NaN;
            if (isNaN(res0) && !isNaN(res1)) {
                value.alpha = res[0];
                value.numeric = res1;
            } else if (!isNaN(res0)) {
                value.numeric = res0;
            }
        }
        let currentTree = autoCompleteTree;
        for (let i = 0; i < value.alpha.length; i++) {
            const tree = currentTree[value.alpha[i]] || { tree: {} };
            tree.prefix = value.alpha[i];
            currentTree.tree[value.alpha[i]] = tree;
            currentTree = tree;
        }
        if (value.numeric) {
            currentTree.lastNumber = Math.max(currentTree.lastNumber || 0, value.numeric);
            if (value.numeric.toString().length > 1) {
                const firstChar = value.numeric.toString()[0];
                currentTree.tree[firstChar] = currentTree.tree[firstChar] || { tree: {} };
                currentTree.tree[firstChar].lastNumber = Math.max(
                    currentTree.tree[firstChar].lastNumber || 0,
                    value.numeric
                );
            }
        }
    });
    return autoCompleteTree;
};

const addChildrenTreesNext = (
    currentTree: directedTreeNum,
    excludeFirstChar: string,
    choices: string[],
    prefix: string
) => {
    if (!currentTree.tree) {
        return;
    }
    Object.keys(currentTree.tree).forEach((key) => {
        if (key !== excludeFirstChar) {
            const tree = currentTree.tree[key];
            if (tree?.lastNumber && tree?.lastNumber !== currentTree?.lastNumber) {
                const newNumber = (tree.lastNumber + 1).toString();
                if (isNaN(parseInt(key)) || newNumber[0] === key || newNumber.length === 1) {
                    choices.push(prefix + (tree.prefix || '') + newNumber);
                }
            }
            addChildrenTreesNext(tree, excludeFirstChar, choices, prefix + (tree.prefix || ''));
        }
    });
};

const calculateAutocompleteList = (values: (string | number)[], value: string): string[] => {
    const autoCompleteTree = prepareData(values);
    const choices: string[] = [];
    let currentTree = autoCompleteTree;
    let prefix = '';
    for (let i = 0; i < value.length; i++) {
        currentTree = currentTree.tree[value[i]];
        if (!currentTree) {
            break;
        }
        prefix += currentTree.prefix || '';
    }
    if (currentTree?.lastNumber) {
        const newNumber = currentTree.lastNumber + 1;
        choices.push(prefix + newNumber.toString());
    }
    if (currentTree) {
        const extraChoices: string[] = [];
        addChildrenTreesNext(currentTree, choices.length > 0 ? choices[0].toString()[0] : '', extraChoices, prefix);
        if (extraChoices.length < 10) {
            choices.push(...extraChoices);
        }
    }
    return choices;
};

/**
 * Returns an array of potential values for the next value in a collection. If
 * the values ends with a number, the returned value will be incremented by one.
 * It guesses the next value also given an alphabetical prefix, so, if values
 * are 'a1', 'a2' it would return 'a3' if the prefix 'a' was entered.
 *
 * @param collection The collection of objects from which to get current values
 * @param field The object field to search for
 * @param value The prefix for the value
 */
const getAutocompleteListFromObjectCollection = async (
    collection: any[],
    field: string,
    value = ''
): Promise<string[]> => {
    const values: string[] = [];
    collection.forEach((element) => {
        const fieldValue = element.get(field);
        if (fieldValue) {
            values.push(fieldValue);
        }
    });
    return new Promise((resolve) => {
        const choices = calculateAutocompleteList(values, value);
        resolve(choices);
    });
};

const getAutocompleteList = async (values: (string | number)[], value = ''): Promise<string[]> => {
    return new Promise((resolve) => {
        const choices = calculateAutocompleteList(values, value);
        resolve(choices);
    });
};

export { getAutocompleteListFromObjectCollection, getAutocompleteList };
