import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { analyzeRoute } from "./routes/analyze";
import { imageRoute } from "./routes/image";
import { summaryRoute } from "./routes/summary";
import { transcriptRoute } from "./routes/transcript";
import { ttsRoute } from "./routes/tts";
import { feedbackRoute } from "./routes/feedback";
import { healthRoute } from "./routes/health";
import { languagesRoute } from "./routes/languages";

const app = new Elysia()
  .use(cors())
  .use(healthRoute)
  .use(languagesRoute)
  .use(analyzeRoute)
  .use(imageRoute)
  .use(summaryRoute)
  .use(transcriptRoute)
  .use(ttsRoute)
  .use(feedbackRoute)
  .listen(3000);

console.log(
  `backend running at http://${app.server?.hostname}:${app.server?.port}`
);
