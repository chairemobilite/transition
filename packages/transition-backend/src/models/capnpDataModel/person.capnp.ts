/* tslint:disable */

/**
 * This file has been automatically generated by the [capnpc-ts utility](https://github.com/jdiaz5513/capnp-ts).
 */

import * as capnp from 'capnp-ts';
import { ObjectSize as __O, Struct as __S } from 'capnp-ts';
export const _capnpFileId = 'ff526f818562f0b2';
export enum Person_AgeGroup {
    NONE,
    AG0004,
    AG0509,
    AG1014,
    AG1519,
    AG2024,
    AG2529,
    AG3034,
    AG3539,
    AG4044,
    AG4549,
    AG5054,
    AG5559,
    AG6064,
    AG6569,
    AG7074,
    AG7579,
    AG8084,
    AG8589,
    AG9094,
    AG95PLUS,
    UNKNOWN
}
export enum Person_Gender {
    NONE,
    FEMALE,
    MALE,
    CUSTOM,
    UNKNOWN
}
export enum Person_Occupation {
    NONE,
    FULL_TIME_WORKER,
    PART_TIME_WORKER,
    FULL_TIME_STUDENT,
    PART_TIME_STUDENT,
    WORKER_AND_STUDENT,
    RETIRED,
    AT_HOME,
    OTHER,
    NON_APPLICABLE,
    UNKNOWN
}
export class Person extends __S {
    static readonly AgeGroup = Person_AgeGroup;
    static readonly Gender = Person_Gender;
    static readonly Occupation = Person_Occupation;
    static readonly _capnp = { displayName: 'Person', id: 'e900aec85ed9b47f', size: new __O(64, 11) };
    getUuid(): string {
        return __S.getText(0, this);
    }
    setUuid(value: string): void {
        __S.setText(0, value, this);
    }
    getDataSourceUuid(): string {
        return __S.getText(1, this);
    }
    setDataSourceUuid(value: string): void {
        __S.setText(1, value, this);
    }
    getHouseholdUuid(): string {
        return __S.getText(2, this);
    }
    setHouseholdUuid(value: string): void {
        __S.setText(2, value, this);
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
    getAge(): number {
        return __S.getInt16(8, this);
    }
    setAge(value: number): void {
        __S.setInt16(8, value, this);
    }
    getDrivingLicenseOwner(): number {
        return __S.getInt8(10, this);
    }
    setDrivingLicenseOwner(value: number): void {
        __S.setInt8(10, value, this);
    }
    getTransitPassOwner(): number {
        return __S.getInt8(11, this);
    }
    setTransitPassOwner(value: number): void {
        __S.setInt8(11, value, this);
    }
    getAgeGroup(): Person_AgeGroup {
        return __S.getUint16(12, this);
    }
    setAgeGroup(value: Person_AgeGroup): void {
        __S.setUint16(12, value, this);
    }
    getGender(): Person_Gender {
        return __S.getUint16(14, this);
    }
    setGender(value: Person_Gender): void {
        __S.setUint16(14, value, this);
    }
    getOccupation(): Person_Occupation {
        return __S.getUint16(16, this);
    }
    setOccupation(value: Person_Occupation): void {
        __S.setUint16(16, value, this);
    }
    getUsualWorkPlaceLatitude(): number {
        return __S.getInt32(20, this);
    }
    setUsualWorkPlaceLatitude(value: number): void {
        __S.setInt32(20, value, this);
    }
    getUsualWorkPlaceLongitude(): number {
        return __S.getInt32(24, this);
    }
    setUsualWorkPlaceLongitude(value: number): void {
        __S.setInt32(24, value, this);
    }
    getUsualSchoolPlaceLatitude(): number {
        return __S.getInt32(28, this);
    }
    setUsualSchoolPlaceLatitude(value: number): void {
        __S.setInt32(28, value, this);
    }
    getUsualSchoolPlaceLongitude(): number {
        return __S.getInt32(32, this);
    }
    setUsualSchoolPlaceLongitude(value: number): void {
        __S.setInt32(32, value, this);
    }
    adoptUsualWorkPlaceNodesUuids(value: capnp.Orphan<capnp.List<string>>): void {
        __S.adopt(value, __S.getPointer(3, this));
    }
    disownUsualWorkPlaceNodesUuids(): capnp.Orphan<capnp.List<string>> {
        return __S.disown(this.getUsualWorkPlaceNodesUuids());
    }
    getUsualWorkPlaceNodesUuids(): capnp.List<string> {
        return __S.getList(3, capnp.TextList, this);
    }
    hasUsualWorkPlaceNodesUuids(): boolean {
        return !__S.isNull(__S.getPointer(3, this));
    }
    initUsualWorkPlaceNodesUuids(length: number): capnp.List<string> {
        return __S.initList(3, capnp.TextList, length, this);
    }
    setUsualWorkPlaceNodesUuids(value: capnp.List<string>): void {
        __S.copyFrom(value, __S.getPointer(3, this));
    }
    adoptUsualWorkPlaceNodesTravelTimes(value: capnp.Orphan<capnp.List<number>>): void {
        __S.adopt(value, __S.getPointer(4, this));
    }
    disownUsualWorkPlaceNodesTravelTimes(): capnp.Orphan<capnp.List<number>> {
        return __S.disown(this.getUsualWorkPlaceNodesTravelTimes());
    }
    getUsualWorkPlaceNodesTravelTimes(): capnp.List<number> {
        return __S.getList(4, capnp.Int16List, this);
    }
    hasUsualWorkPlaceNodesTravelTimes(): boolean {
        return !__S.isNull(__S.getPointer(4, this));
    }
    initUsualWorkPlaceNodesTravelTimes(length: number): capnp.List<number> {
        return __S.initList(4, capnp.Int16List, length, this);
    }
    setUsualWorkPlaceNodesTravelTimes(value: capnp.List<number>): void {
        __S.copyFrom(value, __S.getPointer(4, this));
    }
    adoptUsualWorkPlaceNodesDistances(value: capnp.Orphan<capnp.List<number>>): void {
        __S.adopt(value, __S.getPointer(5, this));
    }
    disownUsualWorkPlaceNodesDistances(): capnp.Orphan<capnp.List<number>> {
        return __S.disown(this.getUsualWorkPlaceNodesDistances());
    }
    getUsualWorkPlaceNodesDistances(): capnp.List<number> {
        return __S.getList(5, capnp.Int16List, this);
    }
    hasUsualWorkPlaceNodesDistances(): boolean {
        return !__S.isNull(__S.getPointer(5, this));
    }
    initUsualWorkPlaceNodesDistances(length: number): capnp.List<number> {
        return __S.initList(5, capnp.Int16List, length, this);
    }
    setUsualWorkPlaceNodesDistances(value: capnp.List<number>): void {
        __S.copyFrom(value, __S.getPointer(5, this));
    }
    adoptUsualSchoolPlaceNodesUuids(value: capnp.Orphan<capnp.List<string>>): void {
        __S.adopt(value, __S.getPointer(6, this));
    }
    disownUsualSchoolPlaceNodesUuids(): capnp.Orphan<capnp.List<string>> {
        return __S.disown(this.getUsualSchoolPlaceNodesUuids());
    }
    getUsualSchoolPlaceNodesUuids(): capnp.List<string> {
        return __S.getList(6, capnp.TextList, this);
    }
    hasUsualSchoolPlaceNodesUuids(): boolean {
        return !__S.isNull(__S.getPointer(6, this));
    }
    initUsualSchoolPlaceNodesUuids(length: number): capnp.List<string> {
        return __S.initList(6, capnp.TextList, length, this);
    }
    setUsualSchoolPlaceNodesUuids(value: capnp.List<string>): void {
        __S.copyFrom(value, __S.getPointer(6, this));
    }
    adoptUsualSchoolPlaceNodesTravelTimes(value: capnp.Orphan<capnp.List<number>>): void {
        __S.adopt(value, __S.getPointer(7, this));
    }
    disownUsualSchoolPlaceNodesTravelTimes(): capnp.Orphan<capnp.List<number>> {
        return __S.disown(this.getUsualSchoolPlaceNodesTravelTimes());
    }
    getUsualSchoolPlaceNodesTravelTimes(): capnp.List<number> {
        return __S.getList(7, capnp.Int16List, this);
    }
    hasUsualSchoolPlaceNodesTravelTimes(): boolean {
        return !__S.isNull(__S.getPointer(7, this));
    }
    initUsualSchoolPlaceNodesTravelTimes(length: number): capnp.List<number> {
        return __S.initList(7, capnp.Int16List, length, this);
    }
    setUsualSchoolPlaceNodesTravelTimes(value: capnp.List<number>): void {
        __S.copyFrom(value, __S.getPointer(7, this));
    }
    adoptUsualSchoolPlaceNodesDistances(value: capnp.Orphan<capnp.List<number>>): void {
        __S.adopt(value, __S.getPointer(8, this));
    }
    disownUsualSchoolPlaceNodesDistances(): capnp.Orphan<capnp.List<number>> {
        return __S.disown(this.getUsualSchoolPlaceNodesDistances());
    }
    getUsualSchoolPlaceNodesDistances(): capnp.List<number> {
        return __S.getList(8, capnp.Int16List, this);
    }
    hasUsualSchoolPlaceNodesDistances(): boolean {
        return !__S.isNull(__S.getPointer(8, this));
    }
    initUsualSchoolPlaceNodesDistances(length: number): capnp.List<number> {
        return __S.initList(8, capnp.Int16List, length, this);
    }
    setUsualSchoolPlaceNodesDistances(value: capnp.List<number>): void {
        __S.copyFrom(value, __S.getPointer(8, this));
    }
    getInternalId(): string {
        return __S.getText(9, this);
    }
    setInternalId(value: string): void {
        __S.setText(9, value, this);
    }
    getData(): string {
        return __S.getText(10, this);
    }
    setData(value: string): void {
        __S.setText(10, value, this);
    }
    getIsFrozen(): number {
        return __S.getInt8(18, this);
    }
    setIsFrozen(value: number): void {
        __S.setInt8(18, value, this);
    }
    getUsualWorkPlaceWalkingTravelTimeSeconds(): number {
        return __S.getInt32(36, this);
    }
    setUsualWorkPlaceWalkingTravelTimeSeconds(value: number): void {
        __S.setInt32(36, value, this);
    }
    getUsualWorkPlaceCyclingTravelTimeSeconds(): number {
        return __S.getInt32(40, this);
    }
    setUsualWorkPlaceCyclingTravelTimeSeconds(value: number): void {
        __S.setInt32(40, value, this);
    }
    getUsualWorkPlaceDrivingTravelTimeSeconds(): number {
        return __S.getInt32(44, this);
    }
    setUsualWorkPlaceDrivingTravelTimeSeconds(value: number): void {
        __S.setInt32(44, value, this);
    }
    getUsualSchoolPlaceWalkingTravelTimeSeconds(): number {
        return __S.getInt32(48, this);
    }
    setUsualSchoolPlaceWalkingTravelTimeSeconds(value: number): void {
        __S.setInt32(48, value, this);
    }
    getUsualSchoolPlaceCyclingTravelTimeSeconds(): number {
        return __S.getInt32(52, this);
    }
    setUsualSchoolPlaceCyclingTravelTimeSeconds(value: number): void {
        __S.setInt32(52, value, this);
    }
    getUsualSchoolPlaceDrivingTravelTimeSeconds(): number {
        return __S.getInt32(56, this);
    }
    setUsualSchoolPlaceDrivingTravelTimeSeconds(value: number): void {
        __S.setInt32(56, value, this);
    }
    toString(): string {
        return 'Person_' + super.toString();
    }
}
