export interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  imageUrl?: string;
  timestamp: Date;
  mode: "text" | "image";
  isGenerating?: boolean;
  error?: string;
  isFallback?: boolean;
  errorDetails?: string;
}

export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

export type ImageStyle = "none" | "photorealistic" | "watercolor" | "3D render" | "minimalist" | "pixel art" | "cyberpunk" | "line art";

export interface StyleOption {
  value: ImageStyle;
  label: string;
  description: string;
}

export interface AspectRatioOption {
  value: AspectRatio;
  label: string;
  ratioClass: string;
}
