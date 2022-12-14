/* tslint:disable */

/**
 * This file has been automatically generated by the [capnpc-ts utility](https://github.com/jdiaz5513/capnp-ts).
 */

import * as capnp from 'capnp-ts';
import { ObjectSize as __O, Struct as __S } from 'capnp-ts';
import { OdTrip } from './odTrip.capnp';
export const _capnpFileId = '8ffad6ff4ac3568a';
export class OdTripCollection extends __S {
    static readonly _capnp = { displayName: 'OdTripCollection', id: 'e1b76be126da4a62', size: new __O(0, 1) };
    static _OdTrips: capnp.ListCtor<OdTrip>;
    adoptOdTrips(value: capnp.Orphan<capnp.List<OdTrip>>): void {
        __S.adopt(value, __S.getPointer(0, this));
    }
    disownOdTrips(): capnp.Orphan<capnp.List<OdTrip>> {
        return __S.disown(this.getOdTrips());
    }
    getOdTrips(): capnp.List<OdTrip> {
        return __S.getList(0, OdTripCollection._OdTrips, this);
    }
    hasOdTrips(): boolean {
        return !__S.isNull(__S.getPointer(0, this));
    }
    initOdTrips(length: number): capnp.List<OdTrip> {
        return __S.initList(0, OdTripCollection._OdTrips, length, this);
    }
    setOdTrips(value: capnp.List<OdTrip>): void {
        __S.copyFrom(value, __S.getPointer(0, this));
    }
    toString(): string {
        return 'OdTripCollection_' + super.toString();
    }
}
OdTripCollection._OdTrips = capnp.CompositeList(OdTrip);
