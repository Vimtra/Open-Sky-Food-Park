"use client";

import { ImageUp, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { backend } from "@/lib/backend";
import { friendlyError, imageSrc } from "@/lib/format";
import { Button, cn } from "./ui";

const MAX_BYTES = 15 * 1024 * 1024;

/**
 * Shrinks a photo in the browser before upload: at most [maxSide] px on the long side, JPEG.
 * Phone photos (4–10 MB) become ~150–300 KB, which keeps the menu fast on park Wi-Fi.
 */
async function shrink(file: File, maxSide: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("That file isn't a photo we can read. Use a JPG, PNG or WebP.");
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't prepare photos. Try another browser.");
  ctx.fillStyle = "#ffffff"; // transparent PNGs get a white ground instead of black
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not prepare that photo."))), "image/jpeg", 0.84),
  );
}

interface Props {
  label: string;
  value: string;
  onChange: (url: string) => void;
  folder: "dishes" | "stalls" | "promos";
  hint?: string;
  /** Preview shape: square for dishes and posters, wide for covers, round for logos. */
  shape?: "square" | "wide" | "round";
  maxSide?: number;
}

/** Photo picker for the admin panel: choose a file, it is resized and uploaded, the preview updates. */
export function ImageUpload({ label, value, onChange, folder, hint, shape = "square", maxSide = 1200 }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const src = imageSrc(value);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Choose a photo (JPG, PNG or WebP).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That photo is over 15 MB. Choose a smaller one.");
      return;
    }
    setBusy(true);
    try {
      const blob = await shrink(file, maxSide);
      onChange(await backend().uploadImage(blob, folder));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const frame = cn(
    "relative flex shrink-0 items-center justify-center overflow-hidden border border-line bg-surface-1 text-ink-300",
    shape === "round" ? "size-20 rounded-full" : shape === "wide" ? "h-20 w-30 rounded-md" : "size-20 rounded-md",
  );

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-label text-ink-900">
        {label}
      </label>
      <div className="flex items-center gap-4">
        <div className={frame}>
          {src ? <img src={src} alt="" className="size-full object-cover" /> : <ImageUp className="size-6" aria-hidden />}
          {busy && <span className="skeleton absolute inset-0 rounded-none" aria-hidden />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={input}
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="sr-only"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          <Button variant="outline" size="sm" loading={busy} onClick={() => input.current?.click()}>
            <ImageUp className="size-4" aria-hidden />
            {src ? "Change photo" : "Upload photo"}
          </Button>
          {src && !busy && (
            <Button variant="ghost" size="sm" className="text-chili-600" onClick={() => onChange("")}>
              <Trash2 className="size-4" aria-hidden />
              Remove
            </Button>
          )}
        </div>
      </div>
      {error ? (
        <p className="mt-1.5 text-small font-medium text-chili-600" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-small text-ink-500">{hint}</p>
      )}
    </div>
  );
}
