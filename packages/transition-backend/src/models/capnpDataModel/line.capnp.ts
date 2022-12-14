/* tslint:disable */

/**
 * This file has been automatically generated by the [capnpc-ts utility](https://github.com/jdiaz5513/capnp-ts).
 */

import * as capnp from 'capnp-ts';
import { ObjectSize as __O, Struct as __S } from 'capnp-ts';
export const _capnpFileId = 'd06a46d775e4e446';
export class Trip extends __S {
    static readonly _capnp = { displayName: 'Trip', id: 'aeeb93dd97609064', size: new __O(16, 7) };
    getUuid(): string {
        return __S.getText(0, this);
    }
    setUuid(value: string): void {
        __S.setText(0, value, this);
    }
    getPathUuid(): string {
        return __S.getText(1, this);
    }
    setPathUuid(value: string): void {
        __S.setText(1, value, this);
    }
    getDepartureTimeSeconds(): number {
        return __S.getInt32(0, this);
    }
    setDepartureTimeSeconds(value: number): void {
        __S.setInt32(0, value, this);
    }
    getArrivalTimeSeconds(): number {
        return __S.getInt32(4, this);
    }
    setArrivalTimeSeconds(value: number): void {
        __S.setInt32(4, value, this);
    }
    adoptNodeArrivalTimesSeconds(value: capnp.Orphan<capnp.List<number>>): void {
        __S.adopt(value, __S.getPointer(2, this));
    }
    disownNodeArrivalTimesSeconds(): capnp.Orphan<capnp.List<number>> {
        return __S.disown(this.getNodeArrivalTimesSeconds());
    }
    getNodeArrivalTimesSeconds(): capnp.List<number> {
        return __S.getList(2, capnp.Int32List, this);
    }
    hasNodeArrivalTimesSeconds(): boolean {
        return !__S.isNull(__S.getPointer(2, this));
    }
    initNodeArrivalTimesSeconds(length: number): capnp.List<number> {
        return __S.initList(2, capnp.Int32List, length, this);
    }
    setNodeArrivalTimesSeconds(value: capnp.List<number>): void {
        __S.copyFrom(value, __S.getPointer(2, this));
    }
    adoptNodeDepartureTimesSeconds(value: capnp.Orphan<capnp.List<number>>): void {
        __S.adopt(value, __S.getPointer(3, this));
    }
    disownNodeDepartureTimesSeconds(): capnp.Orphan<capnp.List<number>> {
        return __S.disown(this.getNodeDepartureTimesSeconds());
    }
    getNodeDepartureTimesSeconds(): capnp.List<number> {
        return __S.getList(3, capnp.Int32List, this);
    }
    hasNodeDepartureTimesSeconds(): boolean {
        return !__S.isNull(__S.getPointer(3, this));
    }
    initNodeDepartureTimesSeconds(length: number): capnp.List<number> {
        return __S.initList(3, capnp.Int32List, length, this);
    }
    setNodeDepartureTimesSeconds(value: capnp.List<number>): void {
        __S.copyFrom(value, __S.getPointer(3, this));
    }
    adoptNodesCanBoard(value: capnp.Orphan<capnp.List<number>>): void {
        __S.adopt(value, __S.getPointer(4, this));
    }
    disownNodesCanBoard(): capnp.Orphan<capnp.List<number>> {
        return __S.disown(this.getNodesCanBoard());
    }
    getNodesCanBoard(): capnp.List<number> {
        return __S.getList(4, capnp.Int8List, this);
    }
    hasNodesCanBoard(): boolean {
        return !__S.isNull(__S.getPointer(4, this));
    }
    initNodesCanBoard(length: number): capnp.List<number> {
        return __S.initList(4, capnp.Int8List, length, this);
    }
    setNodesCanBoard(value: capnp.List<number>): void {
        __S.copyFrom(value, __S.getPointer(4, this));
    }
    adoptNodesCanUnboard(value: capnp.Orphan<capnp.List<number>>): void {
        __S.adopt(value, __S.getPointer(5, this));
    }
    disownNodesCanUnboard(): capnp.Orphan<capnp.List<number>> {
        return __S.disown(this.getNodesCanUnboard());
    }
    getNodesCanUnboard(): capnp.List<number> {
        return __S.getList(5, capnp.Int8List, this);
    }
    hasNodesCanUnboard(): boolean {
        return !__S.isNull(__S.getPointer(5, this));
    }
    initNodesCanUnboard(length: number): capnp.List<number> {
        return __S.initList(5, capnp.Int8List, length, this);
    }
    setNodesCanUnboard(value: capnp.List<number>): void {
        __S.copyFrom(value, __S.getPointer(5, this));
    }
    getBlockUuid(): string {
        return __S.getText(6, this);
    }
    setBlockUuid(value: string): void {
        __S.setText(6, value, this);
    }
    getTotalCapacity(): number {
        return __S.getInt16(8, this);
    }
    setTotalCapacity(value: number): void {
        __S.setInt16(8, value, this);
    }
    getSeatedCapacity(): number {
        return __S.getInt16(10, this);
    }
    setSeatedCapacity(value: number): void {
        __S.setInt16(10, value, this);
    }
    getIsFrozen(): number {
        return __S.getInt8(12, this);
    }
    setIsFrozen(value: number): void {
        __S.setInt8(12, value, this);
    }
    toString(): string {
        return 'Trip_' + super.toString();
    }
}
export class Period extends __S {
    static readonly _capnp = { displayName: 'Period', id: 'ddeccfbefad43561', size: new __O(24, 5) };
    static _Trips: capnp.ListCtor<Trip>;
    getPeriodShortname(): string {
        return __S.getText(0, this);
    }
    setPeriodShortname(value: string): void {
        __S.setText(0, value, this);
    }
    getOutboundPathUuid(): string {
        return __S.getText(1, this);
    }
    setOutboundPathUuid(value: string): void {
        __S.setText(1, value, this);
    }
    getInboundPathUuid(): string {
        return __S.getText(2, this);
    }
    setInboundPathUuid(value: string): void {
        __S.setText(2, value, this);
    }
    getCustomStartAtSeconds(): number {
        return __S.getInt32(0, this);
    }
    setCustomStartAtSeconds(value: number): void {
        __S.setInt32(0, value, this);
    }
    getStartAtSeconds(): number {
        return __S.getInt32(4, this);
    }
    setStartAtSeconds(value: number): void {
        __S.setInt32(4, value, this);
    }
    getEndAtSeconds(): number {
        return __S.getInt32(8, this);
    }
    setEndAtSeconds(value: number): void {
        __S.setInt32(8, value, this);
    }
    getIntervalSeconds(): number {
        return __S.getInt16(12, this);
    }
    setIntervalSeconds(value: number): void {
        __S.setInt16(12, value, this);
    }
    getNumberOfUnits(): number {
        return __S.getInt16(14, this);
    }
    setNumberOfUnits(value: number): void {
        __S.setInt16(14, value, this);
    }
    adoptTrips(value: capnp.Orphan<capnp.List<Trip>>): void {
        __S.adopt(value, __S.getPointer(3, this));
    }
    disownTrips(): capnp.Orphan<capnp.List<Trip>> {
        return __S.disown(this.getTrips());
    }
    getTrips(): capnp.List<Trip> {
        return __S.getList(3, Period._Trips, this);
    }
    hasTrips(): boolean {
        return !__S.isNull(__S.getPointer(3, this));
    }
    initTrips(length: number): capnp.List<Trip> {
        return __S.initList(3, Period._Trips, length, this);
    }
    setTrips(value: capnp.List<Trip>): void {
        __S.copyFrom(value, __S.getPointer(3, this));
    }
    getIsFrozen(): number {
        return __S.getInt8(16, this);
    }
    setIsFrozen(value: number): void {
        __S.setInt8(16, value, this);
    }
    getCustomEndAtSeconds(): number {
        return __S.getInt32(20, this);
    }
    setCustomEndAtSeconds(value: number): void {
        __S.setInt32(20, value, this);
    }
    getUuid(): string {
        return __S.getText(4, this);
    }
    setUuid(value: string): void {
        __S.setText(4, value, this);
    }
    toString(): string {
        return 'Period_' + super.toString();
    }
}
export class Schedule extends __S {
    static readonly _capnp = { displayName: 'Schedule', id: 'fa89c34b8ef97103', size: new __O(8, 4) };
    static _Periods: capnp.ListCtor<Period>;
    getUuid(): string {
        return __S.getText(0, this);
    }
    setUuid(value: string): void {
        __S.setText(0, value, this);
    }
    getServiceUuid(): string {
        return __S.getText(1, this);
    }
    setServiceUuid(value: string): void {
        __S.setText(1, value, this);
    }
    getPeriodsGroupShortname(): string {
        return __S.getText(2, this);
    }
    setPeriodsGroupShortname(value: string): void {
        __S.setText(2, value, this);
    }
    adoptPeriods(value: capnp.Orphan<capnp.List<Period>>): void {
        __S.adopt(value, __S.getPointer(3, this));
    }
    disownPeriods(): capnp.Orphan<capnp.List<Period>> {
        return __S.disown(this.getPeriods());
    }
    getPeriods(): capnp.List<Period> {
        return __S.getList(3, Schedule._Periods, this);
    }
    hasPeriods(): boolean {
        return !__S.isNull(__S.getPointer(3, this));
    }
    initPeriods(length: number): capnp.List<Period> {
        return __S.initList(3, Schedule._Periods, length, this);
    }
    setPeriods(value: capnp.List<Period>): void {
        __S.copyFrom(value, __S.getPointer(3, this));
    }
    getAllowSecondsBasedSchedules(): number {
        return __S.getInt8(0, this);
    }
    setAllowSecondsBasedSchedules(value: number): void {
        __S.setInt8(0, value, this);
    }
    getIsFrozen(): number {
        return __S.getInt8(1, this);
    }
    setIsFrozen(value: number): void {
        __S.setInt8(1, value, this);
    }
    toString(): string {
        return 'Schedule_' + super.toString();
    }
}
export class Line extends __S {
    static readonly _capnp = { displayName: 'Line', id: 'c474ebe8d98c347e', size: new __O(8, 11) };
    static _Schedules: capnp.ListCtor<Schedule>;
    getUuid(): string {
        return __S.getText(0, this);
    }
    setUuid(value: string): void {
        __S.setText(0, value, this);
    }
    getInternalId(): string {
        return __S.getText(1, this);
    }
    setInternalId(value: string): void {
        __S.setText(1, value, this);
    }
    getMode(): string {
        return __S.getText(2, this);
    }
    setMode(value: string): void {
        __S.setText(2, value, this);
    }
    getCategory(): string {
        return __S.getText(3, this);
    }
    setCategory(value: string): void {
        __S.setText(3, value, this);
    }
    getAgencyUuid(): string {
        return __S.getText(4, this);
    }
    setAgencyUuid(value: string): void {
        __S.setText(4, value, this);
    }
    getShortname(): string {
        return __S.getText(5, this);
    }
    setShortname(value: string): void {
        __S.setText(5, value, this);
    }
    getLongname(): string {
        return __S.getText(6, this);
    }
    setLongname(value: string): void {
        __S.setText(6, value, this);
    }
    getColor(): string {
        return __S.getText(7, this);
    }
    setColor(value: string): void {
        __S.setText(7, value, this);
    }
    getIsEnabled(): number {
        return __S.getInt8(0, this);
    }
    setIsEnabled(value: number): void {
        __S.setInt8(0, value, this);
    }
    getDescription(): string {
        return __S.getText(8, this);
    }
    setDescription(value: string): void {
        __S.setText(8, value, this);
    }
    getData(): string {
        return __S.getText(9, this);
    }
    setData(value: string): void {
        __S.setText(9, value, this);
    }
    getIsAutonomous(): number {
        return __S.getInt8(1, this);
    }
    setIsAutonomous(value: number): void {
        __S.setInt8(1, value, this);
    }
    getAllowSameLineTransfers(): number {
        return __S.getInt8(2, this);
    }
    setAllowSameLineTransfers(value: number): void {
        __S.setInt8(2, value, this);
    }
    adoptSchedules(value: capnp.Orphan<capnp.List<Schedule>>): void {
        __S.adopt(value, __S.getPointer(10, this));
    }
    disownSchedules(): capnp.Orphan<capnp.List<Schedule>> {
        return __S.disown(this.getSchedules());
    }
    getSchedules(): capnp.List<Schedule> {
        return __S.getList(10, Line._Schedules, this);
    }
    hasSchedules(): boolean {
        return !__S.isNull(__S.getPointer(10, this));
    }
    initSchedules(length: number): capnp.List<Schedule> {
        return __S.initList(10, Line._Schedules, length, this);
    }
    setSchedules(value: capnp.List<Schedule>): void {
        __S.copyFrom(value, __S.getPointer(10, this));
    }
    getIsFrozen(): number {
        return __S.getInt8(3, this);
    }
    setIsFrozen(value: number): void {
        __S.setInt8(3, value, this);
    }
    toString(): string {
        return 'Line_' + super.toString();
    }
}
Period._Trips = capnp.CompositeList(Trip);
Schedule._Periods = capnp.CompositeList(Period);
Line._Schedules = capnp.CompositeList(Schedule);
