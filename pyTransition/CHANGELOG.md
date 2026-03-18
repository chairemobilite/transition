# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.2.0 - 2026-03-16

### Added
- Add a TripTimeChoice enum to python library to validate the parameter departure_or_arrival_choice (#1177)
- pyTransition: add population and pois to accessibility map requests

### Changed
- Now display a message with the reason for bad requests instead of simply failing (ccb4d451d21e6a8761994150da2427a2ebcb8308)

## 0.1.2 - 2024-05-29

### Fixed

- Validate token before using it

## 0.1.1 - 2024-05-23

### Fixed

- URL normalization to clean extra characters. Also streamline url construction instead of using strings

## 0.1.0 - 2024-05-03

### Added
- Initial implementation: includes getters for paths, nodes, scenarios and routing modes, as well as route requests and accessibility maps

