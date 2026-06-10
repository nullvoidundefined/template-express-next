import type { PoolClient } from 'app/database/databasePool.js';
import type {
  CreatePostInput,
  Post,
  UpdatePostInput,
} from 'app/schemas/postsSchema.js';
import type { QueryResult, QueryResultRow } from 'pg';

/**
 * Data-access dependencies injected so repo tests can supply a fake `query`
 * instead of mocking the pool module.
 */
interface PostsRepoDeps {
  query: <T extends QueryResultRow>(
    text: string,
    values?: unknown[],
    client?: PoolClient,
  ) => Promise<QueryResult<T>>;
  withTransaction: <T>(fn: (client: PoolClient) => Promise<T>) => Promise<T>;
}

const POST_COLUMNS = 'id, user_id, title, body, created_at, updated_at';

function createPostsRepo({ query }: PostsRepoDeps) {
  async function createPost(
    userId: string,
    input: CreatePostInput,
  ): Promise<Post> {
    const result = await query<Post>(
      `INSERT INTO posts (user_id, title, body) VALUES ($1, $2, $3) RETURNING ${POST_COLUMNS}`,
      [userId, input.title, input.body],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert returned no row');
    return row;
  }

  async function listPostsByUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ posts: Post[]; total: number }> {
    const [dataResult, countResult] = await Promise.all([
      query<Post>(
        `SELECT ${POST_COLUMNS} FROM posts WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [userId, limit, offset],
      ),
      query<{ total: number }>(
        'SELECT count(*)::int AS total FROM posts WHERE user_id = $1',
        [userId],
      ),
    ]);
    return {
      posts: dataResult.rows,
      total: countResult.rows[0]?.total ?? 0,
    };
  }

  async function getPostById(id: string, userId: string): Promise<Post | null> {
    const result = await query<Post>(
      `SELECT ${POST_COLUMNS} FROM posts WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return result.rows[0] ?? null;
  }

  async function updatePost(
    id: string,
    userId: string,
    input: UpdatePostInput,
  ): Promise<Post | null> {
    const result = await query<Post>(
      `UPDATE posts SET title = $1, body = $2 WHERE id = $3 AND user_id = $4 RETURNING ${POST_COLUMNS}`,
      [input.title, input.body, id, userId],
    );
    return result.rows[0] ?? null;
  }

  async function deletePost(id: string, userId: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM posts WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  return { createPost, deletePost, getPostById, listPostsByUser, updatePost };
}

type PostsRepo = ReturnType<typeof createPostsRepo>;

export { createPostsRepo };
export type { PostsRepo, PostsRepoDeps };
