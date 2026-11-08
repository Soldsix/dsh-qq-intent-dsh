---
description: "Use native DSH agents to classify optional group-chat replies."
kind: "package-bundle"
---
# dsh-qq-intent-dsh

English | [中文](README.zh.md)

## Summary

This development bundle supplies `qqTurnIntent` through DSH's configured model and durable Session services. It is disabled by default and needs the separate `dsh-qq-turn-control` bundle. Isolated DSH integration, a Web settings page and small synthetic real-model decision tests have run; Linux, real QQ and natural end-to-end conversation remain unverified, so it is not a release candidate.

## Use and limits

Install the bundle into a DSH 0.2.2-rc.1 profile alongside dsh-qq-turn-control 0.1.0-development. Use its owner settings page in the DSH plugin manager to configure and enable it before enabling intent classification in turn control. Set both `provider` and `model`, or leave both empty to use the Host model route. The page never edits credentials; configure them through the Host. Saving requires an idle classifier and briefly delegates new unaddressed decisions to the basic rule while settings change.

After installing the shared messaging library, chat and turn-control development packages, install this bundle with `dsh plugin --profile <profile> add <archive.tgz>`. These development dependencies are not yet published to a public registry; supply their verified archives when testing locally.

Only strict decision JSON is accepted. Unknown or malformed output delegates to the chat plugin's basic rules. Explicitly addressed messages remain handled by chat directly. Group contexts have separate native Sessions, with configurable concurrency, queue, live-Session, input-size and rotation limits. Rotation limits user-input characters and turn count, not provider tokens; durable DSH Session logs remain on disk and can accumulate after eviction or rotation. A model can still misclassify ambiguous conversations or be influenced by untrusted text; review behavior before enabling it in a real group.

## Testing and privacy

`npm test` uses synthetic fixtures and does not send QQ messages. The classifier sends group text from the selected context snapshot to the selected model and stores model-visible input in DSH Session logs. Member IDs in the interface are temporary aliases, but message text can contain personal information. The plugin does not mount a persona or skills, and media labels contain no image or audio content. It suppresses optional runtime context; required Host context can still be included, so inspect the Host composition before deployment. Protect the profile, model credentials and Session storage separately.
