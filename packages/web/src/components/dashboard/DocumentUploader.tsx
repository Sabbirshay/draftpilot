'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface UploadedDoc {
  id: string;
  name: string;
  type: 'PDF' | 'Word' | 'Excel' | 'Markdown' | 'Text' | 'JSON';
  size: string;
  chunksCount: number;
  extractedMacrosCount: number;
  uploadedAt: string;
  status: 'Indexed & Ready' | 'Processing';
}

export interface DocumentUploaderProps {
  onExtractionComplete?: (count: number) => void;
}

export default function DocumentUploader({ onExtractionComplete }: DocumentUploaderProps) {
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleSimulatedUpload = (fileName: string, type: UploadedDoc['type'], size: string) => {
    setIsUploading(true);

    const newDocId = `doc-${Date.now()}`;
    const processingDoc: UploadedDoc = {
      id: newDocId,
      name: fileName,
      type,
      size,
      chunksCount: 0,
      extractedMacrosCount: 0,
      uploadedAt: 'Just now',
      status: 'Processing',
    };

    setDocs((prev) => [processingDoc, ...prev]);

    setTimeout(() => {
      const extractedCount = Math.floor(Math.random() * 6) + 4;
      const chunks = Math.floor(Math.random() * 40) + 25;

      setDocs((prev) =>
        prev.map((d) =>
          d.id === newDocId
            ? {
                ...d,
                chunksCount: chunks,
                extractedMacrosCount: extractedCount,
                status: 'Indexed & Ready',
              }
            : d
        )
      );
      setIsUploading(false);
      onExtractionComplete?.(extractedCount);
    }, 2000);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    let type: UploadedDoc['type'] = 'PDF';
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') type = 'Excel';
    else if (ext === 'docx' || ext === 'doc') type = 'Word';
    else if (ext === 'md') type = 'Markdown';
    else if (ext === 'json') type = 'JSON';
    else if (ext === 'txt') type = 'Text';

    const sizeStr = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
    handleSimulatedUpload(file.name, type, sizeStr);
  };

  const handleDelete = (id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Upload Box / Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          const file = e.dataTransfer.files?.[0];
          if (file) {
            const ext = file.name.split('.').pop()?.toLowerCase();
            let type: UploadedDoc['type'] = 'PDF';
            if (ext === 'xlsx' || ext === 'xls') type = 'Excel';
            else if (ext === 'docx') type = 'Word';
            else if (ext === 'md') type = 'Markdown';
            handleSimulatedUpload(file.name, type, (file.size / 1024 / 1024).toFixed(1) + ' MB');
          }
        }}
        className={`p-8 sm:p-10 rounded-3xl border-2 border-dashed transition-all text-center flex flex-col items-center justify-center relative overflow-hidden ${
          dragActive
            ? 'border-accent bg-accent/10 shadow-[0_0_30px_rgba(124,58,237,0.3)]'
            : 'border-border/80 bg-elevated/50 hover:border-accent/50'
        }`}
      >
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-accent/20 to-cyan/20 border border-accent/30 flex items-center justify-center text-2xl mb-4 shadow-sm">
          📁
        </div>

        <h3 className="text-base font-bold text-text mb-1">
          Upload Knowledge Base Documents
        </h3>
        <p className="text-xs text-text-muted max-w-md mx-auto mb-5 leading-relaxed">
          Drag &amp; drop PDF policies, Word manuals, Excel FAQs, or Markdown docs. DraftPilot extracts and converts them into searchable team macros.
        </p>

        <label className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(124,58,237,0.4)] cursor-pointer flex items-center gap-2">
          <span>⬆️</span>
          <span>{isUploading ? 'Parsing & Indexing...' : 'Browse Document Files'}</span>
          <input
            type="file"
            accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.md,.txt,.json"
            onChange={handleFileInput}
            className="hidden"
            disabled={isUploading}
          />
        </label>

        <p className="text-[10px] text-text-dim mt-3">
          Supported formats: PDF, DOCX, XLSX, CSV, Markdown, Plain Text (up to 25MB each)
        </p>
      </div>

      {/* Uploaded Documents Table / Cards */}
      {docs.length > 0 && (
        <div className="rounded-3xl bg-elevated/70 border border-border/80 shadow-lg overflow-hidden">
          <div className="p-5 border-b border-border/50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-text">Indexed Knowledge Base Sources ({docs.length})</h3>
            <span className="text-[11px] text-text-dim">Vector chunks active</span>
          </div>

          <div className="divide-y divide-border/40">
            {docs.map((doc) => (
              <div key={doc.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-bg border border-border flex items-center justify-center text-xs font-bold text-accent font-mono shrink-0">
                    {doc.type}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-text">{doc.name}</h4>
                    <p className="text-[11px] text-text-dim mt-0.5">
                      {doc.size} · {doc.chunksCount} chunks · {doc.extractedMacrosCount} macros generated
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-5 text-xs">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
                    doc.status === 'Indexed & Ready' ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    {doc.status}
                  </span>

                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="text-text-dim hover:text-red-400 text-xs transition-colors p-1 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
