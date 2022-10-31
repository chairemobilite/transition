/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _get       from 'lodash.get';

let count = 0;

// TODO, Do not stub when the object is moved in the typescript frontend
export class TransitObjectStub  {

    attributes: {
        data: {[key:string]: any}
        [key:string]: any;
    };

    static clone(obj: TransitObjectStub): TransitObjectStub {
        return new TransitObjectStub(JSON.parse(JSON.stringify(obj.attributes)));
    }

    constructor(attributes: any) {
        if (!attributes.id) {
            attributes.id = "id" + count++;
        }
        this.attributes = attributes;
        this.get = this.get.bind(this);
        this.set = this.set.bind(this);
        this.toString = this.toString.bind(this);
        this.save = jest.fn(() => new Promise(() => "mock save"));
        this.delete = jest.fn(() => new Promise(() => "mock delete"));
    }

    get(field: string): any {
        return this.attributes[field];
    }

    set(field: string, value: any): void {
        this.attributes[field] = value;
    }

    getData(path: string, defaultValue: any = '') {
        const value = this.attributes.data[path] ? this.attributes.data[path] : _get(this.attributes.data, path);
        if (defaultValue === undefined && value !== undefined) {
            return value;
        }
        return value === null || value === undefined || value === "" ? defaultValue : value;
    }

    toString(): string {
        return this.attributes["name"] ? this.attributes["name"] : "";
    }

    save(): Promise<any> {
        return new Promise(() => "dummy save");
    }

    delete(): Promise<any> {
        return new Promise(() => "dummy delete");
    }
}

export class GenericCollectionStub  {

    collection: any[];

    constructor(collection: any[]) {
        this.collection = collection;
        this.getFeatures = this.getFeatures.bind(this);
    }

    getFeatures(): any[] {
        return this.collection;
    }

    getById(id: string): any {
        return this.collection.find(element => element.properties.id === id);
    }
}

export class TransitNodeStub extends TransitObjectStub {

}

test('Dummy', () => {
    // Dummy test so this file passes, we should have a place to put stub classes
});