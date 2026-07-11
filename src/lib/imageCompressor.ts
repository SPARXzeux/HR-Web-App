/**
 * Client-side WebP Image Compressor and WebP Conversion Kit
 *
 * PocketBase stores these as text fields. Very large base64 strings can
 * approach PocketBase's per-request body limit (default 32 MB) but the
 * practical issue is database row size, so we cap client-side:
 *   - Profile pictures:      up to 1 MB (WebP, base64)
 *   - Document images:       up to 3 MB (WebP, base64)
 *   - Document PDFs:         up to 5 MB (not compressed, just size-checked)
 */

export const MAX_PROFILE_PICTURE_BYTES = 1 * 1024 * 1024; // 1 MB base64 string
export const MAX_DOCUMENT_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB base64 string
export const MAX_DOCUMENT_PDF_BYTES = 5 * 1024 * 1024; // 5 MB raw file size

// Validates a PDF (or any non-image document) File against the size cap.
// Returns an error message if it's too large, or null if it's fine.
export function validatePdfSize(file: File, maxBytes: number = MAX_DOCUMENT_PDF_BYTES): string | null {
  if (file.size > maxBytes) {
    return `PDF is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed is ${(maxBytes / (1024 * 1024)).toFixed(0)} MB.`;
  }
  return null;
}

// Reads a File (e.g. a PDF) into a base64 data URL without any compression.
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && typeof e.target.result === 'string') resolve(e.target.result);
      else reject(new Error('Failed to read file'));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function compressImageToWebP(
  base64OrFile: string | File,
  quality: number = 0.75,
  maxOutputBytes: number = MAX_PROFILE_PICTURE_BYTES,
): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(typeof base64OrFile === 'string' ? base64OrFile : '');
      return;
    }

    let fallbackDataUrl = '';
    if (typeof base64OrFile === 'string') {
      fallbackDataUrl = base64OrFile;
    }

    const img = new Image();
    img.onload = () => {
      try {
        // Set maximum dimensions to preserve detail while limiting file size
        const MAX_WIDTH = 1000;
        const MAX_HEIGHT = 1000;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.warn('[WebP Converter] Failed to get canvas context, falling back.');
          resolve(fallbackDataUrl);
          return;
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Iteratively reduce quality until output fits within maxOutputBytes.
        // Starts at the requested quality and steps down 10% per iteration.
        let q = quality;
        let compressedBase64 = canvas.toDataURL('image/webp', q);
        while (compressedBase64.length > maxOutputBytes && q > 0.1) {
          q = Math.max(0.1, q - 0.1);
          compressedBase64 = canvas.toDataURL('image/webp', q);
        }

        // Last-resort: if still too large, halve the canvas dimensions and retry.
        if (compressedBase64.length > maxOutputBytes) {
          const smallCanvas = document.createElement('canvas');
          smallCanvas.width = Math.round(width / 2);
          smallCanvas.height = Math.round(height / 2);
          const smallCtx = smallCanvas.getContext('2d');
          if (smallCtx) {
            smallCtx.drawImage(img, 0, 0, smallCanvas.width, smallCanvas.height);
            compressedBase64 = smallCanvas.toDataURL('image/webp', 0.5);
          }
        }

        if (compressedBase64.length > maxOutputBytes) {
          console.warn(
            `[WebP Converter] Output still ${(compressedBase64.length / 1024).toFixed(0)} KB after all attempts — ` +
            'the image may not save correctly. Consider using a smaller source image.',
          );
        }

        console.log(
          `[WebP Converter] Original: ${img.width}x${img.height}. ` +
          `Output: ${width}x${height} @ q=${q.toFixed(1)}, ` +
          `size: ${(compressedBase64.length / 1024).toFixed(0)} KB.`,
        );
        resolve(compressedBase64);
      } catch (err) {
        console.warn('[WebP Converter] Conversion threw error, falling back:', err);
        resolve(fallbackDataUrl);
      }
    };

    img.onerror = () => {
      console.warn('[WebP Converter] Image rendering failed (possibly headless browser), using fallback data URL.');
      resolve(fallbackDataUrl);
    };

    if (typeof base64OrFile === 'string') {
      img.src = base64OrFile;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result && typeof e.target.result === 'string') {
          fallbackDataUrl = e.target.result;
          img.src = e.target.result;
        } else {
          console.warn('[WebP Converter] FileReader result empty, using fallback.');
          resolve('');
        }
      };
      reader.onerror = () => {
        console.warn('[WebP Converter] FileReader failed, using fallback.');
        resolve('');
      };
      reader.readAsDataURL(base64OrFile);
    }
  });
}
