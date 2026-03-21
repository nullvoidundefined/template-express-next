import type { Request, Response } from "express";

// Return a consistent JSON response for any unmatched route instead of the default HTML 404.
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: {
      message: "Not found",
      path: req.path,
    },
  });
}
