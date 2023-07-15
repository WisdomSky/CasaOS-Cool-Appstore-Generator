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
        return /^(?:docker\.io\/)?(?:(?:[\w-.]+\/)?[\w-.]+)$/.test(image);
    }

    async fetchTag(image: string, validator: (tag: string) => boolean): Promise<string>  {

        let page = 1;
        try {
            do {

                if (page >= 10) throw 'Scanned 10 pages. Surrendering...';

                if (image.indexOf('/') === -1) {
                    image = `library/${image}`;
                }

                this.context.log(`Scanning https://registry.hub.docker.com/v2/repositories/${image}/tags/?page_size=100&page=${page}`)

                let imagejson = await this.fetchJson<DockerResult>(`https://registry.hub.docker.com/v2/repositories/${image}/tags/?page_size=100&page=${page++}`);

                if (imagejson.message === 'httperror 404: object not found') {
                    throw 'Unable to resolve image version';
                }

                if (imagejson.results === undefined) {
                    throw 'Unable to resolve image version';
                }

                const results: DockerTag[] = imagejson.results;
                for (let row of results) {
                    let valid = validator(row.name);
                    if (valid) {
                        this.context.log(`Tag = ${row.name}`);
                        return row.name;
                    }
                }
            } while (true);
        } catch(e) {
            this.context.log(e);
        }

        return undefined;
    }


}