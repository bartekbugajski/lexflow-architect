"use client";

import { useState } from "react";

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
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-lg shadow-emerald-500/30" />
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                LexFlow Architect
              </h1>
              <p className="text-xs text-zinc-400">
                Cursor-like workspace for legal documents
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-xs text-zinc-400">
            <span className="px-2 py-1 rounded border border-zinc-700/80 bg-zinc-900/80">
              API: {API_URL ?? "not configured"}
            </span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 mx-auto max-w-6xl w-full px-4 sm:px-6 py-6 flex flex-col gap-4">
        {/* Status / Errors */}
        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="flex-1 flex flex-col md:flex-row gap-4">
          {/* Left Panel: Document Viewer */}
          <section className="flex-1 flex flex-col rounded-lg border border-zinc-800 bg-zinc-900/70 backdrop-blur-sm shadow-inner shadow-black/40 overflow-hidden">
            <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-2 bg-zinc-900/80">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Document Viewer
              </div>
              {documentId && (
                <span className="text-xs text-zinc-500">
                  document_id:{" "}
                  <span className="font-mono text-emerald-300">
                    {documentId}
                  </span>
                </span>
              )}
            </header>

            <div className="p-4 space-y-4 border-b border-zinc-800">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <label className="flex-1 text-xs text-zinc-300">
                  <span className="block mb-1 uppercase tracking-wide text-[0.65rem] text-zinc-500">
                    Source document (.docx)
                  </span>
                  <input
                    type="file"
                    accept=".docx"
                    onChange={handleFileChange}
                    className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-emerald-500 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-zinc-950 hover:file:bg-emerald-400 cursor-pointer bg-zinc-950/60 border border-zinc-800 rounded-md px-2 py-1.5 text-zinc-300 focus:outline-none focus:ring-1 focus:ring-emerald-500/70"
                  />
                </label>

                <div className="flex gap-2">
                  <button
                    onClick={handleIngest}
                    disabled={ingestLoading || !file}
                    className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-zinc-950 shadow-sm hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 transition"
                  >
                    {ingestLoading ? "Ingesting..." : "Ingest Document"}
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={exportLoading || !documentId}
                    className="inline-flex items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 transition"
                  >
                    {exportLoading ? "Exporting..." : "Export Document"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-zinc-950/40">
              <div className="text-xs text-zinc-400 mb-2 flex items-center justify-between">
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
                {clauses.map((clause) => (
                  <div
                    key={clause.id}
                    className={`rounded border px-3 py-2 bg-zinc-900/80 border-zinc-800 cursor-pointer transition-colors ${
                      clauseId === clause.id ? "border-emerald-500/70" : "hover:border-zinc-600"
                    }`}
                    onClick={() => setClauseId(clause.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) =>
                      e.key === "Enter" && setClauseId(clause.id)
                    }
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[0.7rem] uppercase tracking-wide text-zinc-500">
                        clause_id: {clause.id}
                      </span>
                      <span className="text-[0.7rem] text-zinc-500">
                        {clause.title ?? "Untitled"}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-200">
                      {clause.text || "(No content)"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Right Panel: AI Agent Chat */}
          <section className="flex-1 flex flex-col rounded-lg border border-zinc-800 bg-zinc-900/70 backdrop-blur-sm shadow-inner shadow-black/40 overflow-hidden">
            <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-2 bg-zinc-900/80">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                AI Drafting Agent
              </div>
            </header>

            <div className="p-4 space-y-3 border-b border-zinc-800">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-zinc-300">
                  <span className="block mb-1 uppercase tracking-wide text-[0.65rem] text-zinc-500">
                    Target clause_id
                  </span>
                  <input
                    type="text"
                    value={clauseId}
                    onChange={(e) => setClauseId(e.target.value)}
                    placeholder="e.g. clause-penalty"
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950/60 px-2 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/70"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-zinc-300">
                  <span className="block mb-1 uppercase tracking-wide text-[0.65rem] text-zinc-500">
                    Instruction
                  </span>
                  <textarea
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder="e.g. Make the penalty period 30 days and clarify that it is an exclusive remedy."
                    rows={4}
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950/60 px-2 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/70 resize-none"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={handleGeneratePatch}
                  disabled={patchLoading}
                  className="inline-flex items-center justify-center rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-medium text-zinc-950 shadow-sm hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 transition"
                >
                  {patchLoading ? "Generating Patch..." : "Generate Patch"}
                </button>
                <span className="text-[0.7rem] text-zinc-500 hidden sm:inline">
                  The agent will propose a revised clause and explain its
                  reasoning.
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-zinc-950/40 space-y-3">
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
                  <div className="rounded-md border border-emerald-500/60 bg-emerald-500/10 px-3 py-2">
                    <div className="mb-1 text-[0.7rem] uppercase tracking-wide text-emerald-300">
                      Proposed Text
                    </div>
                    <p className="text-sm text-emerald-50 whitespace-pre-line">
                      {patchResult.proposed_text}
                    </p>
                  </div>

                  <div className="rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2">
                    <div className="mb-1 text-[0.7rem] uppercase tracking-wide text-zinc-400">
                      Reasoning
                    </div>
                    <p className="text-xs text-zinc-300 whitespace-pre-line">
                      {patchResult.reasoning}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}