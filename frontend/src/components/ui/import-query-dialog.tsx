import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, FileCode, Clock, Trash2, Search, Database, FolderOpen, Code2, User } from "lucide-react";
import { cn } from "~/lib/utils";
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

const dbConfig = {
  redshift: {
    name: "Redshift",
    color: "#ff9900",
    gradient: "from-[#ff9900] to-[#ff6600]",
    glow: "shadow-[0_0_40px_rgba(255,153,0,0.25)]",
    bgGlow: "bg-[radial-gradient(ellipse_at_top,rgba(255,153,0,0.12),transparent_60%)]",
    cardHover: "hover:border-[#ff9900]/30 hover:shadow-[0_0_30px_rgba(255,153,0,0.15)]",
  },
  sqlserver: {
    name: "SQL Server",
    color: "#0078d4",
    gradient: "from-[#0078d4] to-[#005a9e]",
    glow: "shadow-[0_0_40px_rgba(0,120,212,0.25)]",
    bgGlow: "bg-[radial-gradient(ellipse_at_top,rgba(0,120,212,0.12),transparent_60%)]",
    cardHover: "hover:border-[#0078d4]/30 hover:shadow-[0_0_30px_rgba(0,120,212,0.15)]",
  },
  merge: {
    name: "Merge",
    color: "#a855f7",
    gradient: "from-[#ff9900] via-[#a855f7] to-[#0078d4]",
    glow: "shadow-[0_0_40px_rgba(168,85,247,0.25)]",
    bgGlow: "bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.12),transparent_60%)]",
    cardHover: "hover:border-[#a855f7]/30 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]",
  },
};

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
  const [hoveredQuery, setHoveredQuery] = React.useState<string | null>(null);
  const config = dbConfig[colorScheme];

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
      setHoveredQuery(null);
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
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    }
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
        q.description?.toLowerCase().includes(search) ||
        q.query_text.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [savedQueries, searchTerm, queryType, authorFilter]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-in fade-in-0 duration-200" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
            "w-full max-w-2xl max-h-[85vh]",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-300",
            "focus:outline-none"
          )}
        >
          {/* Main Card */}
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl flex flex-col",
              "bg-[#0d0d12] border border-white/[0.08]",
              config.glow,
              "transition-shadow duration-500"
            )}
            style={{ maxHeight: '85vh' }}
          >
            {/* Ambient glow background */}
            <div className={cn("absolute inset-0 pointer-events-none", config.bgGlow)} />

            {/* Dot pattern overlay */}
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.02]"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 1px)`,
                backgroundSize: '20px 20px',
              }}
            />

            {/* Header */}
            <div className="relative px-6 pt-6 pb-4 flex-shrink-0">
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
                    <FolderOpen className="w-5 h-5" style={{ color: config.color }} />
                  </div>
                  <div>
                    <Dialog.Title className="text-[15px] font-semibold text-white tracking-tight">
                      Import Query
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

            {/* Search & Filters */}
            <div className="relative px-6 pb-4 flex-shrink-0 space-y-3">
              {/* Search Input */}
              <div className="relative group">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 transition-colors group-focus-within:text-white/50"
                />
                <input
                  type="text"
                  placeholder="Search queries by name, description, or content..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(
                    "w-full pl-11 pr-4 py-3 rounded-xl text-sm",
                    "bg-white/[0.03] text-white placeholder:text-white/25",
                    "border border-white/[0.06]",
                    "focus:outline-none focus:border-transparent",
                    "transition-all duration-300"
                  )}
                  style={{
                    boxShadow: searchTerm
                      ? `0 0 0 2px ${config.color}30, 0 0 20px ${config.color}15`
                      : undefined
                  }}
                />
              </div>

              {/* Author Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                <User className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                {AUTHORS.map((author) => (
                  <button
                    key={author}
                    onClick={() => setAuthorFilter(author)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap",
                      "transition-all duration-200",
                      "border",
                      authorFilter === author
                        ? "text-white border-transparent"
                        : "text-white/40 border-white/[0.04] hover:border-white/[0.08] hover:text-white/60"
                    )}
                    style={authorFilter === author ? {
                      backgroundColor: `${config.color}20`,
                      borderColor: `${config.color}40`,
                    } : undefined}
                  >
                    {author}
                  </button>
                ))}
              </div>
            </div>

            {/* Query List */}
            <div className="relative flex-1 overflow-auto px-6 min-h-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div
                    className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: `${config.color}40`, borderTopColor: 'transparent' }}
                  />
                  <p className="mt-4 text-sm text-white/40">Loading queries...</p>
                </div>
              ) : filteredQueries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className={cn(
                    "w-16 h-16 rounded-2xl flex items-center justify-center mb-4",
                    "bg-white/[0.03] border border-white/[0.06]"
                  )}>
                    <Code2 className="w-8 h-8 text-white/20" />
                  </div>
                  <p className="text-sm text-white/50 text-center">
                    {searchTerm || authorFilter !== "All"
                      ? "No queries match your filters"
                      : "No saved queries yet"}
                  </p>
                  <p className="text-xs text-white/30 mt-1">
                    {!searchTerm && authorFilter === "All" && "Save your first query to see it here"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 pb-4">
                  {filteredQueries.map((query, index) => (
                    <div
                      key={query.id}
                      onClick={() => handleQueryClick(query)}
                      onMouseEnter={() => setHoveredQuery(query.id)}
                      onMouseLeave={() => setHoveredQuery(null)}
                      className={cn(
                        "group relative p-4 rounded-xl cursor-pointer",
                        "bg-white/[0.02] border border-white/[0.04]",
                        "transition-all duration-300",
                        config.cardHover
                      )}
                      style={{
                        animationDelay: `${index * 50}ms`,
                        animation: 'fadeIn 0.3s ease-out forwards',
                        opacity: 0,
                      }}
                    >
                      {/* Hover glow effect */}
                      {hoveredQuery === query.id && (
                        <div
                          className="absolute inset-0 rounded-xl pointer-events-none opacity-30"
                          style={{
                            background: `radial-gradient(ellipse at center, ${config.color}10 0%, transparent 70%)`
                          }}
                        />
                      )}

                      <div className="relative flex items-start gap-3">
                        {/* Icon */}
                        <div
                          className={cn(
                            "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                            "bg-white/[0.04] border border-white/[0.04]",
                            "transition-all duration-300",
                            "group-hover:scale-110"
                          )}
                          style={{
                            borderColor: hoveredQuery === query.id ? `${config.color}30` : undefined,
                            backgroundColor: hoveredQuery === query.id ? `${config.color}10` : undefined,
                          }}
                        >
                          <FileCode className="w-4 h-4" style={{ color: config.color }} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-semibold text-white truncate group-hover:text-white">
                              {query.query_name}
                            </h3>
                          </div>

                          {query.description && (
                            <p className="text-xs text-white/40 mb-2 line-clamp-1">
                              {query.description}
                            </p>
                          )}

                          <div className="flex items-center gap-3 text-[11px] text-white/30">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(query.updated_at)}
                            </span>
                            {query.author && (
                              <>
                                <span className="text-white/10">•</span>
                                <span>{query.author}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Delete Button */}
                        <button
                          onClick={(e) => handleDeleteQuery(e, query.id)}
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            "opacity-0 group-hover:opacity-100",
                            "text-white/30 hover:text-red-400 hover:bg-red-500/10",
                            "transition-all duration-200",
                            "flex-shrink-0"
                          )}
                          title="Delete query"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Query Preview */}
                      <div className={cn(
                        "mt-3 relative rounded-lg overflow-hidden",
                        "bg-[#08080c] border border-white/[0.03]"
                      )}>
                        {/* Mini line numbers aesthetic */}
                        <div className="absolute left-0 top-0 bottom-0 w-6 bg-white/[0.02] border-r border-white/[0.03]" />

                        <pre className={cn(
                          "p-2.5 pl-8 text-[10px] font-mono leading-relaxed",
                          "text-white/40 overflow-hidden",
                          "line-clamp-2"
                        )}>
                          <code>{query.query_text}</code>
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="relative px-6 py-4 border-t border-white/[0.04] bg-white/[0.01] flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-white/30 font-mono">
                    {filteredQueries.length} {filteredQueries.length === 1 ? "query" : "queries"}
                  </span>
                  {(searchTerm || authorFilter !== "All") && (
                    <button
                      onClick={() => {
                        setSearchTerm("");
                        setAuthorFilter("All");
                      }}
                      className="text-[11px] text-white/40 hover:text-white/60 transition-colors"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
                <Dialog.Close asChild>
                  <button
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium",
                      "text-white/50 hover:text-white",
                      "border border-white/[0.06] hover:border-white/[0.12]",
                      "transition-all duration-200"
                    )}
                  >
                    Close
                  </button>
                </Dialog.Close>
              </div>
            </div>
          </div>

          {/* CSS for animations */}
          <style>{`
            @keyframes fadeIn {
              from {
                opacity: 0;
                transform: translateY(8px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            .scrollbar-hide::-webkit-scrollbar {
              display: none;
            }
            .scrollbar-hide {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
          `}</style>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
