import ContainerRepositoryHandler from "./_base";


export default class DockerRepositoryHandler extends ContainerRepositoryHandler {

    imageMatches(image: string): boolean {
        return /^(?:docker\.io\/)?(?:(?:[\w-.]+\/)?[\w-.]+)$/.test(image);
    }

    async fetchTag(image: string, validator: (dockerTag: DockerTag) => boolean): Promise<string>  {

        let page = 1;
        try {
            do {

                if (page >= 10) throw 'Scanned 10 pages. Surrendering...';

                if (image.indexOf('/') === -1) {
                    image = `library/${image}`;
                }

                this.context.log(`Scanning https://registry.hub.docker.com/v2/repositories/${image}/tags/?page_size=100&page=${page}`)

                let imagejson = undefined;

                do {
                    imagejson = await this.fetchJson(`https://registry.hub.docker.com/v2/repositories/${image}/tags/?page_size=100&page=${page++}`)
                } while (imagejson.message !== 'httperror 404: object not found' && imagejson.results === undefined);

                if (imagejson.results === undefined) {
                    throw 'Unable to resolve image version';
                }

                const results: DockerTag[] = imagejson.results;
                for (let row of results) {
                    let valid = validator(row);
                    if (valid) {
                        this.context.log(`Tag matched: ${row.name}`);
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