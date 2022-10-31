/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
export interface Progressable {
    progress(progressEventName: string, completeRatio: number): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isProgressable = (obj: any): obj is Progressable => {
    return obj.progress && typeof obj.progress === 'function';
};

export default Progressable;
