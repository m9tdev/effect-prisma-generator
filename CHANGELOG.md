# Changelog

## [0.5.0] (2025-11-26)

### BREAKING CHANGES

* **transactions:** Transactions now run in the same fiber as the parent effect instead of spawning a new fiber via `Runtime.runPromiseExit`. This fixes issues where `FiberRef` modifications (like `HttpApiBuilder.securitySetCookie`) inside transactions were lost. If you relied on fiber isolation in transactions, this is a breaking change.

### Features

* **transactions:** Callback-free transaction implementation using `Effect.acquireUseRelease` - modifications to `FiberRef`, `Ref`, and service state inside transactions are now visible to the parent effect
* **transactions:** Add `transactionOptions` to layer config for default isolation level
* **config:** Add `importFileExtension` option for ESM compatibility (e.g., `.js` extensions in imports)
* **config:** Add `errorImportPath` for custom error class mapping
* **api:** Add `Prisma.layer`, `Prisma.layerEffect`, and `Prisma.Live` for improved ergonomics
* **types:** Add comprehensive type tests for select/include narrowing

### Bug Fixes

* **config:** Make `errorImportPath` relative to schema.prisma location, not output directory
* **layers:** Fix layer composition in nested transaction tests using `Layer.provideMerge`
* **compat:** Improve Prisma 6/7 compatibility (no version config needed)

## [0.4.0](https://github.com/m9tdev/effect-prisma-generator/compare/v0.3.3...v0.4.0) (2025-11-20)


### Features

* add operation specific errors ([3704f08](https://github.com/m9tdev/effect-prisma-generator/commit/3704f08409e42c5c607832e901d2c29dac61032b))

## [0.3.3](https://github.com/m9tdev/effect-prisma-generator/compare/v0.3.2...v0.3.3) (2025-11-20)


### Bug Fixes

* preserve error types in transactions ([79f0ed4](https://github.com/m9tdev/effect-prisma-generator/commit/79f0ed48bb086eb1c0b8cf6d74e0b347f2f974f2))

## [0.3.2](https://github.com/m9tdev/effect-prisma-generator/compare/v0.3.1...v0.3.2) (2025-11-20)


### Bug Fixes

* add missing tx in transaction ([fbd0071](https://github.com/m9tdev/effect-prisma-generator/commit/fbd00716b1b31ef5f273f211ec4e817adda5ee4a))

## [0.3.1](https://github.com/m9tdev/effect-prisma-generator/compare/v0.3.0...v0.3.1) (2025-11-20)


### Bug Fixes

* reuse parent transaction for nested transactions ([753b917](https://github.com/m9tdev/effect-prisma-generator/commit/753b91777ce3a87387dba555e26318e3f3863215))

## [0.3.0](https://github.com/m9tdev/effect-prisma-generator/compare/v0.2.1...v0.3.0) (2025-11-20)


### Features

* add transaction support ([ff08249](https://github.com/m9tdev/effect-prisma-generator/commit/ff082498c4fd1b1a352e6ebec19b21beb7abe06d))

## [0.2.1](https://github.com/m9tdev/effect-prisma-generator/compare/v0.2.0...v0.2.1) (2025-11-20)


### Bug Fixes

* use PrismaClient arg and return types ([06202aa](https://github.com/m9tdev/effect-prisma-generator/commit/06202aa0442fde759c897504fa94876fb260e6d7))

## [0.2.0](https://github.com/m9tdev/effect-prisma-generator/compare/v0.1.0...v0.2.0) (2025-11-20)


### Features

* add clientImportPath option ([767961e](https://github.com/m9tdev/effect-prisma-generator/commit/767961ef5c70a4f1a50c5c87e20cac5f5e88e618))

## 0.1.0 (2025-11-19)


### Features

* initial version ([088d63b](https://github.com/m9tdev/effect-prisma-generator/commit/088d63bb1d79078796cfa9477328ea3fea8ec3e6))


### Miscellaneous Chores

* release 0.1.0 ([1812b48](https://github.com/m9tdev/effect-prisma-generator/commit/1812b48ce6852155f82d0940284e7bc936544236))
