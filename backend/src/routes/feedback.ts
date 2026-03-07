import { Elysia, t } from "elysia";
import {
  FeedbackBody,
  FeedbackResponse,
  FeedbackCountResponse,
} from "../types";

export const feedbackRoute = new Elysia()
  .post(
    "/feedback",
    async ({ body }) => {
      // TODO: persist vote to database
      const stub: typeof FeedbackResponse.static = {
        success: true,
        upvotes: body.vote === "upvote" ? 1 : 0,
        downvotes: body.vote === "downvote" ? 1 : 0,
      };
      return stub;
    },
    {
      body: FeedbackBody,
      response: FeedbackResponse,
      detail: {
        summary: "Submit an upvote or downvote for an analysis",
        tags: ["Feedback"],
      },
    }
  )
  .get(
    "/feedback/:analysis_id",
    async ({ params }) => {
      // TODO: query database for vote counts
      const stub: typeof FeedbackCountResponse.static = {
        analysis_id: params.analysis_id,
        upvotes: 0,
        downvotes: 0,
      };
      return stub;
    },
    {
      params: t.Object({ analysis_id: t.String() }),
      response: FeedbackCountResponse,
      detail: {
        summary: "Get vote counts for a specific analysis",
        tags: ["Feedback"],
      },
    }
  );
