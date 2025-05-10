export namespace models {
	
	export class w_BM25Config {
	    b?: number;
	    k1?: number;
	
	    static createFrom(source: any = {}) {
	        return new w_BM25Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.b = source["b"];
	        this.k1 = source["k1"];
	    }
	}
	export class w_BatchStats {
	    queueLength?: number;
	    ratePerSecond: number;
	
	    static createFrom(source: any = {}) {
	        return new w_BatchStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.queueLength = source["queueLength"];
	        this.ratePerSecond = source["ratePerSecond"];
	    }
	}
	export class w_VectorConfig {
	    vectorIndexConfig?: any;
	    vectorIndexType?: string;
	    vectorizer?: any;
	
	    static createFrom(source: any = {}) {
	        return new w_VectorConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.vectorIndexConfig = source["vectorIndexConfig"];
	        this.vectorIndexType = source["vectorIndexType"];
	        this.vectorizer = source["vectorizer"];
	    }
	}
	export class w_ReplicationConfig {
	    asyncEnabled: boolean;
	    deletionStrategy?: string;
	    factor?: number;
	
	    static createFrom(source: any = {}) {
	        return new w_ReplicationConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.asyncEnabled = source["asyncEnabled"];
	        this.deletionStrategy = source["deletionStrategy"];
	        this.factor = source["factor"];
	    }
	}
	export class w_NestedProperty {
	    dataType: string[];
	    description?: string;
	    indexFilterable?: boolean;
	    indexRangeFilters?: boolean;
	    indexSearchable?: boolean;
	    name?: string;
	    nestedProperties?: w_NestedProperty[];
	    tokenization?: string;
	
	    static createFrom(source: any = {}) {
	        return new w_NestedProperty(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.dataType = source["dataType"];
	        this.description = source["description"];
	        this.indexFilterable = source["indexFilterable"];
	        this.indexRangeFilters = source["indexRangeFilters"];
	        this.indexSearchable = source["indexSearchable"];
	        this.name = source["name"];
	        this.nestedProperties = this.convertValues(source["nestedProperties"], w_NestedProperty);
	        this.tokenization = source["tokenization"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class w_Property {
	    dataType: string[];
	    description?: string;
	    indexFilterable?: boolean;
	    indexInverted?: boolean;
	    indexRangeFilters?: boolean;
	    indexSearchable?: boolean;
	    moduleConfig?: any;
	    name?: string;
	    nestedProperties?: w_NestedProperty[];
	    tokenization?: string;
	
	    static createFrom(source: any = {}) {
	        return new w_Property(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.dataType = source["dataType"];
	        this.description = source["description"];
	        this.indexFilterable = source["indexFilterable"];
	        this.indexInverted = source["indexInverted"];
	        this.indexRangeFilters = source["indexRangeFilters"];
	        this.indexSearchable = source["indexSearchable"];
	        this.moduleConfig = source["moduleConfig"];
	        this.name = source["name"];
	        this.nestedProperties = this.convertValues(source["nestedProperties"], w_NestedProperty);
	        this.tokenization = source["tokenization"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class w_MultiTenancyConfig {
	    autoTenantActivation: boolean;
	    autoTenantCreation: boolean;
	    enabled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new w_MultiTenancyConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.autoTenantActivation = source["autoTenantActivation"];
	        this.autoTenantCreation = source["autoTenantCreation"];
	        this.enabled = source["enabled"];
	    }
	}
	export class w_StopwordConfig {
	    additions: string[];
	    preset?: string;
	    removals: string[];
	
	    static createFrom(source: any = {}) {
	        return new w_StopwordConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.additions = source["additions"];
	        this.preset = source["preset"];
	        this.removals = source["removals"];
	    }
	}
	export class w_InvertedIndexConfig {
	    bm25?: w_BM25Config;
	    cleanupIntervalSeconds?: number;
	    indexNullState?: boolean;
	    indexPropertyLength?: boolean;
	    indexTimestamps?: boolean;
	    stopwords?: w_StopwordConfig;
	    usingBlockMaxWAND?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new w_InvertedIndexConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.bm25 = this.convertValues(source["bm25"], w_BM25Config);
	        this.cleanupIntervalSeconds = source["cleanupIntervalSeconds"];
	        this.indexNullState = source["indexNullState"];
	        this.indexPropertyLength = source["indexPropertyLength"];
	        this.indexTimestamps = source["indexTimestamps"];
	        this.stopwords = this.convertValues(source["stopwords"], w_StopwordConfig);
	        this.usingBlockMaxWAND = source["usingBlockMaxWAND"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class w_Class {
	    class?: string;
	    description?: string;
	    invertedIndexConfig?: w_InvertedIndexConfig;
	    moduleConfig?: any;
	    multiTenancyConfig?: w_MultiTenancyConfig;
	    properties: w_Property[];
	    replicationConfig?: w_ReplicationConfig;
	    shardingConfig?: any;
	    vectorConfig?: Record<string, VectorConfig>;
	    vectorIndexConfig?: any;
	    vectorIndexType?: string;
	    vectorizer?: string;
	
	    static createFrom(source: any = {}) {
	        return new w_Class(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.class = source["class"];
	        this.description = source["description"];
	        this.invertedIndexConfig = this.convertValues(source["invertedIndexConfig"], w_InvertedIndexConfig);
	        this.moduleConfig = source["moduleConfig"];
	        this.multiTenancyConfig = this.convertValues(source["multiTenancyConfig"], w_MultiTenancyConfig);
	        this.properties = this.convertValues(source["properties"], w_Property);
	        this.replicationConfig = this.convertValues(source["replicationConfig"], w_ReplicationConfig);
	        this.shardingConfig = source["shardingConfig"];
	        this.vectorConfig = this.convertValues(source["vectorConfig"], w_VectorConfig, true);
	        this.vectorIndexConfig = source["vectorIndexConfig"];
	        this.vectorIndexType = source["vectorIndexType"];
	        this.vectorizer = source["vectorizer"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class w_Connection {
	    id: number;
	    uri: string;
	    name: string;
	    favorite: boolean;
	    api_key?: string;
	    color: string;
	
	    static createFrom(source: any = {}) {
	        return new w_Connection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.uri = source["uri"];
	        this.name = source["name"];
	        this.favorite = source["favorite"];
	        this.api_key = source["api_key"];
	        this.color = source["color"];
	    }
	}
	
	
	
	export class w_NodeShardStatus {
	    class: string;
	    compressed: boolean;
	    loaded: boolean;
	    name: string;
	    objectCount: number;
	    vectorIndexingStatus: string;
	    vectorQueueLength: number;
	
	    static createFrom(source: any = {}) {
	        return new w_NodeShardStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.class = source["class"];
	        this.compressed = source["compressed"];
	        this.loaded = source["loaded"];
	        this.name = source["name"];
	        this.objectCount = source["objectCount"];
	        this.vectorIndexingStatus = source["vectorIndexingStatus"];
	        this.vectorQueueLength = source["vectorQueueLength"];
	    }
	}
	export class w_NodeStats {
	    objectCount: number;
	    shardCount: number;
	
	    static createFrom(source: any = {}) {
	        return new w_NodeStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.objectCount = source["objectCount"];
	        this.shardCount = source["shardCount"];
	    }
	}
	export class w_NodeStatus {
	    batchStats?: w_BatchStats;
	    gitHash?: string;
	    name?: string;
	    shards: w_NodeShardStatus[];
	    stats?: w_NodeStats;
	    status?: string;
	    version?: string;
	
	    static createFrom(source: any = {}) {
	        return new w_NodeStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.batchStats = this.convertValues(source["batchStats"], w_BatchStats);
	        this.gitHash = source["gitHash"];
	        this.name = source["name"];
	        this.shards = this.convertValues(source["shards"], w_NodeShardStatus);
	        this.stats = this.convertValues(source["stats"], w_NodeStats);
	        this.status = source["status"];
	        this.version = source["version"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class w_NodesStatusResponse {
	    nodes: w_NodeStatus[];
	
	    static createFrom(source: any = {}) {
	        return new w_NodesStatusResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.nodes = this.convertValues(source["nodes"], w_NodeStatus);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class w_Object {
	    additional?: Record<string, any>;
	    class?: string;
	    creationTimeUnix?: number;
	    id?: string;
	    lastUpdateTimeUnix?: number;
	    properties?: any;
	    tenant?: string;
	    vector?: number[];
	    vectorWeights?: any;
	    vectors?: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new w_Object(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.additional = source["additional"];
	        this.class = source["class"];
	        this.creationTimeUnix = source["creationTimeUnix"];
	        this.id = source["id"];
	        this.lastUpdateTimeUnix = source["lastUpdateTimeUnix"];
	        this.properties = source["properties"];
	        this.tenant = source["tenant"];
	        this.vector = source["vector"];
	        this.vectorWeights = source["vectorWeights"];
	        this.vectors = source["vectors"];
	    }
	}
	
	
	
	export class w_Tenant {
	    activityStatus?: string;
	    name?: string;
	
	    static createFrom(source: any = {}) {
	        return new w_Tenant(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.activityStatus = source["activityStatus"];
	        this.name = source["name"];
	    }
	}

}

export namespace updater {
	
	export class w_CheckForUpdatesResponse {
	    Exists: boolean;
	    LatestVersion: string;
	    Size: string;
	
	    static createFrom(source: any = {}) {
	        return new w_CheckForUpdatesResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Exists = source["Exists"];
	        this.LatestVersion = source["LatestVersion"];
	        this.Size = source["Size"];
	    }
	}

}

export namespace weaviate {
	
	export class w_PaginatedObjectResponse {
	    Objects: w_models.Object[];
	    TotalResults: number;
	
	    static createFrom(source: any = {}) {
	        return new w_PaginatedObjectResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Objects = this.convertValues(source["Objects"], w_models.Object);
	        this.TotalResults = source["TotalResults"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class w_TestConnectionInput {
	    URI: string;
	    ApiKey?: string;
	
	    static createFrom(source: any = {}) {
	        return new w_TestConnectionInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.URI = source["URI"];
	        this.ApiKey = source["ApiKey"];
	    }
	}

}

