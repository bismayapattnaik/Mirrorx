let PredictionServiceClient: any;
let helpers: any;

async function loadAIPlatform() {
  if (!PredictionServiceClient) {
    try {
      // @ts-ignore - optional dependency, only needed when Vertex AI is configured
      const mod = await import('@google-cloud/aiplatform');
      PredictionServiceClient = mod.PredictionServiceClient;
      helpers = mod.helpers;
    } catch {
      throw new Error('Vertex AI SDK not installed. Run: pnpm add @google-cloud/aiplatform');
    }
  }
}

const PROJECT_ID = process.env.GOOGLE_PROJECT_ID;
const LOCATION = 'us-central1';
const ENDPOINT_ID = process.env.VERTEX_ENDPOINT_ID;

export async function generateVtonImage(
  userImageBase64: string,
  garmentImageBase64: string
): Promise<string> {
  if (!ENDPOINT_ID || !PROJECT_ID) {
    throw new Error('Vertex AI Configuration Missing (PROJECT_ID or ENDPOINT_ID)');
  }

  await loadAIPlatform();

  const clientOptions = {
    apiEndpoint: `${LOCATION}-aiplatform.googleapis.com`,
  };
  const predictionServiceClient = new PredictionServiceClient(clientOptions);

  const endpoint = `projects/${PROJECT_ID}/locations/${LOCATION}/endpoints/${ENDPOINT_ID}`;

  // Clean Base64 strings
  const cleanUser = userImageBase64.replace(/^data:image\/\w+;base64,/, '');
  const cleanGarment = garmentImageBase64.replace(/^data:image\/\w+;base64,/, '');

  // Construct Payload
  const instance = {
    user_image: cleanUser,
    garment_image: cleanGarment
  };
  const instanceValue = helpers.toValue(instance);
  const instances = [instanceValue];

  const request = {
    endpoint,
    instances,
  };

  console.log(`[VertexAI] Generating VTON on Endpoint: ${ENDPOINT_ID}...`);

  try {
    const [response] = await predictionServiceClient.predict(request);

    if (!response.predictions || response.predictions.length === 0) {
      throw new Error('Vertex AI returned no predictions');
    }

    // Parse Response
    const prediction: any = response.predictions[0];
    // Vertex returns struct value, we need to extract the string
    const generatedImageB64 = prediction.structValue?.fields?.generated_image?.stringValue;

    if (!generatedImageB64) {
      throw new Error('Invalid response format from Custom Model');
    }

    return `data:image/jpeg;base64,${generatedImageB64}`;

  } catch (error) {
    console.error('[VertexAI] Prediction Failed:', error);
    throw error;
  }
}
