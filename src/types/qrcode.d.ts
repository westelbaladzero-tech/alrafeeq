declare module "qrcode" {
  export interface QRCodeToCanvasOptions {
    width?: number;
    margin?: number;
    color?: { dark?: string; light?: string };
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  }
  export function toCanvas(
    canvas: HTMLCanvasElement,
    text: string,
    options?: QRCodeToCanvasOptions
  ): Promise<void>;
  export function toDataURL(
    text: string,
    options?: QRCodeToCanvasOptions
  ): Promise<string>;
  const _default: { toCanvas: typeof toCanvas; toDataURL: typeof toDataURL };
  export default _default;
}
