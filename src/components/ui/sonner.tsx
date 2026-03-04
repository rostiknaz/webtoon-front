import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-center"
      offset={68} /* 52px nav height + 16px margin */
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success:
            "group-[.toaster]:!bg-emerald-800/95 group-[.toaster]:!text-emerald-50 group-[.toaster]:!border-emerald-700/80 group-[.toaster]:shadow-lg [&_[data-description]]:!text-emerald-100",
          error:
            "group-[.toaster]:!bg-rose-800/95 group-[.toaster]:!text-rose-50 group-[.toaster]:!border-rose-700/80 group-[.toaster]:shadow-lg [&_[data-description]]:!text-rose-100",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
