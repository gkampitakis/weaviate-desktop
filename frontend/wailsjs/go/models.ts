export namespace models {
	
	export class Connection {
	    id: number;
	    uri: string;
	    name: string;
	    favorite: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Connection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.uri = source["uri"];
	        this.name = source["name"];
	        this.favorite = source["favorite"];
	    }
	}

}

