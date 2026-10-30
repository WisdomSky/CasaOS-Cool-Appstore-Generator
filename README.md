# CasaOS-Cool-Appstore-Generator

Generates the [CasaOS Coolstore](https://github.com/WisdomSky/CasaOS-Coolstore) as a **CasaOS / ZimaOS AppStore v2** repository.

The generator resolves the latest matching image tags, refreshes each app's version metadata, and writes a complete v2 `dist/` tree:

```text
dist/
├── store.json
├── index.json
├── README.md
└── apps/
    └── com.wisdomsky.coolstore.kavita/
        ├── docker-compose.yml
        ├── meta.json
        └── assets/
            ├── icon.png
            └── thumbnail.png
```

## Requirements

- Node.js 18 or newer
- Docker with the Compose plugin (only for the optional compose syntax check)

## Usage

```bash
npm install

# Validate source metadata without touching the network
npm run validate

# Resolve image tags and build dist/
npm start

# Build without resolving new image tags
npm run update

# Custom output directory / public asset base URL
npm start -- --output dist --base-url https://cdn.jsdelivr.net/gh/WisdomSky/CasaOS-Coolstore@gh-pages
```

`BASE_URL` can also be set in the environment or in `.env`.

The generated subscription URL is:

```text
<BASE_URL>/store.json
```

If `BASE_URL` is empty, generated links are relative paths and work for local previewing.

## Source layout

- `src/apps/<folder>/docker-compose.yml` — app runtime definition and top-level `x-casaos` metadata.
- `src/apps/<folder>/config.js` — image tag matching rules used by the generator.
- `store-config.json` — v2 store identity.
- `supported-languages.json` — locale candidates.
- `src/assets/` — shared store assets and the README template.

The source directory remains `src/apps`; the build maps each app to `dist/apps/<x-casaos.id>/`.

## Required app metadata

Every app must include the following top-level `x-casaos` fields:

| Field | Notes |
| --- | --- |
| `id` | Stable reverse-domain ID, for example `com.wisdomsky.coolstore.kavita` |
| `main` | Name of the primary web service |
| `index` | Web entry path, usually `/` |
| `port_map` | Quoted published port, for example `"8080"` |
| `icon` | Icon URL or local filename |
| `title.en_US` | Display name as a locale-keyed object |
| `category` | One of `Media`, `Productivity`, `Home`, `Networking`, `AI`, `Finance`, `Social`, `Developer`, `Others` |
| `architectures` | Supported architectures: `amd64`, `arm64`, `arm`, `386` |
| `version` | App version string |

Recommended fields:

- `tagline.en_US`
- `description.en_US`
- `author`
- `developer`
- `scheme`
- `thumbnail`
- `screenshot_link`
- `update_at`
- `website`, `repo`, `support`, `docs`

Locale keys use the `ll_CC` form (`en_US`, `zh_CN`, ...). The build normalizes older keys such as `en_us`.

## Adding an app

1. Create `src/apps/<folder>/`.
2. Add a v2-compliant `docker-compose.yml`.
3. Add a `config.js` tag pattern for the main image, and per-service overrides when needed:

```js
export default {
    tag: {
        pattern: /^\d+(\.\d+(\.\d+)?)?$/
    }
}
```

4. Run `npm run validate`, then `npm start`.
5. Commit the source files. The generated `dist/` directory is ignored by Git.

## GitHub workflows

Two workflows are included:

- `.github/workflows/validate-v2.yml` — validates metadata and runs `docker compose config -q` on every pull request.
- `.github/workflows/publish-v2.yml` — builds the v2 store on pushes to `main`, on a daily schedule, and on manual dispatch, then publishes it to `gh-pages`.

By default the publish workflow deploys `dist/` to this repository's `gh-pages` branch and uses:

```text
https://cdn.jsdelivr.net/gh/<owner>/<repo>@gh-pages
```

To publish to a different repository, configure:

- Repository variable `STORE_REPOSITORY` — target repository, for example `WisdomSky/CasaOS-Coolstore`.
- Repository secret `STORE_DEPLOY_TOKEN` — token with permission to push to that repository.
- Optional repository variable `BASE_URL` — public base URL used in generated links.

## License

ISC
