// Alternative approach - parse multipart manually if Elysia's file handling doesn't work

import { Elysia } from "elysia";
import { randomUUID } from "crypto";
import { writeFile, unlink, mkdir } from "fs/promises";
import path from "path";
import { transcribe } from "../../functions/whisper";

export const transcriptRoute = new Elysia().post(
  "/transcribe",
  async ({ request }) => {
    console.log("=== TRANSCRIBE ENDPOINT CALLED ===");
    console.log("Content-Type:", request.headers.get("content-type"));
    
    try {
      // Parse FormData directly from request
      const formData = await request.formData();
      console.log("FormData keys:", Array.from(formData.keys()));
      
      const audioFile = formData.get("audio");
      
      console.log("Audio file:", {
        hasFile: !!audioFile,
        type: typeof audioFile,
        isBlob: audioFile instanceof Blob,
        isFile: audioFile instanceof File,
      });
      
      if (!audioFile) {
        throw new Error("No audio file provided");
      }

      if (!(audioFile instanceof Blob)) {
        throw new Error("Uploaded data is not a file");
      }

      const blob = audioFile as Blob;
      console.log("File details:", {
        type: blob.type,
        size: blob.size,
        name: (audioFile as File).name || "unknown",
      });

      // Generate temp file path
      const fileExt = getFileExtension(blob.type || "audio/wav");
      const tempFileName = `${randomUUID()}.${fileExt}`;
      const tempDir = path.join(process.cwd(), "temp");
      const tempFilePath = path.join(tempDir, tempFileName);
      
      console.log("Temp file path:", tempFilePath);

      // Ensure temp directory exists
      await mkdir(tempDir, { recursive: true });

      // Write file to disk
      const buffer = await blob.arrayBuffer();
      console.log("Buffer size:", buffer.byteLength, "bytes");
      
      await writeFile(tempFilePath, Buffer.from(buffer));
      console.log("File written successfully");

      // Transcribe
      console.log("Starting Whisper transcription...");
      const transcribedText = await transcribe(tempFilePath);
      console.log("Transcription complete:", transcribedText.length, "chars");

      // Clean up
      await unlink(tempFilePath);
      console.log("Cleanup complete");

      return { text: transcribedText.trim() };
      
    } catch (error) {
      console.error("=== ERROR ===");
      console.error(error);
      throw error;
    }
  }
);

function getFileExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/x-wav": "wav",
    "audio/mp3": "mp3",
    "audio/mpeg": "mp3",
    "audio/m4a": "m4a",
    "audio/x-m4a": "m4a",
    "audio/mp4": "m4a",
    "audio/ogg": "ogg",
    "": "wav",
  };
  return map[mimeType.toLowerCase()] || "wav";
}