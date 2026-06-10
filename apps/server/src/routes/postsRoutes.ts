import type { PostsHandlers } from 'app/handlers/postsHandler.js';
import { requireAuth } from 'app/middleware/requireAuthMiddleware.js';
import { validate } from 'app/middleware/validateMiddleware.js';
import { createPostSchema, updatePostSchema } from 'app/schemas/postsSchema.js';
import express from 'express';
import type { Router } from 'express';

function createPostsRouter(handlers: PostsHandlers): Router {
  const postsRouter = express.Router();

  postsRouter.use(requireAuth);
  postsRouter.get('/', handlers.listPosts);
  postsRouter.get('/:id', handlers.getPost);
  postsRouter.post('/', validate(createPostSchema), handlers.createPost);
  postsRouter.put('/:id', validate(updatePostSchema), handlers.updatePost);
  postsRouter.delete('/:id', handlers.deletePost);

  return postsRouter;
}

export { createPostsRouter };
