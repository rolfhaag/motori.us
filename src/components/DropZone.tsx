"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";

/**
 * Wraps a block of the form so files can be dragged onto it (Chrome, Safari,
 * Edge/Firefox on Windows and macOS -- plain HTML5 drag and drop, no
 * library). Dropped files are handed to `onFiles`; the normal file-picker
 * button inside keeps working as before. Nested children fire their own
 * dragenter/leave events, so a counter keeps the highlight from flickering.
 */
export default function DropZone({
  onFiles,
  disabled,
  label,
  children,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  label: string;
  children: ReactNode;
}) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

  function enter(e: DragEvent) {
    if (disabled || !hasFiles(e)) return;
    e.preventDefault();
    depth.current += 1;
    setOver(true);
  }
  function overHandler(e: DragEvent) {
    if (disabled || !hasFiles(e)) return;
    e.preventDefault(); // required, or the browser refuses the drop
    e.dataTransfer.dropEffect = "copy";
  }
  function leave(e: DragEvent) {
    if (disabled || !hasFiles(e)) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setOver(false);
  }
  function drop(e: DragEvent) {
    if (disabled || !hasFiles(e)) return;
    e.preventDefault();
    depth.current = 0;
    setOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) onFiles(files);
  }

  return (
    <div
      className={`dropzone${over ? " over" : ""}`}
      onDragEnter={enter}
      onDragOver={overHandler}
      onDragLeave={leave}
      onDrop={drop}
    >
      {children}
      {over && <div className="dropzone-label">{label}</div>}
    </div>
  );
}
