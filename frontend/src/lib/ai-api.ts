/**
 * AI API client for Ollama-powered chat with streaming support.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIHealthStatus {
  status: "online" | "offline" | "model_missing" | "error";
  available: boolean;
  model: string;
  message: string;
  available_models?: string[];
}

export interface ChatResponse {
  content: string;
  model: string;
  timestamp: string;
}

export interface ModelsResponse {
  models: string[];
  default_model: string;
}

export interface StreamCallbacks {
  onChunk: (content: string) => void;
  onDone: (model?: string, timestamp?: string) => void;
  onError: (error: string) => void;
}

/**
 * Check if the AI service (Ollama) is healthy and available.
 */
export async function checkAIHealth(): Promise<AIHealthStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/ai/health`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return {
        status: "error",
        available: false,
        model: "unknown",
        message: `Health check failed with status ${response.status}`,
      };
    }

    return await response.json();
  } catch (error) {
    return {
      status: "offline",
      available: false,
      model: "unknown",
      message: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

/**
 * Check if a model name is an embedding model (should be excluded from chat models list).
 */
function isEmbeddingModel(modelName: string): boolean {
  const lowerName = modelName.toLowerCase();
  const embeddingPatterns = [
    "embed",
    "embedding",
    "minilm",
    "bge",
    "e5",
    "gte",
    "nomic-embed",
    "mxbai-embed",
    "snowflake-arctic-embed",
    "all-minilm",
  ];
  return embeddingPatterns.some(pattern => lowerName.includes(pattern));
}

/**
 * Get available Ollama models (excluding embedding models).
 */
export async function getAvailableModels(): Promise<ModelsResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/ai/models`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return {
        models: ["qwen3"],
        default_model: "qwen3",
      };
    }

    const data: ModelsResponse = await response.json();

    // Filter out embedding models
    const chatModels = data.models.filter(model => !isEmbeddingModel(model));

    return {
      models: chatModels.length > 0 ? chatModels : ["qwen3"],
      default_model: isEmbeddingModel(data.default_model) ? (chatModels[0] || "qwen3") : data.default_model,
    };
  } catch {
    return {
      models: ["qwen3"],
      default_model: "qwen3",
    };
  }
}

/**
 * Send a chat message and receive a complete response (non-streaming).
 */
export async function sendChatMessage(
  message: string,
  history?: ChatMessage[],
  systemPrompt?: string
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      history,
      system_prompt: systemPrompt,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }

  return await response.json();
}

/**
 * Send a chat message and receive a streaming response via SSE.
 *
 * @param message - The user's message
 * @param callbacks - Callback functions for handling stream events
 * @param history - Optional conversation history
 * @param systemPrompt - Optional custom system prompt
 * @param signal - Optional AbortSignal for cancellation
 * @param model - Optional model override
 * @param userId - Optional user ID for memory personalisation
 *
 * @returns Promise that resolves when stream completes
 */
export async function sendChatMessageStream(
  message: string,
  callbacks: StreamCallbacks,
  history?: ChatMessage[],
  systemPrompt?: string,
  signal?: AbortSignal,
  model?: string,
  userId?: string
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/ai/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        message,
        history,
        system_prompt: systemPrompt,
        model,
        user_id: userId || "default",
      }),
      signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      callbacks.onError(errorData.detail || `Request failed with status ${response.status}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError("Response body is not readable");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE events from buffer
      const lines = buffer.split("\n");

      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (!data) continue;

          try {
            const event = JSON.parse(data);

            switch (event.type) {
              case "chunk":
                if (event.content) {
                  callbacks.onChunk(event.content);
                }
                break;

              case "done":
                callbacks.onDone(event.model, event.timestamp);
                break;

              case "error":
                callbacks.onError(event.error || "Unknown streaming error");
                break;
            }
          } catch (parseError) {
            console.warn("Failed to parse SSE event:", data);
          }
        }
      }
    }

    // Process any remaining data in buffer
    if (buffer.startsWith("data: ")) {
      const data = buffer.slice(6).trim();
      if (data) {
        try {
          const event = JSON.parse(data);
          if (event.type === "done") {
            callbacks.onDone(event.model, event.timestamp);
          } else if (event.type === "error") {
            callbacks.onError(event.error || "Unknown streaming error");
          }
        } catch {
          // Ignore parse errors for incomplete data
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      // Request was cancelled by user
      callbacks.onDone();
      return;
    }

    callbacks.onError(
      error instanceof Error ? error.message : "Stream connection failed"
    );
  }
}

/**
 * Simple generate API (single-turn, no history).
 */
export async function generateResponse(
  prompt: string,
  systemPrompt?: string
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/ai/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: prompt,
      system_prompt: systemPrompt,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }

  return await response.json();
}

/**
 * Simple generate API with streaming (single-turn, no history).
 */
export async function generateResponseStream(
  prompt: string,
  callbacks: StreamCallbacks,
  systemPrompt?: string,
  signal?: AbortSignal
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/ai/generate/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        message: prompt,
        system_prompt: systemPrompt,
      }),
      signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      callbacks.onError(errorData.detail || `Request failed with status ${response.status}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError("Response body is not readable");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (!data) continue;

          try {
            const event = JSON.parse(data);

            switch (event.type) {
              case "chunk":
                if (event.content) {
                  callbacks.onChunk(event.content);
                }
                break;

              case "done":
                callbacks.onDone(event.model, event.timestamp);
                break;

              case "error":
                callbacks.onError(event.error || "Unknown streaming error");
                break;
            }
          } catch {
            console.warn("Failed to parse SSE event:", data);
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      callbacks.onDone();
      return;
    }

    callbacks.onError(
      error instanceof Error ? error.message : "Stream connection failed"
    );
  }
}
