/**
 * SeriesForm Component
 *
 * Shared form for creating and editing series.
 * Handles cover image upload via presigned URL flow.
 */

import { useState, useCallback, useRef } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Upload, ImageIcon } from 'lucide-react';
import { getSeriesCoverUploadUrl, completeSeriesCoverUpload } from '@/api';

export interface SeriesFormValues {
  title: string;
  description?: string;
  genre?: string;
  nsfwRating: string;
  status?: string;
}

interface SeriesFormProps {
  mode: 'create' | 'edit';
  initialValues?: SeriesFormValues;
  seriesId?: string;
  coverUrl?: string | null;
  onSubmit: (values: SeriesFormValues) => Promise<void>;
  isSubmitting: boolean;
  error?: string;
}

const NSFW_OPTIONS = [
  { value: 'safe', label: 'Safe' },
  { value: 'suggestive', label: 'Suggestive' },
  { value: 'explicit', label: 'Explicit' },
] as const;

const STATUS_OPTIONS = [
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'hiatus', label: 'Hiatus' },
] as const;

export function SeriesForm({
  mode,
  initialValues,
  seriesId,
  coverUrl: initialCoverUrl,
  onSubmit,
  isSubmitting,
  error,
}: SeriesFormProps) {
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [genre, setGenre] = useState(initialValues?.genre ?? '');
  const [nsfwRating, setNsfwRating] = useState(initialValues?.nsfwRating ?? 'safe');
  const [status, setStatus] = useState(initialValues?.status ?? 'ongoing');

  const [coverPreview, setCoverPreview] = useState<string | null>(initialCoverUrl ?? null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCoverUpload = useCallback(async (file: File) => {
    if (!seriesId) {
      setCoverError('Save the series first, then add a cover image');
      return;
    }

    const contentType = file.type;
    if (contentType !== 'image/jpeg' && contentType !== 'image/png') {
      setCoverError('Only JPEG and PNG images are supported');
      return;
    }

    setCoverUploading(true);
    setCoverError(null);

    try {
      const { presignedUrl } = await getSeriesCoverUploadUrl(seriesId, contentType);

      await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': contentType },
      });

      const { coverUrl } = await completeSeriesCoverUpload(seriesId, contentType);
      setCoverPreview(coverUrl);
    } catch (err) {
      setCoverError(err instanceof Error ? err.message : 'Cover upload failed');
    } finally {
      setCoverUploading(false);
    }
  }, [seriesId]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleCoverUpload(file);
  }, [handleCoverUpload]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      genre: genre.trim() || undefined,
      nsfwRating,
      status,
    });
  }, [title, description, genre, nsfwRating, status, onSubmit]);

  const isValid = title.trim().length >= 2;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link to="/creator/series">
            <button type="button" className="p-2 rounded-lg hover:bg-white/5 transition-colors text-muted-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <h1 className="text-lg font-semibold">
            {mode === 'create' ? 'Create Series' : 'Edit Series'}
          </h1>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-[13px] font-medium mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Anime Series"
              maxLength={100}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[14px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-[11px] text-muted-foreground mt-1">{title.length}/100 characters</p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-[13px] font-medium mb-1.5">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's your series about?"
              maxLength={2000}
              rows={4}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[14px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
            <p className="text-[11px] text-muted-foreground mt-1">{description.length}/2000 characters</p>
          </div>

          {/* Genre */}
          <div>
            <label htmlFor="genre" className="block text-[13px] font-medium mb-1.5">
              Genre
            </label>
            <input
              id="genre"
              type="text"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              placeholder="Action, Romance, Sci-Fi..."
              maxLength={50}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[14px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* NSFW Rating */}
          <div>
            <label htmlFor="nsfwRating" className="block text-[13px] font-medium mb-1.5">
              NSFW Rating
            </label>
            <select
              id="nsfwRating"
              value={nsfwRating}
              onChange={(e) => setNsfwRating(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[14px] focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {NSFW_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Status (only in edit mode) */}
          {mode === 'edit' && (
            <div>
              <label htmlFor="status" className="block text-[13px] font-medium mb-1.5">
                Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[14px] focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Cover Image (only in edit mode — needs seriesId for upload) */}
          {mode === 'edit' && seriesId && (
            <div>
              <label className="block text-[13px] font-medium mb-1.5">Cover Image</label>
              <div className="flex items-start gap-4">
                {/* Preview */}
                <div className="w-32 aspect-video rounded-lg overflow-hidden bg-muted border border-border shrink-0">
                  {coverPreview ? (
                    <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-muted-foreground/30" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={coverUploading}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-[13px] font-medium hover:bg-white/5 transition-colors disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    {coverUploading ? 'Uploading...' : 'Upload Cover'}
                  </button>
                  <p className="text-[11px] text-muted-foreground">JPEG or PNG, recommended 16:9</p>
                  {coverError && <p className="text-[11px] text-red-400">{coverError}</p>}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {mode === 'create' && (
            <p className="text-[12px] text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              You can add a cover image after creating the series.
            </p>
          )}

          {/* Error */}
          {error && (
            <p className="text-[13px] text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Link to="/creator/series">
              <button type="button" className="px-4 py-2 rounded-lg border border-border text-[13px] font-medium hover:bg-white/5 transition-colors">
                Cancel
              </button>
            </Link>
            <button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting
                ? (mode === 'create' ? 'Creating...' : 'Saving...')
                : (mode === 'create' ? 'Create Series' : 'Save Changes')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
