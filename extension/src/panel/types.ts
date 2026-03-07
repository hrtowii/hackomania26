import type { WhatsAppClassification } from "./constants";
import type { PendingAnalysis } from "../background/index";

export type Mode = "picker" | "text" | "audio" | "speech" | "image";

export interface CrossReference {
  title: string;
  source: string;
  contradiction_level: "low" | "medium" | "high";
  url: string;
}

export interface AnalysisResult {
  analysis_id: string;
  credibility_score: number;
  classification?: WhatsAppClassification;
  summary: string;
  bias_detected: string[];
  cross_references: CrossReference[];
  key_claims: string[];
  recommendation: string;
  audio_url?: string;
}

export type AppState =
  | { status: "idle" }
  | { status: "loaded"; pending: PendingAnalysis }
  | { status: "loading" }
  | { status: "success"; result: AnalysisResult }
  | { status: "error"; message: string };

export interface UploadedImage {
  file: File;
  dataUrl: string;
}
