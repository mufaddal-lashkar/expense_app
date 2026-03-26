import { useState, useRef, useCallback, useEffect } from "react";
import { getAuthToken } from "@/lib/api";

type SSEState = {
    data: string;
    isStreaming: boolean;
    error: string | null;
};

type UseSSEStreamReturn = SSEState & {
    startStream: (url: string) => void;
    stopStream: () => void;
};

export function useSSEStream(): UseSSEStreamReturn {
    const [state, setState] = useState<SSEState>({
        data: "",
        isStreaming: false,
        error: null,
    });

    // Use a ref for the abort controller so we can cancel from anywhere
    const abortRef = useRef<AbortController | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            abortRef.current?.abort();
        };
    }, []);

    const stopStream = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;
        setState((s) => ({ ...s, isStreaming: false }));
    }, []);

    const startStream = useCallback(
        async (url: string) => {
            // Cancel any existing stream
            abortRef.current?.abort();

            const controller = new AbortController();
            abortRef.current = controller;

            setState({ data: "", isStreaming: true, error: null });

            try {
                const token = getAuthToken();
                const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
                const fullUrl = url.startsWith("http") ? url : `${BASE_URL}/${url}`;

                const response = await fetch(fullUrl, {
                    signal: controller.signal,
                    headers: {
                        Accept: "text/event-stream",
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    credentials: "include",
                });

                if (!response.ok) {
                    const err = await response.json().catch(() => ({ error: { message: "Stream failed" } }));
                    throw new Error(err?.error?.message ?? "Stream request failed");
                }

                if (!response.body) throw new Error("No response body");

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });

                    // SSE messages end with \n\n
                    const lines = buffer.split("\n\n");
                    buffer = lines.pop() ?? "";

                    for (const line of lines) {
                        if (!line.trim()) continue;

                        // Strip "data: " prefix
                        const dataLine = line.startsWith("data: ") ? line.slice(6) : line;

                        try {
                            const parsed = JSON.parse(dataLine) as { text: string; done: boolean };

                            if (parsed.done) {
                                setState((s) => ({ ...s, isStreaming: false }));
                                return;
                            }

                            setState((s) => ({
                                ...s,
                                data: s.data + parsed.text,
                            }));
                        } catch {
                            // Non-JSON line — skip silently
                        }
                    }
                }

                setState((s) => ({ ...s, isStreaming: false }));
            } catch (err) {
                if ((err as Error).name === "AbortError") {
                    setState((s) => ({ ...s, isStreaming: false }));
                    return;
                }
                const message = err instanceof Error ? err.message : "Stream failed";
                setState({ data: "", isStreaming: false, error: message });
            }
        },
        []
    );

    return { ...state, startStream, stopStream };
}