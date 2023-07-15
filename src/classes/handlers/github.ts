import ContainerRepositoryHandler from "./_base";

type GithubTag = {
    metadata: {
        container: {
            tags: string[]
        }
    }
};

export default class GithubRepositoryHandler extends ContainerRepositoryHandler {

    imageMatches(image: string): boolean {
        return /^ghcr\.io\/(?:[\w-]+\/)?[\w-]+$/.test(image);
    }

    async fetchTag(image: string, validator: (tag: any) => boolean): Promise<string>  {

        let page = 1;
        try {
            do {

                if (page >= 10) throw 'Scanned 10 pages. Surrendering...';

                const imageinfo = image.replace(/^(?:ghcr\.io\/)?([^\/]+?\/[^\/\:]+?)(?:\:[^\/\:]+)?$/,'$1').split('/');

                this.context.log(`https://api.github.com/users/${imageinfo[0]}/packages/container/${imageinfo[1]}/versions?page=${page++}`)

                let results: GithubTag[] = await this.fetchJson<GithubTag[]>(`https://api.github.com/users/${imageinfo[0]}/packages/container/${imageinfo[1]}/versions?page=${page++}`,{
                    headers: {
                        Authorization: `Bearer ${process.env.GITHUB_ACCESS_TOKEN}`
                    }
                })

                if (results === undefined) {
                    throw 'Unable to resolve image version';
                }

                try {
                    for (let row of results) {
                        const tags = row.metadata.container.tags;
                        for (const tag of tags) {
                            let valid = validator(tag);
                            if (valid) {
                                this.context.log(`Tag = ${tag}`);
                                return tag;
                            }
                        }

                    }
                } catch (e) {
                    this.context.log(results);
                }
            } while (true);
        } catch(e) {
            this.context.log(e);
        }

        return undefined;
    }


}