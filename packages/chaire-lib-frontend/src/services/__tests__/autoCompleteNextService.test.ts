/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { getAutocompleteListFromObjectCollection, getAutocompleteList } from '../autoCompleteNextService';
import { TransitObjectStub } from './TransitObjectStub';

const object1 = new TransitObjectStub({
    numericCode: 107,
    alphaNumCode: "abc128"
});
const object2 = new TransitObjectStub({
    numericCode: 108,
    alphaNumCode: "abc129"
});
const object3 = new TransitObjectStub({
    numericCode: 109,
    alphaNumCode: "2"
});
const object4 = new TransitObjectStub({
    numericCode: 200,
    alphaNumCode: "xyz6"
});
const object5 = new TransitObjectStub({
    numericCode: 201,
    alphaNumCode: "xyz8"
});
const emptyObject = new TransitObjectStub({});

const list = [object1, object2, object3, object4, object5, emptyObject];

// TODO: We can do smarter auto complete, but it needs extra logic since it's
// just not matching, it's autocompleting with number + 1. Tests in comments should eventually pass
test("Purely numeric choices", async () => {
    expect(await getAutocompleteListFromObjectCollection(list, 'numericCode')).toEqual(['202', '110']);
    expect(await getAutocompleteListFromObjectCollection(list, 'numericCode', '3')).toEqual([]);
    // expect(await getAutocompleteListFromObjectCollection(list, 'numericCode', '11')).toEqual(['110']);
    expect(await getAutocompleteListFromObjectCollection(list, 'numericCode', '11')).toEqual([]);
});

test("Mixed alphanumeric choices", async () => {
    expect(await getAutocompleteListFromObjectCollection(list, 'alphaNumCode')).toEqual(['3', 'abc130', 'xyz9']);
    //expect(await getAutocompleteListFromObjectCollection(list, 'alphaNumCode')).toEqual(['3']);
    expect(await getAutocompleteListFromObjectCollection(list, 'alphaNumCode', '1')).toEqual([]);
    expect(await getAutocompleteListFromObjectCollection(list, 'alphaNumCode', 'ab')).toEqual(['abc130']);
    //expect(await getAutocompleteListFromObjectCollection(list, 'alphaNumCode', 'ab')).toEqual([]);
    expect(await getAutocompleteListFromObjectCollection(list, 'alphaNumCode', 'abc')).toEqual(['abc130']);
    expect(await getAutocompleteListFromObjectCollection(list, 'alphaNumCode', 'xyz')).toEqual(['xyz9']);
});

test("Corner cases", async () => {
    expect(await getAutocompleteList(['7', '8', '9'])).toEqual(['10']);
    expect(await getAutocompleteList(['7', '8', '9', '10'])).toEqual(['11']);
    expect(await getAutocompleteList(['98', '99'])).toEqual(['100']);
    expect(await getAutocompleteList(['98', '99', '100', '101'])).toEqual(['102']);
    expect(await getAutocompleteList(['90', '91', '100', '101'])).toEqual(['102', '92']);
    expect(await getAutocompleteList(['90', '91', '100', '101'], '1')).toEqual(['102']);
    expect(await getAutocompleteList(['90', '91', '100', '101'], '9')).toEqual(['92']);
    expect(await getAutocompleteList(['90', '91', '100', '101'], '8')).toEqual([]);
    expect(await getAutocompleteList([90, 91, 100, 101])).toEqual(['102', '92']);
    expect(await getAutocompleteList([90, 91, 100, 101, 902])).toEqual(['903', '102']);
    expect(await getAutocompleteList(['a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1', 'i1'])).toEqual(['a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2', 'i2']);
    // Too many possible choices
    expect(await getAutocompleteList(['a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1', 'i1', 'j1', 'k1'])).toEqual([]);
});