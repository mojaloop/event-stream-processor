# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
