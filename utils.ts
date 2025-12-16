/**
 * Cleans the Base64 string by removing newlines and whitespace.
 */
export const cleanBase64 = (str: string): string => {
  return str.replace(/\s/g, '');
};

interface ProcessedMedia {
  src: string;
  ext: string;
  mime: string;
  type: 'image' | 'video' | 'audio';
}

/**
 * Detects the MIME type, extension, and media type from a Base64 string.
 * Handles Images, Videos, and common Audio formats (MP3, WAV, FLAC, OGG, AAC/M4A, WMA).
 */
export const processBase64Input = (raw: string): ProcessedMedia => {
  const cleaned = cleanBase64(raw);
  
  // 1. Check for existing Data URI scheme
  const dataUriPattern = /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/;
  const match = cleaned.match(dataUriPattern);
  
  if (match) {
    const mime = match[1];
    let ext = mime.split('/')[1];
    let type: 'image' | 'video' | 'audio' = 'image';

    if (mime.startsWith('video/')) type = 'video';
    if (mime.startsWith('audio/')) type = 'audio';

    // Normalize extensions
    if (ext === 'jpeg') ext = 'jpg';
    if (ext === 'svg+xml') ext = 'svg';
    if (ext === 'x-icon') ext = 'ico';
    if (ext === 'mpeg') ext = 'mp3'; // Common fallback
    if (ext === 'x-m4a') ext = 'm4a';
    
    return { src: cleaned, ext, mime, type };
  }

  // 2. Detect from Magic Numbers (signatures)
  // We decode the first few bytes to check signatures reliably without complex regex on base64
  let header = '';
  try {
    // Decode first 24 bytes (approx 32 base64 chars) to ASCII/Binary string
    header = atob(cleaned.slice(0, 32));
  } catch (e) {
    // If invalid base64, fallback or fail gracefully
  }

  // Helper to check bytes in the header
  const startsWithHex = (hexVals: number[]) => {
    for (let i = 0; i < hexVals.length; i++) {
      if (header.charCodeAt(i) !== hexVals[i]) return false;
    }
    return true;
  };

  // --- AUDIO ---

  // MP3: ID3 (49 44 33)
  if (header.startsWith('ID3')) {
    return { src: `data:audio/mpeg;base64,${cleaned}`, ext: 'mp3', mime: 'audio/mpeg', type: 'audio' };
  }
  // MP3: FF FB (MPEG-1 Layer 3 without ID3) - 255 251
  if (startsWithHex([0xFF, 0xFB])) {
    return { src: `data:audio/mpeg;base64,${cleaned}`, ext: 'mp3', mime: 'audio/mpeg', type: 'audio' };
  }

  // FLAC: fLaC
  if (header.startsWith('fLaC')) {
     return { src: `data:audio/flac;base64,${cleaned}`, ext: 'flac', mime: 'audio/flac', type: 'audio' };
  }

  // OGG: OggS
  if (header.startsWith('OggS')) {
    return { src: `data:audio/ogg;base64,${cleaned}`, ext: 'ogg', mime: 'audio/ogg', type: 'audio' };
  }

  // M4A / AAC (ISO Media, often M4A): 00 00 00 20 ftyp M4A
  // checking 'ftypM4A' at offset 4
  if (header.slice(4, 11) === 'ftypM4A') {
     return { src: `data:audio/mp4;base64,${cleaned}`, ext: 'm4a', mime: 'audio/mp4', type: 'audio' };
  }

  // WMA (ASF): 30 26 B2 75 8E 66 CF 11
  if (startsWithHex([0x30, 0x26, 0xB2, 0x75, 0x8E, 0x66, 0xCF, 0x11])) {
    return { src: `data:audio/x-ms-wma;base64,${cleaned}`, ext: 'wma', mime: 'audio/x-ms-wma', type: 'audio' };
  }

  // --- RIFF CONTAINER (WAV, AVI, WEBP) ---
  if (header.startsWith('RIFF')) {
    const format = header.slice(8, 12);
    if (format === 'WAVE') {
      return { src: `data:audio/wav;base64,${cleaned}`, ext: 'wav', mime: 'audio/wav', type: 'audio' };
    }
    if (format === 'AVI ') {
      return { src: `data:video/x-msvideo;base64,${cleaned}`, ext: 'avi', mime: 'video/x-msvideo', type: 'video' };
    }
    if (format === 'WEBP') {
      return { src: `data:image/webp;base64,${cleaned}`, ext: 'webp', mime: 'image/webp', type: 'image' };
    }
  }

  // --- VIDEO ---

  // MP4: ftyp (usually at offset 4) - simplified check from previous, searching generally for ftyp
  // header 00 00 00 18 ftyp...
  if (header.includes('ftyp') && !header.includes('M4A')) {
     return { src: `data:video/mp4;base64,${cleaned}`, ext: 'mp4', mime: 'video/mp4', type: 'video' };
  }

  // WEBM: 1A 45 DF A3
  if (startsWithHex([0x1A, 0x45, 0xDF, 0xA3])) {
     return { src: `data:video/webm;base64,${cleaned}`, ext: 'webm', mime: 'video/webm', type: 'video' };
  }

  // --- IMAGE ---

  // PNG: .PNG
  if (header.slice(1, 4) === 'PNG') {
     return { src: `data:image/png;base64,${cleaned}`, ext: 'png', mime: 'image/png', type: 'image' };
  }
  
  // JPEG: FF D8 FF
  if (startsWithHex([0xFF, 0xD8, 0xFF])) {
    return { src: `data:image/jpeg;base64,${cleaned}`, ext: 'jpg', mime: 'image/jpeg', type: 'image' };
  }

  // GIF: GIF8
  if (header.startsWith('GIF8')) {
    return { src: `data:image/gif;base64,${cleaned}`, ext: 'gif', mime: 'image/gif', type: 'image' };
  }

  // BMP: BM
  if (header.startsWith('BM')) {
    return { src: `data:image/bmp;base64,${cleaned}`, ext: 'bmp', mime: 'image/bmp', type: 'image' };
  }

  // ICO: 00 00 01 00
  if (startsWithHex([0x00, 0x00, 0x01, 0x00])) {
    return { src: `data:image/x-icon;base64,${cleaned}`, ext: 'ico', mime: 'image/x-icon', type: 'image' };
  }
  
  // SVG: <svg or <?xml (text based)
  if (header.includes('<svg') || (header.includes('<?xml') && cleaned.includes('svg'))) {
    return { src: `data:image/svg+xml;base64,${cleaned}`, ext: 'svg', mime: 'image/svg+xml', type: 'image' };
  }

  // 3. Fallback (Default to PNG if detection fails)
  return {
    src: `data:image/png;base64,${cleaned}`,
    ext: 'png',
    mime: 'image/png',
    type: 'image'
  };
};

/**
 * Triggers a download of the provided image source.
 */
export const downloadImage = (src: string, filename: string) => {
  const link = document.createElement('a');
  link.href = src;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Triggers a download of the provided text content.
 */
export const downloadText = (text: string, filename: string) => {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Formats bytes into a readable string (KB, MB, etc.).
 */
export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Calculates the size of the file in bytes from a Base64 string.
 */
export const getBase64Size = (base64String: string): number => {
  // Strip the Data URI header if present
  const base64 = base64String.split(',')[1] || base64String;
  // Count padding characters
  const padding = (base64.match(/=/g) || []).length;
  // Base64 encodes 3 bytes into 4 characters
  return (base64.length * 3) / 4 - padding;
};

/**
 * Calculates the greatest common divisor.
 */
const gcd = (a: number, b: number): number => {
  return b === 0 ? a : gcd(b, a % b);
};

/**
 * Calculates simplified aspect ratio.
 */
export const getAspectRatio = (width: number, height: number): string => {
  if (height === 0) return 'NaN';
  const divisor = gcd(Math.round(width), Math.round(height));
  return `${width / divisor}:${height / divisor}`;
};

/**
 * Formats seconds into MM:SS format.
 */
export const formatDuration = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};