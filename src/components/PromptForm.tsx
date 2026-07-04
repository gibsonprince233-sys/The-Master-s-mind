import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import { Send, Image as ImageIcon, Paperclip, Camera, RefreshCw } from "lucide-react";
import { Attachment } from "../types";

interface PromptFormProps {
  onSend: (text: string) => void;
  isGenerating: boolean;
  mode: "text" | "image";
  setMode: (mode: "text" | "image") => void;
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  handleFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  startCamera: () => void;
}

export function PromptForm({
  onSend,
  isGenerating,
  mode,
  setMode,
  attachments,
  setAttachments,
  handleFileChange,
  startCamera,
}: PromptFormProps) {
  const [localInput, setLocalInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Monitor local input to auto-switch to image mode if user types /image
  useEffect(() => {
    if (localInput.trim().startsWith("/image ")) {
      if (mode !== "image") {
        setMode("image");
      }
    }
  }, [localInput, mode, setMode]);

  // Handle textarea height auto-grow
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
    }
  }, [localInput]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localInput.trim() || isGenerating) return;
    onSend(localInput);
    setLocalInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t border-neutral-200 bg-white p-4 space-y-4 shrink-0">
      {/* Hidden File Upload Input */}
      <input
        type="file"
        id="file-upload-input"
        className="hidden"
        multiple
        onChange={handleFileChange}
        accept="image/*,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/json,text/csv"
      />

      <form
        onSubmit={handleSubmit}
        className="flex gap-2 relative items-end border border-neutral-200 focus-within:border-neutral-400 bg-neutral-50/50 p-1.5 rounded-2xl transition-all"
      >
        {/* Context Mode indicator badge */}
        {mode === "image" && (
          <div className="absolute top-[-11px] left-4 bg-neutral-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm uppercase tracking-wide z-10">
            <ImageIcon className="w-3 h-3" />
            Image Generation Mode
          </div>
        )}

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-1 pl-1 shrink-0 pb-1">
          <button
            type="button"
            onClick={() => document.getElementById("file-upload-input")?.click()}
            className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-all"
            title="Upload image or document"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={startCamera}
            className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-all"
            title="Capture with camera"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={localInput}
          onChange={(e) => setLocalInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            mode === "image"
              ? "Describe the image you want The Master to paint..."
              : "Type a message or use '/image prompt'..."
          }
          rows={1}
          className="flex-1 resize-none bg-transparent outline-none py-2 px-3 text-sm text-neutral-800 placeholder-neutral-400 font-sans max-h-32 min-h-[36px]"
        />

        <button
          type="submit"
          disabled={!localInput.trim() || isGenerating}
          className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
            !localInput.trim() || isGenerating
              ? "bg-neutral-100 text-neutral-300 cursor-not-allowed"
              : "bg-neutral-950 text-white hover:bg-neutral-900 shadow-xs shadow-neutral-950/20 active:scale-95"
          }`}
        >
          {isGenerating ? (
            <RefreshCw className="w-4.5 h-4.5 animate-spin" />
          ) : (
            <Send className="w-4.5 h-4.5" />
          )}
        </button>
      </form>
    </div>
  );
}
