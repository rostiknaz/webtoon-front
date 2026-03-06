/**
 * LicenseDrawer Component
 *
 * Animated dialog displaying commercial-use license terms for a downloaded clip.
 */

import {
  AnimatedDialog,
  AnimatedDialogContent,
  AnimatedDialogHeader,
  AnimatedDialogTitle,
  AnimatedDialogDescription,
} from '@/components/ui/animated-dialog';

interface LicenseDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clipTitle: string;
  downloadDate: string;
}

export function LicenseDrawer({ open, onOpenChange, clipTitle, downloadDate }: LicenseDrawerProps) {
  const formattedDate = new Date(downloadDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <AnimatedDialog open={open} onOpenChange={onOpenChange}>
      <AnimatedDialogContent open={open}>
        <AnimatedDialogHeader className="pb-2">
          <AnimatedDialogTitle>Commercial Use License</AnimatedDialogTitle>
          <AnimatedDialogDescription>
            {clipTitle} &middot; Downloaded {formattedDate}
          </AnimatedDialogDescription>
        </AnimatedDialogHeader>

        <div className="space-y-4 text-sm pt-2">
          <p className="text-muted-foreground">
            This download grants you a royalty-free, non-exclusive, worldwide,
            perpetual license to use this clip for commercial and personal purposes.
          </p>

          <div>
            <p className="font-medium mb-1.5">You may:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Use in commercial projects (ads, films, social media, presentations)</li>
              <li>Modify, edit, and remix the clip</li>
              <li>Use across multiple projects</li>
            </ul>
          </div>

          <div>
            <p className="font-medium mb-1.5">You may not:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Resell or redistribute the original clip file</li>
              <li>Claim authorship of the original clip</li>
              <li>Use in illegal or defamatory content</li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground/70 pt-2 border-t border-border/50">
            This license is per-clip and non-transferable.
          </p>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2 cursor-pointer"
          >
            Close
          </button>
        </div>
      </AnimatedDialogContent>
    </AnimatedDialog>
  );
}
