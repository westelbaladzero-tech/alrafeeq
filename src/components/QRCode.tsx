"use client";
import { useEffect, useRef } from "react";
import QRCodeLib from "qrcode";

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export default function QRCode({ value, size = 200, className }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QRCodeLib.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: "#1a1a2e", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).catch(() => {});
  }, [value, size]);

  return <canvas ref={canvasRef} className={className} style={{ width: size, height: size }} />;
}

export async function downloadQR(value: string, filename: string) {
  try {
    const dataUrl = await QRCodeLib.toDataURL(value, {
      width: 400,
      margin: 2,
      color: { dark: "#1a1a2e", light: "#ffffff" },
    });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename + ".png";
    link.click();
  } catch {}
}
