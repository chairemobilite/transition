/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import _isNumber from 'lodash/isNumber';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import { ObjectWithHistory } from 'chaire-lib-common/lib/utils/objects/ObjectWithHistory';
import { GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import TransitPath from '../path/Path';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { timeStrToSecondsSinceMidnight } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import Saveable from 'chaire-lib-common/lib/utils/objects/Saveable';
import SaveUtils from 'chaire-lib-common/lib/services/objects/SaveUtils';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';

const DEFAULT_RETURN_INTERVAL_SECONDS = 720;

export interface SchedulePeriodTrip extends GenericAttributes {
    schedule_period_id?: number;
    path_id: string;
    unit_id?: string;
    block_id?: string;
    departure_time_seconds: number;
    arrival_time_seconds: number;
    seated_capacity?: number;
    total_capacity?: number;
    node_arrival_times_seconds: number[];
    node_departure_times_seconds: number[];
    nodes_can_board: boolean[];
    nodes_can_unboard: boolean[];
}

export interface SchedulePeriod extends GenericAttributes {
    schedule_id?: number;
    outbound_path_id?: string;
    inbound_path_id?: string;
    period_shortname?: string;
    interval_seconds?: number;
    inbound_interval_seconds?: number; 
    number_of_units?: number;
    calculated_interval_seconds?: number;
    calculated_number_of_units?: number;
    start_at_hour: number;
    end_at_hour: number;
    // FIXME: Use seconds since midnight format instead of string, which can be anything
    custom_start_at_str?: string;
    custom_end_at_str?: string;
    trips: SchedulePeriodTrip[];
}

export interface ScheduleAttributes extends GenericAttributes {
    line_id: string;
    service_id: string;
    periods_group_shortname?: string;
    allow_seconds_based_schedules?: boolean;
    // TODO Create classes for periods and trips
    periods: SchedulePeriod[];
}

interface BusUnit {
    id: number;
    totalCapacity: number;
    seatedCapacity: number;
    currentLocation: 'origin' | 'destination' | 'in_transit';
    expectedArrivalTime: number; // Quand le bus arrivera à destination
    expectedReturnTime: number | null; // Quand le bus sera de retour au point de départ
    direction: 'outbound' | 'inbound' | null;
    lastTripEndTime: number | null;
}

class Schedule extends ObjectWithHistory<ScheduleAttributes> implements Saveable {
    protected static displayName = 'Schedule';
    private _collectionManager: CollectionManager;

    constructor(attributes = {}, isNew: boolean, collectionManager?) {
        super(attributes, isNew);
        this._collectionManager = collectionManager ? collectionManager : serviceLocator.collectionManager;
    }

    protected _prepareAttributes(attributes: Partial<ScheduleAttributes>) {
        if (_isBlank(attributes.allow_seconds_based_schedules)) {
            attributes.allow_seconds_based_schedules = false;
        }
        if (!attributes.periods) {
            attributes.periods = [];
        }
        return super._prepareAttributes(attributes);
    }

    static symbol() {
        return 'O';
    }

    validate() {
        super.validate();
        this.errors = [];
        if (!this.getAttributes().service_id) {
            this._isValid = false;
            this.errors.push('transit:transitSchedule:errors:ServiceIsRequired');
        }
        if (!this.getAttributes().periods_group_shortname) {
            this._isValid = false;
            this.errors.push('transit:transitSchedule:errors:PeriodsGroupIsRequired');
        }
        const periods = this.getAttributes().periods;
        for (let i = 0, count = periods.length; i < count; i++) {
            const period = periods[i];
            if (period.interval_seconds && period.number_of_units) {
                this._isValid = false;
                this.errors.push('transit:transitSchedule:errors:ChooseIntervalOrNumberOfUnits');
                break;
            }
        }
        return this._isValid;
    }

    getClonedAttributes(deleteSpecifics = true): Partial<ScheduleAttributes> {
        const clonedAttributes = super.getClonedAttributes(deleteSpecifics);
        if (deleteSpecifics) {
            delete clonedAttributes.integer_id;
            const periods = clonedAttributes.periods;
            if (periods) {
                for (let i = 0; i < periods.length; i++) {
                    const period = periods[i] as Partial<SchedulePeriod>;
                    delete period.id;
                    delete period.integer_id;
                    delete period.schedule_id;
                    delete period.created_at;
                    delete period.updated_at;
                    const trips = period.trips;
                    if (trips) {
                        for (let j = 0; j < trips.length; j++) {
                            const trip = trips[j] as Partial<SchedulePeriodTrip>;
                            delete trip.id;
                            delete trip.integer_id;
                            delete trip.schedule_period_id;
                            delete trip.created_at;
                            delete trip.updated_at;
                        }
                    }
                }
            }
        }
        return clonedAttributes;
    }

    getRequiredFleetForPeriod(periodShortname: string) {
        // todo
        const period = this.getPeriod(periodShortname);
        if (period) {
            const trips = period.trips;
            if (trips && trips.length > 0) {
                for (let i = 0, count = trips.length; i < count - 1; i++) {
                    const trip = trips[i];
                    const nextTrip = trips[i + 1];
                    if (trip && nextTrip) {
                        //const path =
                        //const deadHeadTravelTimeBetweenTrips = await
                        //const intervalSeconds = nextTrip.
                    }
                }
            }
        } else {
            return null;
        }
    }

    getAssociatedPathIds(): string[] {
        const associatedPathIds: { [pathId: string]: boolean } = {};

        const periods = this.getAttributes().periods;
        for (let i = 0, countI = periods.length; i < countI; i++) {
            const period = periods[i];
            period.trips.forEach((trip) => (associatedPathIds[trip.path_id] = true));
        }

        return Object.keys(associatedPathIds);
    }

    getPeriod(periodShortname: string) {
        const periods = this.getAttributes().periods;
        const index = Schedule.getPeriodIndex(periodShortname, periods);
        return index === null ? null : periods[index];
    }

    static getPeriodIndex(periodShortname: string, periods: any[]): number | null {
        for (let i = 0, countI = periods.length; i < countI; i++) {
            if (periods[i].shortname === periodShortname || periods[i].period_shortname === periodShortname) {
                return i;
            }
        }
        return null;
    }

    private updateBusAvailability(unit: BusUnit, currentTimeSeconds: number): void {
        if (unit.expectedArrivalTime <= currentTimeSeconds) {
            if (unit.direction === 'outbound') {
                unit.currentLocation = 'destination';
                unit.direction = null;
                unit.lastTripEndTime = currentTimeSeconds;
            } else if (unit.direction === 'inbound') {
                unit.currentLocation = 'origin';
                unit.direction = null;
                unit.lastTripEndTime = currentTimeSeconds;
            }
        }
        
        console.log(`🚌 Bus ${unit.id} - Position: ${unit.currentLocation}, Direction: ${unit.direction}, Arrivée prévue: ${new Date(unit.expectedArrivalTime * 1000).toISOString().substr(11, 8)}`);
    }
    // TODO Type the directions somewhere
    private getNextAvailableUnit(
        units: BusUnit[], 
        direction: 'outbound' | 'inbound', 
        timeSeconds: number,
        tripDuration: number
    ): BusUnit | null {
        // Filtrer les bus disponibles selon leur position et direction
        const availableBuses = units.filter(unit => {
            if (direction === 'outbound') {
                return unit.currentLocation === 'origin' && unit.direction === null;
            } else {
                return unit.currentLocation === 'destination' && unit.direction === null;
            }
        });
        
        // Trier par dernier temps d'utilisation
        availableBuses.sort((a, b) => {
            // Gérer les null comme "toujours disponibles" en les plaçant en fin de liste
            const aTime = a.lastTripEndTime ?? Infinity; 
            const bTime = b.lastTripEndTime ?? Infinity;
            return aTime - bTime; // Tri ASC pour prioriser les bus disponibles le plus tôt
        });
        
        if (availableBuses.length > 0) {
            const selectedBus = availableBuses[0];
            selectedBus.direction = direction;
            selectedBus.currentLocation = 'in_transit';
            selectedBus.expectedArrivalTime = timeSeconds + tripDuration;
            
            return selectedBus;
        }
        
        return null;
    }
    static getPeriodsGroupsChoices(periodsGroups, language) {
        const periodsGroupChoices: any[] = [];
        for (const periodsGroupShortname in periodsGroups) {
            const periodsGroup = periodsGroups[periodsGroupShortname];
            if (periodsGroup) {
                periodsGroupChoices.push({
                    value: periodsGroupShortname,
                    label: periodsGroup.name[language] || periodsGroupShortname
                });
            }
        }
        return periodsGroupChoices;
    }

    static getPeriodsChoices(periods, language) {
        const periodsChoices: any[] = [];
        if (periods && periods.length > 0) {
            periods.forEach((period) => {
                periodsChoices.push({
                    value: period.shortname,
                    label: period.name[language]
                });
            });
        }
        return periodsChoices;
    }
    private findBestBus(currentTime: number, direction: 'outbound' | 'inbound', units: BusUnit[]): BusUnit | null {
        // Séparer les bus en deux catégories : déjà en service et nouveaux
        const availableBuses = units.filter(unit => {
            const correctLocation = direction === 'outbound' 
                ? unit.currentLocation === 'origin'
                : unit.currentLocation === 'destination';
            const isAvailable = unit.direction === null;
            const isReady = unit.lastTripEndTime === null || currentTime >= unit.lastTripEndTime;
            return correctLocation && isAvailable && isReady;
        });
    
        // Séparer les bus en "déjà utilisés" et "jamais utilisés"
        const usedBuses = availableBuses.filter(bus => bus.lastTripEndTime !== null);
        const unusedBuses = availableBuses.filter(bus => bus.lastTripEndTime === null);
    
        // D'abord, essayer de trouver un bus déjà utilisé
        if (usedBuses.length > 0) {
            // Trier par dernier temps d'utilisation pour prendre le bus qui a fini le plus tôt
            return usedBuses.sort((a, b) => 
                (a.lastTripEndTime || 0) - (b.lastTripEndTime || 0)
            )[0];
        }
    
        // Si aucun bus déjà utilisé n'est disponible, prendre un nouveau bus
        return unusedBuses[0] || null;
    }

    private processOutboundDeparture(
        currentTime: number,
        outboundTotalTimeSeconds: number,
        units: BusUnit[],
        outboundPath: TransitPath,
        trips: any[]
    ) {
        const bus = this.findBestBus(currentTime, 'outbound', units);
        if (bus) {
            const trip = this.generateTrip(
                currentTime,
                bus,
                outboundPath,
                outboundPath.getAttributes().data.segments,
                outboundPath.getAttributes().nodes,
                outboundPath.getData('dwellTimeSeconds')
            );
            trips.push(trip);
            bus.direction = 'outbound';
            bus.currentLocation = 'in_transit';
            bus.expectedArrivalTime = currentTime + outboundTotalTimeSeconds;
            console.log(`🚍 [ALLER] Bus ${bus.id} - Départ: ${new Date(currentTime * 1000).toISOString().substr(11, 8)}`);
        } else {
            console.log(`⚠️ Pas de bus disponible pour le départ ALLER de ${new Date(currentTime * 1000).toISOString().substr(11, 8)}`);
        }
    }

    private processInboundDeparture(
        currentTime: number,
        inboundTotalTimeSeconds: number,
        units: BusUnit[],
        inboundPath: TransitPath,
        trips: any[]
    ) {
        const bus = this.findBestBus(currentTime, 'inbound', units);
        if (bus) {
            const trip = this.generateTrip(
                currentTime,
                bus,
                inboundPath,
                inboundPath.getAttributes().data.segments,
                inboundPath.getAttributes().nodes,
                inboundPath.getData('dwellTimeSeconds')
            );
            trips.push(trip);
            bus.direction = 'inbound';
            bus.currentLocation = 'in_transit';
            bus.expectedArrivalTime = currentTime + inboundTotalTimeSeconds;
            console.log(`🚍 [RETOUR] Bus ${bus.id} - Départ: ${new Date(currentTime * 1000).toISOString().substr(11, 8)}`);
        } else {
            console.log(`⚠️ Pas de bus disponible pour le départ RETOUR de ${new Date(currentTime * 1000).toISOString().substr(11, 8)}`);
        }
    }

    private generateTrips(
        startAtSecondsSinceMidnight: number,
        endAtSecondsSinceMidnight: number,
        outboundIntervalSeconds: number | null,
        inboundIntervalSeconds: number | null,
        outboundTotalTimeSeconds: number,
        inboundTotalTimeSeconds: number,
        units: BusUnit[],
        outboundPath: TransitPath,
        inboundPath?: TransitPath
    ) {
        const trips: any[] = [];
        const unitsCount = units.length;
        const outboundDepartures: number[] = [];
        const inboundDepartures: number[] = [];
        const usedBusIds = new Set<number>(); 
    
        console.log(`🔄 Temps de cycle (aller + retour) : ${outboundTotalTimeSeconds + inboundTotalTimeSeconds} secondes`);
    
        if (outboundIntervalSeconds !== null && inboundIntervalSeconds!== null && inboundIntervalSeconds!== 0 ) {
   // Générer les horaires de départ
   for (let time = startAtSecondsSinceMidnight; time < endAtSecondsSinceMidnight; time += outboundIntervalSeconds!) {
    outboundDepartures.push(time);
}
for (let time = startAtSecondsSinceMidnight + outboundTotalTimeSeconds; time < endAtSecondsSinceMidnight; time += inboundIntervalSeconds!) {
    inboundDepartures.push(time);
}

// Traiter les départs
while (outboundDepartures.length > 0 || inboundDepartures.length > 0) {
    const nextOutbound = outboundDepartures[0] || Infinity;
    const nextInbound = inboundDepartures[0] || Infinity;
    const currentTime = Math.min(nextOutbound, nextInbound);

    // Mettre à jour l'état des bus
    units.forEach(unit => this.updateBusAvailability(unit, currentTime));

    // Traiter les départs simultanés
    if (nextOutbound === currentTime && nextInbound === currentTime) {
        if (outboundIntervalSeconds! <= inboundIntervalSeconds!) {
            outboundDepartures.shift();
            this.processOutboundDeparture(currentTime, outboundTotalTimeSeconds, units, outboundPath, trips);
        } else {
            inboundDepartures.shift();
            if (inboundPath) {
                this.processInboundDeparture(currentTime, inboundTotalTimeSeconds, units, inboundPath, trips);
            }
        }
    } else {
        // Traiter les départs normaux
        if (currentTime === nextOutbound) {
            outboundDepartures.shift();
            this.processOutboundDeparture(currentTime, outboundTotalTimeSeconds, units, outboundPath, trips);
        }
        if (currentTime === nextInbound && inboundPath) {
            inboundDepartures.shift();
            this.processInboundDeparture(currentTime, inboundTotalTimeSeconds, units, inboundPath, trips);
        }
    }
}
        } else {
            // Gestion du cas où seul le nombre de bus est spécifié
            console.log(`🚌 Génération des trajets avec nombre de bus spécifié : ${unitsCount} bus`);
            const cycleTimeSeconds = outboundTotalTimeSeconds + inboundTotalTimeSeconds;
    
            // Pour chaque bus, initialiser le temps dans le cycle
            for (let i = 0; i < unitsCount; i++) {
                const unit = units[i];
                const timeInCycle = Math.ceil((i * cycleTimeSeconds) / unitsCount);
                unit.expectedArrivalTime = startAtSecondsSinceMidnight + timeInCycle;
                console.log(`🚍 Bus ID ${unit.id} initialisé avec un temps de cycle de ${timeInCycle} secondes`);
            }
    
            // Génération des trajets basée sur le temps de cycle
            for (let timeSoFar = startAtSecondsSinceMidnight; timeSoFar < endAtSecondsSinceMidnight; timeSoFar++) {
                units.forEach(unit => {
                    this.updateBusAvailability(unit, timeSoFar);
                    
                    if (unit.currentLocation === 'origin' && unit.direction === null) {
                        // Générer un trajet aller
                        const trip = this.generateTrip(
                            timeSoFar,
                            unit,
                            outboundPath,
                            outboundPath.getAttributes().data.segments,
                            outboundPath.getAttributes().nodes,
                            outboundPath.getData('dwellTimeSeconds')
                        );
                        trips.push(trip);
                        unit.direction = 'outbound';
                        unit.expectedArrivalTime = timeSoFar + outboundTotalTimeSeconds;
                    } else if (inboundPath && unit.currentLocation === 'destination' && unit.direction === null) {
                        // Générer un trajet retour
                        const trip = this.generateTrip(
                            timeSoFar,
                            unit,
                            inboundPath,
                            inboundPath.getAttributes().data.segments || undefined,
                            inboundPath.getAttributes().nodes as string[],
                            inboundPath.getAttributes().data.dwellTimeSeconds || undefined
                        );
                        trips.push(trip);
                        unit.direction = 'inbound';
                        unit.expectedArrivalTime = timeSoFar + inboundTotalTimeSeconds;
                        unit.expectedReturnTime = timeSoFar + inboundTotalTimeSeconds;
                    }
                });
            }
        }
    
        trips.forEach(trip => {
            if (trip.unit_id) {
                usedBusIds.add(trip.unit_id);
            }
        });
        console.log(`🚍 Nombre réel de bus utilisés: ${usedBusIds.size}`);
        return trips;
    }

    tripsCount() {
        let tripsCount = 0;
        const periods = this.attributes.periods;
        for (let i = 0, countI = periods.length; i < countI; i++) {
            if (periods[i].trips) {
                tripsCount += periods[i].trips.length;
            }
        }
        return tripsCount;
    }

    private generateTrip(
        tripStartAtSeconds: number,
        unit: BusUnit,
        path: TransitPath,
        segments,
        nodes: string[],
        dwellTimes,
        blockId = null
    ) {
        try {
            const tripArrivalTimesSeconds: (number | null)[] = [];
            const tripDepartureTimesSeconds: (number | null)[] = [];
            const canBoards: boolean[] = [];
            const canUnboards: boolean[] = [];
            const nodesCount = nodes.length;
            let tripTimeSoFar = tripStartAtSeconds;
    
            for (let i = 0; i < nodesCount; i++) {
                const segment = segments[i];
                const dwellTimeSeconds = dwellTimes[i];
                if (i > 0) {
                    tripArrivalTimesSeconds.push(tripTimeSoFar);
                    canUnboards.push(true);
                    if (i === nodesCount - 1) {
                        tripDepartureTimesSeconds.push(null);
                        canBoards.push(false);
                    }
                }
                if (i < nodesCount - 1) {
                    tripTimeSoFar += dwellTimeSeconds;
                    tripDepartureTimesSeconds.push(tripTimeSoFar);
                    tripTimeSoFar += segment.travelTimeSeconds;
                    canBoards.push(true);
                    if (i === 0) {
                        tripArrivalTimesSeconds.push(null);
                        canUnboards.push(false);
                    }
                }
            }
    
            const trip = {
                id: uuidV4(),
                path_id: path.get('id'),
                departure_time_seconds: tripStartAtSeconds,
                arrival_time_seconds: tripTimeSoFar,
                node_arrival_times_seconds: tripArrivalTimesSeconds,
                node_departure_times_seconds: tripDepartureTimesSeconds,
                nodes_can_board: canBoards,
                nodes_can_unboard: canUnboards,
                block_id: blockId,
                total_capacity: unit.totalCapacity,
                seated_capacity: unit.seatedCapacity,
                unit_id: unit.id,
                // Adapter les propriétés pour la nouvelle structure BusUnit
                unitDirection: unit.direction,
                unitReadyAt: unit.expectedReturnTime || unit.expectedArrivalTime
            };
            return trip;
        } catch {
            throw `The path ${path.getId()} for line ${path.getLine()?.getAttributes().shortname} (${
                path.attributes.line_id
            }) is not valid. Please recalculate routing for this path`;
        }
    }

    private generateForPeriodFunction(periodShortname: string): Status.Status<SchedulePeriodTrip[]> {
        const period = this.getPeriod(periodShortname);
        if (!period) {
            return Status.createError(`Period ${periodShortname} does not exist`);
        }
    
        // 📌 Récupération des intervalles (aller et retour) et du nombre de bus
        const outboundIntervalSeconds = period.interval_seconds;
        let inboundIntervalSeconds = period.inbound_interval_seconds ?? DEFAULT_RETURN_INTERVAL_SECONDS;
        const numberOfUnits = period.number_of_units;
    
        if (!this._collectionManager.get('lines') || !this._collectionManager.get('paths')) {
            console.log('❌ Erreur: Collections de lignes et/ou de trajets manquantes');
            return Status.createError('missing lines and/or paths collections');
        }
    
        if ((_isBlank(outboundIntervalSeconds) || _isBlank(inboundIntervalSeconds)) && _isBlank(numberOfUnits)) {
            console.log('❌ Erreur: Aucun intervalle ou nombre d’unités spécifié');
            return Status.createError('missing intervals or number of units');
        }
    
        // 📌 Récupération des chemins
        const outboundPathId = period.outbound_path_id;
        if (_isBlank(outboundPathId)) {
            console.log('❌ Erreur: ID du trajet aller manquant');
            return Status.createError('missing outbound path id');
        }
    
        const outboundPath = new TransitPath(
            this._collectionManager.get('paths').getById(outboundPathId as string).properties,
            false,
            this._collectionManager
        );
    
        const inboundPathId = period.inbound_path_id;
        const inboundPath = !_isBlank(inboundPathId)
            ? new TransitPath(
                this._collectionManager.get('paths').getById(inboundPathId as string).properties,
                false,
                this._collectionManager
            )
            : undefined;
    
        // 📌 Définition des heures de début et de fin
        const customStartAtStr = period.custom_start_at_str;
        const startAtSecondsSinceMidnight = customStartAtStr
            ? (timeStrToSecondsSinceMidnight(customStartAtStr) as number)
            : period.start_at_hour * 3600;
    
        const customEndAtStr = period.custom_end_at_str;
        const endAtSecondsSinceMidnight = customEndAtStr
            ? (timeStrToSecondsSinceMidnight(customEndAtStr) as number)
            : period.end_at_hour * 3600;
    
        // 📌 Calcul des durées des trajets (aller et retour)
        const outboundTotalTimeSeconds = outboundPath.getAttributes().data.operatingTimeWithLayoverTimeSeconds || 0;
        const inboundTotalTimeSeconds = inboundPath
            ? inboundPath.getAttributes().data.operatingTimeWithLayoverTimeSeconds || 0
            : 0;
    
        const cycleTimeSeconds = outboundTotalTimeSeconds + inboundTotalTimeSeconds;
    
        // 📌 Calcul du nombre optimal de bus requis
        let tripsIntervalSeconds: number | null = null;
        let tripsNumberOfUnits: number | null = null;
        let totalPeriod = -1;
    
        // Supprimer les valeurs précédentes
        delete period.calculated_interval_seconds;
        delete period.calculated_number_of_units;
    
        if (_isNumber(numberOfUnits)) {
            inboundIntervalSeconds = 0;
             // 📌 Ancien comportement : l'utilisateur spécifie le nombre de bus
             tripsNumberOfUnits = numberOfUnits;
             tripsIntervalSeconds = Math.ceil(cycleTimeSeconds / numberOfUnits);
     
             // Si les horaires ne sont pas basés sur les secondes, arrondir à la minute supérieure
             if (this.get('allow_seconds_based_schedules') !== true) {
                 tripsIntervalSeconds = Math.ceil(tripsIntervalSeconds / 60) * 60;
             }
     
             // Assigner l'intervalle calculé à period.calculated_interval_seconds
             period.calculated_interval_seconds = tripsIntervalSeconds;
             period.calculated_number_of_units = numberOfUnits;
     
             console.log(`📊 Intervalle calculé : ${tripsIntervalSeconds} secondes`);
        } else if (_isNumber(outboundIntervalSeconds) && _isNumber(inboundIntervalSeconds) ) {
            totalPeriod = endAtSecondsSinceMidnight - startAtSecondsSinceMidnight;
        
            // Calcul des unités nécessaires pour l'aller et le retour (en flottant)
            const outboundUnitsFloat = totalPeriod / outboundIntervalSeconds;
            const inboundUnitsFloat = totalPeriod / inboundIntervalSeconds;
        
            // Nombre de bus requis (entier)
            const outboundUnits = Math.ceil(outboundUnitsFloat);
            const inboundUnits = Math.ceil(inboundUnitsFloat);
            tripsNumberOfUnits = Math.max(outboundUnits, inboundUnits);
        
            // Assigner la valeur flottante à period.calculated_number_of_units
            period.calculated_number_of_units = Math.max(outboundUnitsFloat, inboundUnitsFloat);
        
            // Affichage des détails du calcul
            console.log(`📊 Détails du calcul des unités nécessaires :`);
            console.log(`🔹 Temps total de la période : ${totalPeriod} secondes`);
            console.log(`🔹 Intervalle ALLER : ${outboundIntervalSeconds} secondes`);
            console.log(`🔹 Intervalle RETOUR : ${inboundIntervalSeconds} secondes`);
            console.log(`🚍 Unités nécessaires pour l'ALLER (float) : ${outboundUnitsFloat}`);
            console.log(`🚍 Unités nécessaires pour le RETOUR (float) : ${inboundUnitsFloat}`);
            console.log(`✅ Nombre total de bus alloués (entier) : ${tripsNumberOfUnits}`);
            console.log(`📊 Nombre de bus calculé (float) : ${period.calculated_number_of_units}`);
        }
    
        if (tripsNumberOfUnits === null) {
            return Status.createOk([]);
        }
    
        console.log(`🚍 Bus nécessaires (TOTAL) : ${tripsNumberOfUnits}`);
    
        // 📌 Création des unités de bus
        const units: BusUnit[] = Array.from({ length: tripsNumberOfUnits }, (_, i) => ({
            id: i + 1,
            totalCapacity: 50,
            seatedCapacity: 20,
            currentLocation: 'origin',
            expectedArrivalTime: startAtSecondsSinceMidnight,
            expectedReturnTime: null,
            direction: null,
            lastTripEndTime: null
        }));
        // 📌 Génération des trajets en respectant les intervalles
        const trips = this.generateTrips(
            startAtSecondsSinceMidnight,
            endAtSecondsSinceMidnight,
            tripsIntervalSeconds ?? outboundIntervalSeconds!, // Utiliser l'intervalle calculé ou celui spécifié
            inboundIntervalSeconds ?? null, // Utiliser l'intervalle spécifié ou null
            outboundTotalTimeSeconds,
            inboundTotalTimeSeconds,
            units,
            outboundPath,
            inboundPath
        );
    
        period.trips = trips;
    
        console.log(`✅ Nombre total de trajets générés: ${trips.length}`);
        return Status.createOk(trips);
    }
    

    updateForAllPeriods() {
        // re-generate (after modifying path by instance)
        const periods = this.attributes.periods;
        for (let i = 0, countI = periods.length; i < countI; i++) {
            // TODO period_shortname can be undefined, fix typing to avoid this or add check
            this.generateForPeriodFunction(periods[i].period_shortname as string);
        }
    }

    generateForPeriod(periodShortname: string): { trips: SchedulePeriodTrip[] } {
        const resultStatus = this.generateForPeriodFunction(periodShortname);
        return { trips: Status.isStatusOk(resultStatus) ? Status.unwrap(resultStatus) : [] };
    }

    async delete(socket): Promise<Status.Status<{ id: string | undefined }>> {
        return SaveUtils.delete(this, socket, 'transitSchedule', undefined);
    }

    async save(socket) {
        return SaveUtils.save(this, socket, 'transitSchedule', undefined);
    }

    static getPluralName() {
        return 'schedules';
    }

    static getCapitalizedPluralName() {
        return 'Schedules';
    }

    static getDisplayName() {
        return Schedule.displayName;
    }
}

export default Schedule;