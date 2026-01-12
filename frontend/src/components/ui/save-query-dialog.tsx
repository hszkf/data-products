import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Save, Database } from "lucide-react";
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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 animate-in fade-in-0 duration-150" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
            "w-full max-w-md p-5 rounded-xl",
            "bg-surface-container border border-outline-variant",
            "shadow-elevation-3",
            "animate-in fade-in-0 zoom-in-95 duration-150",
            "focus:outline-none"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center",
                colorScheme === "redshift" && "bg-redshift/10 text-redshift",
                colorScheme === "sqlserver" && "bg-sqlserver/10 text-sqlserver",
                colorScheme === "merge" && "bg-purple-500/10 text-purple-400"
              )}>
                <Save className="w-4.5 h-4.5" />
              </div>
              <div>
                <Dialog.Title className="text-sm font-semibold text-on-surface">
                  Save Query
                </Dialog.Title>
                <span className={cn(
                  "text-[11px] font-medium",
                  colorScheme === "redshift" && "text-redshift",
                  colorScheme === "sqlserver" && "text-sqlserver",
                  colorScheme === "merge" && "text-purple-400"
                )}>
                  {queryType === "redshift" ? "Redshift" : queryType === "sqlserver" ? "SQL Server" : "Merge"}
                </span>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* Query Name */}
            <div>
              <label htmlFor="query-name" className="block text-xs font-medium text-on-surface-variant mb-1.5">
                Query Name <span className="text-red-400">*</span>
              </label>
              <input
                id="query-name"
                type="text"
                value={queryName}
                onChange={(e) => setQueryName(e.target.value)}
                placeholder="Enter query name"
                className={cn(
                  "w-full px-3 py-2.5 rounded-lg text-sm",
                  "bg-surface text-on-surface placeholder:text-outline",
                  "border border-outline-variant",
                  "focus:outline-none focus:ring-2",
                  colorScheme === "redshift" && "focus:ring-redshift/30 focus:border-redshift/50",
                  colorScheme === "sqlserver" && "focus:ring-sqlserver/30 focus:border-sqlserver/50",
                  colorScheme === "merge" && "focus:ring-purple-500/30 focus:border-purple-500/50"
                )}
              />
            </div>

            {/* Author */}
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                Author
              </label>
              <div className="flex flex-wrap gap-1.5">
                {AUTHORS.map((authorName) => (
                  <button
                    key={authorName}
                    type="button"
                    onClick={() => setAuthor(authorName)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      author === authorName
                        ? cn(
                            colorScheme === "redshift" && "bg-redshift/15 text-redshift border border-redshift/30",
                            colorScheme === "sqlserver" && "bg-sqlserver/15 text-sqlserver border border-sqlserver/30",
                            colorScheme === "merge" && "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                          )
                        : "bg-surface-container-high text-on-surface-variant hover:text-on-surface border border-transparent"
                    )}
                  >
                    {authorName}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="query-desc" className="block text-xs font-medium text-on-surface-variant mb-1.5">
                Description <span className="text-on-surface-variant/50">(optional)</span>
              </label>
              <textarea
                id="query-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this query do?"
                rows={2}
                className={cn(
                  "w-full px-3 py-2.5 rounded-lg text-sm resize-none",
                  "bg-surface text-on-surface placeholder:text-outline",
                  "border border-outline-variant",
                  "focus:outline-none focus:ring-2",
                  colorScheme === "redshift" && "focus:ring-redshift/30 focus:border-redshift/50",
                  colorScheme === "sqlserver" && "focus:ring-sqlserver/30 focus:border-sqlserver/50",
                  colorScheme === "merge" && "focus:ring-purple-500/30 focus:border-purple-500/50"
                )}
              />
            </div>

            {/* Query Preview */}
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                Preview
              </label>
              <div className="rounded-lg bg-surface-container-high border border-outline-variant p-3 max-h-32 overflow-auto">
                <pre className="text-xs font-mono text-on-surface-variant whitespace-pre-wrap break-words">
                  {queryText.length > 600 ? `${queryText.slice(0, 600)}...` : queryText}
                </pre>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-outline-variant">
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
