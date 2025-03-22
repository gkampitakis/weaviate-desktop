export namespace models {
	
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

}

export namespace weaviate {
	
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

