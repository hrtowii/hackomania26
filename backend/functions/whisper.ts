import { readFile } from "fs/promises";
import { existsSync } from "fs";

export async function transcribe(audioPath: string, language = "en"): Promise<string> {
  if (!existsSync(audioPath)) throw new Error("File not found: ${audioPath}");
  
  const buffer = await readFile(audioPath);
  const formData = new FormData();
  const blob = new Blob([buffer], { type: "audio/wav" });
  formData.append("file", blob, "audio.wav");
  formData.append("language", language);
  
  const response = await fetch("http://localhost:8001/v1/audio/transcriptions", {
    method: "POST",
    body: formData,
  });
  
  if (!response.ok) throw new Error("API error: ${response.status}");
  
  const result = await response.json();
  return result.text || "";
}