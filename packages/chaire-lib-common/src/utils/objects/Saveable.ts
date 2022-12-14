/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
export interface Saveable {
    save(socket: any): Promise<any>;
    delete(socket: any): Promise<any>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isSaveable = (obj: any): obj is Saveable => {
    return obj.save && typeof obj.save === 'function' && obj.delete && typeof obj.delete === 'function';
};

export default Saveable;
