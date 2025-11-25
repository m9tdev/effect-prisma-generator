import { describe, expect, expectTypeOf, it } from "@effect/vitest";
import { Data, Effect, Layer } from "effect";
import {
  LivePrismaLayer,
  PrismaService,
  PrismaClientService,
  PrismaUniqueConstraintError,
  PrismaRecordNotFoundError,
  PrismaForeignKeyConstraintError,
} from "./generated/effect/index.js";
import { Prisma } from "./generated/client/index.js";

// PrismaService.Default depends on PrismaClientService, so merge them
const MainLayer = Layer.merge(LivePrismaLayer, PrismaService.Default);

describe("Prisma 6 Effect Generator", () => {
  // ============================================
  // CRUD Operations
  // ============================================

  describe("CRUD operations", () => {
    it.effect("create - should create a record", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email = `create-${Date.now()}@example.com`;

        const user = yield* prisma.user.create({
          data: { email, name: "Test User" },
        });

        expect(user.email).toBe(email);
        expect(user.name).toBe("Test User");
        expect(user.id).toBeTypeOf("number");

        // Cleanup
        yield* prisma.user.delete({ where: { id: user.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("findUnique - should find a record by unique field", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email = `find-unique-${Date.now()}@example.com`;

        const created = yield* prisma.user.create({
          data: { email, name: "Find Me" },
        });

        // Find by id
        const byId = yield* prisma.user.findUnique({
          where: { id: created.id },
        });
        expect(byId?.email).toBe(email);

        // Find by email (unique field)
        const byEmail = yield* prisma.user.findUnique({
          where: { email },
        });
        expect(byEmail?.id).toBe(created.id);

        // Not found returns null
        const notFound = yield* prisma.user.findUnique({
          where: { id: 999999 },
        });
        expect(notFound).toBeNull();

        // Cleanup
        yield* prisma.user.delete({ where: { id: created.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("findUniqueOrThrow - should throw when not found", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        const error = yield* prisma.user
          .findUniqueOrThrow({ where: { id: 999999 } })
          .pipe(Effect.flip);

        expect(error).toBeInstanceOf(PrismaRecordNotFoundError);
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("findFirstOrThrow - should throw when not found", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        const error = yield* prisma.user
          .findFirstOrThrow({ where: { id: 999999 } })
          .pipe(Effect.flip);

        expect(error).toBeInstanceOf(PrismaRecordNotFoundError);
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("findFirstOrThrow - should return record when found", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email = `find-first-throw-${Date.now()}@example.com`;

        const created = yield* prisma.user.create({
          data: { email, name: "Find First Throw" },
        });

        const found = yield* prisma.user.findFirstOrThrow({
          where: { email },
        });

        expect(found.id).toBe(created.id);

        // Cleanup
        yield* prisma.user.delete({ where: { id: created.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("findFirst - should find first matching record", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `find-first-${Date.now()}`;

        // Create multiple users
        yield* prisma.user.createMany({
          data: [
            { email: `${prefix}-a@example.com`, name: "Alice" },
            { email: `${prefix}-b@example.com`, name: "Bob" },
          ],
        });

        // Find first with ordering
        const first = yield* prisma.user.findFirst({
          where: { email: { startsWith: prefix } },
          orderBy: { name: "asc" },
        });

        expect(first?.name).toBe("Alice");

        // Cleanup
        yield* prisma.user.deleteMany({
          where: { email: { startsWith: prefix } },
        });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("findMany - should find multiple records with filters", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `find-many-${Date.now()}`;

        // Create test data
        yield* prisma.user.createMany({
          data: [
            { email: `${prefix}-1@example.com`, name: "User 1" },
            { email: `${prefix}-2@example.com`, name: "User 2" },
            { email: `${prefix}-3@example.com`, name: "User 3" },
          ],
        });

        // Find with where clause
        const users = yield* prisma.user.findMany({
          where: { email: { startsWith: prefix } },
          orderBy: { email: "asc" },
        });

        expect(users).toHaveLength(3);
        expect(users[0].name).toBe("User 1");

        // Cleanup
        yield* prisma.user.deleteMany({
          where: { email: { startsWith: prefix } },
        });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("update - should update a record", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email = `update-${Date.now()}@example.com`;

        const user = yield* prisma.user.create({
          data: { email, name: "Original Name" },
        });

        const updated = yield* prisma.user.update({
          where: { id: user.id },
          data: { name: "Updated Name" },
        });

        expect(updated.name).toBe("Updated Name");
        expect(updated.email).toBe(email);

        // Cleanup
        yield* prisma.user.delete({ where: { id: user.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("upsert - should create or update", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email = `upsert-${Date.now()}@example.com`;

        // First upsert creates
        const created = yield* prisma.user.upsert({
          where: { email },
          create: { email, name: "Created" },
          update: { name: "Updated" },
        });

        expect(created.name).toBe("Created");

        // Second upsert updates
        const updated = yield* prisma.user.upsert({
          where: { email },
          create: { email, name: "Created" },
          update: { name: "Updated" },
        });

        expect(updated.name).toBe("Updated");
        expect(updated.id).toBe(created.id);

        // Cleanup
        yield* prisma.user.delete({ where: { id: created.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("delete - should delete a record", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email = `delete-${Date.now()}@example.com`;

        const user = yield* prisma.user.create({
          data: { email, name: "To Delete" },
        });

        const deleted = yield* prisma.user.delete({
          where: { id: user.id },
        });

        expect(deleted.id).toBe(user.id);

        // Verify deleted
        const found = yield* prisma.user.findUnique({
          where: { id: user.id },
        });
        expect(found).toBeNull();
      }).pipe(Effect.provide(MainLayer)),
    );
  });

  // ============================================
  // Batch Operations
  // ============================================

  describe("Batch operations", () => {
    it.effect("createMany - should create multiple records", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `create-many-${Date.now()}`;

        const result = yield* prisma.user.createMany({
          data: [
            { email: `${prefix}-1@example.com`, name: "User 1" },
            { email: `${prefix}-2@example.com`, name: "User 2" },
          ],
        });

        expect(result.count).toBe(2);

        // Cleanup
        yield* prisma.user.deleteMany({
          where: { email: { startsWith: prefix } },
        });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("createManyAndReturn - should create and return records", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `create-many-return-${Date.now()}`;

        const users = yield* prisma.user.createManyAndReturn({
          data: [
            { email: `${prefix}-1@example.com`, name: "User 1" },
            { email: `${prefix}-2@example.com`, name: "User 2" },
          ],
        });

        expect(users).toHaveLength(2);
        expect(users[0].email).toBe(`${prefix}-1@example.com`);
        expect(users[1].email).toBe(`${prefix}-2@example.com`);
        expect(users[0].id).toBeTypeOf("number");

        // Cleanup
        yield* prisma.user.deleteMany({
          where: { email: { startsWith: prefix } },
        });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("createManyAndReturn - should support select", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `create-many-select-${Date.now()}`;

        const users = yield* prisma.user.createManyAndReturn({
          data: [
            { email: `${prefix}-1@example.com`, name: "User 1" },
          ],
          select: { id: true, email: true },
        });

        expect(users).toHaveLength(1);
        expect(users[0].email).toBe(`${prefix}-1@example.com`);
        expect(users[0].id).toBeTypeOf("number");
        // @ts-expect-error - name should not be selected
        expect(users[0].name).toBeUndefined();

        // Cleanup
        yield* prisma.user.deleteMany({
          where: { email: { startsWith: prefix } },
        });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("updateMany - should update multiple records", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `update-many-${Date.now()}`;

        yield* prisma.user.createMany({
          data: [
            { email: `${prefix}-1@example.com`, name: "Original" },
            { email: `${prefix}-2@example.com`, name: "Original" },
          ],
        });

        const result = yield* prisma.user.updateMany({
          where: { email: { startsWith: prefix } },
          data: { name: "Updated" },
        });

        expect(result.count).toBe(2);

        // Verify updates
        const users = yield* prisma.user.findMany({
          where: { email: { startsWith: prefix } },
        });
        expect(users.every((u) => u.name === "Updated")).toBe(true);

        // Cleanup
        yield* prisma.user.deleteMany({
          where: { email: { startsWith: prefix } },
        });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("updateManyAndReturn - should update and return records", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `update-many-return-${Date.now()}`;

        yield* prisma.user.createMany({
          data: [
            { email: `${prefix}-1@example.com`, name: "Original 1" },
            { email: `${prefix}-2@example.com`, name: "Original 2" },
          ],
        });

        const users = yield* prisma.user.updateManyAndReturn({
          where: { email: { startsWith: prefix } },
          data: { name: "Updated" },
        });

        expect(users).toHaveLength(2);
        expect(users.every((u) => u.name === "Updated")).toBe(true);
        expect(users[0].id).toBeTypeOf("number");

        // Cleanup
        yield* prisma.user.deleteMany({
          where: { email: { startsWith: prefix } },
        });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("updateManyAndReturn - should support select", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `update-many-select-${Date.now()}`;

        yield* prisma.user.createMany({
          data: [
            { email: `${prefix}-1@example.com`, name: "Original" },
          ],
        });

        const users = yield* prisma.user.updateManyAndReturn({
          where: { email: { startsWith: prefix } },
          data: { name: "Updated" },
          select: { id: true, name: true },
        });

        expect(users).toHaveLength(1);
        expect(users[0].name).toBe("Updated");
        // @ts-expect-error - email should not be selected
        expect(users[0].email).toBeUndefined();

        // Cleanup
        yield* prisma.user.deleteMany({
          where: { email: { startsWith: prefix } },
        });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("deleteMany - should delete multiple records", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `delete-many-${Date.now()}`;

        yield* prisma.user.createMany({
          data: [
            { email: `${prefix}-1@example.com`, name: "User 1" },
            { email: `${prefix}-2@example.com`, name: "User 2" },
          ],
        });

        const result = yield* prisma.user.deleteMany({
          where: { email: { startsWith: prefix } },
        });

        expect(result.count).toBe(2);
      }).pipe(Effect.provide(MainLayer)),
    );
  });

  // ============================================
  // Aggregation Operations
  // ============================================

  describe("Aggregation operations", () => {
    it.effect("count - should count records", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `count-${Date.now()}`;

        yield* prisma.user.createMany({
          data: [
            { email: `${prefix}-1@example.com`, name: "User 1" },
            { email: `${prefix}-2@example.com`, name: "User 2" },
            { email: `${prefix}-3@example.com`, name: "User 3" },
          ],
        });

        const count = yield* prisma.user.count({
          where: { email: { startsWith: prefix } },
        });

        expect(count).toBe(3);

        // Cleanup
        yield* prisma.user.deleteMany({
          where: { email: { startsWith: prefix } },
        });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("aggregate - should aggregate numeric fields", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `aggregate-${Date.now()}`;

        yield* prisma.user.createMany({
          data: [
            { email: `${prefix}-1@example.com`, name: "User 1" },
            { email: `${prefix}-2@example.com`, name: "User 2" },
          ],
        });

        const result = yield* prisma.user.aggregate({
          where: { email: { startsWith: prefix } },
          _count: { id: true },
          _max: { id: true },
          _min: { id: true },
        });

        expect(result._count.id).toBe(2);
        expect(result._max.id).toBeTypeOf("number");
        expect(result._min.id).toBeTypeOf("number");

        // Cleanup
        yield* prisma.user.deleteMany({
          where: { email: { startsWith: prefix } },
        });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("groupBy - should group records", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `groupby-${Date.now()}`;

        yield* prisma.user.createMany({
          data: [
            { email: `${prefix}-1@example.com`, name: "Alice" },
            { email: `${prefix}-2@example.com`, name: "Alice" },
            { email: `${prefix}-3@example.com`, name: "Bob" },
          ],
        });

        const groups = yield* prisma.user.groupBy({
          by: ["name"],
          where: { email: { startsWith: prefix } },
          _count: { id: true },
        });

        expect(groups).toHaveLength(2);
        const aliceGroup = groups.find((g) => g.name === "Alice");
        expect(aliceGroup?._count.id).toBe(2);

        // Cleanup
        yield* prisma.user.deleteMany({
          where: { email: { startsWith: prefix } },
        });
      }).pipe(Effect.provide(MainLayer)),
    );
  });

  // ============================================
  // Pagination
  // ============================================

  describe("Pagination", () => {
    it.effect("should support take and skip pagination", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `pagination-${Date.now()}`;

        // Create 5 users
        yield* prisma.user.createMany({
          data: Array.from({ length: 5 }, (_, i) => ({
            email: `${prefix}-${i}@example.com`,
            name: `User ${i}`,
          })),
        });

        // Take/Skip pagination
        const page1 = yield* prisma.user.findMany({
          where: { email: { startsWith: prefix } },
          orderBy: { email: "asc" },
          take: 2,
          skip: 0,
        });
        expect(page1).toHaveLength(2);
        expect(page1[0].name).toBe("User 0");

        const page2 = yield* prisma.user.findMany({
          where: { email: { startsWith: prefix } },
          orderBy: { email: "asc" },
          take: 2,
          skip: 2,
        });
        expect(page2).toHaveLength(2);
        expect(page2[0].name).toBe("User 2");

        // Cleanup
        yield* prisma.user.deleteMany({
          where: { email: { startsWith: prefix } },
        });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should support cursor-based pagination", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `cursor-${Date.now()}`;

        // Create 5 users and get their IDs
        const users = yield* prisma.user.createManyAndReturn({
          data: Array.from({ length: 5 }, (_, i) => ({
            email: `${prefix}-${i}@example.com`,
            name: `User ${i}`,
          })),
        });

        // Sort by id to ensure consistent ordering
        const sortedUsers = [...users].sort((a, b) => a.id - b.id);

        // First page: get first 2 users
        const page1 = yield* prisma.user.findMany({
          where: { email: { startsWith: prefix } },
          orderBy: { id: "asc" },
          take: 2,
        });
        expect(page1).toHaveLength(2);
        expect(page1[0].id).toBe(sortedUsers[0].id);
        expect(page1[1].id).toBe(sortedUsers[1].id);

        // Second page: cursor to last item of page1, skip it, take next 2
        const page2 = yield* prisma.user.findMany({
          where: { email: { startsWith: prefix } },
          orderBy: { id: "asc" },
          cursor: { id: page1[1].id },
          skip: 1, // Skip the cursor itself
          take: 2,
        });
        expect(page2).toHaveLength(2);
        expect(page2[0].id).toBe(sortedUsers[2].id);
        expect(page2[1].id).toBe(sortedUsers[3].id);

        // Third page: should get remaining 1 user
        const page3 = yield* prisma.user.findMany({
          where: { email: { startsWith: prefix } },
          orderBy: { id: "asc" },
          cursor: { id: page2[1].id },
          skip: 1,
          take: 2,
        });
        expect(page3).toHaveLength(1);
        expect(page3[0].id).toBe(sortedUsers[4].id);

        // Cleanup
        yield* prisma.user.deleteMany({
          where: { email: { startsWith: prefix } },
        });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should support reverse pagination with negative take", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `reverse-${Date.now()}`;

        // Create users
        yield* prisma.user.createMany({
          data: Array.from({ length: 5 }, (_, i) => ({
            email: `${prefix}-${i}@example.com`,
            name: `User ${i}`,
          })),
        });

        // Query all our test users and sort by id to get consistent ordering
        const allUsers = yield* prisma.user.findMany({
          where: { email: { startsWith: prefix } },
          orderBy: { id: "asc" },
        });

        expect(allUsers).toHaveLength(5);
        const middleId = allUsers[2].id;

        // Get 2 items ending at the cursor (reverse direction)
        // With take: -2, Prisma returns the cursor and 1 item before it
        const beforeCursor = yield* prisma.user.findMany({
          where: { email: { startsWith: prefix } },
          orderBy: { id: "asc" },
          cursor: { id: middleId },
          take: -2, // Negative take = go backwards, including cursor
        });

        expect(beforeCursor).toHaveLength(2);
        // Cursor is inclusive - we get the cursor (index 2) and one item before (index 1)
        const beforeCursorIds = beforeCursor.map((u) => u.id).sort((a, b) => a - b);
        expect(beforeCursorIds).toEqual([allUsers[1].id, allUsers[2].id]);

        // Cleanup
        yield* prisma.user.deleteMany({
          where: { email: { startsWith: prefix } },
        });
      }).pipe(Effect.provide(MainLayer)),
    );
  });

  // ============================================
  // Relations
  // ============================================

  describe("Relations", () => {
    it.effect("should create records with relations", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email = `relations-${Date.now()}@example.com`;

        // Create user with posts
        const user = yield* prisma.user.create({
          data: {
            email,
            name: "Author",
            posts: {
              create: [
                { title: "Post 1", content: "Content 1" },
                { title: "Post 2", content: "Content 2" },
              ],
            },
          },
          include: { posts: true },
        });

        expect(user.posts).toHaveLength(2);
        expect(user.posts[0].authorId).toBe(user.id);

        // Cleanup
        yield* prisma.post.deleteMany({ where: { authorId: user.id } });
        yield* prisma.user.delete({ where: { id: user.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should query with include", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email = `include-query-${Date.now()}@example.com`;

        const user = yield* prisma.user.create({
          data: {
            email,
            name: "Author",
            posts: {
              create: { title: "Test Post", published: true },
            },
          },
        });

        // Query with include
        const found = yield* prisma.user.findUnique({
          where: { id: user.id },
          include: { posts: true },
        });

        expect(found?.posts).toHaveLength(1);
        expect(found?.posts[0].title).toBe("Test Post");

        // Cleanup
        yield* prisma.post.deleteMany({ where: { authorId: user.id } });
        yield* prisma.user.delete({ where: { id: user.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should query nested relations", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email = `nested-${Date.now()}@example.com`;

        const user = yield* prisma.user.create({
          data: {
            email,
            name: "Author",
            posts: {
              create: { title: "Nested Post" },
            },
          },
        });

        // Query post with author
        const posts = yield* prisma.post.findMany({
          where: { authorId: user.id },
          include: { author: true },
        });

        expect(posts[0].author.email).toBe(email);

        // Cleanup
        yield* prisma.post.deleteMany({ where: { authorId: user.id } });
        yield* prisma.user.delete({ where: { id: user.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should update nested relations", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email = `nested-update-${Date.now()}@example.com`;

        // Create user with posts
        const user = yield* prisma.user.create({
          data: {
            email,
            name: "Author",
            posts: {
              create: [
                { title: "Post 1", published: false },
                { title: "Post 2", published: false },
              ],
            },
          },
          include: { posts: true },
        });

        // Update user and nested posts
        const updated = yield* prisma.user.update({
          where: { id: user.id },
          data: {
            name: "Updated Author",
            posts: {
              updateMany: {
                where: { published: false },
                data: { published: true },
              },
            },
          },
          include: { posts: true },
        });

        expect(updated.name).toBe("Updated Author");
        expect(updated.posts.every((p) => p.published)).toBe(true);

        // Cleanup
        yield* prisma.post.deleteMany({ where: { authorId: user.id } });
        yield* prisma.user.delete({ where: { id: user.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should delete nested relations via cascade or explicit", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email = `nested-delete-${Date.now()}@example.com`;

        // Create user with posts
        const user = yield* prisma.user.create({
          data: {
            email,
            name: "Author",
            posts: {
              create: [{ title: "Post 1" }, { title: "Post 2" }],
            },
          },
          include: { posts: true },
        });

        expect(user.posts).toHaveLength(2);

        // Delete specific posts through nested operation
        const updated = yield* prisma.user.update({
          where: { id: user.id },
          data: {
            posts: {
              deleteMany: { title: "Post 1" },
            },
          },
          include: { posts: true },
        });

        expect(updated.posts).toHaveLength(1);
        expect(updated.posts[0].title).toBe("Post 2");

        // Cleanup
        yield* prisma.post.deleteMany({ where: { authorId: user.id } });
        yield* prisma.user.delete({ where: { id: user.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should connect/disconnect relations", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email1 = `connect-user1-${Date.now()}@example.com`;
        const email2 = `connect-user2-${Date.now()}@example.com`;

        // Create two users
        const user1 = yield* prisma.user.create({
          data: { email: email1, name: "User 1" },
        });
        const user2 = yield* prisma.user.create({
          data: { email: email2, name: "User 2" },
        });

        // Create post connected to user1
        const post = yield* prisma.post.create({
          data: {
            title: "Movable Post",
            author: { connect: { id: user1.id } },
          },
        });

        expect(post.authorId).toBe(user1.id);

        // Move post to user2 by updating the relation
        const moved = yield* prisma.post.update({
          where: { id: post.id },
          data: {
            author: { connect: { id: user2.id } },
          },
        });

        expect(moved.authorId).toBe(user2.id);

        // Cleanup
        yield* prisma.post.delete({ where: { id: post.id } });
        yield* prisma.user.delete({ where: { id: user1.id } });
        yield* prisma.user.delete({ where: { id: user2.id } });
      }).pipe(Effect.provide(MainLayer)),
    );
  });

  // ============================================
  // Transactions
  // ============================================

  describe("Transactions", () => {
    it.effect("should commit successful transactions", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email = `tx-success-${Date.now()}@example.com`;

        const result = yield* prisma.$transaction(
          Effect.gen(function* () {
            const user = yield* prisma.user.create({
              data: { email, name: "TX User" },
            });
            yield* prisma.post.create({
              data: { title: "TX Post", authorId: user.id },
            });
            return user;
          }),
        );

        // Verify both were created
        const user = yield* prisma.user.findUnique({
          where: { id: result.id },
          include: { posts: true },
        });
        expect(user?.posts).toHaveLength(1);

        // Cleanup
        yield* prisma.post.deleteMany({ where: { authorId: result.id } });
        yield* prisma.user.delete({ where: { id: result.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should rollback on failure", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email = `tx-rollback-${Date.now()}@example.com`;

        const program = prisma.$transaction(
          Effect.gen(function* () {
            yield* prisma.user.create({
              data: { email, name: "Will Rollback" },
            });
            yield* Effect.fail("Intentional failure");
          }),
        );

        yield* Effect.flip(program);

        // Verify rollback
        const user = yield* prisma.user.findUnique({ where: { email } });
        expect(user).toBeNull();
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should rollback nested transactions on outer failure", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email1 = `tx-nested-outer-${Date.now()}@example.com`;
        const email2 = `tx-nested-inner-${Date.now()}@example.com`;

        const program = prisma.$transaction(
          Effect.gen(function* () {
            yield* prisma.user.create({ data: { email: email1, name: "Outer" } });
            yield* prisma.$transaction(
              Effect.gen(function* () {
                yield* prisma.user.create({ data: { email: email2, name: "Inner" } });
              }),
            );
            yield* Effect.fail("Outer failure");
          }),
        );

        yield* Effect.flip(program);

        // Both should be rolled back
        const users = yield* prisma.user.findMany({
          where: { email: { in: [email1, email2] } },
        });
        expect(users).toHaveLength(0);
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("nested tx: inner fails uncaught - both rollback", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `tx-inner-fail-${Date.now()}`;

        const program = prisma.$transaction(
          Effect.gen(function* () {
            // Outer creates user
            yield* prisma.user.create({
              data: { email: `${prefix}-outer@example.com`, name: "Outer" },
            });

            // Inner fails - NOT caught
            yield* prisma.$transaction(
              Effect.gen(function* () {
                yield* prisma.user.create({
                  data: { email: `${prefix}-inner@example.com`, name: "Inner" },
                });
                yield* Effect.fail("Inner failure");
              }),
            );

            // This line never executes
            yield* prisma.user.create({
              data: { email: `${prefix}-after@example.com`, name: "After" },
            });
          }),
        );

        yield* Effect.flip(program);

        // ALL users should be rolled back (outer, inner, and "after" was never created)
        const users = yield* prisma.user.findMany({
          where: { email: { startsWith: prefix } },
        });
        expect(users).toHaveLength(0);
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("nested tx: inner succeeds, outer fails - both rollback", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `tx-inner-success-${Date.now()}`;

        const program = prisma.$transaction(
          Effect.gen(function* () {
            yield* prisma.user.create({
              data: { email: `${prefix}-outer@example.com`, name: "Outer" },
            });

            // Inner succeeds completely
            const innerUser = yield* prisma.$transaction(
              Effect.gen(function* () {
                const user = yield* prisma.user.create({
                  data: { email: `${prefix}-inner@example.com`, name: "Inner" },
                });
                yield* prisma.post.create({
                  data: { title: "Inner Post", authorId: user.id },
                });
                return user;
              }),
            );

            // Inner returned successfully
            expect(innerUser.email).toBe(`${prefix}-inner@example.com`);

            // But outer fails AFTER inner completed
            yield* Effect.fail("Outer failure after inner success");
          }),
        );

        yield* Effect.flip(program);

        // BOTH should be rolled back - inner's "success" doesn't escape outer
        const users = yield* prisma.user.findMany({
          where: { email: { startsWith: prefix } },
        });
        expect(users).toHaveLength(0);

        const posts = yield* prisma.post.findMany({
          where: { title: "Inner Post" },
        });
        expect(posts).toHaveLength(0);
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("nested tx: both succeed - both commit", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `tx-both-success-${Date.now()}`;

        const result = yield* prisma.$transaction(
          Effect.gen(function* () {
            const outerUser = yield* prisma.user.create({
              data: { email: `${prefix}-outer@example.com`, name: "Outer" },
            });

            const innerUser = yield* prisma.$transaction(
              Effect.gen(function* () {
                return yield* prisma.user.create({
                  data: { email: `${prefix}-inner@example.com`, name: "Inner" },
                });
              }),
            );

            return { outerUser, innerUser };
          }),
        );

        // Both should be committed
        const users = yield* prisma.user.findMany({
          where: { email: { startsWith: prefix } },
          orderBy: { email: "asc" },
        });
        expect(users).toHaveLength(2);
        expect(users[0].name).toBe("Inner");
        expect(users[1].name).toBe("Outer");

        // Cleanup
        yield* prisma.user.deleteMany({
          where: { email: { startsWith: prefix } },
        });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("nested tx: deeply nested (3 levels) - all rollback on innermost fail", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `tx-deep-${Date.now()}`;

        const program = prisma.$transaction(
          Effect.gen(function* () {
            yield* prisma.user.create({
              data: { email: `${prefix}-L1@example.com`, name: "Level 1" },
            });

            yield* prisma.$transaction(
              Effect.gen(function* () {
                yield* prisma.user.create({
                  data: { email: `${prefix}-L2@example.com`, name: "Level 2" },
                });

                yield* prisma.$transaction(
                  Effect.gen(function* () {
                    yield* prisma.user.create({
                      data: { email: `${prefix}-L3@example.com`, name: "Level 3" },
                    });
                    yield* Effect.fail("Deepest failure");
                  }),
                );
              }),
            );
          }),
        );

        yield* Effect.flip(program);

        // All 3 levels should be rolled back
        const users = yield* prisma.user.findMany({
          where: { email: { startsWith: prefix } },
        });
        expect(users).toHaveLength(0);
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("nested tx: catch inner failure - inner data PERSISTS (no savepoints)", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `tx-catch-inner-${Date.now()}`;

        // IMPORTANT: Nested $transaction calls share the SAME database transaction!
        // There are no savepoints - catching inner failure doesn't rollback inner's writes

        const result = yield* prisma.$transaction(
          Effect.gen(function* () {
            const outerUser = yield* prisma.user.create({
              data: { email: `${prefix}-outer@example.com`, name: "Outer" },
            });

            // Inner "fails" but we CATCH it - the data it created is NOT rolled back!
            const innerResult = yield* prisma
              .$transaction(
                Effect.gen(function* () {
                  yield* prisma.user.create({
                    data: { email: `${prefix}-inner@example.com`, name: "Inner" },
                  });
                  yield* Effect.fail("Inner failure");
                }),
              )
              .pipe(Effect.catchAll(() => Effect.succeed("inner-caught")));

            expect(innerResult).toBe("inner-caught");

            // Outer continues after catching inner
            yield* prisma.user.create({
              data: { email: `${prefix}-after@example.com`, name: "After" },
            });

            return outerUser;
          }),
        );

        // ALL THREE users are committed because nested txs share the same db transaction
        const users = yield* prisma.user.findMany({
          where: { email: { startsWith: prefix } },
          orderBy: { email: "asc" },
        });

        expect(users).toHaveLength(3);
        expect(users.map((u) => u.name)).toEqual(["After", "Inner", "Outer"]);
        // "Inner" IS in the list - its writes persisted despite the caught failure

        // Cleanup
        yield* prisma.user.deleteMany({
          where: { email: { startsWith: prefix } },
        });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("nested tx: inner creates data visible to outer within tx", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `tx-visibility-${Date.now()}`;

        const result = yield* prisma.$transaction(
          Effect.gen(function* () {
            // Inner creates a user
            const innerUser = yield* prisma.$transaction(
              Effect.gen(function* () {
                return yield* prisma.user.create({
                  data: { email: `${prefix}@example.com`, name: "Inner User" },
                });
              }),
            );

            // Outer can see and use the inner's created user
            const post = yield* prisma.post.create({
              data: { title: "Outer's Post", authorId: innerUser.id },
            });

            // Verify relationship
            const userWithPosts = yield* prisma.user.findUnique({
              where: { id: innerUser.id },
              include: { posts: true },
            });

            expect(userWithPosts?.posts).toHaveLength(1);
            expect(userWithPosts?.posts[0].title).toBe("Outer's Post");

            return { innerUser, post };
          }),
        );

        // Both should be committed
        const user = yield* prisma.user.findUnique({
          where: { id: result.innerUser.id },
          include: { posts: true },
        });
        expect(user?.posts).toHaveLength(1);

        // Cleanup
        yield* prisma.post.delete({ where: { id: result.post.id } });
        yield* prisma.user.delete({ where: { id: result.innerUser.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("nested tx: function with its own $transaction called from outer tx", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `tx-fn-${Date.now()}`;

        // A reusable function that wraps its work in a transaction
        // This function doesn't know if it's being called inside another tx or not
        const createUserWithPost = (email: string, postTitle: string) =>
          Effect.gen(function* () {
            const p = yield* PrismaService;
            return yield* p.$transaction(
              Effect.gen(function* () {
                const user = yield* p.user.create({
                  data: { email, name: "Function User" },
                });
                const post = yield* p.post.create({
                  data: { title: postTitle, authorId: user.id },
                });
                return { user, post };
              }),
            );
          });

        // Call the function OUTSIDE a transaction - works normally
        const standalone = yield* createUserWithPost(
          `${prefix}-standalone@example.com`,
          "Standalone Post"
        );
        expect(standalone.user.email).toBe(`${prefix}-standalone@example.com`);

        // Now call from INSIDE an outer transaction
        const outerResult = yield* prisma.$transaction(
          Effect.gen(function* () {
            // Create something in outer tx
            const outerUser = yield* prisma.user.create({
              data: { email: `${prefix}-outer@example.com`, name: "Outer User" },
            });

            // Call the function - its internal $transaction joins the outer one
            const fromFn = yield* createUserWithPost(
              `${prefix}-from-fn@example.com`,
              "Function Post"
            );

            // Now fail the outer transaction
            yield* Effect.fail("Outer failure after function call");

            return { outerUser, fromFn };
          }),
        ).pipe(Effect.flip);

        // The outer tx failed, so:
        // - "Outer User" should be rolled back
        // - The function's user and post should ALSO be rolled back
        // - But "Standalone" (created outside) should still exist

        const users = yield* prisma.user.findMany({
          where: { email: { startsWith: prefix } },
        });

        // Only standalone should exist
        expect(users).toHaveLength(1);
        expect(users[0].email).toBe(`${prefix}-standalone@example.com`);

        const posts = yield* prisma.post.findMany({
          where: { title: { in: ["Standalone Post", "Function Post"] } },
        });

        // Only standalone's post should exist
        expect(posts).toHaveLength(1);
        expect(posts[0].title).toBe("Standalone Post");

        // Cleanup
        yield* prisma.post.delete({ where: { id: standalone.post.id } });
        yield* prisma.user.delete({ where: { id: standalone.user.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("nested tx: composable service functions that use transactions", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `tx-compose-${Date.now()}`;

        // Imagine these are service layer functions
        const UserService = {
          createWithProfile: (email: string) =>
            Effect.gen(function* () {
              const p = yield* PrismaService;
              return yield* p.$transaction(
                Effect.gen(function* () {
                  const user = yield* p.user.create({
                    data: { email, name: "Service User" },
                  });
                  // In a real app, might create a Profile record too
                  return user;
                }),
              );
            }),
        };

        const PostService = {
          createForUser: (userId: number, title: string) =>
            Effect.gen(function* () {
              const p = yield* PrismaService;
              return yield* p.$transaction(
                Effect.gen(function* () {
                  return yield* p.post.create({
                    data: { title, authorId: userId },
                  });
                }),
              );
            }),
        };

        // Compose services in an outer transaction for atomicity
        const result = yield* prisma.$transaction(
          Effect.gen(function* () {
            const user = yield* UserService.createWithProfile(
              `${prefix}@example.com`
            );
            const post1 = yield* PostService.createForUser(user.id, "Post 1");
            const post2 = yield* PostService.createForUser(user.id, "Post 2");
            return { user, posts: [post1, post2] };
          }),
        );

        // All should be committed together
        const user = yield* prisma.user.findUnique({
          where: { id: result.user.id },
          include: { posts: true },
        });

        expect(user?.posts).toHaveLength(2);

        // Cleanup
        yield* prisma.post.deleteMany({ where: { authorId: result.user.id } });
        yield* prisma.user.delete({ where: { id: result.user.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("nested tx: service function failure rolls back entire composed tx", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `tx-svc-fail-${Date.now()}`;

        // Service that always fails after creating data
        const FailingService = {
          createAndFail: (email: string) =>
            Effect.gen(function* () {
              const p = yield* PrismaService;
              return yield* p.$transaction(
                Effect.gen(function* () {
                  yield* p.user.create({
                    data: { email, name: "Will Fail" },
                  });
                  yield* Effect.fail("Service failure");
                }),
              );
            }),
        };

        const program = prisma.$transaction(
          Effect.gen(function* () {
            // Create something first
            yield* prisma.user.create({
              data: { email: `${prefix}-before@example.com`, name: "Before" },
            });

            // Call failing service (uncaught)
            yield* FailingService.createAndFail(`${prefix}-failing@example.com`);

            // Never reached
            yield* prisma.user.create({
              data: { email: `${prefix}-after@example.com`, name: "After" },
            });
          }),
        );

        yield* Effect.flip(program);

        // Everything should be rolled back
        const users = yield* prisma.user.findMany({
          where: { email: { startsWith: prefix } },
        });
        expect(users).toHaveLength(0);
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should preserve custom error types in transactions", () =>
      Effect.gen(function* () {
        class CustomError extends Data.TaggedError("CustomError")<{
          message: string;
        }> {}

        const prisma = yield* PrismaService;

        const error = yield* prisma
          .$transaction(Effect.fail(new CustomError({ message: "custom" })))
          .pipe(Effect.flip);

        expect(error).toBeInstanceOf(CustomError);
        if (error instanceof CustomError) {
          expect(error.message).toBe("custom");
        }
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should rollback on Prisma errors within transaction", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email = `tx-prisma-error-${Date.now()}@example.com`;

        // First create a user outside transaction
        const existingUser = yield* prisma.user.create({
          data: { email, name: "Existing" },
        });

        // Try to create a new user and then duplicate in transaction
        const program = prisma.$transaction(
          Effect.gen(function* () {
            const newEmail = `tx-new-${Date.now()}@example.com`;
            yield* prisma.user.create({
              data: { email: newEmail, name: "New User" },
            });
            // This should fail with unique constraint
            yield* prisma.user.create({
              data: { email, name: "Duplicate" },
            });
          }),
        );

        const error = yield* Effect.flip(program);
        expect(error).toBeInstanceOf(PrismaUniqueConstraintError);

        // Verify the new user was rolled back (only existing user remains)
        const users = yield* prisma.user.findMany({
          where: { email: { contains: "tx-" } },
        });
        // Only the existing user should be there
        expect(users.filter((u) => u.email === email)).toHaveLength(1);
        expect(users.filter((u) => u.email.includes("tx-new"))).toHaveLength(0);

        // Cleanup
        yield* prisma.user.delete({ where: { id: existingUser.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should handle caught inner transaction failure", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email1 = `tx-outer-caught-${Date.now()}@example.com`;

        // Outer transaction succeeds even if inner fails (when caught)
        const result = yield* prisma.$transaction(
          Effect.gen(function* () {
            const user = yield* prisma.user.create({
              data: { email: email1, name: "Outer User" },
            });

            // Inner transaction fails but we catch it
            const innerResult = yield* prisma
              .$transaction(Effect.fail("Inner failure"))
              .pipe(
                Effect.catchAll(() => Effect.succeed("caught")),
              );

            expect(innerResult).toBe("caught");
            return user;
          }),
        );

        // Outer user should still be committed
        const user = yield* prisma.user.findUnique({
          where: { id: result.id },
        });
        expect(user).not.toBeNull();
        expect(user?.email).toBe(email1);

        // Cleanup
        yield* prisma.user.delete({ where: { id: result.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should persist data between sequential transactions", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email = `tx-sequential-${Date.now()}@example.com`;

        // First transaction creates a user
        const user = yield* prisma.$transaction(
          Effect.gen(function* () {
            return yield* prisma.user.create({
              data: { email, name: "Sequential User" },
            });
          }),
        );

        // Second transaction should see the user
        const foundInTx = yield* prisma.$transaction(
          Effect.gen(function* () {
            return yield* prisma.user.findUnique({
              where: { id: user.id },
            });
          }),
        );

        expect(foundInTx).not.toBeNull();
        expect(foundInTx?.email).toBe(email);

        // Cleanup
        yield* prisma.user.delete({ where: { id: user.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should support transaction with multiple operations and return value", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `tx-multi-${Date.now()}`;

        // Transaction with multiple operations returning computed value
        const stats = yield* prisma.$transaction(
          Effect.gen(function* () {
            // Create multiple users
            yield* prisma.user.createMany({
              data: [
                { email: `${prefix}-1@example.com`, name: "User 1" },
                { email: `${prefix}-2@example.com`, name: "User 2" },
                { email: `${prefix}-3@example.com`, name: "User 3" },
              ],
            });

            // Count them
            const count = yield* prisma.user.count({
              where: { email: { startsWith: prefix } },
            });

            // Update them
            yield* prisma.user.updateMany({
              where: { email: { startsWith: prefix } },
              data: { name: "Updated" },
            });

            // Get updated users
            const users = yield* prisma.user.findMany({
              where: { email: { startsWith: prefix } },
              select: { name: true },
            });

            return {
              created: count,
              allUpdated: users.every((u) => u.name === "Updated"),
            };
          }),
        );

        expect(stats.created).toBe(3);
        expect(stats.allUpdated).toBe(true);

        // Cleanup
        yield* prisma.user.deleteMany({
          where: { email: { startsWith: prefix } },
        });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should rollback all operations on late failure in transaction", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `tx-late-fail-${Date.now()}`;

        const program = prisma.$transaction(
          Effect.gen(function* () {
            // Create user
            yield* prisma.user.create({
              data: { email: `${prefix}-user@example.com`, name: "User" },
            });

            // Create another user with post
            const author = yield* prisma.user.create({
              data: {
                email: `${prefix}-author@example.com`,
                name: "Author",
                posts: {
                  create: { title: "Post 1" },
                },
              },
            });

            // Create more posts
            yield* prisma.post.create({
              data: { title: "Post 2", authorId: author.id },
            });

            // Fail at the end - everything should rollback
            yield* Effect.fail("Late failure");
          }),
        );

        yield* Effect.flip(program);

        // Verify all users rolled back
        const users = yield* prisma.user.findMany({
          where: { email: { startsWith: prefix } },
        });
        expect(users).toHaveLength(0);

        // Verify all posts rolled back
        const posts = yield* prisma.post.findMany({
          where: { title: { in: ["Post 1", "Post 2"] } },
        });
        expect(posts).toHaveLength(0);
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should rollback on Prisma OrThrow error same as Effect.fail", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `tx-orthrow-${Date.now()}`;

        // Test 1: Effect.fail() behavior
        const effectFailProgram = prisma.$transaction(
          Effect.gen(function* () {
            yield* prisma.user.create({
              data: { email: `${prefix}-effect@example.com`, name: "Effect User" },
            });
            yield* Effect.fail("Effect failure");
          }),
        );

        yield* Effect.flip(effectFailProgram);

        const effectUsers = yield* prisma.user.findMany({
          where: { email: `${prefix}-effect@example.com` },
        });
        expect(effectUsers).toHaveLength(0);

        // Test 2: Prisma findUniqueOrThrow error behavior
        const prismaErrorProgram = prisma.$transaction(
          Effect.gen(function* () {
            yield* prisma.user.create({
              data: { email: `${prefix}-prisma@example.com`, name: "Prisma User" },
            });
            // This will throw PrismaRecordNotFoundError
            yield* prisma.user.findUniqueOrThrow({ where: { id: 999999 } });
          }),
        );

        const error = yield* Effect.flip(prismaErrorProgram);
        expect(error).toBeInstanceOf(PrismaRecordNotFoundError);

        const prismaUsers = yield* prisma.user.findMany({
          where: { email: `${prefix}-prisma@example.com` },
        });
        expect(prismaUsers).toHaveLength(0);
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should rollback on findFirstOrThrow error in transaction", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `tx-firstorthrow-${Date.now()}`;

        const program = prisma.$transaction(
          Effect.gen(function* () {
            // Create a user first
            yield* prisma.user.create({
              data: { email: `${prefix}@example.com`, name: "Will Rollback" },
            });

            // Create a post for that user
            const users = yield* prisma.user.findMany({
              where: { email: { startsWith: prefix } },
            });
            yield* prisma.post.create({
              data: { title: "Orphan Post", authorId: users[0].id },
            });

            // Now fail with findFirstOrThrow on non-existent data
            yield* prisma.post.findFirstOrThrow({
              where: { title: "This Post Does Not Exist" },
            });
          }),
        );

        const error = yield* Effect.flip(program);
        expect(error).toBeInstanceOf(PrismaRecordNotFoundError);

        // Both user and post should be rolled back
        const users = yield* prisma.user.findMany({
          where: { email: { startsWith: prefix } },
        });
        expect(users).toHaveLength(0);

        const posts = yield* prisma.post.findMany({
          where: { title: "Orphan Post" },
        });
        expect(posts).toHaveLength(0);
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should rollback on update non-existent record in transaction", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `tx-update-fail-${Date.now()}`;

        const program = prisma.$transaction(
          Effect.gen(function* () {
            // Create a user
            yield* prisma.user.create({
              data: { email: `${prefix}@example.com`, name: "Will Rollback" },
            });

            // Try to update a non-existent user - this throws PrismaRecordNotFoundError
            yield* prisma.user.update({
              where: { id: 999999 },
              data: { name: "Won't Work" },
            });
          }),
        );

        const error = yield* Effect.flip(program);
        expect(error).toBeInstanceOf(PrismaRecordNotFoundError);

        // User should be rolled back
        const users = yield* prisma.user.findMany({
          where: { email: { startsWith: prefix } },
        });
        expect(users).toHaveLength(0);
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should NOT rollback when catching findUniqueOrThrow error", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `tx-catch-orthrow-${Date.now()}`;

        const result = yield* prisma.$transaction(
          Effect.gen(function* () {
            // Create a user
            const user = yield* prisma.user.create({
              data: { email: `${prefix}@example.com`, name: "Should Persist" },
            });

            // Try to find non-existent user, but CATCH the error
            const maybeUser = yield* prisma.user
              .findUniqueOrThrow({ where: { id: 999999 } })
              .pipe(
                Effect.catchAll((error) => {
                  expect(error).toBeInstanceOf(PrismaRecordNotFoundError);
                  return Effect.succeed(null);
                }),
              );

            expect(maybeUser).toBeNull();
            return user;
          }),
        );

        // User SHOULD be committed because we caught the error
        const user = yield* prisma.user.findUnique({
          where: { id: result.id },
        });
        expect(user).not.toBeNull();
        expect(user?.name).toBe("Should Persist");

        // Cleanup
        yield* prisma.user.delete({ where: { id: result.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should NOT rollback when catching findFirstOrThrow error", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `tx-catch-firstorthrow-${Date.now()}`;

        const result = yield* prisma.$transaction(
          Effect.gen(function* () {
            // Create user and post
            const user = yield* prisma.user.create({
              data: {
                email: `${prefix}@example.com`,
                name: "Should Persist",
                posts: { create: { title: "Real Post" } },
              },
              include: { posts: true },
            });

            // Try to find non-existent post, but CATCH the error
            const maybePost = yield* prisma.post
              .findFirstOrThrow({ where: { title: "Ghost Post" } })
              .pipe(
                Effect.catchTag("PrismaRecordNotFoundError", () =>
                  Effect.succeed(null),
                ),
              );

            expect(maybePost).toBeNull();
            return user;
          }),
        );

        // Both user and post SHOULD be committed
        const user = yield* prisma.user.findUnique({
          where: { id: result.id },
          include: { posts: true },
        });
        expect(user).not.toBeNull();
        expect(user?.posts).toHaveLength(1);
        expect(user?.posts[0].title).toBe("Real Post");

        // Cleanup
        yield* prisma.post.deleteMany({ where: { authorId: result.id } });
        yield* prisma.user.delete({ where: { id: result.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should NOT rollback when catching update error on non-existent", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `tx-catch-update-${Date.now()}`;

        const result = yield* prisma.$transaction(
          Effect.gen(function* () {
            // Create a user
            const user = yield* prisma.user.create({
              data: { email: `${prefix}@example.com`, name: "Should Persist" },
            });

            // Try to update non-existent, but CATCH the error
            const updateResult = yield* prisma.user
              .update({
                where: { id: 999999 },
                data: { name: "Ghost" },
              })
              .pipe(
                Effect.catchAll(() => Effect.succeed("caught")),
              );

            expect(updateResult).toBe("caught");
            return user;
          }),
        );

        // User SHOULD be committed
        const user = yield* prisma.user.findUnique({
          where: { id: result.id },
        });
        expect(user).not.toBeNull();

        // Cleanup
        yield* prisma.user.delete({ where: { id: result.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should NOT rollback when catching unique constraint error", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `tx-catch-unique-${Date.now()}`;
        const duplicateEmail = `${prefix}-dup@example.com`;

        // Create the "existing" user outside transaction
        const existing = yield* prisma.user.create({
          data: { email: duplicateEmail, name: "Existing" },
        });

        const result = yield* prisma.$transaction(
          Effect.gen(function* () {
            // Create a new user
            const newUser = yield* prisma.user.create({
              data: { email: `${prefix}-new@example.com`, name: "New User" },
            });

            // Try to create duplicate, but CATCH the error
            const duplicateResult = yield* prisma.user
              .create({ data: { email: duplicateEmail, name: "Duplicate" } })
              .pipe(
                Effect.catchTag("PrismaUniqueConstraintError", (error) => {
                  expect(error.cause.code).toBe("P2002");
                  return Effect.succeed("caught-duplicate");
                }),
              );

            expect(duplicateResult).toBe("caught-duplicate");
            return newUser;
          }),
        );

        // New user SHOULD be committed
        const newUser = yield* prisma.user.findUnique({
          where: { id: result.id },
        });
        expect(newUser).not.toBeNull();
        expect(newUser?.email).toBe(`${prefix}-new@example.com`);

        // Cleanup
        yield* prisma.user.delete({ where: { id: existing.id } });
        yield* prisma.user.delete({ where: { id: result.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should NOT rollback when catching FK constraint error", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `tx-catch-fk-${Date.now()}`;

        const result = yield* prisma.$transaction(
          Effect.gen(function* () {
            // Create a user
            const user = yield* prisma.user.create({
              data: { email: `${prefix}@example.com`, name: "Should Persist" },
            });

            // Try to create post with non-existent author, but CATCH the error
            const postResult = yield* prisma.post
              .create({
                data: { title: "Orphan", authorId: 999999 },
              })
              .pipe(
                Effect.catchTag("PrismaForeignKeyConstraintError", (error) => {
                  expect(error.cause.code).toBe("P2003");
                  return Effect.succeed("caught-fk");
                }),
              );

            expect(postResult).toBe("caught-fk");
            return user;
          }),
        );

        // User SHOULD be committed
        const user = yield* prisma.user.findUnique({
          where: { id: result.id },
        });
        expect(user).not.toBeNull();

        // Cleanup
        yield* prisma.user.delete({ where: { id: result.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should allow partial recovery with catchTag in transaction", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `tx-partial-${Date.now()}`;

        const result = yield* prisma.$transaction(
          Effect.gen(function* () {
            // Create first user
            const user1 = yield* prisma.user.create({
              data: { email: `${prefix}-1@example.com`, name: "User 1" },
            });

            // Try to find non-existent, catch and create fallback instead
            const user2 = yield* prisma.user
              .findUniqueOrThrow({ where: { email: `${prefix}-ghost@example.com` } })
              .pipe(
                Effect.catchTag("PrismaRecordNotFoundError", () =>
                  // Fallback: create the user instead
                  prisma.user.create({
                    data: { email: `${prefix}-2@example.com`, name: "Fallback User" },
                  }),
                ),
              );

            return { user1, user2 };
          }),
        );

        // Both users SHOULD exist
        const users = yield* prisma.user.findMany({
          where: { email: { startsWith: prefix } },
          orderBy: { email: "asc" },
        });

        expect(users).toHaveLength(2);
        expect(users[0].name).toBe("User 1");
        expect(users[1].name).toBe("Fallback User");

        // Cleanup
        yield* prisma.user.deleteMany({
          where: { email: { startsWith: prefix } },
        });
      }).pipe(Effect.provide(MainLayer)),
    );
  });

  // ============================================
  // Error Handling
  // ============================================

  describe("Error handling", () => {
    it.effect("should return PrismaUniqueConstraintError on duplicate", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email = `unique-error-${Date.now()}@example.com`;

        yield* prisma.user.create({ data: { email, name: "First" } });

        const error = yield* prisma.user
          .create({ data: { email, name: "Duplicate" } })
          .pipe(Effect.flip);

        expect(error).toBeInstanceOf(PrismaUniqueConstraintError);
        if (error instanceof PrismaUniqueConstraintError) {
          expect(error.cause.code).toBe("P2002");
        }

        // Cleanup
        yield* prisma.user.delete({ where: { email } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should return PrismaRecordNotFoundError on OrThrow methods", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        const findError = yield* prisma.user
          .findUniqueOrThrow({ where: { id: 999999 } })
          .pipe(Effect.flip);

        expect(findError).toBeInstanceOf(PrismaRecordNotFoundError);

        const findFirstError = yield* prisma.user
          .findFirstOrThrow({ where: { id: 999999 } })
          .pipe(Effect.flip);

        expect(findFirstError).toBeInstanceOf(PrismaRecordNotFoundError);
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should return PrismaForeignKeyConstraintError on invalid FK", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        // Try to create a post with a non-existent author
        const error = yield* prisma.post
          .create({
            data: {
              title: "Orphan Post",
              authorId: 999999, // Non-existent user
            },
          })
          .pipe(Effect.flip);

        expect(error).toBeInstanceOf(PrismaForeignKeyConstraintError);
        if (error instanceof PrismaForeignKeyConstraintError) {
          expect(error.cause.code).toBe("P2003");
        }
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should return PrismaRecordNotFoundError on update non-existent", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        const error = yield* prisma.user
          .update({
            where: { id: 999999 },
            data: { name: "Will Not Work" },
          })
          .pipe(Effect.flip);

        expect(error).toBeInstanceOf(PrismaRecordNotFoundError);
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("should return PrismaRecordNotFoundError on delete non-existent", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        const error = yield* prisma.user
          .delete({ where: { id: 999999 } })
          .pipe(Effect.flip);

        expect(error).toBeInstanceOf(PrismaRecordNotFoundError);
      }).pipe(Effect.provide(MainLayer)),
    );
  });

  // ============================================
  // Type Narrowing
  // ============================================

  describe("Type narrowing", () => {
    it.effect("select should narrow return type", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email = `type-select-${Date.now()}@example.com`;

        const user = yield* prisma.user.create({
          data: { email, name: "Type Test" },
        });

        const narrowed = yield* prisma.user.findUnique({
          where: { id: user.id },
          select: { id: true },
        });

        expectTypeOf(narrowed).toEqualTypeOf<{ id: number } | null>();
        expect(narrowed?.id).toBe(user.id);
        // @ts-expect-error - email should not exist
        expect(narrowed?.email).toBeUndefined();

        // Cleanup
        yield* prisma.user.delete({ where: { id: user.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("include should add relations to type", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email = `type-include-${Date.now()}@example.com`;

        const user = yield* prisma.user.create({
          data: {
            email,
            name: "Include Test",
            posts: { create: { title: "Post" } },
          },
          include: { posts: true },
        });

        expectTypeOf(user.posts).toEqualTypeOf<
          Array<{
            id: number;
            title: string;
            content: string | null;
            published: boolean;
            authorId: number;
          }>
        >();

        expect(user.posts).toHaveLength(1);

        // Cleanup
        yield* prisma.post.deleteMany({ where: { authorId: user.id } });
        yield* prisma.user.delete({ where: { id: user.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("findMany should return narrowed array type", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        const users = yield* prisma.user.findMany({
          select: { email: true },
        });

        expectTypeOf(users).toEqualTypeOf<{ email: string }[]>();
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("no select should return full model", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email = `type-full-${Date.now()}@example.com`;

        const user = yield* prisma.user.create({
          data: { email, name: "Full Model" },
        });

        const found = yield* prisma.user.findUnique({
          where: { id: user.id },
        });

        expectTypeOf(found).toEqualTypeOf<{
          id: number;
          email: string;
          name: string | null;
        } | null>();

        // Cleanup
        yield* prisma.user.delete({ where: { id: user.id } });
      }).pipe(Effect.provide(MainLayer)),
    );
  });

  // ============================================
  // Raw Queries
  // ============================================

  describe("Raw queries", () => {
    it.effect("$queryRaw should execute raw SELECT", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email = `raw-query-${Date.now()}@example.com`;

        yield* prisma.user.create({ data: { email, name: "Raw Query Test" } });

        // Use Prisma.sql to create the SQL object
        const result = yield* prisma.$queryRaw<{ email: string }[]>(
          Prisma.sql`SELECT email FROM User WHERE email = ${email}`
        );

        expect(result).toHaveLength(1);
        expect(result[0].email).toBe(email);

        // Cleanup
        yield* prisma.user.delete({ where: { email } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("$executeRaw should execute raw mutations", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email = `raw-execute-${Date.now()}@example.com`;

        yield* prisma.user.create({ data: { email, name: "Original" } });

        // Use Prisma.sql to create the SQL object
        const affected = yield* prisma.$executeRaw(
          Prisma.sql`UPDATE User SET name = 'Updated via Raw' WHERE email = ${email}`
        );

        expect(affected).toBe(1);

        const user = yield* prisma.user.findUnique({ where: { email } });
        expect(user?.name).toBe("Updated via Raw");

        // Cleanup
        yield* prisma.user.delete({ where: { email } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("$queryRawUnsafe should execute unsafe SELECT", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email = `raw-unsafe-query-${Date.now()}@example.com`;

        yield* prisma.user.create({ data: { email, name: "Unsafe Query Test" } });

        // Use unsafe variant with string query and parameters
        const result = yield* prisma.$queryRawUnsafe<{ email: string }[]>(
          "SELECT email FROM User WHERE email = ?",
          email
        );

        expect(result).toHaveLength(1);
        expect(result[0].email).toBe(email);

        // Cleanup
        yield* prisma.user.delete({ where: { email } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("$executeRawUnsafe should execute unsafe mutations", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email = `raw-unsafe-execute-${Date.now()}@example.com`;

        yield* prisma.user.create({ data: { email, name: "Original" } });

        // Use unsafe variant with string query and parameters
        const affected = yield* prisma.$executeRawUnsafe(
          "UPDATE User SET name = ? WHERE email = ?",
          "Updated via Unsafe",
          email
        );

        expect(affected).toBe(1);

        const user = yield* prisma.user.findUnique({ where: { email } });
        expect(user?.name).toBe("Updated via Unsafe");

        // Cleanup
        yield* prisma.user.delete({ where: { email } });
      }).pipe(Effect.provide(MainLayer)),
    );
  });

  // ============================================
  // Service Layer Composition Tests
  // Tests for composing Effect services that wrap PrismaService
  // ============================================

  describe("Service layer composition with transactions", () => {
    /**
     * These tests verify that services built on top of PrismaService
     * correctly participate in transactions at any level of composition.
     */

    it.effect("single service layer wrapping PrismaService - tx rollback works", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `single-layer-${Date.now()}`;

        // A repository service that wraps PrismaService
        class UserRepo extends Effect.Service<UserRepo>()("UserRepo", {
          effect: Effect.gen(function* () {
            const db = yield* PrismaService;
            return {
              create: (email: string, name: string) =>
                db.user.create({ data: { email, name } }),
              findByEmail: (email: string) =>
                db.user.findUnique({ where: { email } }),
            };
          }),
        }) {}

        const RepoLayer = Layer.merge(
          Layer.merge(LivePrismaLayer, PrismaService.Default),
          UserRepo.Default,
        );

        // Transaction that fails should rollback
        const program = prisma.$transaction(
          Effect.gen(function* () {
            const repo = yield* UserRepo;
            yield* repo.create(`${prefix}@example.com`, "Test User");
            yield* Effect.fail("Intentional failure");
          }),
        );

        yield* Effect.flip(program.pipe(Effect.provide(RepoLayer)));

        // User should NOT exist - was rolled back
        const user = yield* prisma.user.findUnique({
          where: { email: `${prefix}@example.com` },
        });
        expect(user).toBeNull();
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("two-level service composition - tx rollback works", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `two-level-${Date.now()}`;

        // Level 1: Repository services
        class UserRepo extends Effect.Service<UserRepo>()("UserRepo", {
          effect: Effect.gen(function* () {
            const db = yield* PrismaService;
            return {
              create: (email: string, name: string) =>
                db.user.create({ data: { email, name } }),
            };
          }),
        }) {}

        class PostRepo extends Effect.Service<PostRepo>()("PostRepo", {
          effect: Effect.gen(function* () {
            const db = yield* PrismaService;
            return {
              create: (title: string, authorId: number) =>
                db.post.create({ data: { title, authorId } }),
            };
          }),
        }) {}

        // Level 2: Domain service composing repositories
        class BlogService extends Effect.Service<BlogService>()("BlogService", {
          effect: Effect.gen(function* () {
            const users = yield* UserRepo;
            const posts = yield* PostRepo;
            return {
              createAuthorWithPost: (email: string, name: string, postTitle: string) =>
                Effect.gen(function* () {
                  const user = yield* users.create(email, name);
                  const post = yield* posts.create(postTitle, user.id);
                  return { user, post };
                }),
            };
          }),
        }) {}

        // Build layer with proper dependency order:
        // BlogService depends on UserRepo + PostRepo, which depend on PrismaService
        const PrismaLayer = Layer.merge(LivePrismaLayer, PrismaService.Default);
        const RepoLayer = Layer.merge(UserRepo.Default, PostRepo.Default).pipe(
          Layer.provide(PrismaLayer),
        );
        const ServiceLayer = BlogService.Default.pipe(
          Layer.provide(RepoLayer),
          Layer.provide(PrismaLayer),
        );

        // Transaction wrapping the domain service should rollback both
        const program = prisma.$transaction(
          Effect.gen(function* () {
            const blog = yield* BlogService;
            yield* blog.createAuthorWithPost(
              `${prefix}@example.com`,
              "Author",
              "First Post",
            );
            yield* Effect.fail("Rollback everything");
          }),
        );

        yield* Effect.flip(program.pipe(Effect.provide(ServiceLayer)));

        // Both user and post should be rolled back
        const user = yield* prisma.user.findUnique({
          where: { email: `${prefix}@example.com` },
        });
        expect(user).toBeNull();

        const posts = yield* prisma.post.findMany({
          where: { title: "First Post" },
        });
        expect(posts).toHaveLength(0);
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("three-level service composition - tx rollback works through all layers", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `three-level-${Date.now()}`;

        // Level 1: Repository services (data access)
        class UserRepo extends Effect.Service<UserRepo>()("UserRepo", {
          effect: Effect.gen(function* () {
            const db = yield* PrismaService;
            return {
              create: (email: string, name: string) =>
                db.user.create({ data: { email, name } }),
              findById: (id: number) =>
                db.user.findUnique({ where: { id } }),
            };
          }),
        }) {}

        class PostRepo extends Effect.Service<PostRepo>()("PostRepo", {
          effect: Effect.gen(function* () {
            const db = yield* PrismaService;
            return {
              create: (title: string, content: string | null, authorId: number) =>
                db.post.create({ data: { title, content, authorId } }),
              findByAuthor: (authorId: number) =>
                db.post.findMany({ where: { authorId } }),
            };
          }),
        }) {}

        // Level 2: Domain services (business logic)
        class AuthorService extends Effect.Service<AuthorService>()("AuthorService", {
          effect: Effect.gen(function* () {
            const users = yield* UserRepo;
            return {
              register: (email: string, name: string) =>
                users.create(email, name),
              getProfile: (id: number) =>
                users.findById(id),
            };
          }),
        }) {}

        class ContentService extends Effect.Service<ContentService>()("ContentService", {
          effect: Effect.gen(function* () {
            const posts = yield* PostRepo;
            return {
              publish: (title: string, content: string, authorId: number) =>
                posts.create(title, content, authorId),
              getAuthorPosts: (authorId: number) =>
                posts.findByAuthor(authorId),
            };
          }),
        }) {}

        // Level 3: Application service (orchestration)
        class OnboardingService extends Effect.Service<OnboardingService>()(
          "OnboardingService",
          {
            effect: Effect.gen(function* () {
              const authors = yield* AuthorService;
              const content = yield* ContentService;
              const db = yield* PrismaService;

              return {
                // Onboard new author with welcome post - in a transaction
                onboardAuthor: (email: string, name: string) =>
                  db.$transaction(
                    Effect.gen(function* () {
                      const author = yield* authors.register(email, name);
                      const welcomePost = yield* content.publish(
                        "Welcome!",
                        `Hello, I'm ${name}`,
                        author.id,
                      );
                      return { author, welcomePost };
                    }),
                  ),

                // Onboard but fail at the end
                onboardAndFail: (email: string, name: string) =>
                  db.$transaction(
                    Effect.gen(function* () {
                      const author = yield* authors.register(email, name);
                      yield* content.publish("Welcome!", `Hello, I'm ${name}`, author.id);
                      yield* Effect.fail("Simulated onboarding failure");
                      return author; // never reached
                    }),
                  ),
              };
            }),
          },
        ) {}

        // Build the full layer stack with proper dependencies:
        // Level 1 (Repos) -> PrismaService
        // Level 2 (Domain) -> Level 1
        // Level 3 (App) -> Level 2 + PrismaService
        const PrismaLayer = Layer.merge(LivePrismaLayer, PrismaService.Default);
        const Level1 = Layer.merge(UserRepo.Default, PostRepo.Default).pipe(
          Layer.provide(PrismaLayer),
        );
        const Level2 = Layer.merge(AuthorService.Default, ContentService.Default).pipe(
          Layer.provide(Level1),
        );
        const ServiceLayer = OnboardingService.Default.pipe(
          Layer.provide(Level2),
          Layer.provide(PrismaLayer),
        );

        // Test successful onboarding
        const successProgram = Effect.gen(function* () {
          const onboarding = yield* OnboardingService;
          return yield* onboarding.onboardAuthor(`${prefix}-success@example.com`, "Success");
        });

        const result = yield* successProgram.pipe(Effect.provide(ServiceLayer));
        expect(result.author.email).toBe(`${prefix}-success@example.com`);
        expect(result.welcomePost.title).toBe("Welcome!");

        // Test failed onboarding - everything should rollback
        const failProgram = Effect.gen(function* () {
          const onboarding = yield* OnboardingService;
          yield* onboarding.onboardAndFail(`${prefix}-fail@example.com`, "Fail");
        });

        yield* Effect.flip(failProgram.pipe(Effect.provide(ServiceLayer)));

        // Failed author should NOT exist
        const failedUser = yield* prisma.user.findUnique({
          where: { email: `${prefix}-fail@example.com` },
        });
        expect(failedUser).toBeNull();

        // Cleanup successful user
        yield* prisma.post.deleteMany({ where: { authorId: result.author.id } });
        yield* prisma.user.delete({ where: { id: result.author.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    /**
     * WHY NESTED TRANSACTIONS WORK:
     *
     * When you write:
     *   class MyRepo extends Effect.Service<MyRepo>()("MyRepo", {
     *     effect: Effect.gen(function* () {
     *       const db = yield* PrismaService;  // <-- captured at layer construction
     *       return {
     *         create: (data) => db.user.create({ data })  // <-- returns an Effect
     *       };
     *     }),
     *   }) {}
     *
     * The key insight is that `db.user.create({ data })` returns an EFFECT, not a value.
     * Looking at the generated code:
     *
     *   user: {
     *     create: (args) => Effect.flatMap(PrismaClientService, ({ tx: client }) =>
     *       Effect.tryPromise({ try: () => client.user.create(args), ... })
     *     )
     *   }
     *
     * The `Effect.flatMap(PrismaClientService, ...)` DEFERS the lookup of PrismaClientService
     * until the Effect is actually RUN. So even though you capture `db` (the PrismaService)
     * at layer construction, when you call `db.user.create()`, it returns an Effect that
     * will look up PrismaClientService fresh when executed.
     *
     * When $transaction runs, it does:
     *   effect.pipe(Effect.provideService(PrismaClientService, { tx, client }))
     *
     * This replaces PrismaClientService for all Effects in that scope, so any
     * `db.user.create()` call will now use the transaction client.
     */
    it.effect("nested transactions in composed services", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `nested-composed-${Date.now()}`;

        // Repository - captures PrismaService at layer construction
        class UserRepo extends Effect.Service<UserRepo>()("UserRepo", {
          effect: Effect.gen(function* () {
            const db = yield* PrismaService;
            return {
              // This returns an Effect that will lookup PrismaClientService when run
              create: (email: string, name: string) =>
                db.user.create({ data: { email, name } }),
            };
          }),
        }) {}

        class PostRepo extends Effect.Service<PostRepo>()("PostRepo", {
          effect: Effect.gen(function* () {
            const db = yield* PrismaService;
            return {
              create: (title: string, authorId: number) =>
                db.post.create({ data: { title, authorId } }),
              createMany: (titles: string[], authorId: number) =>
                Effect.forEach(titles, (title) =>
                  db.post.create({ data: { title, authorId } }),
                ),
            };
          }),
        }) {}

        // Service that uses its own transaction internally
        class BatchPostService extends Effect.Service<BatchPostService>()(
          "BatchPostService",
          {
            effect: Effect.gen(function* () {
              const posts = yield* PostRepo;
              const db = yield* PrismaService;

              return {
                // Creates multiple posts in a transaction
                createBatch: (titles: string[], authorId: number) =>
                  db.$transaction(posts.createMany(titles, authorId)),
              };
            }),
          },
        ) {}

        // Build layer with proper dependencies
        const PrismaLayer = Layer.merge(LivePrismaLayer, PrismaService.Default);
        const RepoLayer = Layer.merge(UserRepo.Default, PostRepo.Default).pipe(
          Layer.provide(PrismaLayer),
        );
        const ServiceLayer = BatchPostService.Default.pipe(
          Layer.provide(RepoLayer),
          Layer.provide(PrismaLayer),
        );

        // Outer transaction calling service with inner transaction
        const program = prisma.$transaction(
          Effect.gen(function* () {
            const users = yield* UserRepo;
            const batchPosts = yield* BatchPostService;

            const user = yield* users.create(`${prefix}@example.com`, "Batch Author");

            // This internally runs its own $transaction, but since we're
            // already in a tx, it should just use the existing one
            yield* batchPosts.createBatch(["Post 1", "Post 2", "Post 3"], user.id);

            // Fail to rollback everything
            yield* Effect.fail("Rollback all");
          }),
        );

        yield* Effect.flip(program.pipe(Effect.provide(ServiceLayer)));

        // Everything should be rolled back
        const user = yield* prisma.user.findUnique({
          where: { email: `${prefix}@example.com` },
        });
        expect(user).toBeNull();

        const posts = yield* prisma.post.findMany({
          where: { title: { in: ["Post 1", "Post 2", "Post 3"] } },
        });
        expect(posts).toHaveLength(0);
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("service method that returns Effect can be composed in transactions", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `composable-${Date.now()}`;

        class UserRepo extends Effect.Service<UserRepo>()("UserRepo", {
          effect: Effect.gen(function* () {
            const db = yield* PrismaService;
            return {
              create: (email: string, name: string) =>
                db.user.create({ data: { email, name } }),
              delete: (id: number) => db.user.delete({ where: { id } }),
            };
          }),
        }) {}

        class PostRepo extends Effect.Service<PostRepo>()("PostRepo", {
          effect: Effect.gen(function* () {
            const db = yield* PrismaService;
            return {
              create: (title: string, authorId: number) =>
                db.post.create({ data: { title, authorId } }),
            };
          }),
        }) {}

        const ServiceLayer = Layer.merge(
          Layer.merge(LivePrismaLayer, PrismaService.Default),
          Layer.merge(UserRepo.Default, PostRepo.Default),
        );

        // Compose service methods directly in a transaction
        const program = prisma.$transaction(
          Effect.gen(function* () {
            const users = yield* UserRepo;
            const posts = yield* PostRepo;

            // Create user
            const user = yield* users.create(`${prefix}@example.com`, "Composable");

            // Create post for user
            yield* posts.create("Composed Post", user.id);

            // Delete user (will cascade in real scenario, but here we just test the composition)
            // Actually, this will fail due to FK constraint, let's just fail manually
            yield* Effect.fail("Rollback composed operations");
          }),
        );

        yield* Effect.flip(program.pipe(Effect.provide(ServiceLayer)));

        // Both should be rolled back
        const user = yield* prisma.user.findUnique({
          where: { email: `${prefix}@example.com` },
        });
        expect(user).toBeNull();
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("complex: 4-level deep service with stored effects and delayed execution", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `deep-${Date.now()}`;

        // Level 1: Base repo that stores effects in closures
        class UserRepo extends Effect.Service<UserRepo>()("UserRepo", {
          effect: Effect.gen(function* () {
            const db = yield* PrismaService;
            return {
              create: (email: string, name: string) =>
                db.user.create({ data: { email, name } }),
              // Store an effect factory - the effect is created at call time
              makeCreator: () => {
                // Capture db here, but the effect still defers PrismaClientService lookup
                return (email: string, name: string) =>
                  db.user.create({ data: { email, name } });
              },
            };
          }),
        }) {}

        class PostRepo extends Effect.Service<PostRepo>()("PostRepo", {
          effect: Effect.gen(function* () {
            const db = yield* PrismaService;
            return {
              create: (title: string, authorId: number) =>
                db.post.create({ data: { title, authorId } }),
            };
          }),
        }) {}

        // Level 2: Domain service that pre-creates effect factories
        class AuthorDomain extends Effect.Service<AuthorDomain>()("AuthorDomain", {
          effect: Effect.gen(function* () {
            const users = yield* UserRepo;
            const posts = yield* PostRepo;

            // Pre-create the effect factory at layer construction time
            const createUser = users.makeCreator();

            return {
              // Use the pre-created factory
              registerAuthor: (email: string, name: string) => createUser(email, name),
              addPost: (title: string, authorId: number) => posts.create(title, authorId),
            };
          }),
        }) {}

        // Level 3: Application service that composes domains
        class BlogApp extends Effect.Service<BlogApp>()("BlogApp", {
          effect: Effect.gen(function* () {
            const authorDomain = yield* AuthorDomain;
            return {
              onboardWithPost: (email: string, name: string, postTitle: string) =>
                Effect.gen(function* () {
                  const author = yield* authorDomain.registerAuthor(email, name);
                  const post = yield* authorDomain.addPost(postTitle, author.id);
                  return { author, post };
                }),
            };
          }),
        }) {}

        // Level 4: Orchestrator that wraps in transaction
        class Orchestrator extends Effect.Service<Orchestrator>()("Orchestrator", {
          effect: Effect.gen(function* () {
            const db = yield* PrismaService;
            const blogApp = yield* BlogApp;
            return {
              safeOnboard: (email: string, name: string, postTitle: string) =>
                db.$transaction(blogApp.onboardWithPost(email, name, postTitle)),
            };
          }),
        }) {}

        // Build the 4-level layer stack
        const PrismaLayer = Layer.merge(LivePrismaLayer, PrismaService.Default);
        const Level1 = Layer.merge(UserRepo.Default, PostRepo.Default).pipe(
          Layer.provide(PrismaLayer),
        );
        const Level2 = AuthorDomain.Default.pipe(Layer.provide(Level1));
        const Level3 = BlogApp.Default.pipe(Layer.provide(Level2));
        const Level4 = Orchestrator.Default.pipe(
          Layer.provide(Level3),
          Layer.provide(PrismaLayer),
        );

        // Test 1: Successful transaction through 4 levels
        const successProgram = Effect.gen(function* () {
          const orch = yield* Orchestrator;
          return yield* orch.safeOnboard(
            `${prefix}-ok@example.com`,
            "Deep OK",
            "Deep Post OK",
          );
        });

        const okResult = yield* successProgram.pipe(Effect.provide(Level4));
        expect(okResult.author.email).toBe(`${prefix}-ok@example.com`);
        expect(okResult.post.title).toBe("Deep Post OK");

        // Test 2: Failed transaction through 4 levels - verify rollback
        const failProgram = Effect.gen(function* () {
          const orch = yield* Orchestrator;
          const db = yield* PrismaService;

          // Wrap orchestrator's transaction in another transaction
          yield* db.$transaction(
            Effect.gen(function* () {
              yield* orch.safeOnboard(
                `${prefix}-fail@example.com`,
                "Deep Fail",
                "Deep Post Fail",
              );
              yield* Effect.fail("Outer failure after inner tx");
            }),
          );
        });

        yield* Effect.flip(failProgram.pipe(Effect.provide(Level4)));

        // The inner transaction committed, but outer rolled back
        // Since nested $transaction just reuses the existing tx when already in one,
        // the whole thing should be rolled back
        const failedUser = yield* prisma.user.findUnique({
          where: { email: `${prefix}-fail@example.com` },
        });
        expect(failedUser).toBeNull();

        // Cleanup successful user
        yield* prisma.post.deleteMany({ where: { authorId: okResult.author.id } });
        yield* prisma.user.delete({ where: { id: okResult.author.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("stored effect references still use correct tx client", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const prefix = `stored-ref-${Date.now()}`;

        // Service that stores effect references at construction
        class CachingRepo extends Effect.Service<CachingRepo>()("CachingRepo", {
          effect: Effect.gen(function* () {
            const db = yield* PrismaService;

            // Store references to effect-returning methods
            const createUser = db.user.create;
            const createPost = db.post.create;

            return {
              // Use the stored references
              addUser: (email: string, name: string) =>
                createUser({ data: { email, name } }),
              addPost: (title: string, authorId: number) =>
                createPost({ data: { title, authorId } }),
            };
          }),
        }) {}

        const ServiceLayer = CachingRepo.Default.pipe(
          Layer.provide(Layer.merge(LivePrismaLayer, PrismaService.Default)),
        );

        // Transaction using stored effect references
        const program = prisma.$transaction(
          Effect.gen(function* () {
            const repo = yield* CachingRepo;

            const user = yield* repo.addUser(`${prefix}@example.com`, "Stored Ref");
            yield* repo.addPost("Stored Ref Post", user.id);

            yield* Effect.fail("Rollback stored refs");
          }),
        );

        yield* Effect.flip(program.pipe(Effect.provide(ServiceLayer)));

        // Both should be rolled back - the stored references still work correctly
        const user = yield* prisma.user.findUnique({
          where: { email: `${prefix}@example.com` },
        });
        expect(user).toBeNull();

        const posts = yield* prisma.post.findMany({
          where: { title: "Stored Ref Post" },
        });
        expect(posts).toHaveLength(0);
      }).pipe(Effect.provide(MainLayer)),
    );
  });

  // ============================================
  // Layer Lifecycle Tests
  // Tests for PrismaClient connection/disconnection
  // ============================================

  describe("Layer lifecycle", () => {
    it.effect("$disconnect is called when layer scope ends", () =>
      Effect.gen(function* () {
        let disconnectCalled = false;

        // Create a custom layer that tracks disconnect
        const TrackedPrismaLayer = Layer.scoped(
          PrismaClientService,
          Effect.gen(function* () {
            const { PrismaClient } = yield* Effect.promise(() =>
              import("./generated/client/index.js"),
            );
            const prisma = new PrismaClient();

            // Wrap $disconnect to track when it's called
            const originalDisconnect = prisma.$disconnect.bind(prisma);
            prisma.$disconnect = async () => {
              disconnectCalled = true;
              return originalDisconnect();
            };

            yield* Effect.addFinalizer(() =>
              Effect.promise(() => prisma.$disconnect()),
            );

            return { tx: prisma, client: prisma };
          }),
        );

        const TestLayer = Layer.merge(TrackedPrismaLayer, PrismaService.Default);

        // Run a simple query in a scoped context
        const program = Effect.gen(function* () {
          const prisma = yield* PrismaService;
          yield* prisma.user.findMany();
          // At this point, disconnect should NOT have been called yet
          expect(disconnectCalled).toBe(false);
        });

        // Run with Effect.scoped to properly close the scope
        yield* program.pipe(Effect.provide(TestLayer), Effect.scoped);

        // After scope ends, disconnect SHOULD have been called
        expect(disconnectCalled).toBe(true);
      }),
    );

    it.effect("$disconnect is called even when effect fails", () =>
      Effect.gen(function* () {
        let disconnectCalled = false;

        const TrackedPrismaLayer = Layer.scoped(
          PrismaClientService,
          Effect.gen(function* () {
            const { PrismaClient } = yield* Effect.promise(() =>
              import("./generated/client/index.js"),
            );
            const prisma = new PrismaClient();

            const originalDisconnect = prisma.$disconnect.bind(prisma);
            prisma.$disconnect = async () => {
              disconnectCalled = true;
              return originalDisconnect();
            };

            yield* Effect.addFinalizer(() =>
              Effect.promise(() => prisma.$disconnect()),
            );

            return { tx: prisma, client: prisma };
          }),
        );

        const TestLayer = Layer.merge(TrackedPrismaLayer, PrismaService.Default);

        // Run a program that fails
        const program = Effect.gen(function* () {
          const prisma = yield* PrismaService;
          yield* prisma.user.findMany();
          yield* Effect.fail("Intentional failure");
        });

        // Run and catch the failure
        yield* program.pipe(
          Effect.provide(TestLayer),
          Effect.scoped,
          Effect.catchAll(() => Effect.succeed("caught")),
        );

        // Disconnect should still be called despite the failure
        expect(disconnectCalled).toBe(true);
      }),
    );

    it.effect("multiple scoped usages each get their own connection", () =>
      Effect.gen(function* () {
        const disconnectCount = { value: 0 };

        const makeTrackedLayer = () =>
          Layer.scoped(
            PrismaClientService,
            Effect.gen(function* () {
              const { PrismaClient } = yield* Effect.promise(() =>
                import("./generated/client/index.js"),
              );
              const prisma = new PrismaClient();

              const originalDisconnect = prisma.$disconnect.bind(prisma);
              prisma.$disconnect = async () => {
                disconnectCount.value++;
                return originalDisconnect();
              };

              yield* Effect.addFinalizer(() =>
                Effect.promise(() => prisma.$disconnect()),
              );

              return { tx: prisma, client: prisma };
            }),
          );

        // Run two separate scoped effects
        const program1 = Effect.gen(function* () {
          const prisma = yield* PrismaService;
          yield* prisma.user.findMany();
        }).pipe(
          Effect.provide(Layer.merge(makeTrackedLayer(), PrismaService.Default)),
          Effect.scoped,
        );

        const program2 = Effect.gen(function* () {
          const prisma = yield* PrismaService;
          yield* prisma.user.findMany();
        }).pipe(
          Effect.provide(Layer.merge(makeTrackedLayer(), PrismaService.Default)),
          Effect.scoped,
        );

        yield* program1;
        expect(disconnectCount.value).toBe(1);

        yield* program2;
        expect(disconnectCount.value).toBe(2);
      }),
    );
  });
});
