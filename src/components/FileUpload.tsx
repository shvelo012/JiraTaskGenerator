import React, { useState, useRef } from 'react';

interface DocData {
  text: string;
  fileName: string;
  filePath: string;
  images: string[];
}

interface StatusMsg {
  type: 'loading' | 'success' | 'error';
  msg: string;
}

interface SelectedFile {
  name: string;
  path: string;
}

interface Props {
  onFileParsed: (data: DocData | null) => void;
}

export default function FileUpload({ onFileParsed }: Props) {
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [status, setStatus] = useState<StatusMsg | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const processFile = async (filePath: string) => {
    const name = filePath.split(/[\\/]/).pop() ?? filePath;
    setSelectedFile({ name, path: filePath });
    setStatus({ type: 'loading', msg: 'Parsing DOCX file…' });

    const result = await window.electronAPI.parseDocx(filePath);

    if (result.success) {
      const imageMsg = result.images.length > 0 ? ` ${result.images.length} image${result.images.length !== 1 ? 's' : ''} found.` : '';
      setStatus({
        type: 'success',
        msg: `Parsed successfully. ${result.text.length.toLocaleString()} characters extracted.${imageMsg}`,
      });
      onFileParsed({ text: result.text, fileName: name, filePath, images: result.images });
    } else {
      setStatus({ type: 'error', msg: result.error || 'Failed to parse file.' });
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    const docx = files.find((f) => f.name.endsWith('.docx'));
    if (!docx) {
      setStatus({ type: 'error', msg: 'Please drop a .docx file.' });
      return;
    }
    processFile((docx as File & { path: string }).path);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!dropRef.current?.contains(e.relatedTarget as Node)) {
      setDragging(false);
    }
  };

  const handleBrowse = async () => {
    const filePath = await window.electronAPI.openFileDialog();
    if (filePath) {
      processFile(filePath);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setStatus(null);
    onFileParsed(null);
  };

  return (
    <div>
      {!selectedFile ? (
        <div
          ref={dropRef}
          className={`upload-zone ${dragging ? 'dragover' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleBrowse}
        >
          <span className="upload-icon">&#128196;</span>
          <h3>Drop your DOCX file here</h3>
          <p>Or click to browse your files</p>
          <button
            className="browse-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleBrowse();
            }}
          >
            &#128193; Browse Files
          </button>
        </div>
      ) : (
        <div className="file-selected-card">
          <span className="file-icon">&#128196;</span>
          <div className="file-info">
            <div className="file-name">{selectedFile.name}</div>
            <div className="file-path">{selectedFile.path}</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleReset}>
            Change File
          </button>
        </div>
      )}

      {status && (
        <div className={`status-bar ${status.type}`}>
          {status.type === 'loading' && <div className="spinner" />}
          {status.type === 'success' && <span>&#10003;</span>}
          {status.type === 'error' && <span>&#9888;</span>}
          <span>{status.msg}</span>
        </div>
      )}
    </div>
  );
}
