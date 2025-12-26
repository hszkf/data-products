import toast, { Toaster } from "react-hot-toast";

export { toast, Toaster };

export function useToast() {
  return {
    showToast: (message: string, type: "success" | "error" | "info" | "warning" = "info") => {
      switch (type) {
        case "success":
          toast.success(message);
          break;
        case "error":
          toast.error(message);
          break;
        default:
          toast(message);
      }
    },
  };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster position="top-center" />
    </>
  );
}
