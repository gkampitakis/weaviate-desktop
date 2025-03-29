export namespace models {
	
	export class BM25Config {
	    b?: number;
	    k1?: number;
	
	    static createFrom(source: any = {}) {
	        return new BM25Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.b = source["b"];
	        this.k1 = source["k1"];
	    }
	}
	export class VectorConfig {
	    vectorIndexConfig?: any;
	    vectorIndexType?: string;
	    vectorizer?: any;
	
	    static createFrom(source: any = {}) {
	        return new VectorConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.vectorIndexConfig = source["vectorIndexConfig"];
	        this.vectorIndexType = source["vectorIndexType"];
	        this.vectorizer = source["vectorizer"];
	    }
	}
	export class ReplicationConfig {
	    asyncEnabled: boolean;
	    deletionStrategy?: string;
	    factor?: number;
	
	    static createFrom(source: any = {}) {
	        return new ReplicationConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.asyncEnabled = source["asyncEnabled"];
	        this.deletionStrategy = source["deletionStrategy"];
	        this.factor = source["factor"];
	    }
	}
	export class NestedProperty {
	    dataType: string[];
	    description?: string;
	    indexFilterable?: boolean;
	    indexRangeFilters?: boolean;
	    indexSearchable?: boolean;
	    name?: string;
	    nestedProperties?: NestedProperty[];
	    tokenization?: string;
	
	    static createFrom(source: any = {}) {
	        return new NestedProperty(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.dataType = source["dataType"];
	        this.description = source["description"];
	        this.indexFilterable = source["indexFilterable"];
	        this.indexRangeFilters = source["indexRangeFilters"];
	        this.indexSearchable = source["indexSearchable"];
	        this.name = source["name"];
	        this.nestedProperties = this.convertValues(source["nestedProperties"], NestedProperty);
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
	export class Property {
	    dataType: string[];
	    description?: string;
	    indexFilterable?: boolean;
	    indexInverted?: boolean;
	    indexRangeFilters?: boolean;
	    indexSearchable?: boolean;
	    moduleConfig?: any;
	    name?: string;
	    nestedProperties?: NestedProperty[];
	    tokenization?: string;
	
	    static createFrom(source: any = {}) {
	        return new Property(source);
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
	        this.nestedProperties = this.convertValues(source["nestedProperties"], NestedProperty);
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
	export class MultiTenancyConfig {
	    autoTenantActivation: boolean;
	    autoTenantCreation: boolean;
	    enabled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new MultiTenancyConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.autoTenantActivation = source["autoTenantActivation"];
	        this.autoTenantCreation = source["autoTenantCreation"];
	        this.enabled = source["enabled"];
	    }
	}
	export class StopwordConfig {
	    additions: string[];
	    preset?: string;
	    removals: string[];
	
	    static createFrom(source: any = {}) {
	        return new StopwordConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.additions = source["additions"];
	        this.preset = source["preset"];
	        this.removals = source["removals"];
	    }
	}
	export class InvertedIndexConfig {
	    bm25?: BM25Config;
	    cleanupIntervalSeconds?: number;
	    indexNullState?: boolean;
	    indexPropertyLength?: boolean;
	    indexTimestamps?: boolean;
	    stopwords?: StopwordConfig;
	
	    static createFrom(source: any = {}) {
	        return new InvertedIndexConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.bm25 = this.convertValues(source["bm25"], BM25Config);
	        this.cleanupIntervalSeconds = source["cleanupIntervalSeconds"];
	        this.indexNullState = source["indexNullState"];
	        this.indexPropertyLength = source["indexPropertyLength"];
	        this.indexTimestamps = source["indexTimestamps"];
	        this.stopwords = this.convertValues(source["stopwords"], StopwordConfig);
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
	export class Class {
	    class?: string;
	    description?: string;
	    invertedIndexConfig?: InvertedIndexConfig;
	    moduleConfig?: any;
	    multiTenancyConfig?: MultiTenancyConfig;
	    properties: Property[];
	    replicationConfig?: ReplicationConfig;
	    shardingConfig?: any;
	    vectorConfig?: Record<string, VectorConfig>;
	    vectorIndexConfig?: any;
	    vectorIndexType?: string;
	    vectorizer?: string;
	
	    static createFrom(source: any = {}) {
	        return new Class(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.class = source["class"];
	        this.description = source["description"];
	        this.invertedIndexConfig = this.convertValues(source["invertedIndexConfig"], InvertedIndexConfig);
	        this.moduleConfig = source["moduleConfig"];
	        this.multiTenancyConfig = this.convertValues(source["multiTenancyConfig"], MultiTenancyConfig);
	        this.properties = this.convertValues(source["properties"], Property);
	        this.replicationConfig = this.convertValues(source["replicationConfig"], ReplicationConfig);
	        this.shardingConfig = source["shardingConfig"];
	        this.vectorConfig = this.convertValues(source["vectorConfig"], VectorConfig, true);
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
	export class Connection {
	    id: number;
	    uri: string;
	    name: string;
	    favorite: boolean;
	    api_key?: string;
	
	    static createFrom(source: any = {}) {
	        return new Connection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.uri = source["uri"];
	        this.name = source["name"];
	        this.favorite = source["favorite"];
	        this.api_key = source["api_key"];
	    }
	}
	
	
	
	export class Object {
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
	        return new Object(source);
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
	
	
	
	export class Tenant {
	    activityStatus?: string;
	    name?: string;
	
	    static createFrom(source: any = {}) {
	        return new Tenant(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.activityStatus = source["activityStatus"];
	        this.name = source["name"];
	    }
	}

}

export namespace weaviate {
	
	export class PaginatedObjectResponse {
	    Objects: models.Object[];
	    TotalResults: number;
	
	    static createFrom(source: any = {}) {
	        return new PaginatedObjectResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Objects = this.convertValues(source["Objects"], models.Object);
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
	export class TestConnectionInput {
	    URI: string;
	    ApiKey?: string;
	
	    static createFrom(source: any = {}) {
	        return new TestConnectionInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.URI = source["URI"];
	        this.ApiKey = source["ApiKey"];
	    }
	}

}

