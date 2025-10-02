/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

//This was in dataOsmRaw.ts but it's only used in this directory.
export interface OsmRawQueryOr {
    type?: 'way' | 'relation' | 'node';
    id?: string | number;
    tags?: { [key: string]: any };
    nodes?: number[];
    members?: { type: 'way' | 'relation' | 'node'; ref: number; [key: string]: any }[];
    [key: string]: any;
}
