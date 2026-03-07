import { Elysia } from "elysia";
import { t } from "elysia";
import { randomUUID } from "crypto";
import { writeFile, unlink, mkdir, readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { spawn } from "child_process";
import { AnalysisAiOutputSchema, AnalysisResponse } from "../types";
import type { TAnalysisAiOutput, TAnalysisResponse } from "../types";
import { callAiImageWithSearch } from "../../functions/call-ai";
import { transcribe } from "../../functions/whisper";
import { postMessageCheck } from "../../functions/postMessageCheck";

// ─── helpers ────────────────────────────────────────────────────────────────

function normalizeClassification(
  value: unknown
): "legitimate" | "misleading" | "scam" | "suspicious" | "unverified" {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("scam") || text.includes("fraud") || text.includes("phish")) return "scam";
  if (text.includes("mislead") || text.includes("false") || text.includes("fake") || text.includes("hoax")) return "misleading";
  if (text.includes("suspic") || text.includes("dubious") || text.includes("questionable")) return "suspicious";
  if (text.includes("legit") || text.includes("reliable") || text.includes("safe") || text.includes("informational")) return "legitimate";
  return "unverified";
}

/** Run a shell command and return stdout. Rejects on non-zero exit. */
function runCommand(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(0, 300)}`));
    });
  });
}

/**
 * Extract audio track from a video file → wav file.
 * Returns path to the wav file.
 */
async function extractAudio(videoPath: string, outDir: string): Promise<string> {
  const audioPath = path.join(outDir, `${randomUUID()}.wav`);
  await runCommand("ffmpeg", [
    "-i", videoPath,
    "-vn",                  // no video
    "-acodec", "pcm_s16le", // standard wav
    "-ar", "16000",         // 16 kHz — ideal for Whisper
    "-ac", "1",             // mono
    "-y",                   // overwrite
    audioPath,
  ]);
  return audioPath;
}

/**
 * Extract N evenly-spaced frames from a video as JPEG base64 strings.
 * Falls back gracefully if ffmpeg probe fails.
 */
async function extractFrames(
  videoPath: string,
  outDir: string,
  frameCount = 6
): Promise<string[]> {
  // Get video duration in seconds
  let duration = 30; // fallback
  try {
    const probe = await runCommand("ffprobe", [
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      videoPath,
    ]);
    const info = JSON.parse(probe);
    duration = parseFloat(info?.format?.duration ?? "30");
  } catch {
    console.warn("ffprobe failed, using fallback duration");
  }

  const frames: string[] = [];
  const interval = duration / (frameCount + 1);

  for (let i = 1; i <= frameCount; i++) {
    const timestamp = (interval * i).toFixed(2);
    const framePath = path.join(outDir, `frame_${i}_${randomUUID()}.jpg`);
    try {
      await runCommand("ffmpeg", [
        "-ss", timestamp,
        "-i", videoPath,
        "-frames:v", "1",
        "-q:v", "2",
        "-y",
        framePath,
      ]);
      if (existsSync(framePath)) {
        const buf = await readFile(framePath);
        frames.push(buf.toString("base64"));
        await unlink(framePath);
      }
    } catch {
      console.warn(`Frame extraction failed at ${timestamp}s — skipping`);
    }
  }

  return frames;
}

// ─── system prompt ───────────────────────────────────────────────────────────

const VIDEO_SYSTEM_PROMPT =
  "You are an expert media forensics and fraud detection assistant. " +
  "You will receive: (1) video frames as images, and (2) a transcript of the audio. " +
  "Your job is to assess whether the video contains scams, fraud, deepfakes, or AI-generated content. " +
  "\n\nLook for these signals:" +
  "\n• SCAM: urgency language, prize/money/crypto claims, requests for personal info, impersonation of officials" +
  "\n• FRAUD: false statistics, fabricated quotes, misleading product/service claims" +
  "\n• DEEPFAKE: unnatural lip sync, facial flickering, blurry edges around face, inconsistent lighting on skin" +
  "\n• AI-GENERATED: overly smooth skin, warped background details, inconsistent teeth/hair, robotic speech patterns" +
  "\n\nUse exa_search to verify any specific claims, people, organisations, or statistics mentioned. " +
  "Use ONLY these enum values exactly as written:\n" +
  "  • cross_references[].contradiction_level: 'low' | 'medium' | 'high'\n" +
  "For each cross_references entry, set url to the exact URL returned by exa_search. " +
  "Be explicit about what signals you found and why you reached your conclusion.";

// ─── route ───────────────────────────────────────────────────────────────────

const VideoBody = t.Object({
  video: t.File({ description: "Video file (mp4, mov, webm)" }),
  context_url: t.Optional(t.String()),
  preferred_language: t.Optional(t.String()),
});

export const videoRoute = new Elysia().post(
  "/analyze-video",
  async ({ body }) => {
    console.log("=== VIDEO ROUTE CALLED ===");

    const tempDir = path.join(process.cwd(), "temp");
    await mkdir(tempDir, { recursive: true });

    const videoFile = body.video as File;
    const ext = videoFile.name?.split(".").pop() ?? "mp4";
    const videoPath = path.join(tempDir, `${randomUUID()}.${ext}`);

    // Write uploaded video to disk
    const buffer = await videoFile.arrayBuffer();
    await writeFile(videoPath, Buffer.from(buffer));
    console.log(`Video saved: ${videoPath} (${buffer.byteLength} bytes)`);

    const toClean: string[] = [videoPath];

    try {
      // ── Step 1: Extract audio + transcribe ──────────────────────────────
      let transcript = "";
      let audioPath: string | null = null;

      try {
        audioPath = await extractAudio(videoPath, tempDir);
        toClean.push(audioPath);
        console.log("Audio extracted, transcribing...");
        transcript = await transcribe(audioPath);
        console.log(`Transcript (${transcript.length} chars):`, transcript.slice(0, 120));
      } catch (err) {
        console.warn("Audio extraction/transcription failed:", err);
        transcript = "[No audio track or transcription unavailable]";
      }

      // ── Step 2: Extract frames ───────────────────────────────────────────
      let frames: string[] = [];
      try {
        frames = await extractFrames(videoPath, tempDir, 6);
        console.log(`Extracted ${frames.length} frames`);
      } catch (err) {
        console.warn("Frame extraction failed:", err);
      }

      if (frames.length === 0) {
        throw new Error("Could not extract any frames from the video. Is ffmpeg installed?");
      }

      // ── Step 3: Build prompt ─────────────────────────────────────────────
      const languageNames: Record<string, string> = {
        en: "English", zh: "Chinese (Simplified)", ms: "Malay", ta: "Tamil",
      };
      const responseLang = languageNames[body.preferred_language ?? "en"] ?? "English";

      const prompt =
        `Analyse this video for scams, fraud, deepfakes, and AI-generated content.\n\n` +
        `TRANSCRIPT:\n${transcript}\n\n` +
        `VIDEO FRAMES: ${frames.length} frames attached (evenly spaced through the video).\n\n` +
        `Instructions:\n` +
        `1. Check the transcript for scam/fraud language patterns\n` +
        `2. Inspect the frames for deepfake or AI-generation artifacts\n` +
        `3. Use exa_search to verify any claims, people, or organisations mentioned\n` +
        `4. Return your full structured analysis\n` +
        `5. Write all text fields (summary, recommendation, key_claims, bias_detected) in ${responseLang}.\n` +
        `After your analysis, you MUST include an 'ai_detection' object with:\n` +
        `  • verdict: exactly one of 'real', 'ai-generated', 'deepfake', 'inconclusive'\n` +
        `  • confidence: 0-100 score of how confident you are\n` +
        `  • signals: list of specific visual/audio clues that led to your verdict\n` +
        (body.context_url ? `\nVideo source URL: ${body.context_url}` : "");

      // ── Step 4: Call AI with frames + search ────────────────────────────
      const { text: raw, searchResults } = await callAiImageWithSearch(frames, prompt, {
        systemPrompt: VIDEO_SYSTEM_PROMPT,
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: "analysis",
            strict: true,
            schema: JSON.parse(JSON.stringify(AnalysisAiOutputSchema)),
          },
        },
      });

      console.log("AI raw response:", raw?.slice(0, 300));

      if (!raw || raw.trim() === "") {
        throw new Error("AI returned empty response");
      }

      // ── Step 5: Parse + normalise ────────────────────────────────────────
      let output: TAnalysisAiOutput;
      try {
        output = JSON.parse(raw) as TAnalysisAiOutput;
      } catch (e) {
        console.error("JSON parse failed. Full raw:", raw);
        throw new Error(`JSON parse failed: ${e}`);
      }

      const aiByUrl = new Map<string, "low" | "medium" | "high">(
        (output.cross_references ?? [])
          .filter((ref) => ref.url?.startsWith("http"))
          .map((ref) => [ref.url, ref.contradiction_level])
      );

      const cross_references = searchResults.map((item) => {
        let source = "External source";
        try { source = new URL(item.url).hostname.replace(/^www\./, ""); } catch { }
        return {
          title: item.title?.trim() || source,
          source,
          url: item.url,
          contradiction_level: aiByUrl.get(item.url) ?? ("medium" as const),
        };
      });

      const normalizedOutput = {
        ...output,
        classification: normalizeClassification(output.classification),
        cross_references,
      };

      // ── Step 6: Persist to DB ────────────────────────────────────────────
      let db_id: string | undefined;
      try {
        const inserted = await postMessageCheck({
          content_text: `[video analysis] ${transcript.slice(0, 500)}`,
          credibility_score: normalizedOutput.credibility_score,
          summary: normalizedOutput.summary,
          recommendation: normalizedOutput.recommendation,
          bias_detected: normalizedOutput.bias_detected,
          cross_references: normalizedOutput.cross_references,
          key_claims: normalizedOutput.key_claims,
          image_present: true,
          image_hash: null,
        });
        db_id = inserted?.id;
      } catch (err) {
        console.error("DB insert failed:", err);
      }

      return {
        ...normalizedOutput,
        analysis_id: db_id ?? randomUUID(),
        transcript, // include transcript in response so frontend can show it
      } satisfies TAnalysisResponse & { transcript: string };

    } finally {
      // Clean up all temp files
      for (const f of toClean) {
        try { await unlink(f); } catch { }
      }
    }
  },
  {
    body: VideoBody,
    detail: {
      summary: "Analyse a video for scams, fraud, deepfakes, and AI-generated content",
      tags: ["Analysis"],
    },
  }
);