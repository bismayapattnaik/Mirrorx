import Replicate from 'replicate';

// Initialize Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || '',
});

// IDM-VTON model for virtual try-on with perfect face preservation
const VTON_MODEL = 'cuuupid/idm-vton:c871bb9b046c1c045725e293bfe1e5847ae29f8d0bfc76b6bd32ed0dd89bf5eb';

// Kolors Virtual Try-On as backup
const KOLORS_VTON_MODEL = 'camenduru/kolors-virtual-try-on:c1a02d4c87e4a55ea5289aa4e86c6f7f2af0c77dd6de5df7be45f56f1a044b75';

type Gender = 'male' | 'female';
type Category = 'upper_body' | 'lower_body' | 'dresses';

interface TryOnResult {
  image: string;
  success: boolean;
  error?: string;
}

/**
 * Generate virtual try-on using IDM-VTON model
 * This model preserves the exact face from the input image
 */
export async function generateTryOnWithReplicate(
  personImageUrl: string,
  garmentImageUrl: string,
  category: Category = 'upper_body'
): Promise<string> {
  try {
    console.log('Starting IDM-VTON generation...');

    const output = await replicate.run(VTON_MODEL, {
      input: {
        human_img: personImageUrl,
        garm_img: garmentImageUrl,
        garment_des: getGarmentDescription(category),
        category: category,
        // High quality settings
        denoise_steps: 30,
        seed: Math.floor(Math.random() * 1000000),
      },
    });

    console.log('IDM-VTON output:', typeof output);

    // Handle output - could be string URL or array
    if (typeof output === 'string') {
      return output;
    } else if (Array.isArray(output) && output.length > 0) {
      return output[0] as string;
    }

    throw new Error('Unexpected output format from IDM-VTON');
  } catch (error) {
    console.error('IDM-VTON error:', error);
    throw error;
  }
}

/**
 * Generate virtual try-on using Kolors model (backup)
 */
export async function generateTryOnWithKolors(
  personImageUrl: string,
  garmentImageUrl: string
): Promise<string> {
  try {
    console.log('Starting Kolors Virtual Try-On...');

    const output = await replicate.run(KOLORS_VTON_MODEL, {
      input: {
        person_image: personImageUrl,
        garment_image: garmentImageUrl,
      },
    });

    if (typeof output === 'string') {
      return output;
    } else if (Array.isArray(output) && output.length > 0) {
      return output[0] as string;
    }

    throw new Error('Unexpected output format from Kolors');
  } catch (error) {
    console.error('Kolors error:', error);
    throw error;
  }
}

/**
 * Upload base64 image to temporary storage and get URL
 * Replicate needs URLs, not base64
 */
export async function uploadToTempStorage(imageData: string): Promise<string> {
  // If it's already a URL, return it directly
  if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
    return imageData;
  }

  try {
    // Clean base64 string
    const cleanBase64 = imageData.replace(/^data:image\/\w+;base64,/, '');

    // Use Replicate's file upload
    const buffer = Buffer.from(cleanBase64, 'base64');
    const blob = new Blob([buffer], { type: 'image/jpeg' });

    // Create a File object
    const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });

    // Upload to Replicate
    const fileUrl = await replicate.files.create(file);

    return fileUrl.urls.get;
  } catch (error) {
    console.error('Upload error:', error);
    // Fallback: return as data URL (some models accept this)
    if (!imageData.startsWith('data:')) {
      return `data:image/jpeg;base64,${imageData}`;
    }
    return imageData;
  }
}

/**
 * Main function to run virtual try-on
 */
export async function runVirtualTryOn(
  personBase64: string,
  garmentBase64: string,
  category: 'upper_body' | 'lower_body' | 'dresses' = 'upper_body',
  useKolorsBackup: boolean = false
): Promise<string> {
  try {
    // Upload images to get URLs
    console.log('Uploading person image...');
    const personUrl = await uploadToTempStorage(personBase64);

    console.log('Uploading garment image...');
    const garmentUrl = await uploadToTempStorage(garmentBase64);

    // Run try-on model
    if (useKolorsBackup) {
      return await generateTryOnWithKolors(personUrl, garmentUrl);
    } else {
      return await generateTryOnWithReplicate(personUrl, garmentUrl, category);
    }
  } catch (error) {
    console.error('Virtual try-on error:', error);

    // Try Kolors as backup
    if (!useKolorsBackup) {
      console.log('Trying Kolors as backup...');
      try {
        const personUrl = await uploadToTempStorage(personBase64);
        const garmentUrl = await uploadToTempStorage(garmentBase64);
        return await generateTryOnWithKolors(personUrl, garmentUrl);
      } catch (backupError) {
        console.error('Backup also failed:', backupError);
      }
    }

    throw new Error('Virtual try-on generation failed');
  }
}

function getGarmentDescription(category: Category): string {
  switch (category) {
    case 'upper_body':
      return 'A stylish top/shirt';
    case 'lower_body':
      return 'Stylish pants/bottoms';
    case 'dresses':
      return 'A beautiful dress';
    default:
      return 'A fashionable garment';
  }
}

export default {
  runVirtualTryOn,
  generateTryOnWithReplicate,
  generateTryOnWithKolors,
  uploadToTempStorage,
};
