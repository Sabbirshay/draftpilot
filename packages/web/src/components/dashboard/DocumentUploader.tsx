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

const INITIAL_DOCS: UploadedDoc[] = [
  {
    id: 'doc-1',
    name: 'Customer_Support_Policy_&_Refunds_2026.pdf',
    type: 'PDF',
    size: '1.4 MB',
    chunksCount: 84,
    extractedMacrosCount: 18,
    uploadedAt: 'Today, 2:15 PM',
    status: 'Indexed & Ready',
  },
  {
    id: 'doc-2',
    name: 'Product_Catalog_&_Troubleshooting_FAQ.xlsx',
    type: 'Excel',
    size: '860 KB',
    chunksCount: 112,
    extractedMacrosCount: 16,
    uploadedAt: 'Yesterday',
    status: 'Indexed & Ready',
  },
  {
    id: 'doc-3',
    name: 'SaaS_Terms_SLA_and_Security_Rules.docx',
    type: 'Word',
    size: '520 KB',
    chunksCount: 65,
    extractedMacrosCount: 16,
    uploadedAt: '3 days ago',
    status: 'Indexed & Ready',
  },
];

interface DocumentUploaderProps {
  onMacrosExtracted: (count: number) => void;
}

export default function DocumentUploader({ onMacrosExtracted }: DocumentUploaderProps) {
  const [docs, setDocs] = useState<UploadedDoc[]>(INITIAL_DOCS);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [uploadSuccessNotice, setUploadSuccessNotice] = useState<string | null>(null);

  const simulateFileUpload = (fileName: string, fileType: UploadedDoc['type'], fileSize: string) => {
    setIsProcessing(true);
    setProcessingStage('Reading document bytes & extracting text chunks...');

    setTimeout(() => {
      setProcessingStage('Vectorizing embeddings & matching support topics...');
      setTimeout(() => {
        setProcessingStage('AI generating 50 structured, tagged team support macros...');
        setTimeout(() => {
          const newDoc: UploadedDoc = {
            id: String(Date.now()),
            name: fileName,
            type: fileType,
            size: fileSize,
            chunksCount: Math.floor(Math.random() * 60) + 70,
            extractedMacrosCount: 50,
            uploadedAt: 'Just now',
            status: 'Indexed & Ready',
          };

          setDocs([newDoc, ...docs]);
          setIsProcessing(false);
          setProcessingStage('');
          onMacrosExtracted(50);
          setUploadSuccessNotice(`Successfully analyzed "${fileName}"! Full document indexed in Vector KB + 50 structured macros generated.`);
          setTimeout(() => setUploadSuccessNotice(null), 5000);
        }, 800);
      }, 750);
    }, 750);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let type: UploadedDoc['type'] = 'PDF';
      if (ext === 'docx' || ext === 'doc') type = 'Word';
      else if (ext === 'xlsx' || ext === 'csv') type = 'Excel';
      else if (ext === 'md') type = 'Markdown';
      else if (ext === 'json') type = 'JSON';

      const sizeStr = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
      simulateFileUpload(file.name, type, sizeStr);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let type: UploadedDoc['type'] = 'PDF';
      if (ext === 'docx' || ext === 'doc') type = 'Word';
      else if (ext === 'xlsx' || ext === 'csv') type = 'Excel';
      else if (ext === 'md') type = 'Markdown';
      else if (ext === 'json') type = 'JSON';

      const sizeStr = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
      simulateFileUpload(file.name, type, sizeStr);
    }
  };

  const handleDeleteDoc = (id: string) => {
    setDocs(docs.filter((d) => d.id !== id));
  };

  return (
    <div className="space-y-6">
      {uploadSuccessNotice && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center justify-between shadow-lg"
        >
          <div className="flex items-center gap-2">
            <span>✨</span>
            <span>{uploadSuccessNotice}</span>
          </div>
          <span className="text-[10px] text-emerald-300 font-mono">Synced to Gmail Extension</span>
        </motion.div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          1. KNOWLEDGE BASE TWO-TIER ARCHITECTURE EXPLAINER BANNER
      ───────────────────────────────────────────────────────────── */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-accent/15 via-elevated to-bg border border-accent/30 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm">🧠</span>
            <h4 className="text-xs font-bold uppercase tracking-wider text-accent-light font-mono">
              Deep Document Knowledge Base &amp; Auto-Macro Engine
            </h4>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            When you upload files, the AI indexes the <strong>entire document text into your vector knowledge base</strong> to answer complex, nuanced customer questions in Gmail. In addition, it extracts <strong>50 categorized, ready-to-use macros</strong> for 1-click team use.
          </p>
        </div>

        <div className="px-3.5 py-1.5 rounded-full bg-accent/20 border border-accent/40 text-accent-light text-[11px] font-bold font-mono shrink-0">
          🟢 Unlimited Knowledge Grounding
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. DRAG & DROP FILE UPLOAD DROPZONE
      ───────────────────────────────────────────────────────────── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`p-8 sm:p-10 rounded-3xl border-2 border-dashed transition-all text-center flex flex-col items-center justify-center relative overflow-hidden ${
          isDragging
            ? 'border-accent bg-accent/15 scale-[1.01]'
            : 'border-border/80 bg-elevated/70 hover:border-accent/50'
        }`}
      >
        {isProcessing ? (
          <div className="space-y-4 py-4">
            <div className="w-12 h-12 rounded-full border-3 border-accent border-t-transparent animate-spin mx-auto" />
            <div>
              <p className="text-sm font-bold text-text mb-1">AI Processing Knowledge Base File</p>
              <p className="text-xs text-accent-light font-mono animate-pulse">{processingStage}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="w-16 h-16 rounded-3xl bg-accent/20 border border-accent/40 flex items-center justify-center text-2xl text-accent-light mb-4 shadow-[0_0_20px_rgba(124,58,237,0.3)]">
              📄
            </div>

            <h3 className="text-base font-bold text-text mb-1">
              Drop Your Knowledge Base Files Here
            </h3>
            <p className="text-xs text-text-dim max-w-md mb-5">
              Supports <strong>PDF, Word (.docx), Excel (.xlsx / .csv), Markdown (.md), Text (.txt)</strong>.
              The AI analyzes all policies, FAQs, and pricing to auto-generate 50 structured macros.
            </p>

            <label className="px-6 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all cursor-pointer inline-flex items-center gap-2">
              <span>+ Select File from Computer</span>
              <input
                type="file"
                accept=".pdf,.docx,.doc,.xlsx,.csv,.md,.txt,.json"
                onChange={handleFileInput}
                className="hidden"
              />
            </label>

            {/* Quick Demo Upload Buttons */}
            <div className="mt-6 pt-4 border-t border-border/40 flex flex-wrap items-center justify-center gap-2 text-[11px] text-text-dim">
              <span>Or try sample files:</span>
              <button
                type="button"
                onClick={() => simulateFileUpload('Shopify_Store_Policy_&_Exchanges.pdf', 'PDF', '1.2 MB')}
                className="px-2.5 py-1 rounded-lg bg-bg border border-border hover:border-accent text-text-muted hover:text-text cursor-pointer"
              >
                + E-Commerce FAQ.pdf
              </button>
              <button
                type="button"
                onClick={() => simulateFileUpload('SaaS_Pricing_&_Security_Manual.docx', 'Word', '740 KB')}
                className="px-2.5 py-1 rounded-lg bg-bg border border-border hover:border-accent text-text-muted hover:text-text cursor-pointer"
              >
                + SaaS Docs.docx
              </button>
              <button
                type="button"
                onClick={() => simulateFileUpload('Support_Troubleshooting_Matrix.xlsx', 'Excel', '910 KB')}
                className="px-2.5 py-1 rounded-lg bg-bg border border-border hover:border-accent text-text-muted hover:text-text cursor-pointer"
              >
                + Support Matrix.xlsx
              </button>
            </div>
          </>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. INGESTED DOCUMENTS ROSTER (Deep Vector Knowledge Base)
      ───────────────────────────────────────────────────────────── */}
      <div className="rounded-3xl bg-elevated/70 border border-border/80 overflow-hidden shadow-lg">
        <div className="p-5 border-b border-border/40 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-text">Ingested Knowledge Base Documents</h3>
            <p className="text-[11px] text-text-dim">
              Full text of these documents is active in the Gmail AI draft engine
            </p>
          </div>
          <span className="text-xs text-emerald-400 font-mono font-semibold">
            ● {docs.length} Documents Active ({docs.reduce((acc, d) => acc + d.chunksCount, 0)} Chunks)
          </span>
        </div>

        <div className="divide-y divide-border/40 text-xs">
          {docs.map((doc) => (
            <div key={doc.id} className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center font-bold text-accent-light text-sm shrink-0">
                  {doc.type === 'PDF' && '📕'}
                  {doc.type === 'Excel' && '📊'}
                  {doc.type === 'Word' && '📘'}
                  {doc.type === 'Markdown' && '📝'}
                  {doc.type === 'JSON' && '⚙️'}
                  {doc.type === 'Text' && '📄'}
                </div>

                <div>
                  <p className="font-bold text-text text-xs sm:text-sm">{doc.name}</p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-dim mt-0.5 font-mono">
                    <span className="px-1.5 py-0.2 rounded bg-bg border border-border">{doc.type}</span>
                    <span>• {doc.size}</span>
                    <span>• {doc.chunksCount} Indexed Chunks</span>
                    <span>• {doc.extractedMacrosCount} Auto-Generated Macros</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>{doc.status}</span>
                </span>

                <button
                  onClick={() => handleDeleteDoc(doc.id)}
                  className="text-red-400 hover:text-red-300 text-xs font-medium cursor-pointer p-1"
                  title="Remove document"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
