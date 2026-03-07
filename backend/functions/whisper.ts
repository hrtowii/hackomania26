import { nodewhisper } from "nodejs-whisper";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function transcribe(audioPath: string): Promise<string> {
  const result = await nodewhisper(audioPath, {
    modelName: "base",
    autoDownloadModelName: "base",
    removeWavFileAfterTranscription: false,
    withCuda: false,
    logger: console,
    whisperOptions: {
      outputInText: true,
      outputInSrt: false,
      outputInVtt: false,
      outputInJson: false,
      outputInJsonFull: false,
      outputInCsv: false,
      outputInLrc: false,
      outputInWords: false,
      translateToEnglish: false,
      wordTimestamps: false,
      timestamps_length: 20,
      splitOnWord: true,
    },
  });

  return typeof result === "string" ? result : String(result);
}

export async function callWhisperTranscribe(
  audioPath: string = path.resolve(__dirname, "audio.wav")
): Promise<string | void> {
  try {
    const text = await transcribe(audioPath);
    console.log("Transcription:");
    console.log(text);
    return text;
  } catch (error) {
    console.error("Transcription failed:");
    console.error(error);
  }
}

callWhisperTranscribe(path.resolve(__dirname, "audio2.m4a"));