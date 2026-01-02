/**
 * Utility functions for handling image data and preventing 431 errors
 */

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB limit for images
const MAX_HEADER_SIZE = 1024 * 1024; // 1MB limit for "header-safe" data (increased from 16KB)

/**
 * Validates if an image data URL is within acceptable size limits
 */
export function validateImageDataUrl(dataUrl: string): { isValid: boolean; error?: string } {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return { isValid: false, error: 'Invalid data URL' };
  }

  // Check if it's a data URL
  if (!dataUrl.startsWith('data:')) {
    return { isValid: false, error: 'Not a data URL' };
  }

  // Extract the base64 part and calculate size
  const base64Part = dataUrl.split(',')[1];
  if (!base64Part) {
    return { isValid: false, error: 'Invalid data URL format' };
  }

  // Calculate approximate size (base64 is ~33% larger than binary)
  const size = Math.floor(base64Part.length * 0.75);

  if (size > MAX_IMAGE_SIZE) {
    return { isValid: false, error: `Image too large: ${Math.round(size / 1024)}KB (max: ${MAX_IMAGE_SIZE / 1024}KB)` };
  }

  return { isValid: true };
}

/**
 * Resizes an image to fit within the specified dimensions
 */
export function resizeImage(file: File, maxWidth: number = 400, maxHeight: number = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      try {
        // Calculate new dimensions
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          
          // Try to create a JPEG with good quality, fallback to PNG if needed
          try {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            resolve(dataUrl);
          } catch (jpegError) {
            console.warn('JPEG conversion failed, trying PNG:', jpegError);
            try {
              const dataUrl = canvas.toDataURL('image/png');
              resolve(dataUrl);
            } catch (pngError) {
              reject(new Error('Failed to convert image to either JPEG or PNG'));
            }
          }
        } else {
          reject(new Error('Could not get canvas context'));
        }
      } catch (error) {
        reject(new Error(`Image processing failed: ${error}`));
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    
    // Handle object URL cleanup
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    
    // Clean up object URL after image loads or fails
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 1000);
  });
}

/**
 * Processes a file for use as a profile image
 */
export async function processProfileImage(file: File): Promise<string> {
  console.log('Processing profile image:', file.name, file.type, file.size);
  
  // Check file size first
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error(`File too large: ${Math.round(file.size / 1024)}KB (max: ${MAX_IMAGE_SIZE / 1024}KB)`);
  }

  // Check if file is actually an image
  if (!file.type.startsWith('image/')) {
    throw new Error(`Invalid file type: ${file.type}. Please select an image file.`);
  }

  try {
    // Try to resize the image
    console.log('Attempting to resize image...');
    const resizedDataUrl = await resizeImage(file);
    console.log('Image resized successfully');
    
    // Validate the result
    const validation = validateImageDataUrl(resizedDataUrl);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    return resizedDataUrl;
  } catch (error) {
    console.error('Image processing failed:', error);
    
    // Fallback: try to read the image as-is without resizing
    try {
      console.log('Attempting fallback: reading image without resizing...');
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      
      // Validate the fallback result
      const validation = validateImageDataUrl(dataUrl);
      if (!validation.isValid) {
        throw new Error(`Image validation failed: ${validation.error}`);
      }
      
      console.log('Fallback successful');
      return dataUrl;
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Creates a safe version of image data for HTTP requests
 */
export function createSafeImageData(dataUrl: string): { safe: string; isDataUrl: boolean } {
  const validation = validateImageDataUrl(dataUrl);
  
  if (!validation.isValid) {
    // Return a placeholder or empty string for invalid/large images
    return { safe: '', isDataUrl: false };
  }

  if (dataUrl.length > MAX_HEADER_SIZE) {
    // For very large images, return a placeholder
    return { safe: '', isDataUrl: false };
  }

  return { safe: dataUrl, isDataUrl: true };
}
