# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [12.0.0-snapshot.25](https://github.com/mojaloop/event-stream-processor/compare/v12.0.0-snapshot.24...v12.0.0-snapshot.25) (2026-02-23)


### Bug Fixes

* bump fast-xml-parser override to 5.3.6, remove minimatch override ([1960b93](https://github.com/mojaloop/event-stream-processor/commit/1960b93a966d26ae0b849776b3fba33dc19003d8))
* remove duplicate GHSA-3ppc-4f35-3m26 entry from .grype.yaml ([4cbedd0](https://github.com/mojaloop/event-stream-processor/commit/4cbedd01d355b8932f14368cb6a88a52f597be76))

## [12.0.0-snapshot.24](https://github.com/mojaloop/event-stream-processor/compare/v12.0.0-snapshot.23...v12.0.0-snapshot.24) (2026-02-12)


### Features

* replace Consumer.isConnected with consumer.isHealthy() for Kafka health checks ([24f2950](https://github.com/mojaloop/event-stream-processor/commit/24f2950b2b151f70daa15dc261ae13e8d58c4f92)), closes [#1238](https://github.com/mojaloop/event-stream-processor/issues/1238)


### Bug Fixes

* add lodash override and allowlist yargs-parser for audit-ci ([698310f](https://github.com/mojaloop/event-stream-processor/commit/698310fcf2963136b41e9cf89232af286dda7be9))

## [12.0.0-snapshot.23](https://github.com/mojaloop/event-stream-processor/compare/v12.0.0-snapshot.22...v12.0.0-snapshot.23) (2026-01-14)

## [12.0.0-snapshot.22](https://github.com/mojaloop/event-stream-processor/compare/v12.0.0-snapshot.21...v12.0.0-snapshot.22) (2025-12-08)

## [12.0.0-snapshot.21](https://github.com/mojaloop/event-stream-processor/compare/v12.0.0-snapshot.20...v12.0.0-snapshot.21) (2025-10-09)

## [12.0.0-snapshot.20](https://github.com/mojaloop/event-stream-processor/compare/v12.0.0-snapshot.19...v12.0.0-snapshot.20) (2025-07-30)

## [12.0.0-snapshot.19](https://github.com/mojaloop/event-stream-processor/compare/v12.0.0-snapshot.18...v12.0.0-snapshot.19) (2025-07-30)


### Bug Fixes

* genrate sbom and node version ([9cef22a](https://github.com/mojaloop/event-stream-processor/commit/9cef22a29c0aaa0ffd9fc909addaa63bb55ce0b7))

## [12.0.0-snapshot.18](https://github.com/mojaloop/event-stream-processor/compare/v12.0.0-snapshot.17...v12.0.0-snapshot.18) (2025-07-30)


### Bug Fixes

* sbom generation ([d3c4b30](https://github.com/mojaloop/event-stream-processor/commit/d3c4b3069477d461568d925bca9b3db605bef971))

## [12.0.0-snapshot.17](https://github.com/mojaloop/event-stream-processor/compare/v12.0.0-snapshot.16...v12.0.0-snapshot.17) (2025-07-29)

## [12.0.0-snapshot.16](https://github.com/mojaloop/event-stream-processor/compare/v12.0.0-snapshot.15...v12.0.0-snapshot.16) (2025-07-25)

## [12.0.0-snapshot.15](https://github.com/mojaloop/event-stream-processor/compare/v12.0.0-snapshot.14...v12.0.0-snapshot.15) (2025-06-17)

## [12.0.0-snapshot.14](https://github.com/mojaloop/event-stream-processor/compare/v12.0.0-snapshot.13...v12.0.0-snapshot.14) (2025-02-25)

## [12.0.0-snapshot.13](https://github.com/mojaloop/event-stream-processor/compare/v12.0.0-snapshot.12...v12.0.0-snapshot.13) (2025-01-29)

## [12.0.0-snapshot.12](https://github.com/mojaloop/event-stream-processor/compare/v12.0.0-snapshot.11...v12.0.0-snapshot.12) (2025-01-27)

## [12.0.0-snapshot.11](https://github.com/mojaloop/event-stream-processor/compare/v12.0.0-snapshot.10...v12.0.0-snapshot.11) (2025-01-16)


### Bug Fixes

* downgrade nodejs to v18.20.4 ([16f2152](https://github.com/mojaloop/event-stream-processor/commit/16f2152136f7486aa797d4e93adb778d2aec5aaa))

## [12.0.0-snapshot.10](https://github.com/mojaloop/event-stream-processor/compare/v12.0.0-snapshot.9...v12.0.0-snapshot.10) (2025-01-13)

## [12.0.0-snapshot.9](https://github.com/mojaloop/event-stream-processor/compare/v12.0.0-snapshot.8...v12.0.0-snapshot.9) (2023-12-20)

## [12.0.0-snapshot.7](https://github.com/mojaloop/event-stream-processor/compare/v12.0.0-snapshot.6...v12.0.0-snapshot.7) (2022-07-25)


### ⚠ BREAKING CHANGES

* **mojaloop/#2092:** Major version bump for node v16 LTS support, re-structuring of project directories to align to core Mojaloop repositories and docker image now uses `/opt/app` instead of `/opt/event-stream-processor` which will impact config mounts.

### Features

* **mojaloop/#2092:** upgrade nodeJS version for core services ([#61](https://github.com/mojaloop/event-stream-processor/issues/61)) ([d27db35](https://github.com/mojaloop/event-stream-processor/commit/d27db3501b415ca54d89e8389808dd11b9ca3ab3)), closes [mojaloop/#2092](https://github.com/mojaloop/project/issues/2092)
