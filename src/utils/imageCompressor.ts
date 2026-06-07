export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeKB?: number;
}

export interface CompressResult {
  success: boolean;
  imageData?: string;
  fileSize: number;
  error?: string;
}

const DEFAULT_OPTIONS: Required<CompressOptions> = {
  maxWidth: 800,
  maxHeight: 600,
  quality: 0.7,
  maxSizeKB: 100,
};

export function compressImage(file: File, options: CompressOptions = {}): Promise<CompressResult> {
  return new Promise((resolve) => {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    if (!file.type.startsWith('image/')) {
      resolve({
        success: false,
        fileSize: 0,
        error: '请选择有效的图片文件',
      });
      return;
    }

    const maxFileSize = opts.maxSizeKB * 1024;
    if (file.size <= maxFileSize && opts.quality >= 0.9) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        resolve({
          success: true,
          imageData: dataUrl,
          fileSize: file.size,
        });
      };
      reader.onerror = () => {
        resolve({
          success: false,
          fileSize: 0,
          error: '读取图片文件失败',
        });
      };
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        let newWidth = width;
        let newHeight = height;

        if (width > opts.maxWidth) {
          newWidth = opts.maxWidth;
          newHeight = (height * newWidth) / width;
        }
        if (newHeight > opts.maxHeight) {
          newHeight = opts.maxHeight;
          newWidth = (newWidth * newHeight) / height;
        }

        newWidth = Math.round(newWidth);
        newHeight = Math.round(newHeight);

        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            success: false,
            fileSize: 0,
            error: '创建画布失败，请更换浏览器重试',
          });
          return;
        }

        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        let quality = opts.quality;
        let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        let compressedSize = Math.round((compressedDataUrl.length * 3) / 4);

        while (compressedSize > maxFileSize && quality > 0.3) {
          quality -= 0.1;
          compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          compressedSize = Math.round((compressedDataUrl.length * 3) / 4);
        }

        if (compressedSize > maxFileSize * 1.5) {
          resolve({
            success: false,
            fileSize: compressedSize,
            error: `图片过大（${Math.round(compressedSize / 1024)}KB），即使压缩后仍超过限制。请选择更小的图片或分辨率更低的图片。`,
          });
          return;
        }

        resolve({
          success: true,
          imageData: compressedDataUrl,
          fileSize: compressedSize,
        });
      };

      img.onerror = () => {
        resolve({
          success: false,
          fileSize: 0,
          error: '加载图片失败，文件可能已损坏',
        });
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      resolve({
        success: false,
        fileSize: 0,
        error: '读取图片文件失败',
      });
    };

    reader.readAsDataURL(file);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
