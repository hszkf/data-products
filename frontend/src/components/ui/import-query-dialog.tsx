import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, FileCode, Clock, Trash2, Search, FolderOpen } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "./button";
import { getFilteredQueries, deleteLocalQuery, LocalSavedQuery } from "~/lib/saved-queries";
import { useToast } from "./toast-provider";

interface ImportQueryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuerySelect: (query: LocalSavedQuery) => void;
  queryType: "redshift" | "sqlserver" | "merge";
  colorScheme?: "redshift" | "sqlserver" | "merge";
}

const AUTHORS = ["All", "Hasif", "Nazierul", "Asyraff", "Izhar"] as const;

export function ImportQueryDialog({
  open,
  onOpenChange,
  onQuerySelect,
  queryType,
  colorScheme = "redshift",
}: ImportQueryDialogProps) {
  const { showToast } = useToast();
  const [savedQueries, setSavedQueries] = React.useState<LocalSavedQuery[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [authorFilter, setAuthorFilter] = React.useState<string>("All");

  const loadSavedQueries = React.useCallback(() => {
    setIsLoading(true);
    try {
      const queries = getFilteredQueries();
      setSavedQueries(queries);
    } catch (error) {
      showToast("Failed to load saved queries", "error");
      setSavedQueries([]);
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  React.useEffect(() => {
    if (open) {
      loadSavedQueries();
      setSearchTerm("");
      setAuthorFilter("All");
    }
  }, [open, loadSavedQueries]);

  const handleQueryClick = (query: LocalSavedQuery) => {
    onQuerySelect(query);
    onOpenChange(false);
  };

  const handleDeleteQuery = (e: React.MouseEvent, queryId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this query?")) return;

    try {
      deleteLocalQuery(queryId);
      showToast("Query deleted", "success");
      loadSavedQueries();
    } catch (error) {
      showToast("Failed to delete query", "error");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredQueries = React.useMemo(() => {
    let filtered = savedQueries.filter((q) => q.query_type === queryType);

    if (authorFilter !== "All") {
      filtered = filtered.filter((q) => q.author === authorFilter);
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((q) =>
        q.query_name.toLowerCase().includes(search) ||
        q.description?.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [savedQueries, searchTerm, queryType, authorFilter]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 animate-in fade-in-0 duration-150" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
            "w-full max-w-xl max-h-[80vh] rounded-xl",
            "bg-surface-container border border-outline-variant",
            "shadow-elevation-3",
            "animate-in fade-in-0 zoom-in-95 duration-150",
            "flex flex-col",
            "focus:outline-none"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 pb-4 border-b border-outline-variant">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center",
                colorScheme === "redshift" && "bg-redshift/10 text-redshift",
                colorScheme === "sqlserver" && "bg-sqlserver/10 text-sqlserver",
                colorScheme === "merge" && "bg-purple-500/10 text-purple-400"
              )}>
                <FolderOpen className="w-4.5 h-4.5" />
              </div>
              <div>
                <Dialog.Title className="text-sm font-semibold text-on-surface">
                  Import Query
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

          {/* Search & Filters */}
          <div className="px-5 py-3 space-y-3 border-b border-outline-variant">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
              <input
                type="text"
                placeholder="Search queries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  "w-full pl-9 pr-3 py-2 rounded-lg text-sm",
                  "bg-surface text-on-surface placeholder:text-outline",
                  "border border-outline-variant",
                  "focus:outline-none focus:ring-2",
                  colorScheme === "redshift" && "focus:ring-redshift/30 focus:border-redshift/50",
                  colorScheme === "sqlserver" && "focus:ring-sqlserver/30 focus:border-sqlserver/50",
                  colorScheme === "merge" && "focus:ring-purple-500/30 focus:border-purple-500/50"
                )}
              />
            </div>

            {/* Author Filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {AUTHORS.map((author) => (
                <button
                  key={author}
                  onClick={() => setAuthorFilter(author)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                    authorFilter === author
                      ? cn(
                          colorScheme === "redshift" && "bg-redshift/15 text-redshift",
                          colorScheme === "sqlserver" && "bg-sqlserver/15 text-sqlserver",
                          colorScheme === "merge" && "bg-purple-500/15 text-purple-400"
                        )
                      : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                  )}
                >
                  {author}
                </button>
              ))}
            </div>
          </div>

          {/* Query List */}
          <div className="flex-1 overflow-auto p-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center text-on-surface-variant">
                  <div className={cn(
                    "inline-block animate-spin rounded-full h-6 w-6 border-2 border-current border-t-transparent mb-3",
                    colorScheme === "redshift" && "text-redshift",
                    colorScheme === "sqlserver" && "text-sqlserver"
                  )} />
                  <p className="text-xs">Loading...</p>
                </div>
              </div>
            ) : filteredQueries.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center text-on-surface-variant">
                  <FileCode className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">
                    {searchTerm || authorFilter !== "All"
                      ? "No queries match your search"
                      : "No saved queries yet"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredQueries.map((query) => (
                  <div
                    key={query.id}
                    onClick={() => handleQueryClick(query)}
                    className={cn(
                      "group p-3 rounded-lg cursor-pointer",
                      "bg-surface hover:bg-surface-container-high",
                      "border border-outline-variant/50 hover:border-outline-variant",
                      "transition-colors"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <FileCode className={cn(
                            "w-4 h-4 flex-shrink-0",
                            colorScheme === "redshift" && "text-redshift",
                            colorScheme === "sqlserver" && "text-sqlserver",
                            colorScheme === "merge" && "text-purple-400"
                          )} />
                          <h3 className="text-sm font-medium text-on-surface truncate">
                            {query.query_name}
                          </h3>
                        </div>

                        {query.description && (
                          <p className="text-xs text-on-surface-variant mb-1.5 line-clamp-1 ml-6">
                            {query.description}
                          </p>
                        )}

                        <div className="flex items-center gap-2 text-[11px] text-on-surface-variant/70 ml-6">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(query.updated_at)}
                          </span>
                          {query.author && (
                            <>
                              <span>·</span>
                              <span>{query.author}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDeleteQuery(e, query.id)}
                        className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Query Preview */}
                    <div className="mt-2 ml-6 p-2 rounded bg-surface-container-high border border-outline-variant/30">
                      <pre className="text-[10px] font-mono text-on-surface-variant/70 overflow-hidden whitespace-pre-wrap break-words line-clamp-2">
                        {query.query_text}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-outline-variant">
            <span className="text-xs text-on-surface-variant">
              {filteredQueries.length} {filteredQueries.length === 1 ? "query" : "queries"}
            </span>
            <Dialog.Close asChild>
              <Button variant="default" size="sm">
                Close
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
