import ContainerRepositoryHandler from "./_base";

type DockerTag = {
    name: string;
    digest: string;
    last_updated: string;
    images: DockerImage[];

}

type DockerImage = {
    architecture: string;
    digest: string;
    last_pulled: string;
    last_pushed: string;
    status: string;
}


type DockerResult = {
    message?: string;
    results: DockerTag[];
}

export default class DockerRepositoryHandler extends ContainerRepositoryHandler {

    imageMatches(image: string): boolean {
        const name = image.replace(/^(?:docker\.io|index\.docker\.io|registry-1\.docker\.io)\//, '');
        const segments = name.split('/');
        const hasRegistry = segments.length > 1 &&
            (segments[0].includes('.') || segments[0].includes(':') || segments[0] === 'localhost');

        return !hasRegistry;
    }

    async fetchTag(image: string, validator: (tag: string) => boolean): Promise<string | undefined> {

        let repository = image.replace(/^(?:docker\.io|index\.docker\.io|registry-1\.docker\.io)\//, '');

        if (!repository.includes('/')) {
            repository = `library/${repository}`;
        }

        let page = 1;
        try {
            do {
                if (page >= 10) throw 'Scanned 10 pages. Surrendering...';

                const url = `https://registry.hub.docker.com/v2/repositories/${repository}/tags/?page_size=100&page=${page++}&ordering=last_updated`;
                this.context.log(`Scanning ${url}`)

                let imagejson = await this.fetchJson<DockerResult>(url);

                if (imagejson.message === 'httperror 404: object not found') {
                    throw 'Unable to resolve image version';
                }

                if (imagejson.results === undefined || imagejson.results.length === 0) {
                    throw 'Unable to resolve image version';
                }

                for (const row of imagejson.results) {
                    if (validator(row.name)) {
                        return row.name;
                    }
                }
            } while (true);
        } catch(e) {
            this.context.log(e instanceof Error ? e.message : e);
        }

        return undefined;
    }


}
