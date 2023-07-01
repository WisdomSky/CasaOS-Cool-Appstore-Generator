declare namespace App {
    export type Config = {
        tag?: App.Tag,
        services?: {
            [service:string]: {
                tag?: App.Tag
            }
        }
    }

    export type Tag = {
        pattern?: App.Tag.Pattern;
        resolver?: App.Tag.Resolver;
    }

    export namespace Tag {
        export type Pattern = RegExp;
        export type Resolver = (tag: string) => boolean;
    }

}

declare type Compose = {
    name: string;
    "x-casaos": Compose.XCasaOS;
    services: { [service: string]: Compose.Service };
    network: { [network: string]: any };
    volumes: { [volume: string]: any };
}

declare namespace Compose {

    export type Service = {
        image: string;
        envs?: {};
        ports?: Compose.Service.Port[];
        volumes?: Compose.Service.Volume[];
        restart: string;
        "x-casaos"?: {
            envs?: [];
            ports?: [];
            [key:string]: any;
        };

        [key:string]: any;
    }

    export namespace Service {

        export type Port = {
            published: string|number;
            target: string|number;
            protocol: string;
        }

        export type Volume = {
            type: string;
            source: string;
            target: string;
        }
    }


    export type XCasaOS = {
        architectures?: [];
        main: string;
        title: {
            [language: string]: string
        };
        description: Object;
        tagline: Object;
        category: Coolstore
        developer: string;
        author: string;
        icon?: string;
        thumbnail?: string;
        port_map: string;

        [key:string]: any;
    }
}


declare type ComposeParser = Compose & {
    getService(service: string): ComposeParser.Service;
    getServices(): ComposeParser.Service[];
    json(): JSON;
    text(): string;
    toJSON(): JSON;
    writeToFile(path: string): void;
}

declare namespace ComposeParser {

    export type Service = {
        getImage(): ComposeParser.Image;
        getName(): string;
        setImage(image: string): ComposeParser.Service
        getRestartPolicy(): string;
        setRestartPolicy(policy: string): ComposeParser.Service;
        getEnvironment(): string;
        toJSON(): JSON;
    };

    export type Image = {
        getImage(): string;
        setImage(image: string): ComposeParser.Image;
        getName(): string;
        setName(name: string): ComposeParser.Image;
        getTag(): string;
        setTag(tag: string): ComposeParser.Image;
        getDigest(): string;
        setDigest(digest: string): ComposeParser.Image;
        get(): string;
        toJSON(): string;
    }

}


declare type FetchOptions = {
    longlivedcache?: boolean,

    [key:string]: any;
}


declare type DockerTag = {
    name: string;
    digest: string;
    last_updated: string;
    images: DockerImage[];

}

declare type DockerImage = {
    architecture: string;
    digest: string;
    last_pulled: string;
    last_pushed: string;
    status: string;
}