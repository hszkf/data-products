import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Save, Database, Terminal, Sparkles } from "lucide-react";
import { cn } from "~/lib/utils";
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

const dbConfig = {
  redshift: {
    name: "Redshift",
    color: "#ff9900",
    gradient: "from-[#ff9900] to-[#ff6600]",
    glow: "shadow-[0_0_30px_rgba(255,153,0,0.3)]",
    bgGlow: "bg-[radial-gradient(ellipse_at_top,rgba(255,153,0,0.15),transparent_70%)]",
  },
  sqlserver: {
    name: "SQL Server",
    color: "#0078d4",
    gradient: "from-[#0078d4] to-[#005a9e]",
    glow: "shadow-[0_0_30px_rgba(0,120,212,0.3)]",
    bgGlow: "bg-[radial-gradient(ellipse_at_top,rgba(0,120,212,0.15),transparent_70%)]",
  },
  merge: {
    name: "Merge",
    color: "#a855f7",
    gradient: "from-[#ff9900] via-[#a855f7] to-[#0078d4]",
    glow: "shadow-[0_0_30px_rgba(168,85,247,0.3)]",
    bgGlow: "bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.15),transparent_70%)]",
  },
};

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
  const [focusedField, setFocusedField] = React.useState<string | null>(null);
  const config = dbConfig[colorScheme];

  React.useEffect(() => {
    if (open) {
      setQueryName("");
      setDescription("");
      setAuthor(AUTHORS[0]);
      setFocusedField(null);
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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-in fade-in-0 duration-200" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
            "w-full max-w-lg",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-300",
            "focus:outline-none"
          )}
        >
          {/* Main Card */}
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl",
              "bg-[#0d0d12] border border-white/[0.08]",
              config.glow,
              "transition-shadow duration-500"
            )}
          >
            {/* Ambient glow background */}
            <div className={cn("absolute inset-0 pointer-events-none", config.bgGlow)} />

            {/* Dot pattern overlay */}
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.03]"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 1px)`,
                backgroundSize: '16px 16px',
              }}
            />

            {/* Header */}
            <div className="relative px-6 pt-6 pb-4">
              {/* Accent line */}
              <div className={cn(
                "absolute top-0 left-6 right-6 h-[2px] rounded-full",
                `bg-gradient-to-r ${config.gradient}`,
                "opacity-80"
              )} />

              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    "bg-gradient-to-br from-white/[0.08] to-white/[0.02]",
                    "border border-white/[0.06]",
                    "backdrop-blur-sm"
                  )}>
                    <Save className="w-5 h-5" style={{ color: config.color }} />
                  </div>
                  <div>
                    <Dialog.Title className="text-[15px] font-semibold text-white tracking-tight">
                      Save Query
                    </Dialog.Title>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider"
                        style={{
                          backgroundColor: `${config.color}20`,
                          color: config.color
                        }}
                      >
                        <Database className="w-3 h-3" />
                        {config.name}
                      </span>
                    </div>
                  </div>
                </div>

                <Dialog.Close asChild>
                  <button
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      "text-white/40 hover:text-white hover:bg-white/[0.06]",
                      "transition-all duration-200",
                      "focus:outline-none focus:ring-2 focus:ring-white/20"
                    )}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </Dialog.Close>
              </div>
            </div>

            {/* Form */}
            <div className="relative px-6 pb-2 space-y-4">
              {/* Query Name */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-white/50 uppercase tracking-wider">
                  <Terminal className="w-3.5 h-3.5" />
                  Query Name
                  <span className="text-red-400">*</span>
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    value={queryName}
                    onChange={(e) => setQueryName(e.target.value)}
                    onFocus={() => setFocusedField("name")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="my_awesome_query"
                    className={cn(
                      "w-full px-4 py-3 rounded-xl text-sm font-mono",
                      "bg-white/[0.03] text-white placeholder:text-white/20",
                      "border border-white/[0.06]",
                      "focus:outline-none focus:border-transparent",
                      "transition-all duration-300"
                    )}
                    style={{
                      boxShadow: focusedField === "name"
                        ? `0 0 0 2px ${config.color}40, 0 0 20px ${config.color}20`
                        : undefined
                    }}
                  />
                  {focusedField === "name" && (
                    <div
                      className="absolute inset-0 rounded-xl pointer-events-none opacity-20"
                      style={{
                        background: `linear-gradient(135deg, ${config.color}10 0%, transparent 50%)`
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Author Select */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-white/50 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  Author
                </label>
                <div className="flex flex-wrap gap-2">
                  {AUTHORS.map((authorName) => (
                    <button
                      key={authorName}
                      type="button"
                      onClick={() => setAuthor(authorName)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium",
                        "transition-all duration-200",
                        "border",
                        author === authorName
                          ? "text-white border-transparent"
                          : "text-white/50 border-white/[0.06] hover:border-white/[0.12] hover:text-white/70"
                      )}
                      style={author === authorName ? {
                        backgroundColor: `${config.color}25`,
                        boxShadow: `0 0 20px ${config.color}20`,
                        borderColor: `${config.color}50`,
                      } : undefined}
                    >
                      {authorName}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-white/50 uppercase tracking-wider">
                  Description
                  <span className="text-white/30 normal-case tracking-normal">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onFocus={() => setFocusedField("desc")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="What does this query do?"
                  rows={2}
                  className={cn(
                    "w-full px-4 py-3 rounded-xl text-sm resize-none",
                    "bg-white/[0.03] text-white placeholder:text-white/20",
                    "border border-white/[0.06]",
                    "focus:outline-none focus:border-transparent",
                    "transition-all duration-300"
                  )}
                  style={{
                    boxShadow: focusedField === "desc"
                      ? `0 0 0 2px ${config.color}40, 0 0 20px ${config.color}20`
                      : undefined
                  }}
                />
              </div>

              {/* Query Preview */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-white/50 uppercase tracking-wider">
                  Preview
                </label>
                <div className={cn(
                  "relative rounded-xl overflow-hidden",
                  "bg-[#0a0a0f] border border-white/[0.04]"
                )}>
                  {/* Line numbers gutter aesthetic */}
                  <div className="absolute left-0 top-0 bottom-0 w-8 bg-white/[0.02] border-r border-white/[0.04]" />

                  <pre className={cn(
                    "p-3 pl-10 text-[11px] font-mono leading-relaxed",
                    "text-white/60 max-h-20 overflow-auto"
                  )}>
                    <code>{queryText.length > 300 ? `${queryText.slice(0, 300)}...` : queryText}</code>
                  </pre>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="relative px-6 py-4 mt-2 border-t border-white/[0.04] bg-white/[0.01]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white/30 font-mono">
                  {queryText.length} chars
                </span>
                <div className="flex items-center gap-2">
                  <Dialog.Close asChild>
                    <button
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium",
                        "text-white/50 hover:text-white",
                        "border border-white/[0.06] hover:border-white/[0.12]",
                        "transition-all duration-200"
                      )}
                    >
                      Cancel
                    </button>
                  </Dialog.Close>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || !queryName.trim()}
                    className={cn(
                      "px-5 py-2 rounded-lg text-sm font-semibold",
                      "text-white flex items-center gap-2",
                      "transition-all duration-300",
                      "disabled:opacity-40 disabled:cursor-not-allowed",
                      "hover:scale-[1.02] active:scale-[0.98]"
                    )}
                    style={{
                      background: `linear-gradient(135deg, ${config.color} 0%, ${config.color}cc 100%)`,
                      boxShadow: !isSaving && queryName.trim()
                        ? `0 4px 20px ${config.color}40, 0 0 40px ${config.color}20`
                        : undefined
                    }}
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? "Saving..." : "Save Query"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
