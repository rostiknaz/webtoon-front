/**
 * Upload Metadata Step (Step 1)
 *
 * Form for clip metadata with animated category chips,
 * video file validation, and thumbnail preview generation.
 */

import { memo, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Film, AlertCircle, Check, Upload as UploadIcon } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { MotionButton, buttonAnimations } from '@/components/ui/motion-button';
import type { UploadInitInput } from '@/types';
import { analyzeVideoFile, UPLOAD_VIDEO_CONSTRAINTS } from '@/lib/video-analysis';
import type { VideoMetadata } from '@/lib/video-analysis';

const MAX_CATEGORIES = 5;

interface UploadMetadataStepProps {
  seriesId?: string;
  episodeNumber?: number;
  onSubmit: (input: UploadInitInput, file: File, thumbnailUrl: string | null) => void;
}

interface FieldError {
  field: string;
  message: string;
}

const NSFW_OPTIONS = [
  { value: 'safe' as const, label: 'Safe', desc: 'General audience' },
  { value: 'suggestive' as const, label: 'Suggestive', desc: '13+' },
  { value: 'explicit' as const, label: 'Explicit', desc: '18+ only' },
];

const SPRING = { type: 'spring' as const, stiffness: 400, damping: 17 };

export const UploadMetadataStep = memo(function UploadMetadataStep({
  seriesId,
  episodeNumber,
  onSubmit,
}: UploadMetadataStepProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const { data: catData } = useCategories();
  const categories = catData?.categories ?? [];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [nsfwRating, setNsfwRating] = useState<'safe' | 'suggestive' | 'explicit'>('safe');
  const [aiToolUsed, setAiToolUsed] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [videoMeta, setVideoMeta] = useState<VideoMetadata | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const getError = (field: string) => errors.find((e) => e.field === field)?.message;

  const toggleCategory = useCallback((catId: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(catId)) return prev.filter((id) => id !== catId);
      if (prev.length >= MAX_CATEGORIES) return prev;
      return [...prev, catId];
    });
  }, []);

  const analyzeVideo = useCallback((videoFile: File) => {
    setAnalyzing(true);
    setFileError(null);
    setVideoMeta(null);

    analyzeVideoFile(videoFile, UPLOAD_VIDEO_CONSTRAINTS)
      .then((meta) => setVideoMeta(meta))
      .catch((err: string) => setFileError(err))
      .finally(() => setAnalyzing(false));
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    analyzeVideo(selectedFile);
  }, [analyzeVideo]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile || !droppedFile.type.startsWith('video/')) return;
    setFile(droppedFile);
    analyzeVideo(droppedFile);
  }, [analyzeVideo]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: FieldError[] = [];
    if (title.length < 2 || title.length > 100) newErrors.push({ field: 'title', message: 'Title must be 2-100 characters' });
    if (selectedCategories.length === 0) newErrors.push({ field: 'categories', message: 'Select at least 1 category' });
    if (!aiToolUsed.trim()) newErrors.push({ field: 'aiToolUsed', message: 'Required' });
    if (!file) newErrors.push({ field: 'file', message: 'Select a video file' });
    if (fileError) newErrors.push({ field: 'file', message: fileError });
    setErrors(newErrors);
    return newErrors.length === 0;
  }, [title, selectedCategories, aiToolUsed, file, fileError]);

  const handleSubmit = useCallback(() => {
    if (!validate() || !file || !videoMeta) return;

    const input: UploadInitInput = {
      title: title.trim(),
      categoryIds: selectedCategories,
      aiToolUsed: aiToolUsed.trim(),
      nsfwRating,
      fileSize: file.size,
      duration: Math.round(videoMeta.duration),
      resolution: `${videoMeta.width}x${videoMeta.height}`,
      ...(seriesId && { seriesId }),
      ...(episodeNumber && { episodeNumber }),
    };

    onSubmit(input, file, videoMeta.thumbnailUrl);
  }, [validate, file, videoMeta, title, selectedCategories, aiToolUsed, nsfwRating, seriesId, episodeNumber, onSubmit]);

  const transition = shouldReduceMotion ? { duration: 0 } : SPRING;

  return (
    <div className="flex flex-col gap-5 py-4 px-4 max-h-[65vh] overflow-y-auto">
      {/* Title */}
      <div>
        <label htmlFor="clip-title" className="block text-[13px] font-medium mb-1.5">Title</label>
        <input
          id="clip-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Give your clip a title"
          maxLength={100}
          className={`w-full rounded-lg border bg-background px-3 py-2 text-[14px] outline-none transition-colors focus:border-primary ${getError('title') ? 'border-red-500' : 'border-border'}`}
        />
        <AnimatedError message={getError('title')} shouldReduceMotion={shouldReduceMotion} />
      </div>

      {/* Categories */}
      <div>
        <label className="block text-[13px] font-medium mb-1.5">
          Categories <span className="text-muted-foreground font-normal">({selectedCategories.length}/{MAX_CATEGORIES})</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const isSelected = selectedCategories.includes(cat.id);
            return (
              <motion.button
                key={cat.id}
                type="button"
                onClick={() => toggleCategory(cat.id)}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.93 }}
                transition={transition}
                className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/50 text-muted-foreground border-border hover:border-white/20'
                }`}
              >
                <AnimatePresence mode="wait">
                  {isSelected && (
                    <motion.span
                      key="check"
                      initial={shouldReduceMotion ? false : { width: 0, opacity: 0 }}
                      animate={{ width: 'auto', opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      className="inline-flex mr-1"
                    >
                      <Check className="w-3 h-3" />
                    </motion.span>
                  )}
                </AnimatePresence>
                {cat.name}
              </motion.button>
            );
          })}
        </div>
        <AnimatedError message={getError('categories')} shouldReduceMotion={shouldReduceMotion} />
      </div>

      {/* NSFW Rating */}
      <div>
        <label className="block text-[13px] font-medium mb-1.5">Content Rating</label>
        <div className="flex gap-2">
          {NSFW_OPTIONS.map((opt) => (
            <motion.button
              key={opt.value}
              type="button"
              onClick={() => setNsfwRating(opt.value)}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
              className={`flex-1 rounded-lg border px-3 py-2 text-center transition-colors ${
                nsfwRating === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-white/20'
              }`}
            >
              <div className="text-[12px] font-medium">{opt.label}</div>
              <div className="text-[10px] opacity-70">{opt.desc}</div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* AI Tool Used */}
      <div>
        <label htmlFor="ai-tool" className="block text-[13px] font-medium mb-1.5">AI Tool Used</label>
        <input
          id="ai-tool"
          type="text"
          value={aiToolUsed}
          onChange={(e) => setAiToolUsed(e.target.value)}
          placeholder="e.g., Runway Gen-3, Pika, Sora"
          className={`w-full rounded-lg border bg-background px-3 py-2 text-[14px] outline-none transition-colors focus:border-primary ${getError('aiToolUsed') ? 'border-red-500' : 'border-border'}`}
        />
        <AnimatedError message={getError('aiToolUsed')} shouldReduceMotion={shouldReduceMotion} />
      </div>

      {/* Video File */}
      <div>
        <label className="block text-[13px] font-medium mb-1.5">Video File</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4"
          onChange={handleFileChange}
          className="hidden"
        />

        {!file ? (
          <motion.button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
            className={`w-full rounded-xl border-2 border-dashed p-8 flex flex-col items-center gap-3 transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <UploadIcon className="w-8 h-8 text-muted-foreground" />
            <div className="text-[13px] text-muted-foreground">
              <span className="text-primary font-medium">Choose file</span> or drag & drop
            </div>
            <div className="text-[11px] text-muted-foreground">MP4 up to 500MB, 10s-10min, min 720x1280</div>
          </motion.button>
        ) : (
          <div className="rounded-xl border border-border p-3">
            <div className="flex gap-3">
              {/* Thumbnail preview */}
              <AnimatePresence mode="wait">
                {analyzing ? (
                  <motion.div
                    key="analyzing"
                    initial={shouldReduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-16 h-24 rounded-lg bg-muted flex items-center justify-center shrink-0"
                  >
                    <Film className="w-5 h-5 text-muted-foreground animate-pulse" />
                  </motion.div>
                ) : videoMeta?.thumbnailUrl ? (
                  <motion.img
                    key="thumb"
                    src={videoMeta.thumbnailUrl}
                    alt="Video preview"
                    initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-16 h-24 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="w-16 h-24 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Film className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
              </AnimatePresence>

              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate">{file.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {(file.size / (1024 * 1024)).toFixed(1)} MB
                </p>

                {/* Video metadata badges */}
                {videoMeta && !fileError && (
                  <motion.div
                    className="flex gap-1.5 mt-2"
                    initial={shouldReduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <span className="text-[10px] bg-muted rounded px-1.5 py-0.5">
                      {Math.round(videoMeta.duration)}s
                    </span>
                    <span className="text-[10px] bg-muted rounded px-1.5 py-0.5">
                      {videoMeta.width}x{videoMeta.height}
                    </span>
                  </motion.div>
                )}

                {/* Change file */}
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setVideoMeta(null);
                    setFileError(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-[11px] text-primary mt-1.5 hover:underline"
                >
                  Change file
                </button>
              </div>
            </div>
          </div>
        )}

        <AnimatedError message={fileError || getError('file')} shouldReduceMotion={shouldReduceMotion} />
      </div>

      {/* Series info (read-only when in series mode) */}
      {seriesId && (
        <div className="rounded-lg bg-muted/50 px-3 py-2 text-[12px] text-muted-foreground">
          Adding as Episode {episodeNumber} to series
        </div>
      )}

      {/* Submit */}
      <MotionButton
        onClick={handleSubmit}
        disabled={!file || !!fileError || analyzing}
        className="w-full"
        {...buttonAnimations.press}
      >
        {analyzing ? 'Analyzing video...' : 'Upload'}
      </MotionButton>
    </div>
  );
});

function AnimatedError({ message, shouldReduceMotion }: { message?: string | null; shouldReduceMotion: boolean }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, height: 0, x: -5 }}
          animate={{ opacity: 1, height: 'auto', x: 0 }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="flex items-center gap-1 mt-1 text-[11px] text-red-400">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
