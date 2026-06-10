# User Story: Posts

Posts is the sample CRUD resource that demonstrates the auth-scoped data pattern (uuid primary key, `user_id` foreign key, validate middleware, `{ code, error }` errors, pagination).

## As an authenticated user, I can manage my own posts

- **Create:** I `POST /posts` with `{ title, body }` and receive `201 { data: post }`. The post is owned by my user id.
- **List:** I `GET /posts` and receive only my own posts, newest first, as `{ data, meta: { limit, offset, total } }`. I can page with `?limit=&offset=`.
- **Read:** I `GET /posts/:id` for one of my posts and receive `200 { data: post }`.
- **Update:** I `PUT /posts/:id` with `{ title, body }` and receive `200 { data: post }`.
- **Delete:** I `DELETE /posts/:id` and receive `204`.

## Acceptance criteria

- Every route requires authentication; an unauthenticated request returns `401 AUTH_REQUIRED`.
- All access is scoped to `user_id`: requesting, updating, or deleting another user's post returns `404 POSTS_NOT_FOUND` (the resource is indistinguishable from non-existent).
- A non-uuid `:id` returns `404 POSTS_NOT_FOUND` without touching the database.
- Bodies are validated by `validate(createPostSchema | updatePostSchema)`: empty/oversized `title` or `body` returns `400 INPUT_VALIDATION_ERROR`.
- Mutations require the `X-Requested-With: XMLHttpRequest` header (CSRF guard).

## Coverage

- Unit: `__tests__/schemas/posts.test.ts`, `__tests__/repositories/posts/posts.test.ts`, `__tests__/handlers/posts/posts.test.ts`, `__tests__/routes/routes.test.ts`.
- Integration (real DB): `__tests__/integration/posts-flow.test.ts`.
- E2E (API): `e2e/posts.spec.ts`.
