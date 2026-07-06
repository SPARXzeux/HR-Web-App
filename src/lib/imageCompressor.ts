/**
 * Client-side WebP Image Compressor and WebP Conversion Kit
 */
export async function compressImageToWebP(base64OrFile: string | File, quality: number = 0.75): Promise<string> {
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

        // Convert to WebP format with specified quality
        const compressedBase64 = canvas.toDataURL('image/webp', quality);
        
        console.log(`[WebP Converter] Original dimensions: ${img.width}x${img.height}. Compressed to: ${width}x${height}. Format: image/webp.`);
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
