import React, { useState, useCallback, useRef } from 'react';
import { Trash2, Download, Zap, Image as ImageIcon, AlertCircle, X, FileType, Monitor, Smartphone, HardDrive, Video, Clock, Repeat, Upload, Copy, Check, Music, FileText, FileUp, ShieldAlert, ClipboardPaste } from 'lucide-react';
import { processBase64Input, downloadImage, downloadText, formatBytes, getBase64Size, getAspectRatio, formatDuration } from './utils';

type Mode = 'decode' | 'encode';

const App: React.FC = () => {
  const [mode, setMode] = useState<Mode>('decode');
  
  // Shared State
  const [input, setInput] = useState<string>(''); // Stores Base64 string (Input for Decode, Output for Encode)
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);

  // Decode Mode State
  const [mediaSrc, setMediaSrc] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ ext: string, mime: string, type: 'image' | 'video' | 'audio' } | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number; ratio: string } | null>(null);
  const [duration, setDuration] = useState<string | null>(null);
  
  // Refs
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement | HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const txtInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setInput('');
    setMediaSrc(null);
    setFileInfo(null);
    setFileSize(null);
    setDimensions(null);
    setDuration(null);
    setError(null);
    setCopied(false);
  }, []);

  const handleEraseTraces = useCallback(async () => {
    if (window.confirm("ERASE ALL DATA?\n\nThis will clear your inputs, clipboard, browser caches for this site, and reload a fresh session. This action cannot be undone.")) {
        // 1. Clear State
        resetState();
        
        // 2. Clear Refs
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (txtInputRef.current) txtInputRef.current.value = '';

        // 3. Clear Storage
        localStorage.clear();
        sessionStorage.clear();
        
        // 4. Attempt to clear Clipboard
        try {
            await navigator.clipboard.writeText('');
        } catch (e) {
            // Ignore clipboard errors
        }

        // 5. Clear Caches (if supported)
        if ('caches' in window) {
            try {
                const names = await caches.keys();
                await Promise.all(names.map(name => caches.delete(name)));
            } catch (e) {
                // Ignore cache errors
            }
        }

        // 6. Force Reload
        window.location.reload();
    }
  }, [resetState]);

  const toggleMode = useCallback(() => {
    resetState();
    setMode(prev => prev === 'decode' ? 'encode' : 'decode');
  }, [resetState]);

  // --- Decode Logic ---
  const handleConvert = useCallback(() => {
    setError(null);
    if (!input.trim()) {
      setError("Please enter a Base64 string first.");
      return;
    }

    try {
      const { src, ext, mime, type } = processBase64Input(input);
      const sizeBytes = getBase64Size(src);
      
      setMediaSrc(src);
      setFileInfo({ ext, mime, type });
      setFileSize(formatBytes(sizeBytes));
      setDimensions(null);
      setDuration(null);
    } catch (err) {
      setError("Failed to process Base64 string.");
    }
  }, [input]);

  const handlePaste = async () => {
    try {
        const text = await navigator.clipboard.readText();
        if (text) {
            setInput(text);
            setError(null);
        }
    } catch (err) {
        setError("Failed to read clipboard. Please paste manually.");
    }
  };

  const handleTxtUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        if (ev.target?.result) {
            setInput(ev.target.result as string);
            setError(null);
        }
    };
    reader.onerror = () => setError("Failed to read text file.");
    reader.readAsText(file);
    
    // Reset value to allow re-uploading same file if needed
    e.target.value = '';
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    const ratio = getAspectRatio(width, height);
    setDimensions({ width, height, ratio });
  };

  const handleVideoLoad = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const width = video.videoWidth;
    const height = video.videoHeight;
    const ratio = getAspectRatio(width, height);
    setDimensions({ width, height, ratio });
    setDuration(formatDuration(video.duration));
  };

  const handleAudioLoad = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    setDuration(formatDuration(audio.duration));
    setDimensions(null); // Audio has no dimensions
  };

  const handleSave = useCallback(() => {
    if (mediaSrc && fileInfo) {
      downloadImage(mediaSrc, `file-${Date.now()}.${fileInfo.ext}`);
    }
  }, [mediaSrc, fileInfo]);

  // --- Encode Logic ---
  const handleFileUpload = useCallback((file: File) => {
    // Reset previous errors/state
    setError(null);
    setCopied(false);

    // Validate type (Image, Video, or Audio)
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
        // Fallback check for common audio files that might have missing mime types in some browsers
        const ext = file.name.split('.').pop()?.toLowerCase();
        const validExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'];
        if (!ext || !validExts.includes(ext)) {
            setError("Please upload a valid image, video, or audio file.");
            return;
        }
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const result = e.target?.result as string;
        // In encode mode, 'input' state holds the result Base64
        setInput(result);
        
        // Calculate size for display purposes immediately
        const sizeBytes = getBase64Size(result);
        setFileSize(formatBytes(sizeBytes));
        
        // Determine type for info
        let type: 'image' | 'video' | 'audio' = 'image';
        if (file.type.startsWith('video/')) type = 'video';
        if (file.type.startsWith('audio/')) type = 'audio';
        
        // Refine type if MIME is empty but extension suggests audio
        if (type === 'image' && (file.name.endsWith('.mp3') || file.name.endsWith('.wav'))) {
            type = 'audio';
        }

        setFileInfo({ 
            ext: file.name.split('.').pop() || 'dat', 
            mime: file.type || 'application/octet-stream', 
            type 
        });
    };
    reader.onerror = () => setError("Failed to read file.");
    reader.readAsDataURL(file);
  }, []);

  const handleCopy = async () => {
    if (!input) return;
    try {
      await navigator.clipboard.writeText(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError("Failed to copy to clipboard.");
    }
  };

  const handleSaveText = useCallback(() => {
    if (!input) return;
    const name = fileInfo ? `${fileInfo.ext.toUpperCase()}_Base64` : 'Base64_Output';
    downloadText(input, `${name}-${Date.now()}.txt`);
  }, [input, fileInfo]);

  // --- Shared Event Handlers ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (mode === 'decode') {
        const textData = e.dataTransfer.getData('text');
        if (textData) setInput(textData);
    } else {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleFileUpload(files[0]);
        }
    }
  };

  // Helper for render icon
  const renderIcon = () => {
      if (fileInfo?.type === 'video') return <Video className="w-5 h-5"/>;
      if (fileInfo?.type === 'audio') return <Music className="w-5 h-5"/>;
      return <ImageIcon className="w-5 h-5" />;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-zinc-950 text-zinc-100 font-sans selection:bg-zinc-700 selection:text-white relative">
      
      {/* Erase My Traces - Top Left */}
      <div className="absolute top-6 left-6 z-50">
        <button
          onClick={handleEraseTraces}
          className="group flex items-center space-x-2 px-4 py-2 rounded-full bg-red-950/30 border border-red-900/50 hover:border-red-500 hover:bg-red-900/50 transition-all text-sm font-bold text-red-400 hover:text-red-200 shadow-xl"
          title="Clear all local data and reload"
        >
          <ShieldAlert className="w-4 h-4 group-hover:scale-110 transition-transform" />
          <span>Erase my traces!</span>
        </button>
      </div>

      {/* Mode Switcher - Top Right */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={toggleMode}
          className="flex items-center space-x-2 px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 hover:border-zinc-500 hover:bg-zinc-800 transition-all text-sm font-medium text-zinc-400 hover:text-zinc-200 shadow-xl"
        >
          <Repeat className="w-4 h-4" />
          <span>Switch to {mode === 'decode' ? 'Encode' : 'Decode'}</span>
        </button>
      </div>

      <div className="w-full max-w-4xl space-y-8 relative">
        
        {/* Header */}
        <header className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-4 bg-zinc-900 rounded-2xl mb-4 border border-zinc-800 shadow-xl shadow-black/50">
            <Zap className="w-8 h-8 text-white fill-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
            Big Base64 Converter
          </h1>
          <p className="text-zinc-500 max-w-lg mx-auto text-lg">
            {mode === 'decode' 
              ? "Convert Base64 strings to images, videos, or audio securely."
              : "Convert media files to Base64 strings instantly. No server uploads."
            }
          </p>
        </header>

        {/* Main Content Area */}
        <main className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* Left Column */}
          <section className="flex flex-col space-y-4 h-full">
            
            {/* Input Area */}
            <div 
              className={`
                relative flex-grow flex flex-col bg-zinc-900/50 rounded-xl border-2 transition-all duration-200
                ${isDragging ? 'border-zinc-400 bg-zinc-900 shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'border-zinc-800 hover:border-zinc-700'}
                ${mode === 'decode' && mediaSrc ? 'h-48 lg:h-auto' : 'h-96'}
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {mode === 'decode' ? (
                <>
                  <div className="absolute top-4 left-4 flex items-center space-x-2 text-xs font-bold text-zinc-500 tracking-widest uppercase">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-500"></div>
                    <span>Input Base64</span>
                  </div>
                  <textarea
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Paste your Base64 string here..."
                    className="w-full h-full bg-transparent p-6 pt-12 text-sm font-mono text-zinc-300 placeholder-zinc-700 focus:outline-none resize-none rounded-xl"
                    spellCheck={false}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                  />
                  {input && (
                    <button 
                      onClick={() => setInput('')}
                      className="absolute top-4 right-4 p-1 text-zinc-600 hover:text-zinc-200 transition-colors"
                      title="Clear text"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {/* Bottom Right Actions: Paste & Load TXT */}
                  <div className="absolute bottom-4 right-4 flex items-center space-x-2">
                     <button
                        onClick={handlePaste}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
                        title="Paste from clipboard"
                     >
                        <ClipboardPaste className="w-3.5 h-3.5" />
                        <span>Paste</span>
                     </button>
                     <button
                        onClick={() => txtInputRef.current?.click()}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
                     >
                        <FileUp className="w-3.5 h-3.5" />
                        <span>Load TXT</span>
                     </button>
                     <input 
                        ref={txtInputRef} 
                        type="file" 
                        accept=".txt" 
                        hidden 
                        onChange={handleTxtUpload} 
                     />
                  </div>
                </>
              ) : (
                <div 
                  className="w-full h-full flex flex-col items-center justify-center cursor-pointer group text-center px-6"
                  onClick={() => fileInputRef.current?.click()}
                >
                   <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*,video/*,audio/*,.mp3,.wav,.aac,.flac,.ogg,.wma,.m4a"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleFileUpload(e.target.files[0]);
                        }
                      }}
                   />
                   <div className="w-24 h-24 rounded-full bg-zinc-900 border border-zinc-700 group-hover:border-zinc-500 group-hover:bg-zinc-800 transition-all flex items-center justify-center mb-6 shadow-inner">
                      <Upload className="w-10 h-10 text-zinc-500 group-hover:text-zinc-200 transition-colors" />
                   </div>
                   <p className="text-zinc-300 font-semibold text-lg">Click to Upload</p>
                   <p className="text-zinc-500 text-sm mt-1">or drag and drop file here</p>
                   <div className="mt-4 flex flex-wrap justify-center gap-1.5 max-w-[80%]">
                      {['PNG', 'JPG', 'GIF', 'MP4', 'WEBM', 'MP3', 'WAV', 'FLAC'].map(ext => (
                          <span key={ext} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700">
                              {ext}
                          </span>
                      ))}
                   </div>
                </div>
              )}
            </div>

            {/* Action Button (Only for Decode Mode) */}
            {mode === 'decode' && (
              <button
                onClick={handleConvert}
                disabled={!input || !!mediaSrc}
                className={`
                  w-full py-4 px-6 rounded-xl font-bold text-lg shadow-lg transition-all transform
                  flex items-center justify-center space-x-2
                  ${!input || mediaSrc
                    ? 'bg-zinc-800 cursor-not-allowed text-zinc-600'
                    : 'bg-zinc-100 text-zinc-950 hover:bg-white hover:scale-[1.01] active:scale-[0.99] shadow-zinc-900/50'
                  }
                `}
              >
                {renderIcon()}
                <span>Convert</span>
              </button>
            )}
            
            {error && (
              <div className="bg-red-950/30 border border-red-900/50 text-red-200 px-4 py-3 rounded-lg flex items-start space-x-3 text-sm animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </section>

          {/* Right Column */}
          <section className={`
            flex flex-col h-full bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden relative transition-all duration-500 shadow-2xl
            ${(mode === 'decode' && mediaSrc) || (mode === 'encode' && input) ? 'opacity-100 translate-y-0' : 'opacity-50 translate-y-4 lg:translate-y-0 lg:opacity-100'}
          `}>
             <div className="absolute top-4 left-4 flex items-center space-x-2 text-xs font-bold text-zinc-500 tracking-widest uppercase z-10">
                <div className={`w-1.5 h-1.5 rounded-full ${(mediaSrc || (mode === 'encode' && input)) ? 'bg-emerald-500' : 'bg-zinc-600'}`}></div>
                <span>{mode === 'decode' ? 'Preview' : 'Base64 Output'}</span>
                {fileInfo && (
                  <span className="ml-2 px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700 flex items-center gap-1 font-mono">
                    <FileType className="w-3 h-3" />
                    {fileInfo.ext.toUpperCase()}
                  </span>
                )}
              </div>

            {/* Mode: Decode - Show Media Preview */}
            {mode === 'decode' && mediaSrc && (
              <div className="flex flex-col h-full">
                <div className="flex-grow flex items-center justify-center p-8 overflow-auto bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] min-h-[300px]">
                  {fileInfo?.type === 'video' ? (
                     <video
                     ref={mediaRef as React.RefObject<HTMLVideoElement>}
                     src={mediaSrc}
                     controls
                     className="max-w-full max-h-[50vh] shadow-2xl rounded-lg ring-1 ring-white/10"
                     onLoadedMetadata={handleVideoLoad}
                     onError={() => setError("Media could not be loaded")}
                   />
                  ) : fileInfo?.type === 'audio' ? (
                    <div className="w-full max-w-sm bg-zinc-800 p-6 rounded-2xl border border-zinc-700 shadow-xl flex flex-col items-center space-y-4">
                        <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center border-2 border-zinc-700">
                             <Music className="w-8 h-8 text-zinc-400" />
                        </div>
                        <audio
                            ref={mediaRef as React.RefObject<HTMLAudioElement>}
                            src={mediaSrc}
                            controls
                            className="w-full"
                            onLoadedMetadata={handleAudioLoad}
                            onError={() => setError("Audio could not be loaded")}
                        />
                    </div>
                  ) : (
                    <img 
                      ref={mediaRef as React.RefObject<HTMLImageElement>}
                      src={mediaSrc} 
                      alt="Converted Result" 
                      className="max-w-full max-h-[50vh] object-contain shadow-2xl rounded-lg ring-1 ring-white/10"
                      onLoad={handleImageLoad}
                      onError={() => setError("Media could not be loaded")}
                    />
                  )}
                </div>
                
                {/* Media Details */}
                {(dimensions || fileSize) && (
                  <div className={`px-6 py-5 bg-zinc-950 border-t border-zinc-800 grid gap-4 ${fileInfo?.type !== 'image' ? 'grid-cols-3' : 'grid-cols-3'}`}>
                    
                    {/* Size - Always shown */}
                    <div className="flex flex-col items-center justify-center text-center space-y-1">
                      <div className="flex items-center space-x-1.5 text-xs font-bold text-zinc-500 uppercase tracking-wide">
                        <HardDrive className="w-3 h-3" />
                        <span>Size</span>
                      </div>
                      <span className="text-zinc-200 font-mono text-sm">
                        {fileSize || '...'}
                      </span>
                    </div>

                    {/* Dimensions - Only for Image/Video */}
                    {fileInfo?.type !== 'audio' && (
                        <>
                        <div className="flex flex-col items-center justify-center text-center space-y-1 border-l border-zinc-800">
                            <div className="flex items-center space-x-1.5 text-xs font-bold text-zinc-500 uppercase tracking-wide">
                                <Monitor className="w-3 h-3" />
                                <span>Res</span>
                            </div>
                            <span className="text-zinc-200 font-mono text-sm">
                                {dimensions ? `${dimensions.width}×${dimensions.height}` : '-'}
                            </span>
                        </div>
                        
                        <div className="flex flex-col items-center justify-center text-center space-y-1 border-l border-zinc-800">
                            <div className="flex items-center space-x-1.5 text-xs font-bold text-zinc-500 uppercase tracking-wide">
                                <Smartphone className="w-3 h-3" />
                                <span>Ratio</span>
                            </div>
                            <span className="text-zinc-200 font-mono text-sm">
                                {dimensions ? dimensions.ratio : '-'}
                            </span>
                        </div>
                        </>
                    )}

                    {/* Time - Only for Audio/Video */}
                    {(fileInfo?.type === 'video' || fileInfo?.type === 'audio') && (
                       <div className={`flex flex-col items-center justify-center text-center space-y-1 ${fileInfo?.type === 'video' ? 'border-l border-zinc-800' : 'col-span-2 border-l border-zinc-800'}`}>
                       <div className="flex items-center space-x-1.5 text-xs font-bold text-zinc-500 uppercase tracking-wide">
                         <Clock className="w-3 h-3" />
                         <span>Duration</span>
                       </div>
                       <span className="text-zinc-200 font-mono text-sm">
                         {duration || '...'}
                       </span>
                     </div>
                    )}
                  </div>
                )}

                <div className="p-4 bg-zinc-900 border-t border-zinc-800 grid grid-cols-2 gap-4">
                  <button
                    onClick={resetState}
                    className="flex items-center justify-center space-x-2 px-4 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors hover:text-white"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Discard</span>
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex items-center justify-center space-x-2 px-4 py-3 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4" />
                    <span>Save {fileInfo ? fileInfo.ext.toUpperCase() : 'File'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Mode: Encode - Show Base64 Output */}
            {mode === 'encode' && input && (
              <div className="flex flex-col h-full">
                <textarea
                  readOnly
                  value={input}
                  className="flex-grow w-full bg-zinc-950 p-6 pt-12 text-sm font-mono text-zinc-300 placeholder-zinc-700 focus:outline-none resize-none"
                  spellCheck={false}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                />
                 {/* Encode Details Bar */}
                 {fileSize && (
                  <div className="px-6 py-2 bg-zinc-900 border-t border-zinc-800 flex justify-between items-center text-xs">
                    <span className="text-zinc-500 uppercase font-bold tracking-wider">File Size:</span>
                    <span className="text-zinc-300 font-mono">{fileSize}</span>
                  </div>
                )}
                
                <div className="p-4 bg-zinc-900 border-t border-zinc-800 grid grid-cols-3 gap-3">
                  <button
                    onClick={resetState}
                    className="flex items-center justify-center space-x-2 px-4 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors hover:text-white"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                   <button
                    onClick={handleSaveText}
                    className="flex items-center justify-center space-x-2 px-4 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors hover:text-white"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Save TXT</span>
                  </button>
                  <button
                    onClick={handleCopy}
                    className={`
                      flex items-center justify-center space-x-2 px-4 py-3 rounded-lg font-bold shadow-lg transition-all
                      ${copied 
                        ? 'bg-emerald-600 text-white shadow-emerald-900/20' 
                        : 'bg-zinc-100 hover:bg-white text-zinc-900 shadow-zinc-900/50 hover:scale-[1.02] active:scale-[0.98]'
                      }
                    `}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Empty State / Placeholder */}
            {((mode === 'decode' && !mediaSrc) || (mode === 'encode' && !input)) && (
               <div className="flex-grow flex flex-col items-center justify-center p-12 text-zinc-600 space-y-4 min-h-[300px]">
               <div className="w-24 h-24 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                 {mode === 'decode' 
                    ? <ImageIcon className="w-10 h-10 opacity-30" />
                    : <Monitor className="w-10 h-10 opacity-30" />
                 }
               </div>
               <p className="text-sm font-medium opacity-50">
                 {mode === 'decode' ? 'Preview will appear here' : 'Base64 code will appear here'}
               </p>
             </div>
            )}
          </section>

        </main>
      </div>
    </div>
  );
};

export default App;