---
description: "Use native DSH agents to classify optional group-chat replies."
kind: "package-bundle"
---
# dsh-qq-intent-dsh

English | [中文](README.zh.md)

## Summary

Supply a decision-only intent classifier through the Host's model and durable Session services. The bundle is disabled by default and provides an optional classifier for dsh-qq-turn-control. Group contexts have independent bounded Sessions; explicit addressing stays with Chat. This GitHub preview supplies the classifier service; upstream model quality and actual QQ delivery are separate acceptance surfaces.

## Table of Contents

- [Installation and use](#installation-and-use)
- [Decisions and cancellation](#decisions-and-cancellation)
- [Privacy and storage](#privacy-and-storage)
- [Verification and limits](#verification-and-limits)

<a id="installation-and-use"></a>
## Installation and use

Target Host: DSH 0.2.2-rc.1, Node ^22.19 or >=24. Install the archive with `dsh plugin --profile <profile> add <archive.tgz>`. Its turn-control 0.1.0 dependency resolves through the public GitHub release; no package is published to npm. QQ routing additionally requires enabled turn-control and Chat runtimes. The classifier service itself does not connect to QQ.

Open this bundle's owner settings page in the DSH plugin manager. Configure and enable the classifier before enabling intent classification in turn control. Set both `provider` and `model`, or leave both empty to use the Host route. Credentials stay in the Host credential service. Settings changes require an idle classifier; new unaddressed decisions delegate to the basic rule during maintenance.

<a id="decisions-and-cancellation"></a>
## Decisions and cancellation

A trusted consumer supplies a bounded conversation snapshot and an opaque context ID; a model or chat member must not choose another conversation's context ID. The service accepts only strict one-field decision JSON: `reply`, `ignore` or `default`. Malformed or extra output delegates to Chat's basic rules. Media labels reveal only their type. Explicitly addressed messages bypass classification.

Concurrency, pending requests, live Sessions, input size and rotation limits are configurable. One context runs serially while independent contexts can progress concurrently. After caller cancellation or shutdown, a result completed during interval cleanup is rejected. Disposal joins admitted work. Classifiers can still misread ambiguous or untrusted conversation; the result is a routing decision, not a factual answer or permission grant.

<a id="privacy-and-storage"></a>
## Privacy and storage

The selected model receives the group text snapshot, and DSH stores model-visible input in its own Session log. Member aliases omit direct protocol IDs, but text can contain personal information. This plugin mounts no persona or skills and exposes no model tools. It suppresses optional runtime context; required Host context may remain, so review the Host composition before deployment.

Rotation counts input characters and turns, not provider tokens. Eviction and rotation close live handles while retaining durable Session logs; these logs can accumulate. Protect the local profile, credential service and Session storage. The consuming policy binds context identity and output disclosure; this service does not authorize QQ recipients or disclose historical conversations.

## Model Experience

The Host model runs only after a trusted consumer submits a structured history and candidate snapshot. The classifier mounts no main-chat persona or model tools and returns only a decision. It sends no explanations, thinking or decision JSON to QQ. The consumer owns the final answer and destination.

<a id="verification-and-limits"></a>
## Verification and limits

`npm run check` builds strict Host/Client programs, exercises synthetic fixtures and validates the package. Source tests include queued cancellation, fairness, Session rotation, malformed/tool output, external interval interference and late cleanup. These tests send no QQ messages. Reports separate local controlled model fixtures, real API scenarios and actual client delivery.

The isolated SDK, Web, consumer and composed-turn scripts take explicit release archives. Release notes identify the exact public-version composition and cross-platform checks executed for each archive. Earlier synthetic real-model trials are recorded separately; they are not comparative intelligence or natural-conversation benchmarks. Real QQ, Desktop and full media understanding are not verified here.

## Known Limitations and Deferred Work

Enabled means the service is registered, not that upstream authentication or model quality has been verified. Consumers supply cancellation or deadline signals. This package provides no independent search, vision, long-term personal memory, QQ delivery or bot identity detection. Bounded snapshots can be truncated and classification can be wrong; the scope of release verification is listed above.

## Dev Note

GitHub archives are released independently; follow the repository's release notes for the exact verified artifact and matrix.
