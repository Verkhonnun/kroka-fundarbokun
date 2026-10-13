import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = (props: ToasterProps) => (
  <Sonner
    position="bottom-right"
    toastOptions={{
      classNames: {
        toast: "group toast bg-card text-foreground border-border shadow-lg rounded-lg",
        description: "text-muted-foreground",
        actionButton: "bg-primary text-primary-foreground",
        cancelButton: "bg-muted text-muted-foreground",
      },
    }}
    {...props}
  />
);

export { Toaster, toast };
