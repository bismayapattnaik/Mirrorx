import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { tryOnApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface VideoGeneratorProps {
  /** The try-on result image (base64 with data URI prefix) */
  resultImage: string | null;
  /** Whether the user has enough credits */
  hasCredits: boolean;
  /** Cost in credits for video generation */
  creditCost?: number;
  /** Optional class name */
  className?: string;
}

type JobStatus = 'idle' | 'submitting' | 'processing' | 'completed' | 'failed';

// Preset motion styles for fashion videos
const motionPresets = [
  {
    id: 'natural',
    name: 'Natural Movement',
    prompt: 'A person wearing fashionable clothing, natural subtle movement, breathing, slight body sway, confident pose, studio lighting, high quality',
  },
  {
    id: 'catwalk',
    name: 'Runway Walk',
    prompt: 'A fashion model walking on a runway, confident stride, elegant movement, professional model walk, studio lighting, high fashion',
  },
  {
    id: 'pose',
    name: 'Strike a Pose',
    prompt: 'A model striking different poses, smooth transitions between poses, fashion photography style, elegant movements, studio lighting',
  },
  {
    id: 'turn',
    name: 'Slow Turn',
    prompt: 'A person slowly turning around to show outfit from all angles, smooth rotation, fashion showcase, studio lighting, elegant',
  },
  {
    id: 'wind',
    name: 'Wind Effect',
    prompt: 'A person standing with wind blowing through hair and clothes, dynamic fabric movement, dramatic lighting, fashion editorial style',
  },
];

export default function VideoGenerator({
  resultImage,
  hasCredits,
  creditCost = 5,
  className,
}: VideoGeneratorProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<JobStatus>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [selectedPreset, setSelectedPreset] = useState('natural');

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
            title: 'Video Ready!',
            description: 'Your animated video has been generated.',
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
        description: `Animated video requires ${creditCost} credits.`,
      });
      return;
    }

    setStatus('submitting');
    setProgress(0);
    setErrorMessage(null);
    setVideoUrl(null);

    const preset = motionPresets.find(p => p.id === selectedPreset) || motionPresets[0];

    try {
      const response = await tryOnApi.generate360Video(resultImage, {
        prompt: preset.prompt,
        numFrames: 49,  // ~2 seconds at 24fps
        numInferenceSteps: 30,
        guidanceScale: 7.5,
      });

      setJobId(response.job_id);
      setStatus('processing');
      toast({
        title: 'Video Generation Started',
        description: `Creating "${preset.name}" animation...`,
      });
    } catch (error) {
      console.error('Video submission error:', error);
      setStatus('failed');
      setErrorMessage((error as Error).message || 'Failed to start video generation');
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: (error as Error).message || 'Please try again.',
      });
    }
  }, [resultImage, hasCredits, creditCost, selectedPreset, toast]);

  const handleDownload = useCallback(() => {
    if (!videoUrl) return;

    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = `mirrorx-video-${Date.now()}.mp4`;
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
          Animate Your Look
          {isHealthy === false && (
            <span className="text-xs text-yellow-500 ml-2">(Service Unavailable)</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Bring your try-on result to life with AI-powered video generation.
        </p>

        <AnimatePresence mode="wait">
          {status === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Motion Style Selector */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Animation Style</Label>
                <Select value={selectedPreset} onValueChange={setSelectedPreset}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select animation style" />
                  </SelectTrigger>
                  <SelectContent>
                    {motionPresets.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        <div className="flex items-center gap-2">
                          <Wand2 className="w-4 h-4 text-purple-400" />
                          {preset.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {motionPresets.find(p => p.id === selectedPreset)?.prompt.slice(0, 60)}...
                </p>
              </div>

              <Button
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90"
                onClick={handleGenerate}
                disabled={!hasCredits || isHealthy === false}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Video ({creditCost} credits)
              </Button>
              {!hasCredits && (
                <p className="text-xs text-red-400 text-center">
                  Insufficient credits. Video generation requires {creditCost} credits.
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
                <span>~{Math.max(10, Math.round((100 - progress) * 0.3))}s remaining</span>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                AI is animating your outfit with LTX-2...
              </p>
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
                  playsInline
                  className="w-full aspect-[9/16] object-contain max-h-[400px]"
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
          Powered by LTX-2 Image-to-Video AI
        </p>
      </CardContent>
    </Card>
  );
}
