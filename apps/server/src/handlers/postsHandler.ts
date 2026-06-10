import {
  ERROR_CODES,
  createErrorResponse,
} from 'app/constants/errorCodesConstants.js';
import { HTTP } from 'app/constants/httpConstants.js';
import type { PostsRepo } from 'app/repositories/postsRepository.js';
import type {
  CreatePostInput,
  UpdatePostInput,
} from 'app/schemas/postsSchema.js';
import { parseIdParam } from 'app/services/parseIdParamParser.js';
import { parsePagination } from 'app/services/parsePaginationParser.js';
import type { Request, Response } from 'express';

interface PostsHandlerDeps {
  postsRepo: PostsRepo;
}

function createPostsHandlers({ postsRepo }: PostsHandlerDeps) {
  async function createPost(req: Request, res: Response): Promise<void> {
    // Body is validated by the validate(createPostSchema) route middleware.
    const { body, title } = req.body as CreatePostInput;
    const post = await postsRepo.createPost(req.user!.id, { body, title });
    res.status(HTTP.STATUS.CREATED).json({ data: post });
  }

  async function listPosts(req: Request, res: Response): Promise<void> {
    const { limit, offset } = parsePagination(
      req.query.limit,
      req.query.offset,
    );
    const { posts, total } = await postsRepo.listPostsByUser(
      req.user!.id,
      limit,
      offset,
    );
    res.json({ data: posts, meta: { limit, offset, total } });
  }

  async function getPost(req: Request, res: Response): Promise<void> {
    const id = parseIdParam(req.params.id);
    const post = id ? await postsRepo.getPostById(id, req.user!.id) : null;
    if (!post) {
      res
        .status(HTTP.STATUS.NOT_FOUND)
        .json(
          createErrorResponse(ERROR_CODES.POSTS.NOT_FOUND, 'Post not found'),
        );
      return;
    }
    res.json({ data: post });
  }

  async function updatePost(req: Request, res: Response): Promise<void> {
    const id = parseIdParam(req.params.id);
    // Body is validated by the validate(updatePostSchema) route middleware.
    const { body, title } = req.body as UpdatePostInput;
    const post = id
      ? await postsRepo.updatePost(id, req.user!.id, { body, title })
      : null;
    if (!post) {
      res
        .status(HTTP.STATUS.NOT_FOUND)
        .json(
          createErrorResponse(ERROR_CODES.POSTS.NOT_FOUND, 'Post not found'),
        );
      return;
    }
    res.json({ data: post });
  }

  async function deletePost(req: Request, res: Response): Promise<void> {
    const id = parseIdParam(req.params.id);
    const deleted = id ? await postsRepo.deletePost(id, req.user!.id) : false;
    if (!deleted) {
      res
        .status(HTTP.STATUS.NOT_FOUND)
        .json(
          createErrorResponse(ERROR_CODES.POSTS.NOT_FOUND, 'Post not found'),
        );
      return;
    }
    res.status(HTTP.STATUS.NO_CONTENT).send();
  }

  return { createPost, deletePost, getPost, listPosts, updatePost };
}

type PostsHandlers = ReturnType<typeof createPostsHandlers>;

export { createPostsHandlers };
export type { PostsHandlers };
