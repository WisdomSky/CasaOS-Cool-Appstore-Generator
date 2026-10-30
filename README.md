# CasaOS-Cool-Appstore-Generator

Generates the v2 **source tree** for the [CasaOS Coolstore](https://github.com/WisdomSky/CasaOS-Coolstore).

The generator resolves the latest matching image tags, refreshes each app's version metadata, and writes:

```text
dist/
├── .github/
│   └── workflows/
│       └── publish-v2.yml
├── Apps/
│   ├── kavita/
│   │   ├── docker-compose.yml
│   │   └── (local assets, if any)
│   └── ...
├── store-config.json
├── supported-languages.json
├── README.md
├── banner.png
├── default-icon.svg
└── category-list.json
```

The generated `dist/` tree is intended to be committed to the actual appstore repository. That repository's workflow runs the official `IceWhaleTech/build-appstore-action`, builds the protocol files, and publishes them to `gh-pages`.

## Requirements

- Node.js 18 or newer
- Docker with the Compose plugin (only for the optional compose syntax check)

## Usage

```bash
npm install

# Validate source metadata without touching the network
npm run validate

# Resolve image tags and write the v2 source tree to dist/
npm start

# Write dist/ without resolving new image tags
npm run update
```

`BASE_URL` is used only for the store URL shown in the generated README. It can be set with `--base-url`, the environment, or `.env`.

The generator never deletes `dist/`. It overwrites generated files in place, removes stale app folders under `dist/Apps/`, and removes artifacts from the previous built-output layout (`dist/apps/`, `dist/store.json`, `dist/index.json`, etc.).

## Source layout

- `src/apps/<folder>/docker-compose.yml` — app runtime definition and top-level `x-casaos` metadata.
- `src/apps/<folder>/config.js` — image tag matching rules used by the generator. This file is not copied into `dist/`.
- `store-config.json` — v2 store identity.
- `supported-languages.json` — locale candidates.
- `src/assets/` — shared store assets, README template, and the appstore workflow.

The generator writes each app to `dist/Apps/<folder>/`, preserving the source folder names. The official build action derives `apps/<x-casaos.id>/` in the published output.

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

## Publishing

This repository does **not** contain publishing workflows. The publish workflow is generated into `dist/.github/workflows/publish-v2.yml` and is intended for the actual appstore repository.

The workflow:

- runs on pushes to `main`/`master` that change `Apps/**`, `store-config.json`, `supported-languages.json`, or the workflow itself
- can also be run manually
- uses `IceWhaleTech/build-appstore-action`
- builds to `dist/`
- publishes the generated files to `gh-pages` with `peaceiris/actions-gh-pages`
- has no schedule

To publish:

1. Run `npm start`.
2. Copy the contents of `dist/` into the actual appstore repository.
3. Commit and push.

The appstore workflow then builds and publishes `https://cdn.jsdelivr.net/gh/<owner>/<repo>@gh-pages/store.json`.

## License

ISC
