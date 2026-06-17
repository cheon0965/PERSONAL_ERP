# Third-Party Notices

This project is licensed under the [MIT License](./LICENSE).
Third-party dependencies, Docker images, tooling, and package data remain under their own licenses.

This notice is a practical project inventory, not legal advice.
Before redistributing a production bundle or Docker image, re-check the exact dependency tree from `package-lock.json` and the container image contents.

## Main Dependency Profile

The main direct application dependencies are generally licensed under permissive licenses such as MIT, Apache-2.0, BSD, or ISC.

Representative examples:

- Next.js, React, MUI, Emotion, TanStack Query, React Hook Form, Day.js, Zod: MIT-family licenses
- NestJS, Prisma, Playwright, TypeScript, RxJS, Reflect Metadata: MIT or Apache-2.0-family licenses
- MySQL client libraries such as `mysql2`: MIT
- Project-local packages under `packages/*`: covered by this repository license unless another license is added later

## Items To Track When Redistributing

| Component                                       | Current path/source                                    | License signal                      | Why it matters                                                                                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sharp`, `@img/sharp-*`, `@img/sharp-libvips-*` | Transitive dependency of Next.js image handling        | Apache-2.0 and LGPL-3.0-or-later    | Commercial use is not prohibited, but redistribution may require preserving notices and satisfying LGPL obligations for the packaged library.                    |
| `caniuse-lite`                                  | Transitive dependency through browser tooling          | CC-BY-4.0                           | Commercial use is allowed with attribution requirements.                                                                                                         |
| `axe-core`                                      | Dev/test dependency through accessibility lint tooling | MPL-2.0                             | File-level weak copyleft; currently used as tooling, not application runtime code.                                                                               |
| `busboy`, `streamsearch`                        | Transitive upload parsing dependencies                 | MIT in installed package metadata   | `package-lock.json` may not show a single `license` field, so keep package metadata when generating notices.                                                     |
| `node:22-bookworm-slim`                         | Docker base image                                      | Node.js and Debian package licenses | Redistributed container images inherit notices from the base image and OS packages.                                                                              |
| `mysql:8.4`                                     | Docker Compose database image                          | MySQL Community licensing/GPL terms | Running MySQL as a service is different from redistributing MySQL bundled with a commercial product; review Oracle/MySQL terms before commercial redistribution. |

## Project Assets

Images under `apps/web/public` are treated as project-owned assets for this portfolio unless a separate attribution file is added later.
Do not assume externally sourced images are covered by this repository license without checking their origin.

## Maintenance Checklist

- Re-run dependency license review before public redistribution.
- Keep third-party copyright and license files in distributed packages or container images.
- If replacing screenshots, logos, fonts, or generated media, record their source and license.
- If the project moves from portfolio/demo deployment to packaged commercial distribution, perform a dedicated legal review.
