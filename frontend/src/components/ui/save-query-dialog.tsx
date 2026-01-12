

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Save } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "./button";
import { saveLocalQuery, queryNameExists } from "~/lib/saved-queries";
import { useToast } from "./toast-provider";

interface SaveQueryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queryText: string;
  queryType: "redshift" | "sqlserver" | "merge";
  colorScheme?: "redshift" | "sqlserver" | "merge";
}

const AUTHORS = ["Hasif", "Nazierul", "Asyraff", "Izhar"] as const;

export function SaveQueryDialog({
  open,
  onOpenChange,
  queryText,
  queryType,
  colorScheme = "redshift",
}: SaveQueryDialogProps) {
  const { showToast } = useToast();
  const [queryName, setQueryName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [author, setAuthor] = React.useState<string>(AUTHORS[0]);
  const [isSaving, setIsSaving] = React.useState(false);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setQueryName("");
      setDescription("");
      setAuthor(AUTHORS[0]);
    }
  }, [open]);

  const handleSave = () => {
    if (!queryName.trim()) {
      showToast("Please enter a query name", "error");
      return;
    }

    if (!queryText.trim()) {
      showToast("Cannot save an empty query", "error");
      return;
    }

    // Check for duplicate names
    if (queryNameExists(queryName.trim(), queryType)) {
      showToast("A query with this name already exists", "error");
      return;
    }

    setIsSaving(true);

    try {
      saveLocalQuery({
        query_name: queryName.trim(),
        query_text: queryText,
        query_type: queryType,
        author: author,
        description: description.trim() || undefined,
      });

      showToast("Query saved to browser storage", "success");
      onOpenChange(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save query";
      showToast(errorMessage, "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 animate-in fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
            "w-full max-w-md p-6 rounded-xl",
            "bg-surface-container shadow-elevation-3",
            "border border-outline-variant",
            "animate-in fade-in-0 zoom-in-95"
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold text-on-surface">
              Save Query
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className={cn(
                  "p-1.5 rounded-full",
                  "text-on-surface-variant hover:text-on-surface",
                  "hover:bg-surface-container-high transition-colors"
                )}
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            {/* Query Type Badge */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-on-surface-variant">Type:</span>
              <span
                className={cn(
                  "px-2 py-0.5 text-xs font-medium rounded-full",
                  queryType === "redshift" && "bg-redshift/20 text-redshift",
                  queryType === "sqlserver" && "bg-sqlserver/20 text-sqlserver",
                  queryType === "merge" && "bg-gradient-to-r from-redshift/20 to-sqlserver/20 text-on-surface"
                )}
              >
                {queryType === "redshift" ? "Redshift" : queryType === "sqlserver" ? "SQL Server" : "Merge"}
              </span>
            </div>

            {/* Query Name */}
            <div>
              <label
                htmlFor="query-name"
                className="block text-sm font-medium text-on-surface-variant mb-1.5"
              >
                Query Name <span className="text-red-400">*</span>
              </label>
              <input
                id="query-name"
                type="text"
                value={queryName}
                onChange={(e) => setQueryName(e.target.value)}
                placeholder="Enter a name for this query"
                className={cn(
                  "w-full px-3 py-2 rounded-lg text-sm",
                  "bg-surface text-on-surface",
                  "border border-outline-variant",
                  "focus:outline-none focus:ring-2",
                  colorScheme === "redshift" && "focus:ring-redshift/50 focus:border-redshift",
                  colorScheme === "sqlserver" && "focus:ring-sqlserver/50 focus:border-sqlserver",
                  colorScheme === "merge" && "focus:ring-gradient-to-r focus:ring-from-redshift/30 focus:ring-to-sqlserver/30 focus:border-redshift/50",
                  "placeholder:text-outline"
                )}
              />
            </div>

            {/* Author */}
            <div>
              <label
                htmlFor="query-author"
                className="block text-sm font-medium text-on-surface-variant mb-1.5"
              >
                Author <span className="text-red-400">*</span>
              </label>
              <select
                id="query-author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className={cn(
                  "w-full px-3 py-2 rounded-lg text-sm",
                  "bg-surface text-on-surface",
                  "border border-outline-variant",
                  "focus:outline-none focus:ring-2",
                  colorScheme === "redshift" && "focus:ring-redshift/50 focus:border-redshift",
                  colorScheme === "sqlserver" && "focus:ring-sqlserver/50 focus:border-sqlserver",
                  colorScheme === "merge" && "focus:ring-gradient-to-r focus:ring-from-redshift/30 focus:ring-to-sqlserver/30 focus:border-redshift/50",
                  "cursor-pointer"
                )}
              >
                {AUTHORS.map((authorName) => (
                  <option key={authorName} value={authorName}>
                    {authorName}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="query-description"
                className="block text-sm font-medium text-on-surface-variant mb-1.5"
              >
                Description <span className="text-on-surface-variant/50">(optional)</span>
              </label>
              <textarea
                id="query-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description for this query"
                rows={3}
                className={cn(
                  "w-full px-3 py-2 rounded-lg text-sm resize-none",
                  "bg-surface text-on-surface",
                  "border border-outline-variant",
                  "focus:outline-none focus:ring-2",
                  colorScheme === "redshift" && "focus:ring-redshift/50 focus:border-redshift",
                  colorScheme === "sqlserver" && "focus:ring-sqlserver/50 focus:border-sqlserver",
                  colorScheme === "merge" && "focus:ring-gradient-to-r focus:ring-from-redshift/30 focus:ring-to-sqlserver/30 focus:border-redshift/50",
                  "placeholder:text-outline"
                )}
              />
            </div>

            {/* Query Preview */}
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1.5">
                Query Preview
              </label>
              <div
                className={cn(
                  "w-full px-3 py-2 rounded-lg text-xs font-mono",
                  "bg-surface-container-high text-on-surface-variant",
                  "border border-outline-variant",
                  "max-h-24 overflow-auto"
                )}
              >
                <pre className="whitespace-pre-wrap break-words">
                  {queryText.length > 500 ? `${queryText.slice(0, 500)}...` : queryText}
                </pre>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 mt-6">
            <Dialog.Close asChild>
              <Button variant="default" size="sm">
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              variant="run"
              size="sm"
              colorScheme={colorScheme}
              onClick={handleSave}
              disabled={isSaving || !queryName.trim()}
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save Query"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
