declare namespace App {
    export type Config = {
        tag?: App.Tag,
        services?: {
            [service: string]: {
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

    export type LocalizedText = {
        [locale: string]: string;
    };

    export type ComposeService = {
        image: string;
        labels?: { [key: string]: any } | null;
        "x-casaos"?: { [key: string]: any } | null;
        [key: string]: any;
    };

    export type XCasaOS = {
        id?: string;
        main?: string;
        index?: string;
        port_map?: string;
        scheme?: string;
        icon?: string;
        title?: App.LocalizedText;
        tagline?: App.LocalizedText;
        description?: App.LocalizedText;
        thumbnail?: string;
        screenshot_link?: string[];
        tips?: { [key: string]: App.LocalizedText };
        author?: string;
        developer?: string;
        category?: string;
        architectures?: string[];
        version?: string;
        update_at?: string;
        release_notes?: App.LocalizedText;
        website?: string;
        repo?: string;
        support?: string;
        docs?: string;
        [key: string]: any;
    };

    export type Compose = {
        name?: string;
        services: { [service: string]: App.ComposeService };
        "x-casaos"?: App.XCasaOS;
        [key: string]: any;
    };

    export type ParsedImage = {
        reference: string;
        name: string;
        registry: string;
        repository: string;
        tag: string;
        digest: string;
    };
}

declare type FetchOptions = {
    longlivedcache?: boolean,

    [key: string]: any;
}
