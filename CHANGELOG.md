<!-- markdownlint-disable -->
# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [v0.1.0] - 2026-04-15

### Added
- Add optional `@layer` when creating stylesheets/CSS parsers
- Add Security policy
- Add npm config to harden installs

### Changed
- Update Workflows with permissions
- Update contributiing guidelines
- Update to node 26.3.0 & npm 11.16.0

## [v0.0.3] - 2026-02-20

### Fixed
- Notify in `Signal.subtle.Watcher` synchronously
- Only fire `Signal.subtle.watched` and `Signal.subtle.unwatched` when changing the watched state

## [v0.0.2] - 2026-02-19

### Changed
- Version bump to get Package Provenance on npm

### Removed
- Do not include other polyfills/patches (`reportError` and `queuMicroTask`)

## [v0.0.1] - 2026-02-19

Initial Release
