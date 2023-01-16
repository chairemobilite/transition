/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { DataBase } from './dataBase';

export interface OsmRawDataTypeIncoming {
    type: 'way' | 'relation' | 'node';
    id: string | number;
    tags?: { [key: string]: any };
    nodes?: number[];
    members?: { type: 'way' | 'relation' | 'node'; ref: number; [key: string]: any }[];
    [key: string]: any;
}

export interface OsmRawQueryOr {
    type?: 'way' | 'relation' | 'node';
    id?: string | number;
    tags?: { [key: string]: any };
    nodes?: number[];
    members?: { type: 'way' | 'relation' | 'node'; ref: number; [key: string]: any }[];
    [key: string]: any;
}

export interface OsmRawDataTypeBase {
    id: string | number;
    tags?: {
        entrance?: string[];
        ['routing:entrance']?: string[];
        [key: string]: string[] | undefined;
    };
}

export interface OsmRawDataTypeNode extends OsmRawDataTypeBase {
    type: 'node';
    lon: number;
    lat: number;
    [key: string]: any;
}

export interface OsmRawDataTypeWay extends OsmRawDataTypeBase {
    type: 'way';
    nodes?: number[];
    [key: string]: any;
}

export interface OsmRawDataTypeRelation extends OsmRawDataTypeBase {
    type: 'relation';
    members?: { type: 'way' | 'relation' | 'node'; ref: number; [key: string]: any }[];
    [key: string]: any;
}

export type OsmRawDataType = OsmRawDataTypeNode | OsmRawDataTypeWay | OsmRawDataTypeRelation;

class OsmNodesById {
    readonly nodes: { [id: string]: OsmRawDataTypeNode };
    readonly nodesWithTags: { [id: string]: OsmRawDataTypeNode };
    readonly nodesWithEntranceTags: { [id: string]: OsmRawDataTypeNode };
    constructor(osmData: DataOsmRaw) {
        const osmNodes = osmData.query({ type: 'node' });
        const nodes: { [id: string]: OsmRawDataTypeNode } = {};
        const nodesWithTags: { [id: string]: OsmRawDataTypeNode } = {};
        const nodesWithEntranceTags: { [id: string]: OsmRawDataTypeNode } = {};
        for (let i = 0, size = osmNodes.length; i < size; i++) {
            nodes[osmNodes[i].id] = osmNodes[i] as OsmRawDataTypeNode;
            if (osmNodes[i].tags && Object.keys(osmNodes[i].tags || {}).length > 0) {
                nodesWithTags[osmNodes[i].id] = osmNodes[i] as OsmRawDataTypeNode;
                if (osmNodes[i].tags?.entrance || osmNodes[i].tags?.['routing:entrance']) {
                    nodesWithEntranceTags[osmNodes[i].id] = osmNodes[i] as OsmRawDataTypeNode;
                }
            }
            if (i === 0 || (i + 1) % 1000 === 0 || i + 1 === size) {
                process.stdout.write(`  fetching node ${i + 1}/${size}                               \r`);
            }
        }
        this.nodes = nodes;
        this.nodesWithTags = nodesWithTags;
        this.nodesWithEntranceTags = nodesWithEntranceTags;
    }
}

class OsmWaysById {
    readonly ways: { [id: string]: OsmRawDataTypeWay };
    constructor(osmData: DataOsmRaw) {
        const osmWays = osmData.query({ type: 'way' });
        const ways: { [id: string]: OsmRawDataTypeWay } = {};
        for (let i = 0, size = osmWays.length; i < size; i++) {
            ways[osmWays[i].id] = osmWays[i] as OsmRawDataTypeWay;
            process.stdout.write(`  fetching way ${i + 1}/${size}                             \r`);
        }
        this.ways = ways;
    }
}

class OsmRelationsById {
    readonly relations: { [id: string]: OsmRawDataTypeRelation };
    constructor(osmData: DataOsmRaw) {
        const osmRelations = osmData.query({ type: 'relation' });
        const relations: { [id: string]: OsmRawDataTypeRelation } = {};
        for (let i = 0, size = osmRelations.length; i < size; i++) {
            relations[osmRelations[i].id] = osmRelations[i] as OsmRawDataTypeRelation;
            process.stdout.write(`  fetching relation ${i + 1}/${size}                               \r`);
        }
        this.relations = relations;
    }
}

class OsmWayIdsByRelationId {
    readonly wayIdsByRelationId: Map<string, string[]>;
    constructor(relationsById: OsmRelationsById) {
        this.wayIdsByRelationId = new Map();
        let i = 0;
        const size = Object.keys(relationsById.relations).length;
        for (const relationId in relationsById.relations) {
            const relationWayIds: any[] = [];
            const relationWays = relationsById.relations[relationId].members || [];
            for (let i = 0, size = relationWays.length; i < size; i++) {
                relationWayIds.push(relationWays[i].ref);
            }
            if (relationWayIds && relationWayIds.length > 0) {
                this.wayIdsByRelationId.set(relationId, relationWayIds);
            }
            process.stdout.write(`  fetching relation ways ${i + 1}/${size}                           \r`);
            i++;
        }
    }
}

class OsmDataIndex {
    readonly osmNodesById: OsmNodesById;
    readonly osmWaysById: OsmWaysById;
    readonly osmRelationsById: OsmRelationsById;
    readonly osmWayIdsByRelationId: OsmWayIdsByRelationId;
    constructor(osmData: DataOsmRaw) {
        this.osmNodesById = new OsmNodesById(osmData);
        this.osmWaysById = new OsmWaysById(osmData);
        this.osmRelationsById = new OsmRelationsById(osmData);
        this.osmWayIdsByRelationId = new OsmWayIdsByRelationId(this.osmRelationsById);
    }
    find(type: string, id: string): OsmRawDataType | undefined {
        if (type === 'node') {
            return this.osmNodesById.nodes[id];
        } else if (type === 'way') {
            return this.osmWaysById.ways[id];
        } else if (type === 'relation') {
            return this.osmRelationsById.relations[id];
        }
        return undefined;
    }
}

export class DataOsmRaw extends DataBase<OsmRawDataType> {
    private _data: OsmRawDataType[];
    private _index: OsmDataIndex | undefined = undefined;

    constructor(data: { elements: OsmRawDataTypeIncoming[] } | OsmRawDataTypeIncoming[]) {
        super();
        this._data = this.splitTags((data as any).elements ? (data as any).elements : [data]);
    }

    getIndex(): OsmDataIndex {
        if (this._index === undefined) {
            this._index = new OsmDataIndex(this);
        }
        return this._index;
    }

    protected objectMatches(element: OsmRawDataType, data: { [key: string]: any }): boolean {
        const matches = data.other ? super.innerObjectMatches(element, data.other) : true;
        if (matches && data.tags) {
            if (!element.tags) {
                return false;
            }
            return super.innerObjectMatches(element.tags, data.tags);
        }
        return matches;
    }

    protected getData(): OsmRawDataType[] {
        return this._data;
    }

    protected splitTags(elements: OsmRawDataTypeIncoming[]): OsmRawDataType[] {
        for (let i = 0, count = elements.length; i < count; i++) {
            const element = elements[i];
            if (element.tags) {
                for (const tag in element.tags) {
                    element.tags[tag] =
                        typeof element.tags[tag] === 'string'
                            ? (element.tags[tag] as string).split(';')
                            : [element.tags[tag]];
                }
            }
        }
        return elements as OsmRawDataType[];
    }

    public query(data: { [key: string]: any }, maxSize = -1): OsmRawDataType[] {
        const { tags, ...otherData } = data;
        const splitData = { tags, other: otherData };
        return this._query(splitData, this.objectMatches, maxSize);
    }

    public find(data: { [key: string]: any }): OsmRawDataType | undefined {
        const { tags, ...otherData } = data;
        const splitData = { tags, other: otherData };
        return this._find(splitData, this.objectMatches);
    }

    public queryOr(data: { [key: string]: any }[], maxSize = -1): OsmRawDataType[] {
        const splitData: { [key: string]: any }[] = [];
        data.forEach((d) => {
            const { tags, ...otherData } = d;
            splitData.push({ tags, other: otherData });
        });
        return this._queryOr(splitData, this.objectMatches, maxSize);
    }
}

export class DataFileOsmRaw extends DataOsmRaw {
    private _fileData: OsmRawDataType[] | undefined = undefined;
    private _fileManager: any;
    private _filename: string;

    constructor(filename: string, fileManager: any) {
        super([]);
        this._filename = filename;
        this._fileManager = fileManager;
    }

    protected getData(): OsmRawDataType[] {
        if (!this._fileData) {
            try {
                const jsonData = JSON.parse(this._fileManager.readFileAbsolute(this._filename));
                const elements: any[] = jsonData.elements;
                this._fileData = elements ? this.splitTags(elements) : [];
            } catch (error) {
                console.error('Error reading osm raw data file ' + this._filename, error);
            }
        }
        return this._fileData || [];
    }
}
