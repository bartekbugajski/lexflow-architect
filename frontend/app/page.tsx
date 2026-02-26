"use client";

import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

type LegalPatch = {
  proposed_text: string;
  reasoning: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [patchLoading, setPatchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clauseId, setClauseId] = useState("");
  const [instruction, setInstruction] = useState("");
  const [patchResult, setPatchResult] = useState<LegalPatch | null>(null);
  const [clauses, setClauses] = useState<any[]>([]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
  };

  const handleIngest = async () => {
    if (!API_URL) {
      setError("API URL is not configured.");
      return;
    }
    if (!file) {
      setError("Please select a .docx file to ingest.");
      return;
    }

    setError(null);
    setIngestLoading(true);
    setPatchResult(null);
    setClauses([]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/ingest`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to ingest document (${response.status})`);
      }

      const data = await response.json();
      if (!data.document_id) {
        throw new Error("No document_id returned from API.");
      }

      setDocumentId(data.document_id as string);

      const docResponse = await fetch(`${API_URL}/document/${data.document_id}`);
      if (docResponse.ok) {
        const docData = await docResponse.json();
        setClauses(Array.isArray(docData) ? docData : []);
      } else {
        setClauses([]);
      }
    } catch (err: any) {
      setError(err.message ?? "Unexpected error while ingesting document.");
    } finally {
      setIngestLoading(false);
    }
  };

  const handleExport = async () => {
    if (!API_URL) {
      setError("API URL is not configured.");
      return;
    }
    if (!documentId) {
      setError("No document available to export. Please ingest first.");
      return;
    }

    setError(null);
    setExportLoading(true);

    try {
      const response = await fetch(`${API_URL}/export/${documentId}`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`Failed to export document (${response.status})`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `lexflow-document-${documentId}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message ?? "Unexpected error while exporting document.");
    } finally {
      setExportLoading(false);
    }
  };

  const handleGeneratePatch = async () => {
    if (!API_URL) {
      setError("API URL is not configured.");
      return;
    }
    if (!clauseId.trim()) {
      setError("Please enter a clause ID.");
      return;
    }
    if (!instruction.trim()) {
      setError("Please provide an instruction for the AI agent.");
      return;
    }

    setError(null);
    setPatchLoading(true);
    setPatchResult(null);

    try {
      const response = await fetch(`${API_URL}/patch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clause_id: clauseId,
          instruction,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate patch (${response.status})`);
      }

      const data = (await response.json()) as LegalPatch;
      setPatchResult(data);
    } catch (err: any) {
      setError(err.message ?? "Unexpected error while generating patch.");
    } finally {
      setPatchLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans flex flex-col transition-colors duration-200">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-gradient-to-r dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-lg shadow-emerald-500/25 dark:shadow-emerald-500/30" />
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                LexFlow Architect
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Cursor-like workspace for legal documents
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 mx-auto max-w-6xl w-full px-4 sm:px-6 py-6 flex flex-col gap-4">
        {/* Status / Errors */}
        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="flex-1 flex flex-col md:flex-row gap-4">
          {/* Left Panel: Document Viewer */}
          <section className="flex-1 flex flex-col rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/70 backdrop-blur-sm shadow-inner shadow-zinc-200/60 dark:shadow-black/40 overflow-hidden">
            <header className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-2 bg-zinc-100/80 dark:bg-zinc-900/80">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                Document Viewer
              </div>
              {documentId && (
                <span className="text-xs text-zinc-500">
                  document_id:{" "}
                  <span className="font-mono text-emerald-600 dark:text-emerald-300">
                    {documentId}
                  </span>
                </span>
              )}
            </header>

            <div className="p-4 space-y-4 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <span className="block mb-2 uppercase tracking-wide text-[0.65rem] text-zinc-500">
                  Source document (.docx)
                </span>
                <div className="flex items-stretch gap-2">
                  <input
                    id="file-input"
                    type="file"
                    accept=".docx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="file-input"
                    className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium shadow-sm cursor-pointer transition h-[28px] min-w-0 ${
                      file
                        ? "bg-emerald-500 text-white hover:bg-emerald-400"
                        : "border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700/80"
                    }`}
                  >
                    {file ? (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="shrink-0"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                        <span className="truncate">{file.name}</span>
                      </>
                    ) : (
                      "Choose File"
                    )}
                  </label>
                  <button
                    onClick={handleIngest}
                    disabled={ingestLoading || !file}
                    className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 transition h-[28px]"
                  >
                    {ingestLoading ? "Ingesting..." : "Ingest Document"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-zinc-100/50 dark:bg-zinc-950/40">
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-2 flex items-center justify-between">
                <span className="uppercase tracking-wide text-[0.65rem] text-zinc-500">
                  Extracted clauses
                </span>
                {clauses.length > 0 && (
                  <span className="text-[0.65rem] text-zinc-500">
                    {clauses.length} clause{clauses.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <div className="space-y-3 text-sm font-mono">
                {clauses.length === 0 && !documentId && (
                  <p className="text-xs text-zinc-500 italic">
                    Ingest a document to see extracted clauses and metadata.
                  </p>
                )}
                {clauses.length === 0 && documentId && (
                  <p className="text-xs text-zinc-500 italic">
                    No clauses found for this document yet.
                  </p>
                )}
                {clauses.map((clause) => {
                  const isSelected = clauseId === clause.id;
                  return (
                    <div
                      key={clause.id}
                      className={`rounded-lg border px-3 py-2 bg-zinc-100/80 dark:bg-zinc-900/80 cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? "border-cyan-500/80 ring-2 ring-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                          : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600"
                      }`}
                      onClick={() => setClauseId(clause.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) =>
                        e.key === "Enter" && setClauseId(clause.id)
                      }
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[0.7rem] uppercase tracking-wide text-zinc-500 shrink-0">
                            clause_id: {clause.id}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void navigator.clipboard.writeText(clause.id);
                            }}
                            className="shrink-0 p-0.5 rounded text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-zinc-200 dark:hover:bg-zinc-800/80 transition-colors"
                            title="Copy ID"
                            aria-label="Copy clause ID"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect
                                width="14"
                                height="14"
                                x="8"
                                y="8"
                                rx="2"
                                ry="2"
                              />
                              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                            </svg>
                          </button>
                        </div>
                        <span className="text-[0.7rem] text-zinc-500 truncate">
                          {clause.title ?? "Untitled"}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-700 dark:text-zinc-200">
                        {clause.text || "(No content)"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Right Panel: AI Agent Chat */}
          <section className="flex-1 flex flex-col rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/70 backdrop-blur-sm shadow-inner shadow-zinc-200/60 dark:shadow-black/40 overflow-hidden">
            <header className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-2 bg-zinc-100/80 dark:bg-zinc-900/80">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                <span className="h-2 w-2 rounded-full bg-cyan-500 dark:bg-cyan-400" />
                AI Drafting Agent
              </div>
            </header>

            <div className="p-4 space-y-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-zinc-600 dark:text-zinc-300">
                  <span className="block mb-1 uppercase tracking-wide text-[0.65rem] text-zinc-500">
                    Target clause_id
                  </span>
                  <input
                    type="text"
                    value={clauseId}
                    onChange={(e) => setClauseId(e.target.value)}
                    placeholder="e.g. clause-penalty"
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 px-2 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/70"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-zinc-600 dark:text-zinc-300">
                  <span className="block mb-1 uppercase tracking-wide text-[0.65rem] text-zinc-500">
                    Instruction
                  </span>
                  <textarea
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder="e.g. Make the penalty period 30 days and clarify that it is an exclusive remedy."
                    rows={4}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 px-2 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/70 resize-none"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={handleGeneratePatch}
                  disabled={patchLoading}
                  className="inline-flex items-center justify-center rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 transition"
                >
                  {patchLoading ? "Generating Patch..." : "Generate Patch"}
                </button>
                <span className="text-[0.7rem] text-zinc-500 hidden sm:inline">
                  The agent will propose a revised clause and explain its
                  reasoning.
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-zinc-100/50 dark:bg-zinc-950/40 space-y-3">
              {!patchResult && !patchLoading && (
                <p className="text-xs text-zinc-500 italic">
                  Submit an instruction to see an AI-generated LegalPatch for
                  the selected clause. The proposed text will appear in a green
                  panel with reasoning below.
                </p>
              )}

              {patchLoading && (
                <div className="text-xs text-zinc-400">
                  Generating patch with LexFlow Agent...
                </div>
              )}

              {patchResult && (
                <div className="space-y-3">
                  <div className="rounded-md border border-emerald-500/60 bg-emerald-500/15 dark:bg-emerald-500/10 px-3 py-2">
                    <div className="mb-1 text-[0.7rem] uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      Proposed Text
                    </div>
                    <p className="text-sm text-emerald-900 dark:text-emerald-50 whitespace-pre-line">
                      {patchResult.proposed_text}
                    </p>
                  </div>

                  <div className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-100/80 dark:bg-zinc-900/80 px-3 py-2">
                    <div className="mb-1 text-[0.7rem] uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                      Reasoning
                    </div>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
                      {patchResult.reasoning}
                    </p>
                  </div>

                  <button
                    onClick={handleExport}
                    disabled={exportLoading || !documentId}
                    className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 transition"
                  >
                    {exportLoading ? "Exporting..." : "Export Document"}
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}