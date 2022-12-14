/* tslint:disable */

/**
 * This file has been automatically generated by the [capnpc-ts utility](https://github.com/jdiaz5513/capnp-ts).
 */

import * as capnp from 'capnp-ts';
import { ObjectSize as __O, Struct as __S } from 'capnp-ts';
import { Household } from './household.capnp';
export const _capnpFileId = 'fa6a69e9ccb7fa72';
export class HouseholdCollection extends __S {
    static readonly _capnp = { displayName: 'HouseholdCollection', id: 'a2c2f338a869f976', size: new __O(0, 1) };
    static _Households: capnp.ListCtor<Household>;
    adoptHouseholds(value: capnp.Orphan<capnp.List<Household>>): void {
        __S.adopt(value, __S.getPointer(0, this));
    }
    disownHouseholds(): capnp.Orphan<capnp.List<Household>> {
        return __S.disown(this.getHouseholds());
    }
    getHouseholds(): capnp.List<Household> {
        return __S.getList(0, HouseholdCollection._Households, this);
    }
    hasHouseholds(): boolean {
        return !__S.isNull(__S.getPointer(0, this));
    }
    initHouseholds(length: number): capnp.List<Household> {
        return __S.initList(0, HouseholdCollection._Households, length, this);
    }
    setHouseholds(value: capnp.List<Household>): void {
        __S.copyFrom(value, __S.getPointer(0, this));
    }
    toString(): string {
        return 'HouseholdCollection_' + super.toString();
    }
}
HouseholdCollection._Households = capnp.CompositeList(Household);
