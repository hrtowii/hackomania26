import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { analyzeUrlRoute } from "./routes/analyze-url";
import { analyzeTextRoute } from "./routes/analyze-text";
import { imageRoute } from "./routes/image";
import { transcriptRoute } from "./routes/transcript";
import { ttsRoute } from "./routes/tts";
import { feedbackRoute } from "./routes/feedback";
import { healthRoute } from "./routes/health";
import { languagesRoute } from "./routes/languages";
import { videoRoute } from "./routes/video";

const app = new Elysia()
  .use(cors())
  .use(healthRoute)
  .use(languagesRoute)
  .use(analyzeUrlRoute)
  .use(analyzeTextRoute)
  .use(imageRoute)
  .use(transcriptRoute)
  .use(ttsRoute)
  .use(feedbackRoute)
  .use(videoRoute)
  .listen(3000);

console.log(
  `backend running at http://${app.server?.hostname}:${app.server?.port}`
);
