# Changelog

## [0.7.1](https://github.com/m9tdev/effect-prisma-generator/compare/v0.7.0...v0.7.1) (2025-12-03)


### Bug Fixes

* correctly infer groupBy error type ([30590fd](https://github.com/m9tdev/effect-prisma-generator/commit/30590fd163db7a8577d3cdc80af9858431b5eeef))

## [0.7.0](https://github.com/m9tdev/effect-prisma-generator/compare/v0.6.0...v0.7.0) (2025-11-28)


### Features

* output to a file instead of directory ([#10](https://github.com/m9tdev/effect-prisma-generator/issues/10)) ([da9c5de](https://github.com/m9tdev/effect-prisma-generator/commit/da9c5debebd5103690dbeef9bb92ca044307e72c))


### Bug Fixes

* correctly infer groupBy return type ([60addd2](https://github.com/m9tdev/effect-prisma-generator/commit/60addd2b818c51d2f646ba3cd08494a6b3ec392c))

## [0.6.0](https://github.com/m9tdev/effect-prisma-generator/compare/v0.5.0...v0.6.0) (2025-11-28)


### ⚠ BREAKING CHANGES

* PrismaService itself (instead of it's functions) now depends on PrismaClientService.
* The type of PrismaClientService is now PrismaClient instead of { client: PrismaClientService; tx: Prisma.TransactionClient }

### Bug Fixes

* PrismaService itself (instead of it's functions) now depends on PrismaClientService. ([488a18e](https://github.com/m9tdev/effect-prisma-generator/commit/488a18e07feae5cf7d4ba534858970580f3dddba))
* remove PrismaClientService dependency from PrismaService ([488a18e](https://github.com/m9tdev/effect-prisma-generator/commit/488a18e07feae5cf7d4ba534858970580f3dddba))


### Code Refactoring

* The type of PrismaClientService is now PrismaClient instead of { client: PrismaClientService; tx: Prisma.TransactionClient } ([488a18e](https://github.com/m9tdev/effect-prisma-generator/commit/488a18e07feae5cf7d4ba534858970580f3dddba))

## [0.5.0](https://github.com/m9tdev/effect-prisma-generator/compare/v0.4.0...v0.5.0) (2025-11-28)


### ⚠ BREAKING CHANGES

* replace LivePrismaLayer with createPrismaClientLayer

### Features

* upgrade to prisma v7 ([b1b4bfd](https://github.com/m9tdev/effect-prisma-generator/commit/b1b4bfdb1611aa54217c10bfa6c26498ef86a620))


### Bug Fixes

* remove unnecessary queryEngine requirement ([79d8a16](https://github.com/m9tdev/effect-prisma-generator/commit/79d8a1694e8b6fe7902ac3c76fd6048134b747c4))
* replace LivePrismaLayer with createPrismaClientLayer ([6329444](https://github.com/m9tdev/effect-prisma-generator/commit/6329444ad2538dd28429ac4bf40b7be47039433e))
* use generic arg types to fix return types ([bce858d](https://github.com/m9tdev/effect-prisma-generator/commit/bce858d2b475766283352e7b608d18490152b5d7))


### Miscellaneous Chores

* release 0.5.0 ([3056c22](https://github.com/m9tdev/effect-prisma-generator/commit/3056c228d6c878d37040b37292d73596901707ad))

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
