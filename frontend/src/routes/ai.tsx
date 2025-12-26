import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/ai')({
  component: AIAssistantPage,
});

import React, { useState, useRef, useMemo, useCallback, useSyncExternalStore } from "react";
import { useInterval, useLocalStorage } from "~/lib/hooks";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import * as THREE from "three";
import {
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";
import {
  AnimatedSend as Send,
  AnimatedBrain as Brain,
  AnimatedPaperclip as Paperclip,
  AnimatedX as X,
  AnimatedFileText as FileText,
  AnimatedImage as Image,
  AnimatedFile as File,
  AnimatedBot as Bot,
  AnimatedUser as User,
  AnimatedLoader2 as Loader2,
  AnimatedSparkles as Sparkles,
  AnimatedZap as Zap,
  AnimatedDatabase as Database,
  AnimatedCode2 as Code2,
  AnimatedPlus as Plus,
  AnimatedTrash2 as Trash2,
  AnimatedMessageSquare as MessageSquare,
  AnimatedSquare as Square,
  AnimatedAlertCircle as AlertCircle,
  AnimatedSearch as Search,
  AnimatedClock as Clock,
  AnimatedChevronDown as ChevronDown,
  AnimatedArchive as Archive,
  AnimatedPanelLeftClose as PanelLeftClose,
  AnimatedPanelLeft as PanelLeft,
  AnimatedCopy as Copy,
  AnimatedCheck as Check,
  AnimatedRefreshCw as RefreshCw,
} from "~/components/animated-icons";
import { StudioNav } from "~/components/studio-nav";
import { ThemeProvider } from "~/lib/theme-context";
import { ToastProvider } from "~/components/ui/toast-provider";
import { TooltipProvider } from "~/components/ui/tooltip";
import {
  checkAIHealth,
  sendChatMessageStream,
  getAvailableModels,
  type AIHealthStatus,
  type ChatMessage as APIChatMessage,
} from "~/lib/ai-api";
import {
  createRAGSession,
  uploadDocument,
  listDocuments,
  deleteDocument as deleteRAGDocument,
  queryRAGStream,
  formatFileSize as formatRAGFileSize,
  isFileTypeSupported,
  getSupportedExtensions,
  type RAGDocument,
  type Citation,
} from "~/lib/rag-api";
import {
  useChatStorage,
  groupConversationsByTime,
  formatConversationTime,
  type StoredConversation,
  type StoredMessage,
} from "~/lib/use-chat-storage";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  attachments?: { name: string; type: string; size: number }[];
  citations?: Citation[];
}

interface Attachment {
  name: string;
  type: string;
  size: number;
}

// Convert stored message to Message
function toMessage(stored: StoredMessage): Message {
  return {
    ...stored,
    timestamp: new Date(stored.timestamp),
  };
}

// Convert Message to stored format
function toStoredMessage(msg: Message): StoredMessage {
  return {
    ...msg,
    timestamp: msg.timestamp.toISOString(),
  };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return Image;
  if (type.includes("pdf") || type.includes("document")) return FileText;
  return File;
}

// Three.js Animated Background
function ThreeBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const frameRef = useRef<number>(0);
  const meshesRef = useRef<THREE.Mesh[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    const aspect = window.innerWidth / window.innerHeight;
    const camera = new THREE.OrthographicCamera(
      -aspect * 5, aspect * 5, 5, -5, 0.1, 100
    );
    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const createBlobMaterial = (color: THREE.Color, opacity: number) => {
      return new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: color },
          uOpacity: { value: opacity },
          uTime: { value: 0 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uOpacity;
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            vec2 center = vec2(0.5);
            float dist = distance(vUv, center);
            float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
            alpha = pow(alpha, 1.5);
            float pulse = 0.9 + 0.1 * sin(uTime * 0.3);
            alpha *= uOpacity * pulse;
            gl_FragColor = vec4(uColor, alpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
    };

    const blobConfigs = [
      { color: new THREE.Color(0x8b5cf6), size: 6, position: [-4, 3, 0], speed: 0.15, opacity: 0.25 },
      { color: new THREE.Color(0x06b6d4), size: 5, position: [4, -3, 0], speed: 0.12, opacity: 0.2 },
      { color: new THREE.Color(0xec4899), size: 4, position: [3, 2, 0], speed: 0.18, opacity: 0.15 },
      { color: new THREE.Color(0xfbbf24), size: 3.5, position: [-3, -2, 0], speed: 0.2, opacity: 0.12 },
    ];

    blobConfigs.forEach((config, index) => {
      const geometry = new THREE.PlaneGeometry(config.size, config.size);
      const material = createBlobMaterial(config.color, config.opacity);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(config.position[0], config.position[1], config.position[2]);
      mesh.userData = { originalPos: [...config.position], speed: config.speed, offset: index * 2 };
      scene.add(mesh);
      meshesRef.current.push(mesh);
    });

    const animate = (time: number) => {
      const t = time * 0.001;
      meshesRef.current.forEach((mesh) => {
        const { originalPos, speed, offset } = mesh.userData;
        mesh.position.x = originalPos[0] + Math.sin(t * speed + offset) * 1.5;
        mesh.position.y = originalPos[1] + Math.cos(t * speed * 0.8 + offset) * 1.2;
        if (mesh.material instanceof THREE.ShaderMaterial) {
          mesh.material.uniforms.uTime.value = t + offset;
        }
        const scale = 1 + Math.sin(t * 0.2 + offset) * 0.05;
        mesh.scale.setScalar(scale);
      });
      renderer.render(scene, camera);
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    const handleResize = () => {
      const newAspect = window.innerWidth / window.innerHeight;
      camera.left = -newAspect * 5;
      camera.right = newAspect * 5;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(frameRef.current);
      meshesRef.current.forEach((mesh) => {
        mesh.geometry.dispose();
        if (mesh.material instanceof THREE.Material) mesh.material.dispose();
      });
      meshesRef.current = [];
      renderer.dispose();
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, filter: "blur(80px)" }}
    />
  );
}

function GridPattern() {
  return (
    <div
      className="fixed inset-0 pointer-events-none opacity-[0.02]"
      style={{
        backgroundImage: `
          linear-gradient(rgba(255, 255, 255, 0.5) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.5) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
      }}
    />
  );
}

// Markdown renderer component with dark theme styling
function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Headings
        h1: ({ children }) => (
          <h1 className="text-2xl font-bold text-white mb-3 mt-4 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl font-semibold text-white mb-2.5 mt-3.5 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg font-semibold text-neutral-200 mb-2 mt-3 first:mt-0">{children}</h3>
        ),
        // Paragraphs
        p: ({ children }) => (
          <p className="text-base leading-relaxed text-neutral-300 mb-2.5 last:mb-0">{children}</p>
        ),
        // Lists
        ul: ({ children }) => (
          <ul className="text-base text-neutral-300 mb-2.5 pl-5 space-y-1.5 list-disc marker:text-violet-400">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="text-base text-neutral-300 mb-2.5 pl-5 space-y-1.5 list-decimal marker:text-violet-400">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed">{children}</li>
        ),
        // Code blocks with syntax highlighting
        code: ({ className, children, ...props }) => {
          const match = /language-(\w+)/.exec(className || "");
          const language = match ? match[1] : "";
          const codeString = String(children).replace(/\n$/, "");

          // Check if it's a code block (has language) or inline code
          if (match) {
            return (
              <SyntaxHighlighter
                style={oneDark}
                language={language}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  padding: "12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  lineHeight: "1.5",
                  background: "#0d0d12",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
                codeTagProps={{
                  style: {
                    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace",
                  },
                }}
              >
                {codeString}
              </SyntaxHighlighter>
            );
          }

          // Inline code
          return (
            <code className="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 text-[12px] font-mono">
              {children}
            </code>
          );
        },
        // Code blocks wrapper - simplified since SyntaxHighlighter handles it
        pre: ({ children }) => (
          <div className="my-2">
            {children}
          </div>
        ),
        // Strong/Bold
        strong: ({ children }) => (
          <strong className="font-semibold text-white">{children}</strong>
        ),
        // Emphasis/Italic
        em: ({ children }) => (
          <em className="italic text-neutral-200">{children}</em>
        ),
        // Links
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
          >
            {children}
          </a>
        ),
        // Blockquotes
        blockquote: ({ children }) => (
          <blockquote className="my-2 pl-3 border-l-2 border-violet-500/50 text-neutral-400 italic">
            {children}
          </blockquote>
        ),
        // Horizontal rule
        hr: () => <hr className="my-3 border-white/[0.08]" />,
        // Tables
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto rounded-lg border border-white/[0.06]">
            <table className="w-full text-[12px]">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-white/[0.04] text-neutral-300">{children}</thead>
        ),
        tbody: ({ children }) => (
          <tbody className="divide-y divide-white/[0.04]">{children}</tbody>
        ),
        tr: ({ children }) => (
          <tr className="divide-x divide-white/[0.04]">{children}</tr>
        ),
        th: ({ children }) => (
          <th className="px-2 py-1.5 text-left font-semibold text-neutral-200">{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-2 py-1.5 text-neutral-400">{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// Citation display component
function CitationDisplay({ citations }: { citations: Citation[] }) {
  if (!citations || citations.length === 0) return null;

  // Deduplicate citations by document_id, keeping only the highest-scoring chunk per document
  const uniqueCitations = useMemo(() => {
    const docMap = new Map<string, Citation>();
    for (const citation of citations) {
      const existing = docMap.get(citation.document_id);
      if (!existing || citation.relevance_score > existing.relevance_score) {
        docMap.set(citation.document_id, citation);
      }
    }
    return Array.from(docMap.values()).sort((a, b) => b.relevance_score - a.relevance_score);
  }, [citations]);

  return (
    <div className="mt-2 pt-2 border-t border-white/[0.06]">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Database className="w-3 h-3 text-cyan-400" />
        <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">
          Sources ({uniqueCitations.length})
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {uniqueCitations.map((citation, idx) => (
          <div
            key={citation.document_id}
            className="group relative flex items-center gap-1.5 px-2 py-1 rounded-md bg-cyan-500/5 border border-cyan-500/10 hover:bg-cyan-500/10 transition-colors cursor-help"
            title={citation.excerpt}
          >
            <span className="text-[10px] font-bold text-cyan-400">[{idx + 1}]</span>
            <span className="text-[10px] text-neutral-400 truncate max-w-[120px]">
              {citation.document_name}
            </span>
            <span className="text-[9px] text-neutral-600">
              ({Math.round(citation.relevance_score * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Document panel component
function DocumentPanel({
  documents,
  uploadingFiles,
  onDelete,
  onClose,
}: {
  documents: RAGDocument[];
  uploadingFiles: Set<string>;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-full mt-2 w-72 p-3 rounded-lg bg-[#12121a]/95 border border-white/10 backdrop-blur-xl shadow-xl z-50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px] font-semibold text-white">Uploaded Documents</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Uploading files */}
      {Array.from(uploadingFiles).map((fileName) => (
        <div
          key={fileName}
          className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-amber-500/5 border border-amber-500/10 mb-1.5"
        >
          <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
          <span className="text-[11px] text-amber-300 truncate flex-1">{fileName}</span>
          <span className="text-[9px] text-amber-500">Processing...</span>
        </div>
      ))}

      {/* Uploaded documents */}
      {documents.length === 0 && uploadingFiles.size === 0 ? (
        <div className="text-center py-4">
          <p className="text-[11px] text-neutral-500">No documents uploaded</p>
          <p className="text-[10px] text-neutral-600 mt-1">
            Upload PDF, DOCX, TXT, CSV, or JSON
          </p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md border transition-colors ${
                doc.status === "ready"
                  ? "bg-emerald-500/5 border-emerald-500/10"
                  : doc.status === "error"
                  ? "bg-rose-500/5 border-rose-500/10"
                  : "bg-amber-500/5 border-amber-500/10"
              }`}
            >
              <FileText
                className={`w-3 h-3 shrink-0 ${
                  doc.status === "ready"
                    ? "text-emerald-400"
                    : doc.status === "error"
                    ? "text-rose-400"
                    : "text-amber-400"
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-neutral-200 truncate">{doc.filename}</p>
                <p className="text-[9px] text-neutral-500">
                  {doc.status === "ready"
                    ? `${doc.chunk_count} chunks`
                    : doc.status === "error"
                    ? doc.error_message || "Processing failed"
                    : "Processing..."}
                </p>
              </div>
              {doc.status === "ready" && (
                <button
                  onClick={() => onDelete(doc.id)}
                  className="p-1 rounded text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 pt-2 border-t border-white/[0.06]">
        <p className="text-[9px] text-neutral-600 leading-relaxed">
          Documents are processed into chunks and used for context-aware responses.
        </p>
      </div>
    </div>
  );
}

// Conversation group component
function ConversationGroup({
  title,
  conversations,
  currentId,
  onSelect,
  onDelete,
}: {
  title: string;
  conversations: StoredConversation[];
  currentId: string | null;
  onSelect: (conv: StoredConversation) => void;
  onDelete: (id: string) => void;
}) {
  if (conversations.length === 0) return null;

  return (
    <div className="mb-2">
      <h3 className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
        {title}
      </h3>
      <div className="space-y-px">
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv)}
            className={`
              group w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all duration-200
              ${currentId === conv.id
                ? "bg-gradient-to-r from-violet-500/15 to-fuchsia-500/10 text-white border-l-2 border-violet-400"
                : "text-neutral-400 hover:bg-white/[0.03] hover:text-neutral-200"
              }
            `}
          >
            <div className={`
              w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors
              ${currentId === conv.id
                ? "bg-violet-500/20 text-violet-300"
                : "bg-white/5 text-neutral-500 group-hover:bg-white/10 group-hover:text-neutral-400"
              }
            `}>
              <MessageSquare className="w-2.5 h-2.5" />
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-[13px] font-medium truncate leading-tight">
                {conv.title}
              </p>
              <span className="text-[11px] text-neutral-600 font-mono mt-0.5 block">
                {formatConversationTime(conv.updatedAt)}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
              className="p-1.5 rounded opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </button>
        ))}
      </div>
    </div>
  );
}

function AIAssistantContent() {
  const {
    conversations: storedConversations,
    saveConversation,
    deleteConversation: deleteStoredConversation,
    clearAllConversations,
    isLoaded,
  } = useChatStorage();

  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<AIHealthStatus | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("qwen3");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  // RAG state
  const [ragSessionId, setRagSessionId] = useState<string | null>(null);
  const [ragDocuments, setRagDocuments] = useState<RAGDocument[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [streamingCitations, setStreamingCitations] = useState<Citation[]>([]);
  const [showDocumentPanel, setShowDocumentPanel] = useState(false);

  // Copy/Regenerate state
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // User ID for memory personalisation
  const [userId, setUserId] = useState<string>("default");

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasMessages = messages.length > 0;
  const isOnline = aiStatus?.available ?? false;
  const isRAGMode = ragDocuments.length > 0;
  const hasReadyDocuments = ragDocuments.some(d => d.status === "ready");

  // Filter and group conversations
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return storedConversations;
    const query = searchQuery.toLowerCase();
    return storedConversations.filter(
      (conv) =>
        conv.title.toLowerCase().includes(query) ||
        conv.messages.some((m) => m.content.toLowerCase().includes(query))
    );
  }, [storedConversations, searchQuery]);

  const groupedConversations = useMemo(
    () => groupConversationsByTime(filteredConversations),
    [filteredConversations]
  );

  // Initial load using ref pattern instead of useEffect
  const hasInitialized = useRef(false);
  if (!hasInitialized.current) {
    hasInitialized.current = true;
    // Queue async initialization
    Promise.all([checkAIHealth(), getAvailableModels()])
      .then(([status, modelsData]) => {
        setAiStatus(status);
        setAvailableModels(modelsData.models);
        setSelectedModel(modelsData.default_model);
      })
      .catch(console.error);
  }
  
  // Use custom interval hook for health check polling
  useInterval(async () => {
    const status = await checkAIHealth();
    setAiStatus(status);
  }, 30000);

  // Use useLocalStorage hook for persistent user ID
  const [storedUserId, setStoredUserId] = useLocalStorage<string>(
    "ai_assistant_user_id",
    `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  );
  
  // Sync with component state
  const previousStoredUserId = useRef<string | null>(null);
  if (storedUserId !== previousStoredUserId.current) {
    previousStoredUserId.current = storedUserId;
    setUserId(storedUserId);
  }

  // Auto-scroll with smooth animation
  const scrollToBottom = (instant = false) => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;
      const scrollOptions: ScrollToOptions = {
        top: container.scrollHeight,
        behavior: instant ? "instant" : "smooth",
      };
      container.scrollTo(scrollOptions);
    }
  };

  // Auto-scroll using ref comparison instead of useEffect
  const previousMessagesLength = useRef(messages.length);
  if (messages.length !== previousMessagesLength.current) {
    previousMessagesLength.current = messages.length;
    // Small delay to ensure DOM has updated
    queueMicrotask(() => {
      setTimeout(() => scrollToBottom(), 50);
    });
  }

  // Scroll during streaming using ref comparison
  const previousStreamingContent = useRef(streamingContent);
  if (streamingContent !== previousStreamingContent.current) {
    previousStreamingContent.current = streamingContent;
    if (streamingContent) {
      scrollToBottom(true);
    }
  }

  // Auto-resize textarea using ref comparison
  const previousInputValue = useRef(inputValue);
  if (inputValue !== previousInputValue.current) {
    previousInputValue.current = inputValue;
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }

  const loadConversation = (conv: StoredConversation) => {
    setCurrentConversationId(conv.id);
    setMessages(conv.messages.map(toMessage));
  };

  const startNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setInputValue("");
    setAttachments([]);
    setStreamingContent("");
    // Reset RAG state
    setRagSessionId(null);
    setRagDocuments([]);
    setStreamingCitations([]);
    setShowDocumentPanel(false);
  };

  const cancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const handleDeleteConversation = (convId: string) => {
    deleteStoredConversation(convId);
    if (currentConversationId === convId) {
      startNewConversation();
    }
  };

  const generateTitle = (content: string): string => {
    const words = content.split(" ").slice(0, 6).join(" ");
    return words.length > 40 ? words.substring(0, 40) + "..." : words;
  };

  // Auto-capitalize first letter and after sentence-ending punctuation
  const autoCapitalize = (value: string, prevValue: string): string => {
    if (!value) return value;

    const isTyping = value.length > prevValue.length;
    if (!isTyping) return value;

    // Capitalize first character
    if (value.length === 1) {
      return value.toUpperCase();
    }

    // Check last few chars for sentence-end patterns
    const lastThreeChars = value.slice(-3);
    if (lastThreeChars.length >= 3) {
      const beforeLast = lastThreeChars.slice(0, 2);
      const lastChar = lastThreeChars.slice(-1);
      // After ". ", "? ", "! ", or newline variations
      if ((beforeLast === ". " || beforeLast === "? " || beforeLast === "! " ||
           beforeLast === ".\n" || beforeLast === "?\n" || beforeLast === "!\n") &&
          /[a-z]/.test(lastChar)) {
        return value.slice(0, -1) + lastChar.toUpperCase();
      }
    }

    // After newline - capitalize new line start
    const lastTwoChars = value.slice(-2);
    if (lastTwoChars[0] === "\n" && /[a-z]/.test(lastTwoChars[1])) {
      return value.slice(0, -1) + lastTwoChars[1].toUpperCase();
    }

    return value;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = autoCapitalize(e.target.value, inputValue);
    setInputValue(newValue);
  };

  const copyToClipboard = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const regenerateResponse = async (messageIndex: number) => {
    if (isLoading) return;
    if (!isOnline) return;

    // Find the user message before this assistant message
    const userMessageIndex = messageIndex - 1;
    if (userMessageIndex < 0 || messages[userMessageIndex].role !== "user") return;

    const userMessage = messages[userMessageIndex];

    // Remove only the assistant response, keep the user message
    const messagesWithoutAssistant = messages.slice(0, messageIndex);
    setMessages(messagesWithoutAssistant);
    setIsLoading(true);
    setStreamingContent("");
    setStreamingCitations([]);

    abortControllerRef.current = new AbortController();
    let accumulatedContent = "";
    let accumulatedCitations: Citation[] = [];

    const convId = currentConversationId;
    const now = new Date().toISOString();

    try {
      if (hasReadyDocuments && ragSessionId) {
        await queryRAGStream(
          userMessage.content,
          ragSessionId,
          {
            onCitation: (citation) => {
              accumulatedCitations.push(citation);
              setStreamingCitations([...accumulatedCitations]);
            },
            onChunk: (chunk) => {
              accumulatedContent += chunk;
              setStreamingContent(accumulatedContent);
            },
            onDone: () => {
              const assistantMessage: Message = {
                id: `msg-${Date.now()}`,
                role: "assistant",
                content: accumulatedContent || "I apologise, but I couldn't generate a response. Please try again.",
                timestamp: new Date(),
                citations: accumulatedCitations.length > 0 ? accumulatedCitations : undefined,
              };

              const updatedMessages = [...messagesWithoutAssistant, assistantMessage];
              setMessages(updatedMessages);
              setIsLoading(false);
              setStreamingContent("");
              setStreamingCitations([]);

              if (convId) {
                const storedConv: StoredConversation = {
                  id: convId,
                  title: generateTitle(userMessage.content),
                  messages: updatedMessages.map(toStoredMessage),
                  createdAt: storedConversations.find(c => c.id === convId)?.createdAt || now,
                  updatedAt: new Date().toISOString(),
                  messageCount: updatedMessages.length,
                };
                saveConversation(storedConv);
              }
            },
            onError: (error) => {
              const errorMessage: Message = {
                id: `msg-${Date.now()}`,
                role: "assistant",
                content: `⚠️ Error: ${error}\n\nPlease try again or check if the AI service is running.`,
                timestamp: new Date(),
              };

              const updatedMessages = [...messagesWithoutAssistant, errorMessage];
              setMessages(updatedMessages);
              setIsLoading(false);
              setStreamingContent("");
              setStreamingCitations([]);
            },
          },
          selectedModel,
          abortControllerRef.current.signal
        );
      } else {
        // Build history from messages before the user message
        const history: APIChatMessage[] = messagesWithoutAssistant.slice(0, -1).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        await sendChatMessageStream(
          userMessage.content,
          {
            onChunk: (chunk) => {
              accumulatedContent += chunk;
              setStreamingContent(accumulatedContent);
            },
            onDone: () => {
              const assistantMessage: Message = {
                id: `msg-${Date.now()}`,
                role: "assistant",
                content: accumulatedContent || "I apologise, but I couldn't generate a response. Please try again.",
                timestamp: new Date(),
              };

              const updatedMessages = [...messagesWithoutAssistant, assistantMessage];
              setMessages(updatedMessages);
              setIsLoading(false);
              setStreamingContent("");

              if (convId) {
                const storedConv: StoredConversation = {
                  id: convId,
                  title: generateTitle(userMessage.content),
                  messages: updatedMessages.map(toStoredMessage),
                  createdAt: storedConversations.find(c => c.id === convId)?.createdAt || now,
                  updatedAt: new Date().toISOString(),
                  messageCount: updatedMessages.length,
                };
                saveConversation(storedConv);
              }
            },
            onError: (error) => {
              const errorMessage: Message = {
                id: `msg-${Date.now()}`,
                role: "assistant",
                content: `⚠️ Error: ${error}\n\nPlease try again or check if the AI service is running.`,
                timestamp: new Date(),
              };

              const updatedMessages = [...messagesWithoutAssistant, errorMessage];
              setMessages(updatedMessages);
              setIsLoading(false);
              setStreamingContent("");
            },
          },
          history,
          undefined,
          abortControllerRef.current.signal,
          selectedModel
        );
      }
    } catch (error) {
      console.error("Regenerate error:", error);
      setIsLoading(false);
      setStreamingContent("");
      setStreamingCitations([]);
    }

    abortControllerRef.current = null;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Check for RAG-supported files
    const ragFiles: File[] = [];
    const otherFiles: File[] = [];

    Array.from(files).forEach((file) => {
      if (isFileTypeSupported(file)) {
        ragFiles.push(file);
      } else {
        otherFiles.push(file);
      }
    });

    // Add non-RAG files as regular attachments
    if (otherFiles.length > 0) {
      const newAttachments: Attachment[] = otherFiles.map((file) => ({
        name: file.name,
        type: file.type,
        size: file.size,
      }));
      setAttachments((prev) => [...prev, ...newAttachments]);
    }

    // Upload RAG-supported files
    if (ragFiles.length > 0) {
      await handleRAGUpload(ragFiles);
    }

    e.target.value = "";
  };

  const handleRAGUpload = async (files: File[]) => {
    try {
      // Create RAG session if not exists
      let sessionId = ragSessionId;
      if (!sessionId) {
        const session = await createRAGSession();
        sessionId = session.session_id;
        setRagSessionId(sessionId);
      }

      // Upload each file
      for (const file of files) {
        setUploadingFiles((prev) => new Set(prev).add(file.name));

        try {
          const result = await uploadDocument(sessionId, file);

          // Refresh document list
          const docs = await listDocuments(sessionId);
          setRagDocuments(docs);

          // Show document panel if first upload
          if (!showDocumentPanel) {
            setShowDocumentPanel(true);
          }
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
        } finally {
          setUploadingFiles((prev) => {
            const next = new Set(prev);
            next.delete(file.name);
            return next;
          });
        }
      }
    } catch (error) {
      console.error("RAG upload error:", error);
    }
  };

  const handleDeleteRAGDocument = async (docId: string) => {
    if (!ragSessionId) return;

    try {
      await deleteRAGDocument(ragSessionId, docId);
      const docs = await listDocuments(ragSessionId);
      setRagDocuments(docs);
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!inputValue.trim() && attachments.length === 0) return;
    if (!isOnline) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue("");
    setAttachments([]);
    setIsLoading(true);
    setStreamingContent("");
    setStreamingCitations([]);

    // Scroll to bottom immediately when sending
    setTimeout(() => scrollToBottom(), 10);

    let convId = currentConversationId;
    const now = new Date().toISOString();

    if (!convId) {
      convId = `conv-${Date.now()}`;
      setCurrentConversationId(convId);
    }

    abortControllerRef.current = new AbortController();
    let accumulatedContent = "";
    let accumulatedCitations: Citation[] = [];

    try {
      // Use RAG if we have ready documents
      if (hasReadyDocuments && ragSessionId) {
        await queryRAGStream(
          userMessage.content,
          ragSessionId,
          {
            onCitation: (citation) => {
              accumulatedCitations.push(citation);
              setStreamingCitations([...accumulatedCitations]);
            },
            onChunk: (chunk) => {
              accumulatedContent += chunk;
              setStreamingContent(accumulatedContent);
            },
            onDone: () => {
              const assistantMessage: Message = {
                id: `msg-${Date.now()}`,
                role: "assistant",
                content: accumulatedContent || "I apologise, but I couldn't generate a response. Please try again.",
                timestamp: new Date(),
                citations: accumulatedCitations.length > 0 ? accumulatedCitations : undefined,
              };

              const updatedMessages = [...newMessages, assistantMessage];
              setMessages(updatedMessages);
              setIsLoading(false);
              setStreamingContent("");
              setStreamingCitations([]);

              // Save to localStorage
              const storedConv: StoredConversation = {
                id: convId!,
                title: generateTitle(userMessage.content),
                messages: updatedMessages.map(toStoredMessage),
                createdAt: currentConversationId ?
                  (storedConversations.find(c => c.id === convId)?.createdAt || now) : now,
                updatedAt: new Date().toISOString(),
                messageCount: updatedMessages.length,
              };
              saveConversation(storedConv);
            },
            onError: (error) => {
              const errorMessage: Message = {
                id: `msg-${Date.now()}`,
                role: "assistant",
                content: `⚠️ Error: ${error}\n\nPlease try again or check if the AI service is running.`,
                timestamp: new Date(),
              };

              const updatedMessages = [...newMessages, errorMessage];
              setMessages(updatedMessages);
              setIsLoading(false);
              setStreamingContent("");
              setStreamingCitations([]);

              // Save error state to localStorage
              const storedConv: StoredConversation = {
                id: convId!,
                title: generateTitle(userMessage.content),
                messages: updatedMessages.map(toStoredMessage),
                createdAt: currentConversationId ?
                  (storedConversations.find(c => c.id === convId)?.createdAt || now) : now,
                updatedAt: new Date().toISOString(),
                messageCount: updatedMessages.length,
              };
              saveConversation(storedConv);
            },
          },
          selectedModel,
          abortControllerRef.current.signal,
          userId
        );
      } else {
        // Use regular chat API
        const history: APIChatMessage[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        await sendChatMessageStream(
          userMessage.content,
          {
            onChunk: (chunk) => {
              accumulatedContent += chunk;
              setStreamingContent(accumulatedContent);
            },
            onDone: () => {
              const assistantMessage: Message = {
                id: `msg-${Date.now()}`,
                role: "assistant",
                content: accumulatedContent || "I apologise, but I couldn't generate a response. Please try again.",
                timestamp: new Date(),
              };

              const updatedMessages = [...newMessages, assistantMessage];
              setMessages(updatedMessages);
              setIsLoading(false);
              setStreamingContent("");

              // Save to localStorage
              const storedConv: StoredConversation = {
                id: convId!,
                title: generateTitle(userMessage.content),
                messages: updatedMessages.map(toStoredMessage),
                createdAt: currentConversationId ?
                  (storedConversations.find(c => c.id === convId)?.createdAt || now) : now,
                updatedAt: new Date().toISOString(),
                messageCount: updatedMessages.length,
              };
              saveConversation(storedConv);
            },
            onError: (error) => {
              const errorMessage: Message = {
                id: `msg-${Date.now()}`,
                role: "assistant",
                content: `⚠️ Error: ${error}\n\nPlease try again or check if the AI service is running.`,
                timestamp: new Date(),
              };

              const updatedMessages = [...newMessages, errorMessage];
              setMessages(updatedMessages);
              setIsLoading(false);
              setStreamingContent("");

              // Save error state to localStorage
              const storedConv: StoredConversation = {
                id: convId!,
                title: generateTitle(userMessage.content),
                messages: updatedMessages.map(toStoredMessage),
                createdAt: currentConversationId ?
                  (storedConversations.find(c => c.id === convId)?.createdAt || now) : now,
                updatedAt: new Date().toISOString(),
                messageCount: updatedMessages.length,
              };
              saveConversation(storedConv);
            },
          },
          history,
          undefined,
          abortControllerRef.current.signal,
          selectedModel,
          userId
        );
      }
    } catch (error) {
      console.error("Submit error:", error);
      setIsLoading(false);
      setStreamingContent("");
      setStreamingCitations([]);
    }

    abortControllerRef.current = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex h-screen bg-[#08080a] items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#08080a] text-neutral-100 relative overflow-hidden" style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
      <ThreeBackground />
      <GridPattern />

      {/* Collapsed Sidebar Icon Strip */}
      {!sidebarOpen && (
        <aside className="relative z-30 flex flex-col h-full w-12 shrink-0 bg-[#0c0c0e]/80 backdrop-blur-xl border-r border-white/[0.04]">
          <div className="flex flex-col items-center py-3 gap-1">
            {/* Open Sidebar Button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="group relative w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:text-violet-400 hover:bg-violet-500/10 transition-all duration-200"
              title="Open sidebar"
            >
              <PanelLeft className="w-4 h-4" />
              <span className="absolute left-full ml-2 px-2 py-1 rounded bg-[#18181b] border border-white/10 text-[10px] text-neutral-300 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
                Open sidebar
              </span>
            </button>

            {/* Divider */}
            <div className="w-5 h-px bg-white/[0.06] my-1" />

            {/* New Chat */}
            <button
              onClick={startNewConversation}
              className="group relative w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-200"
              title="New chat"
            >
              <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" />
              <span className="absolute left-full ml-2 px-2 py-1 rounded bg-[#18181b] border border-white/10 text-[10px] text-neutral-300 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
                New chat
              </span>
            </button>

            {/* Chat History Indicator */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="group relative w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all duration-200"
              title="Chat history"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="absolute left-full ml-2 px-2 py-1 rounded bg-[#18181b] border border-white/10 text-[10px] text-neutral-300 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
                History
              </span>
            </button>

            {/* Search */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="group relative w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all duration-200"
              title="Search chats"
            >
              <Search className="w-4 h-4" />
              <span className="absolute left-full ml-2 px-2 py-1 rounded bg-[#18181b] border border-white/10 text-[10px] text-neutral-300 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
                Search
              </span>
            </button>
          </div>

          {/* Bottom section */}
          <div className="mt-auto flex flex-col items-center pb-3 gap-1">
            {/* Sparkles / AI indicator */}
            <div className="w-8 h-8 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-violet-500/50" />
            </div>
          </div>
        </aside>
      )}

      {/* Full Sidebar */}
      <aside
        className={`
          relative z-30 flex flex-col h-full shrink-0 transition-all duration-300 ease-out
          ${sidebarOpen ? "w-56" : "w-0 overflow-hidden"}
        `}
      >
        {/* Sidebar Background */}
        <div className="absolute inset-0 bg-[#0c0c0e]/95 backdrop-blur-2xl border-r border-white/[0.04]" />

        {sidebarOpen && (
          <div className="relative z-10 flex flex-col h-full">
            {/* Sidebar Header */}
            <div className="px-3 pt-3 pb-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <h1 className="text-sm font-semibold text-white tracking-tight">Chats</h1>
                    <p className="text-[11px] text-neutral-500 font-mono">
                      {storedConversations.length} total
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 rounded text-neutral-500 hover:text-neutral-300 hover:bg-white/5 transition-colors"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* New Chat Button */}
              <button
                onClick={startNewConversation}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 text-violet-300 hover:from-violet-500/20 hover:to-fuchsia-500/20 transition-all group"
              >
                <Plus className="w-3 h-3 group-hover:rotate-90 transition-transform duration-200" />
                <span className="text-[13px] font-medium">New Chat</span>
              </button>
            </div>

            {/* Search */}
            <div className="px-3 pb-2">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.06] focus-within:border-violet-500/30 focus-within:bg-white/[0.05] transition-all">
                <Search className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="flex-1 bg-transparent text-[13px] text-neutral-300 placeholder:text-neutral-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto px-1.5 py-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-500/10 flex items-center justify-center mb-3">
                    <MessageSquare className="w-4 h-4 text-violet-400/50" />
                  </div>
                  <p className="text-[13px] font-medium text-neutral-400 mb-0.5">
                    {searchQuery ? "No matches" : "No chats yet"}
                  </p>
                  <p className="text-[11px] text-neutral-600 text-center">
                    {searchQuery
                      ? "Try different terms"
                      : "Start a new chat"}
                  </p>
                </div>
              ) : (
                <>
                  <ConversationGroup
                    title="Today"
                    conversations={groupedConversations.today}
                    currentId={currentConversationId}
                    onSelect={loadConversation}
                    onDelete={handleDeleteConversation}
                  />
                  <ConversationGroup
                    title="Yesterday"
                    conversations={groupedConversations.yesterday}
                    currentId={currentConversationId}
                    onSelect={loadConversation}
                    onDelete={handleDeleteConversation}
                  />
                  <ConversationGroup
                    title="This Week"
                    conversations={groupedConversations.thisWeek}
                    currentId={currentConversationId}
                    onSelect={loadConversation}
                    onDelete={handleDeleteConversation}
                  />
                  <ConversationGroup
                    title="This Month"
                    conversations={groupedConversations.thisMonth}
                    currentId={currentConversationId}
                    onSelect={loadConversation}
                    onDelete={handleDeleteConversation}
                  />
                  <ConversationGroup
                    title="Older"
                    conversations={groupedConversations.older}
                    currentId={currentConversationId}
                    onSelect={loadConversation}
                    onDelete={handleDeleteConversation}
                  />
                </>
              )}
            </div>

            {/* Sidebar Footer */}
            {storedConversations.length > 0 && (
              <div className="px-2 py-2 border-t border-white/[0.04]">
                <button
                  onClick={() => setShowClearModal(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[12px] text-neutral-500 hover:text-rose-400 hover:bg-rose-500/5 transition-all"
                >
                  <Archive className="w-3 h-3" />
                  Clear all
                </button>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="relative z-20 flex flex-col bg-[#08080a]/80 backdrop-blur-xl border-b border-white/[0.04] shrink-0">
          {/* Navigation Bar */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-white/[0.04]">
            <StudioNav />
          </div>

          {/* Page Header */}
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                {isOnline && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#08080a]" />
                )}
              </div>
              <div>
                <h1 className="font-bold text-lg text-white tracking-tight">AI Assistant</h1>
                <p className="text-xs text-neutral-500">Data Science Specialist</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Model Selector */}
              {availableModels.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-neutral-300 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all"
                  >
                    <Brain className="w-4 h-4 text-violet-400" />
                    <span className="text-[11px] font-medium max-w-[100px] truncate">{selectedModel}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-neutral-500 transition-transform ${modelDropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {modelDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setModelDropdownOpen(false)}
                      />
                      <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px] py-1 rounded-lg bg-[#18181b]/95 border border-white/[0.08] backdrop-blur-xl shadow-xl">
                        <div className="px-2 py-1 text-[9px] text-neutral-500 uppercase tracking-wider font-semibold">
                          Models
                        </div>
                        {availableModels.map((model) => (
                          <button
                            key={model}
                            onClick={() => {
                              setSelectedModel(model);
                              setModelDropdownOpen(false);
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 text-left transition-colors ${
                              selectedModel === model
                                ? "bg-violet-500/10 text-violet-300"
                                : "text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${selectedModel === model ? "bg-violet-400" : "bg-neutral-600"}`} />
                            <span className="text-[11px] font-medium truncate">{model}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Document Panel Button */}
              <div className="relative">
                <button
                  onClick={() => setShowDocumentPanel(!showDocumentPanel)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                    isRAGMode
                      ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/15"
                      : "bg-white/[0.04] border-white/[0.08] text-neutral-400 hover:bg-white/[0.06]"
                  }`}
                  title={isRAGMode ? `${ragDocuments.length} documents loaded` : "Upload documents for RAG"}
                >
                  <FileText className="w-4 h-4" />
                  {isRAGMode && (
                    <span className="text-[11px] font-medium">{ragDocuments.length}</span>
                  )}
                  {uploadingFiles.size > 0 && (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  )}
                </button>

                {showDocumentPanel && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowDocumentPanel(false)}
                    />
                    <DocumentPanel
                      documents={ragDocuments}
                      uploadingFiles={uploadingFiles}
                      onDelete={handleDeleteRAGDocument}
                      onClose={() => setShowDocumentPanel(false)}
                    />
                  </>
                )}
              </div>

              {/* AI Status Indicator */}
              {aiStatus ? (
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                    isOnline
                      ? "bg-emerald-500/10 border-emerald-500/20"
                      : "bg-amber-500/10 border-amber-500/20"
                  }`}
                  title={aiStatus.message}
                >
                  {isOnline ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[11px] text-emerald-400 font-medium">Online</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                      <span className="text-[11px] text-amber-400 font-medium">Offline</span>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-500/10 border border-neutral-500/20">
                  <Loader2 className="w-4 h-4 text-neutral-400 animate-spin" />
                  <span className="text-[11px] text-neutral-400 font-medium">Connecting</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
          {!hasMessages ? (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center px-4 pb-6">
              <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center mb-5 mx-auto shadow-xl shadow-violet-500/25">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">
                  How can I help you today?
                </h2>
                <p className="text-sm text-neutral-500 max-w-md mx-auto leading-relaxed">
                  AI assistant powered by local models. Upload documents for RAG-enhanced conversations.
                </p>
                {isRAGMode && (
                  <div className="mt-4 flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mx-auto w-fit">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs text-cyan-300 font-medium">
                      {ragDocuments.length} document{ragDocuments.length > 1 ? "s" : ""} loaded
                    </span>
                    {hasReadyDocuments && (
                      <span className="text-[11px] text-cyan-500">• RAG Active</span>
                    )}
                  </div>
                )}
              </div>

              {/* Input Box */}
              <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-6 duration-700 delay-150">
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3 px-1">
                    {attachments.map((file, i) => {
                      const FileIcon = getFileIcon(file.type);
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10"
                        >
                          <FileIcon className="w-4 h-4 text-violet-400" />
                          <span className="text-xs text-neutral-300 truncate max-w-[140px]">{file.name}</span>
                          <button
                            onClick={() => removeAttachment(i)}
                            className="p-0.5 rounded hover:bg-white/10 text-neutral-500 hover:text-neutral-300 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="empty-input-container group">
                  {/* Ambient glow - more prominent for empty state */}
                  <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-violet-500/25 via-fuchsia-500/25 to-violet-500/25 opacity-0 group-focus-within:opacity-100 blur-2xl transition-opacity duration-500" />

                  {/* Main container - slightly larger for welcome state */}
                  <div className="relative flex items-end gap-3 p-3 rounded-2xl bg-[#0a0a0f] border border-white/[0.08] group-focus-within:border-white/[0.15] transition-all duration-300 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.04)]">

                    {/* Inner glow line */}
                    <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent" />

                    {/* Attachment button */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-3 rounded-xl text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04] active:scale-95 transition-all duration-200 shrink-0 mb-0.5"
                      title="Attach files"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>

                    {/* Text input */}
                    <textarea
                      ref={textareaRef}
                      value={inputValue}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask anything about your data..."
                      rows={1}
                      className="flex-1 px-1 py-3 bg-transparent text-[15px] text-neutral-100 placeholder:text-neutral-500 placeholder:font-light outline-none resize-none leading-relaxed tracking-wide"
                      style={{ minHeight: "48px", maxHeight: "180px" }}
                    />

                    {/* Send/Stop button */}
                    {isLoading ? (
                      <button
                        onClick={cancelGeneration}
                        className="empty-stop-btn relative p-3 rounded-xl shrink-0 mb-0.5 active:scale-95 transition-transform duration-150"
                        title="Stop generating"
                      >
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 opacity-90" />
                        <div className="absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.2)_0%,transparent_50%)]" />
                        <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
                        <Square className="relative w-5 h-5 text-white" fill="currentColor" />
                      </button>
                    ) : (
                      <button
                        onClick={handleSubmit}
                        disabled={(!inputValue.trim() && attachments.length === 0) || !isOnline}
                        className="empty-send-btn relative p-3 rounded-xl shrink-0 mb-0.5 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all duration-150 group/send"
                        title={!isOnline ? "AI service is offline" : "Send message"}
                      >
                        {/* Button background */}
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 opacity-90 group-hover/send:opacity-100 transition-opacity" />
                        {/* Highlight */}
                        <div className="absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.15)_0%,transparent_50%)]" />
                        {/* Inner border */}
                        <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
                        <Send className="relative w-5 h-5 text-white" />
                      </button>
                    )}
                  </div>

                  <style jsx>{`
                    .empty-input-container {
                      position: relative;
                    }
                    .empty-send-btn:not(:disabled):hover {
                      box-shadow: 0 0 24px rgba(139, 92, 246, 0.35), 0 0 48px rgba(217, 70, 239, 0.2);
                    }
                    .empty-stop-btn:hover {
                      box-shadow: 0 0 24px rgba(244, 63, 94, 0.45), 0 0 48px rgba(249, 115, 22, 0.25);
                    }
                  `}</style>
                </div>

                <p className="text-[11px] text-neutral-600 text-center mt-4 tracking-wide">
                  {isOnline
                    ? "Press Enter to send · Shift+Enter for new line"
                    : "⚠️ Offline — Start Ollama: ollama serve"}
                </p>
              </div>

              {/* Suggestions */}
              <div className="mt-8 w-full max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Database, text: "Analyse my dataset for trends", colour: "violet" },
                    { icon: Code2, text: "Help me clean and preprocess data", colour: "cyan" },
                    { icon: Zap, text: "Explain machine learning concepts", colour: "amber" },
                    { icon: Sparkles, text: "Write a SQL query for my data", colour: "pink" },
                  ].map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(suggestion.text)}
                      className="group flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/10 transition-all text-left"
                    >
                      <div className={`
                        w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                        ${suggestion.colour === "violet" ? "bg-violet-500/10 text-violet-400" :
                          suggestion.colour === "cyan" ? "bg-cyan-500/10 text-cyan-400" :
                          suggestion.colour === "amber" ? "bg-amber-500/10 text-amber-400" :
                          "bg-pink-500/10 text-pink-400"}
                      `}>
                        <suggestion.icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm text-neutral-400 group-hover:text-neutral-200 transition-colors leading-relaxed">
                        {suggestion.text}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Chat Mode */
            <>
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto scroll-smooth">
                <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-2 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out fill-mode-both ${
                        message.role === "user" ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      <div
                        className={`
                          w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5
                          ${message.role === "user"
                            ? "bg-gradient-to-br from-cyan-500 to-blue-500"
                            : "bg-gradient-to-br from-violet-500 to-fuchsia-500"
                          }
                        `}
                      >
                        {message.role === "user" ? (
                          <User className="w-4 h-4 text-white" />
                        ) : (
                          <Bot className="w-4 h-4 text-white" />
                        )}
                      </div>

                      <div className={`max-w-[80%] ${message.role === "user" ? "text-right" : "text-left"}`}>
                        <div className={`flex items-center gap-1.5 mb-1 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                          <span className="text-[10px] text-neutral-600">
                            {message.timestamp.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        {message.attachments && message.attachments.length > 0 && (
                          <div className={`flex flex-wrap gap-1.5 mb-1.5 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                            {message.attachments.map((file, i) => {
                              const FileIcon = getFileIcon(file.type);
                              return (
                                <div
                                  key={i}
                                  className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/10"
                                >
                                  <FileIcon className="w-3 h-3 text-violet-400" />
                                  <span className="text-[10px] text-neutral-300 truncate max-w-[100px]">{file.name}</span>
                                  <span className="text-[9px] text-neutral-600">{formatFileSize(file.size)}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div
                          className={`
                            inline-block px-3 py-2 rounded-xl
                            ${message.role === "user"
                              ? "bg-gradient-to-r from-cyan-500/15 to-blue-500/15 border border-cyan-500/20 text-neutral-300 text-base leading-relaxed whitespace-pre-wrap"
                              : "bg-white/[0.04] border border-white/[0.06] max-w-none"
                            }
                          `}
                        >
                          {message.role === "user" ? (
                            message.content
                          ) : (
                            <MarkdownMessage content={message.content} />
                          )}
                        </div>

                        {/* Copy and Regenerate buttons for assistant messages */}
                        {message.role === "assistant" && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <button
                              onClick={() => copyToClipboard(message.content, message.id)}
                              className="group flex items-center gap-1 px-2 py-1 rounded-md text-neutral-500 hover:text-neutral-300 hover:bg-white/5 transition-all"
                              title="Copy response"
                            >
                              {copiedMessageId === message.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-[10px] text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span className="text-[10px]">Copy</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => regenerateResponse(messages.indexOf(message))}
                              disabled={isLoading}
                              className="group flex items-center gap-1 px-2 py-1 rounded-md text-neutral-500 hover:text-neutral-300 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                              title="Regenerate response"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span className="text-[10px]">Regenerate</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Loading / Streaming */}
                  {isLoading && (
                    <div className="flex gap-2 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] text-neutral-600">
                            {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        {streamingContent ? (
                          <>
                            <div className="inline-block px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] max-w-none">
                              <MarkdownMessage content={streamingContent} />
                              <span className="inline-block w-1.5 h-3 bg-violet-400 ml-0.5 animate-pulse" />
                            </div>

                            {/* Copy and Regenerate - disabled during streaming */}
                            <div className="flex items-center gap-1 mt-1.5">
                              <button
                                disabled
                                className="group flex items-center gap-1 px-2 py-1 rounded-md text-neutral-500 opacity-40 cursor-not-allowed"
                              >
                                <Copy className="w-3 h-3" />
                                <span className="text-[10px]">Copy</span>
                              </button>
                              <button
                                disabled
                                className="group flex items-center gap-1 px-2 py-1 rounded-md text-neutral-500 opacity-40 cursor-not-allowed"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span className="text-[10px]">Regenerate</span>
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <span
                              className="thinking-text text-[13px] font-medium tracking-wide"
                            >
                              Thinking
                            </span>
                            <span className="flex items-center gap-[3px]">
                              {[0, 1, 2].map((i) => (
                                <span
                                  key={i}
                                  className="w-1 h-1 rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400"
                                  style={{
                                    animation: 'fade 1.4s ease-in-out infinite',
                                    animationDelay: `${i * 0.2}s`,
                                  }}
                                />
                              ))}
                            </span>

                            <style jsx>{`
                              .thinking-text {
                                background: linear-gradient(90deg, #c4b5fd, #e879f9, #a78bfa);
                                background-size: 200% 100%;
                                -webkit-background-clip: text;
                                -webkit-text-fill-color: transparent;
                                background-clip: text;
                                animation: shimmer 3s ease-in-out infinite;
                              }
                              @keyframes shimmer {
                                0%, 100% { background-position: 0% 50%; }
                                50% { background-position: 100% 50%; }
                              }
                              @keyframes fade {
                                0%, 100% { opacity: 0.3; transform: scale(0.8); }
                                50% { opacity: 1; transform: scale(1); }
                              }
                            `}</style>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input Area */}
              <div className="shrink-0 p-3 bg-gradient-to-t from-[#08080a] via-[#08080a]/95 to-transparent">
                <div className="max-w-4xl mx-auto">
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {attachments.map((file, i) => {
                        const FileIcon = getFileIcon(file.type);
                        return (
                          <div
                            key={i}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10"
                          >
                            <FileIcon className="w-3 h-3 text-violet-400" />
                            <span className="text-[11px] text-neutral-300 truncate max-w-[120px]">{file.name}</span>
                            <button
                              onClick={() => removeAttachment(i)}
                              className="p-0.5 rounded hover:bg-white/10 text-neutral-500 hover:text-neutral-300 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="input-container group">
                    {/* Ambient glow - subtle and refined */}
                    <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-violet-500/20 via-fuchsia-500/20 to-violet-500/20 opacity-0 group-focus-within:opacity-100 blur-xl transition-opacity duration-500" />

                    {/* Main container */}
                    <div className="relative flex items-end gap-2 p-2 rounded-2xl bg-[#0a0a0f] border border-white/[0.08] group-focus-within:border-white/[0.15] transition-all duration-300 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.03)]">

                      {/* Inner glow line */}
                      <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

                      {/* Attachment button */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2.5 rounded-xl text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04] active:scale-95 transition-all duration-200 shrink-0 mb-0.5"
                        title="Attach files"
                      >
                        <Paperclip className="w-[18px] h-[18px]" />
                      </button>

                      {/* Text input */}
                      <textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Message Damya..."
                        rows={1}
                        className="flex-1 px-1 py-2.5 bg-transparent text-[14px] text-neutral-100 placeholder:text-neutral-500 placeholder:font-light outline-none resize-none leading-relaxed tracking-wide"
                        style={{ minHeight: "40px", maxHeight: "160px" }}
                      />

                      {/* Send/Stop button */}
                      {isLoading ? (
                        <button
                          onClick={cancelGeneration}
                          className="stop-btn relative p-2.5 rounded-xl shrink-0 mb-0.5 active:scale-95 transition-transform duration-150"
                          title="Stop generating"
                        >
                          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 opacity-90" />
                          <div className="absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.2)_0%,transparent_50%)]" />
                          <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
                          <Square className="relative w-4 h-4 text-white" fill="currentColor" />
                        </button>
                      ) : (
                        <button
                          onClick={handleSubmit}
                          disabled={(!inputValue.trim() && attachments.length === 0) || !isOnline}
                          className="send-btn relative p-2.5 rounded-xl shrink-0 mb-0.5 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all duration-150 group/send"
                          title={!isOnline ? "AI service is offline" : "Send message"}
                        >
                          {/* Button background */}
                          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 opacity-90 group-hover/send:opacity-100 transition-opacity" />
                          {/* Highlight */}
                          <div className="absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.15)_0%,transparent_50%)]" />
                          {/* Inner border */}
                          <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
                          <Send className="relative w-4 h-4 text-white" />
                        </button>
                      )}
                    </div>

                    <style jsx>{`
                      .input-container {
                        position: relative;
                      }
                      .send-btn:not(:disabled):hover {
                        box-shadow: 0 0 20px rgba(139, 92, 246, 0.3), 0 0 40px rgba(217, 70, 239, 0.15);
                      }
                      .stop-btn:hover {
                        box-shadow: 0 0 20px rgba(244, 63, 94, 0.4), 0 0 40px rgba(249, 115, 22, 0.2);
                      }
                    `}</style>
                  </div>
                  {!isOnline && (
                    <p className="text-[10px] text-amber-400 text-center mt-1.5">
                      ⚠️ Offline. Start Ollama: ollama serve
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Hidden file input - always available for both empty state and chat mode */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        accept=".pdf,.doc,.docx,.txt,.csv,.sql,.json,.xml,.md,image/*"
      />

      {/* Clear All Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowClearModal(false)}
          />

          {/* Modal */}
          <div className="relative z-10 w-full max-w-sm mx-4 p-5 rounded-2xl bg-[#18181b] border border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Icon */}
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-rose-400" />
            </div>

            {/* Title */}
            <h3 className="text-lg font-semibold text-white text-center mb-2">
              Clear all conversations?
            </h3>

            {/* Description */}
            <p className="text-sm text-neutral-400 text-center mb-6">
              This will permanently delete all {storedConversations.length} conversation{storedConversations.length !== 1 ? 's' : ''}. This action cannot be undone.
            </p>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm font-medium text-neutral-300 hover:bg-white/10 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearAllConversations();
                  setShowClearModal(false);
                  startNewConversation();
                }}
                className="flex-1 px-4 py-2.5 rounded-lg bg-rose-500 text-sm font-medium text-white hover:bg-rose-400 transition-all"
              >
                Delete all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AIAssistantPage() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <TooltipProvider delayDuration={300}>
          <AIAssistantContent />
        </TooltipProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
