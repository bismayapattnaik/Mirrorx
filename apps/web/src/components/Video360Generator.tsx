import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video,
  Play,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { tryOnApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Video360GeneratorProps {
  /** The try-on result image (base64 with data URI prefix) */
  resultImage: string | null;
  /** Whether the user has enough credits */
  hasCredits: boolean;
  /** Cost in credits for 360 video generation */
  creditCost?: number;
  /** Optional class name */
  className?: string;
}

type JobStatus = 'idle' | 'submitting' | 'processing' | 'completed' | 'failed';

export default function Video360Generator({
  resultImage,
  hasCredits,
  creditCost = 5,
  className,
}: Video360GeneratorProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<JobStatus>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);

  // Check service health on mount
  useEffect(() => {
    tryOnApi.check360Health()
      .then((health) => setIsHealthy(health.status === 'healthy'))
      .catch(() => setIsHealthy(false));
  }, []);

  // Poll for job status when processing
  useEffect(() => {
    if (status !== 'processing' || !jobId) return;

    const pollInterval = setInterval(async () => {
      try {
        const jobStatus = await tryOnApi.get360VideoStatus(jobId);

        setProgress(Math.round(jobStatus.progress * 100));

        if (jobStatus.status === 'completed') {
          setStatus('completed');
          // Create a download URL
          const blob = await tryOnApi.download360Video(jobId);
          const url = URL.createObjectURL(blob);
          setVideoUrl(url);
          toast({
            title: '360° Video Ready!',
            description: 'Your rotating video has been generated.',
          });
          clearInterval(pollInterval);
        } else if (jobStatus.status === 'failed') {
          setStatus('failed');
          setErrorMessage(jobStatus.errorMessage || 'Video generation failed');
          toast({
            variant: 'destructive',
            title: 'Generation Failed',
            description: jobStatus.errorMessage || 'Please try again.',
          });
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Status poll error:', error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [status, jobId, toast]);

  const handleGenerate = useCallback(async () => {
    if (!resultImage) {
      toast({
        variant: 'destructive',
        title: 'No Image',
        description: 'Please generate a try-on result first.',
      });
      return;
    }

    if (!hasCredits) {
      toast({
        variant: 'destructive',
        title: 'Insufficient Credits',
        description: `360° video requires ${creditCost} credits.`,
      });
      return;
    }

    setStatus('submitting');
    setProgress(0);
    setErrorMessage(null);
    setVideoUrl(null);

    try {
      const response = await tryOnApi.generate360Video(resultImage, {
        prompt: 'a 360-degree rotating shot of a person wearing fashion clothing, studio lighting, white background, high quality, 4k',
        numFrames: 80,
        numInferenceSteps: 40,
        guidanceScale: 3.0,
      });

      setJobId(response.job_id);
      setStatus('processing');
      toast({
        title: 'Video Generation Started',
        description: `Estimated time: ~${response.estimated_time_seconds}s`,
      });
    } catch (error) {
      console.error('360 video submission error:', error);
      setStatus('failed');
      setErrorMessage((error as Error).message || 'Failed to start video generation');
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: (error as Error).message || 'Please try again.',
      });
    }
  }, [resultImage, hasCredits, creditCost, toast]);

  const handleDownload = useCallback(() => {
    if (!videoUrl) return;

    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = `mirrorx-360-${Date.now()}.mp4`;
    link.click();
  }, [videoUrl]);

  const handleReset = useCallback(() => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setStatus('idle');
    setJobId(null);
    setProgress(0);
    setVideoUrl(null);
    setErrorMessage(null);
  }, [videoUrl]);

  // Don't render if no result image
  if (!resultImage) {
    return null;
  }

  return (
    <Card className={cn('border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-pink-500/5', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Video className="w-5 h-5 text-purple-400" />
          360° Rotating Video
          {isHealthy === false && (
            <span className="text-xs text-yellow-500 ml-2">(Service Unavailable)</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Generate a stunning 360° rotation video from your try-on result.
        </p>

        <AnimatePresence mode="wait">
          {status === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Button
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90"
                onClick={handleGenerate}
                disabled={!hasCredits || isHealthy === false}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate 360° Video ({creditCost} credits)
              </Button>
              {!hasCredits && (
                <p className="text-xs text-red-400 mt-2 text-center">
                  Insufficient credits. 360° video requires {creditCost} credits.
                </p>
              )}
            </motion.div>
          )}

          {(status === 'submitting' || status === 'processing') && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 text-purple-400">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">
                  {status === 'submitting' ? 'Starting...' : 'Generating video...'}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {progress}% complete
                </span>
                <span>~{Math.max(0, Math.round((100 - progress) * 0.6))}s remaining</span>
              </div>
            </motion.div>
          )}

          {status === 'completed' && videoUrl && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 text-green-400 mb-2">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Video Ready!</span>
              </div>

              <div className="relative rounded-lg overflow-hidden bg-black">
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  loop
                  muted
                  className="w-full aspect-square object-contain"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={handleDownload}
                  className="border-green-500/30 hover:bg-green-500/10"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Generate New
                </Button>
              </div>
            </motion.div>
          )}

          {status === 'failed' && (
            <motion.div
              key="failed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">Generation failed</span>
              </div>
              {errorMessage && (
                <p className="text-xs text-muted-foreground">{errorMessage}</p>
              )}
              <Button
                variant="outline"
                onClick={handleReset}
                className="w-full border-red-500/30 hover:bg-red-500/10"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-xs text-muted-foreground text-center">
          AI-powered 360° rotation using LTX-2 video generation
        </p>
      </CardContent>
    </Card>
  );
}
