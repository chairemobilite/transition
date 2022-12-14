/* tslint:disable */

/**
 * This file has been automatically generated by the [capnpc-ts utility](https://github.com/jdiaz5513/capnp-ts).
 */

import * as capnp from 'capnp-ts';
import { ObjectSize as __O, Struct as __S } from 'capnp-ts';
export const _capnpFileId = '88340494115f60b3';
export enum OdTrip_Mode {
    NONE,
    WALKING,
    CYCLING,
    CAR_DRIVER,
    CAR_PASSENGER,
    MOTORCYCLE,
    TRANSIT,
    PARATRANSIT,
    TAXI,
    SCHOOL_BUS,
    OTHER_BUS,
    INTERCITY_BUS,
    INTERCITY_TRAIN,
    PLANE,
    FERRY,
    PARK_AND_RIDE,
    KISS_AND_RIDE,
    BIKE_AND_RIDE,
    MULTIMODAL_OTHER,
    OTHER,
    UNKNOWN
}
export enum OdTrip_Activity {
    NONE,
    HOME,
    WORK_USUAL,
    WORK_NON_USUAL,
    SCHOOL_USUAL,
    SCHOOL_NON_USUAL,
    SHOPPING,
    LEISURE,
    SERVICE,
    SECONDARY_HOME,
    VISITING_FRIENDS,
    DROP_SOMEONE,
    FETCH_SOMEONE,
    RESTAURANT,
    MEDICAL,
    WORSHIP,
    ON_THE_ROAD,
    OTHER,
    UNKNOWN
}
export class OdTrip extends __S {
    static readonly Mode = OdTrip_Mode;
    static readonly Activity = OdTrip_Activity;
    static readonly _capnp = { displayName: 'OdTrip', id: 'f97d02eb36e1c023', size: new __O(56, 12) };
    getUuid(): string {
        return __S.getText(0, this);
    }
    setUuid(value: string): void {
        __S.setText(0, value, this);
    }
    getPersonUuid(): string {
        return __S.getText(1, this);
    }
    setPersonUuid(value: string): void {
        __S.setText(1, value, this);
    }
    getHouseholdUuid(): string {
        return __S.getText(2, this);
    }
    setHouseholdUuid(value: string): void {
        __S.setText(2, value, this);
    }
    getDataSourceUuid(): string {
        return __S.getText(3, this);
    }
    setDataSourceUuid(value: string): void {
        __S.setText(3, value, this);
    }
    getId(): number {
        return __S.getUint32(0, this);
    }
    setId(value: number): void {
        __S.setUint32(0, value, this);
    }
    getExpansionFactor(): number {
        return __S.getFloat32(4, this);
    }
    setExpansionFactor(value: number): void {
        __S.setFloat32(4, value, this);
    }
    getDepartureTimeSeconds(): number {
        return __S.getInt32(8, this);
    }
    setDepartureTimeSeconds(value: number): void {
        __S.setInt32(8, value, this);
    }
    getArrivalTimeSeconds(): number {
        return __S.getInt32(12, this);
    }
    setArrivalTimeSeconds(value: number): void {
        __S.setInt32(12, value, this);
    }
    getWalkingTravelTimeSeconds(): number {
        return __S.getInt32(16, this);
    }
    setWalkingTravelTimeSeconds(value: number): void {
        __S.setInt32(16, value, this);
    }
    getCyclingTravelTimeSeconds(): number {
        return __S.getInt32(20, this);
    }
    setCyclingTravelTimeSeconds(value: number): void {
        __S.setInt32(20, value, this);
    }
    getDrivingTravelTimeSeconds(): number {
        return __S.getInt32(24, this);
    }
    setDrivingTravelTimeSeconds(value: number): void {
        __S.setInt32(24, value, this);
    }
    getMode(): OdTrip_Mode {
        return __S.getUint16(28, this);
    }
    setMode(value: OdTrip_Mode): void {
        __S.setUint16(28, value, this);
    }
    getOriginActivity(): OdTrip_Activity {
        return __S.getUint16(30, this);
    }
    setOriginActivity(value: OdTrip_Activity): void {
        __S.setUint16(30, value, this);
    }
    getDestinationActivity(): OdTrip_Activity {
        return __S.getUint16(32, this);
    }
    setDestinationActivity(value: OdTrip_Activity): void {
        __S.setUint16(32, value, this);
    }
    getOriginLatitude(): number {
        return __S.getInt32(36, this);
    }
    setOriginLatitude(value: number): void {
        __S.setInt32(36, value, this);
    }
    getOriginLongitude(): number {
        return __S.getInt32(40, this);
    }
    setOriginLongitude(value: number): void {
        __S.setInt32(40, value, this);
    }
    getDestinationLatitude(): number {
        return __S.getInt32(44, this);
    }
    setDestinationLatitude(value: number): void {
        __S.setInt32(44, value, this);
    }
    getDestinationLongitude(): number {
        return __S.getInt32(48, this);
    }
    setDestinationLongitude(value: number): void {
        __S.setInt32(48, value, this);
    }
    adoptOriginNodesUuids(value: capnp.Orphan<capnp.List<string>>): void {
        __S.adopt(value, __S.getPointer(4, this));
    }
    disownOriginNodesUuids(): capnp.Orphan<capnp.List<string>> {
        return __S.disown(this.getOriginNodesUuids());
    }
    getOriginNodesUuids(): capnp.List<string> {
        return __S.getList(4, capnp.TextList, this);
    }
    hasOriginNodesUuids(): boolean {
        return !__S.isNull(__S.getPointer(4, this));
    }
    initOriginNodesUuids(length: number): capnp.List<string> {
        return __S.initList(4, capnp.TextList, length, this);
    }
    setOriginNodesUuids(value: capnp.List<string>): void {
        __S.copyFrom(value, __S.getPointer(4, this));
    }
    adoptOriginNodesTravelTimes(value: capnp.Orphan<capnp.List<number>>): void {
        __S.adopt(value, __S.getPointer(5, this));
    }
    disownOriginNodesTravelTimes(): capnp.Orphan<capnp.List<number>> {
        return __S.disown(this.getOriginNodesTravelTimes());
    }
    getOriginNodesTravelTimes(): capnp.List<number> {
        return __S.getList(5, capnp.Int16List, this);
    }
    hasOriginNodesTravelTimes(): boolean {
        return !__S.isNull(__S.getPointer(5, this));
    }
    initOriginNodesTravelTimes(length: number): capnp.List<number> {
        return __S.initList(5, capnp.Int16List, length, this);
    }
    setOriginNodesTravelTimes(value: capnp.List<number>): void {
        __S.copyFrom(value, __S.getPointer(5, this));
    }
    adoptOriginNodesDistances(value: capnp.Orphan<capnp.List<number>>): void {
        __S.adopt(value, __S.getPointer(6, this));
    }
    disownOriginNodesDistances(): capnp.Orphan<capnp.List<number>> {
        return __S.disown(this.getOriginNodesDistances());
    }
    getOriginNodesDistances(): capnp.List<number> {
        return __S.getList(6, capnp.Int16List, this);
    }
    hasOriginNodesDistances(): boolean {
        return !__S.isNull(__S.getPointer(6, this));
    }
    initOriginNodesDistances(length: number): capnp.List<number> {
        return __S.initList(6, capnp.Int16List, length, this);
    }
    setOriginNodesDistances(value: capnp.List<number>): void {
        __S.copyFrom(value, __S.getPointer(6, this));
    }
    adoptDestinationNodesUuids(value: capnp.Orphan<capnp.List<string>>): void {
        __S.adopt(value, __S.getPointer(7, this));
    }
    disownDestinationNodesUuids(): capnp.Orphan<capnp.List<string>> {
        return __S.disown(this.getDestinationNodesUuids());
    }
    getDestinationNodesUuids(): capnp.List<string> {
        return __S.getList(7, capnp.TextList, this);
    }
    hasDestinationNodesUuids(): boolean {
        return !__S.isNull(__S.getPointer(7, this));
    }
    initDestinationNodesUuids(length: number): capnp.List<string> {
        return __S.initList(7, capnp.TextList, length, this);
    }
    setDestinationNodesUuids(value: capnp.List<string>): void {
        __S.copyFrom(value, __S.getPointer(7, this));
    }
    adoptDestinationNodesTravelTimes(value: capnp.Orphan<capnp.List<number>>): void {
        __S.adopt(value, __S.getPointer(8, this));
    }
    disownDestinationNodesTravelTimes(): capnp.Orphan<capnp.List<number>> {
        return __S.disown(this.getDestinationNodesTravelTimes());
    }
    getDestinationNodesTravelTimes(): capnp.List<number> {
        return __S.getList(8, capnp.Int16List, this);
    }
    hasDestinationNodesTravelTimes(): boolean {
        return !__S.isNull(__S.getPointer(8, this));
    }
    initDestinationNodesTravelTimes(length: number): capnp.List<number> {
        return __S.initList(8, capnp.Int16List, length, this);
    }
    setDestinationNodesTravelTimes(value: capnp.List<number>): void {
        __S.copyFrom(value, __S.getPointer(8, this));
    }
    adoptDestinationNodesDistances(value: capnp.Orphan<capnp.List<number>>): void {
        __S.adopt(value, __S.getPointer(9, this));
    }
    disownDestinationNodesDistances(): capnp.Orphan<capnp.List<number>> {
        return __S.disown(this.getDestinationNodesDistances());
    }
    getDestinationNodesDistances(): capnp.List<number> {
        return __S.getList(9, capnp.Int16List, this);
    }
    hasDestinationNodesDistances(): boolean {
        return !__S.isNull(__S.getPointer(9, this));
    }
    initDestinationNodesDistances(length: number): capnp.List<number> {
        return __S.initList(9, capnp.Int16List, length, this);
    }
    setDestinationNodesDistances(value: capnp.List<number>): void {
        __S.copyFrom(value, __S.getPointer(9, this));
    }
    getInternalId(): string {
        return __S.getText(10, this);
    }
    setInternalId(value: string): void {
        __S.setText(10, value, this);
    }
    getData(): string {
        return __S.getText(11, this);
    }
    setData(value: string): void {
        __S.setText(11, value, this);
    }
    getIsFrozen(): number {
        return __S.getInt8(34, this);
    }
    setIsFrozen(value: number): void {
        __S.setInt8(34, value, this);
    }
    toString(): string {
        return 'OdTrip_' + super.toString();
    }
}
