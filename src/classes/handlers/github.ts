import ContainerRepositoryHandler from "./_base";
import fetch from "node-fetch";

type TokenResponse = {
    token?: string;
    access_token?: string;
};

type TagsResponse = {
    name?: string;
    tags?: string[];
};

export default class GithubRepositoryHandler extends ContainerRepositoryHandler {

    imageMatches(image: string): boolean {
        return /^ghcr\.io\/[^/]+\/[^/]+/.test(image);
    }

    async fetchTag(image: string, validator: (tag: string) => boolean): Promise<string | undefined> {
        const repository = image.replace(/^ghcr\.io\//, '').replace(/\/+$/, '');
        if (!repository.includes('/')) return undefined;

        try {
            const token = await this.getToken(repository);
            if (!token) {
                throw new Error('Unable to obtain a GHCR access token');
            }

            const tags = await this.getTags(repository, token);
            const matching = tags
                .filter(tag => validator(tag))
                .sort(GithubRepositoryHandler.compareTags);

            if (matching.length > 0) {
                return matching[0];
            }
        } catch (e) {
            this.context.log(e instanceof Error ? e.message : e);
        }

        return undefined;
    }

    private async getToken(repository: string): Promise<string | undefined> {
        const tokenUrl = `https://ghcr.io/token?service=ghcr.io&scope=repository:${repository}:pull`;
        const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_ACCESS_TOKEN;

        const request = async (headers: { [key: string]: string }) => {
            const response = await fetch(tokenUrl, {headers});
            if (!response.ok) return undefined;

            const data = await response.json() as TokenResponse;
            return data.token || data.access_token;
        };

        const anonymousToken = await request({});
        if (anonymousToken) return anonymousToken;

        if (githubToken) {
            const username = process.env.GITHUB_ACTOR || 'x-access-token';
            const basic = Buffer.from(`${username}:${githubToken}`).toString('base64');
            return request({Authorization: `Basic ${basic}`});
        }

        return undefined;
    }

    private async getTags(repository: string, token: string): Promise<string[]> {
        const tags: string[] = [];
        let url: string | null = `https://ghcr.io/v2/${repository}/tags/list?n=1000`;

        for (let page = 0; page < 10 && url !== null; page++) {
            this.context.log(`Scanning ${url}`);

            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} while reading GHCR tags for ${repository}`);
            }

            const data = await response.json() as TagsResponse;
            for (const tag of data.tags || []) {
                if (!tags.includes(tag)) tags.push(tag);
            }

            const link = response.headers.get('link');
            const next = link === null ? null : /<([^>]+)>;\s*rel="next"/.exec(link);
            url = next === null ? null : new URL(next[1], 'https://ghcr.io').toString();
        }

        return tags;
    }

    private static compareTags(a: string, b: string): number {
        const aParts = GithubRepositoryHandler.versionParts(a);
        const bParts = GithubRepositoryHandler.versionParts(b);

        if (aParts !== null && bParts === null) return -1;
        if (aParts === null && bParts !== null) return 1;

        if (aParts !== null && bParts !== null) {
            const length = Math.max(aParts.length, bParts.length);
            for (let i = 0; i < length; i++) {
                const aValue = aParts[i] || 0;
                const bValue = bParts[i] || 0;
                if (aValue !== bValue) return bValue - aValue;
            }
        }

        return b.localeCompare(a);
    }

    private static versionParts(tag: string): number[] | null {
        const match = /(\d+(?:[.\-]\d+)*)/.exec(tag);
        if (match === null) return null;

        return match[1].split(/[.\-]/).map(value => Number.parseInt(value, 10));
    }
}
