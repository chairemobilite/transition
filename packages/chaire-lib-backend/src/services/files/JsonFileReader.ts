/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import { type Duplex, Transform, type TransformCallback } from 'stream';
import { JSONParser, TokenType } from '@streamparser/json';

export interface JsonReaderOptions {
    /**
     * The filter for elements in the json file to parse: `filter` is the path
     * of the array to read, with the fields of nested objects separated by
     * dots (for example, to read features of a feature collection, the filter
     * can be {filter: 'features'}). Without a filter, the whole file must be an
     * array.
     */
    filter?: { filter: string };
}

export type FileReaderCallback = (object: { [key: string]: any }, rowNumber: number) => void;

/**
 * JSON parser that calls `onElement` with each element of the array at
 * `arrayPath`, or of the whole document if `arrayPath` is not set. It does not
 * keep the elements once they are passed to `onElement`, so arrays larger than
 * the memory can be read. An error thrown by `onElement` is thrown by `write`.
 */
class JsonArrayParser {
    private parser: JSONParser;
    private isEmpty = true;

    /**
     * @param arrayPath The path of the array in the JSON document, with the
     * fields of nested objects separated by dots
     * @param onElement The function to call with each element and its index
     */
    constructor(arrayPath: string | undefined, onElement: (element: unknown, index: number) => void) {
        this.parser = new JSONParser({ paths: [arrayPath ? `$.${arrayPath}.*` : '$.*'], keepStack: false });
        this.parser.onToken = ({ token }) => {
            if (this.isEmpty && arrayPath === undefined && token !== TokenType.LEFT_BRACKET) {
                throw new Error('The JSON value at the root is not an array');
            }
            this.isEmpty = false;
        };
        this.parser.onValue = ({ value, key }) => {
            // The path also matches the fields of an object, which have string keys
            if (typeof key !== 'number') {
                throw new Error(`The JSON value at ${arrayPath ?? 'the root'} is not an array`);
            }
            onElement(value, key);
        };
    }

    /** Parse the next chunk of the document. */
    write(chunk: Uint8Array | string): void {
        this.parser.write(chunk);
    }

    /** Signal the end of the document. Throws if it is empty or incomplete. */
    end(): void {
        // The parser ends by itself after a complete document. Otherwise,
        // ending it emits a number at the end of the document, if any
        if (!this.parser.isEnded) {
            this.parser.end();
        }
        if (this.isEmpty) {
            throw new Error('The JSON document is empty');
        }
    }
}

/**
 * Wrapper around the parser for JSON files. It transforms the whole file
 * reading into a promise which returns the status of the file read or throws
 * any error thrown in the callback. If there are errors in the data read, the
 * callback will have been called for each parsed row before the error, but the
 * parsing will stop at the error and the promise will be rejected.
 *
 * @param {string} filePath The path of the file to read
 * @param {FileReaderCallback} rowCallback The callback function to call for
 * each object of the file.
 * @return {*}  {(Promise<'completed' | 'notfound'>)} 'completed' when the file
 * was read without error, 'notfound' if the file was not found.
 */
export const parseJsonFile = async (
    filePath: string,
    rowCallback: FileReaderCallback,
    options: JsonReaderOptions = {}
): Promise<'completed' | 'notfound'> => {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(filePath)) {
            // The callback is called while a chunk is parsed, so its errors
            // are thrown by `write`, like the parsing errors
            const parser = new JsonArrayParser(options.filter?.filter, (element, index) =>
                rowCallback(element as { [key: string]: any }, index)
            );
            const readStream = fs.createReadStream(filePath);

            readStream.on('data', (chunk) => {
                try {
                    parser.write(chunk);
                } catch (error) {
                    readStream.destroy();
                    reject(error);
                }
            });

            readStream.on('end', () => {
                try {
                    parser.end();
                    resolve('completed');
                } catch (error) {
                    reject(error);
                }
            });

            readStream.on('error', (e) => {
                console.error(e);
                reject(e);
            });
        } else {
            console.log(`JSON file ${filePath} not found, ignoring...`);
            resolve('notfound');
        }
    });
};

/**
 * Stream that parses JSON text and emits each non-null element of an array in
 * the document.
 */
class JsonArrayStream extends Transform {
    private parser: JsonArrayParser;

    constructor(arrayPath: string) {
        super({ readableObjectMode: true });
        this.parser = new JsonArrayParser(arrayPath, (element) => {
            if (element !== null) {
                this.push(element);
            }
        });
    }

    _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
        try {
            this.parser.write(chunk);
            callback();
        } catch (error) {
            callback(error as Error);
        }
    }

    _flush(callback: TransformCallback): void {
        try {
            this.parser.end();
            callback();
        } catch (error) {
            callback(error as Error);
        }
    }
}

/**
 * Create a stream that parses JSON text and emits each element of the array
 * at `arrayPath`. For example, `features` streams the features of a GeoJSON
 * feature collection and `elements` the elements of an Overpass API response.
 * Pipe a text stream into it, like a file read stream or a response body.
 * `null` elements are skipped.
 *
 * @param {string} arrayPath The path of the array in the JSON document, with
 * the fields of nested objects separated by dots
 * @return {*}  {Duplex} A duplex stream that emits the array's elements in
 * object mode
 */
export const createJsonArrayStream = (arrayPath: string): Duplex => new JsonArrayStream(arrayPath);
