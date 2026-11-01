---
layout: default
title: Embodied-system evidence graphs
---

# Embodied-system evidence graphs

Dotdog can connect supplied assets, sensors, actuators, requirements, hazards and recorded evidence. This is advisory traceability, not robot control, simulation, safety certification or proof that all hazards were identified.

## Read-only evidence audit

```sh
dotdog graph import system.json --project bench
dotdog graph audit --dag .doghouse/imported/bench.dag --profile embodied --max-age-days 30 --json
dotdog impact sensor:encoder --dag .doghouse/imported/bench.dag --json
```

`system.json` uses Dotdog's object graph format (`project`, `nodes`, `edges`). Node IDs are exact identifiers. Node `kind` and edge `verb` values below are case-sensitive. Additional domain properties remain data, not executable instructions.

| Node kind | Required relationship |
| --- | --- |
| `requirement` | `verified_by` → fresh passing `evidence`; `applies_to` → `asset`, `sensor` or `actuator` |
| `sensor` | `calibrated_by` → fresh passing `evidence` |
| `actuator` | `constrained_by` → `requirement` |
| `hazard` | `mitigated_by` → `requirement` |

The embodied profile requires at least one asset, requirement and evidence node. Every evidence node must have these `properties`:

- `file`: existing, non-secret, repository-relative artifact path.
- `sha256`: SHA-256 of the exact artifact bytes, including binary data.
- `observedAt`: timezone-qualified timestamp, not in the future or older than the selected window.
- `result`: `pass`. Failed, unknown and missing results remain gaps.

For software-only graphs, omit `--profile embodied` to check evidence identity and freshness without the embodied relationship conventions. Both profiles return nonzero when a gap is found. Evidence artifacts and graph inputs are limited to 32 MiB each. Evidence files are read and hashed, never executed or fetched remotely.

A digest proves byte identity, not truth, signature authenticity or measurement quality. A claimed `pass` is supplied evidence, not an independent measurement. Calibrating one sensor does not establish that its linked requirement was tested adequately. Review evidence scope, procedures and independent domain-specific checks.

## Where this fits

A useful workflow is: a simulator, test rig or analysis tool produces an artifact; its owner records scope and outcome; Dotdog tracks which requirements/components depend on it. A changed sensor, firmware interface or model can be investigated with `impact`, while `graph audit` reports missing or stale records.

ROS 2 communications security belongs to ROS/DDS policy, not this graph. ROS documents authentication, encryption, enclaves and access control, including the distinction between enabling security and enforcing it. Dotdog does not inspect or enforce those settings. See [ROS 2 security](https://github.com/ros2/ros2_documentation/blob/rolling/source/Developer-Tools/Introspection-and-analysis/Security/About-Security.rst).

OpenUSD's physics schema represents simulation data; its validation framework checks asset/schema rules. Keep those validators authoritative for USD assets. Dotdog can reference their saved reports but does not parse USD, run a physics engine or implement a USD validator. See [UsdPhysics](https://openusd.org/release/api/usd_physics_page_front.html) and [OpenUSD validation](https://openusd.org/dev/api/md_pxr_2usd_validation_2usd_validation_2_r_e_a_d_m_e.html).

No live hardware, ROS deployment, simulator or USD scene was tested for this release. Tests use explicitly synthetic graphs and byte artifacts.
