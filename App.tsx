import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileUpload } from './components/FileUpload';
import { Controls } from './components/Controls';
import { parseMangaFile, blobUrlToBase64 } from './services/fileParser';
import { analyzeBatch } from './services/geminiService';
import { MangaPage, ReaderState, TranscriptionCache } from './types';
import { Loader2, AlertCircle, Volume2, XCircle, Mic } from 'lucide-react';

// Reduced batch size to 2 to prevent timeouts and ensure higher quality extraction
const BATCH_SIZE = 2;

function App() {
  const [status, setStatus] = useState<ReaderState>(ReaderState.IDLE);
  const [pages, setPages] = useState<MangaPage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cache, setCache] = useState<TranscriptionCache>({});
  // Track failed pages to avoid infinite retries
  const [failedPages, setFailedPages] = useState<Set<number>>(new Set());
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const speakingRef = useRef<boolean>(false);

  const handleFileSelect = async (file: File) => {
    setStatus(ReaderState.LOADING_FILE);
    try {
      const extractedPages = await parseMangaFile(file);
      if (extractedPages.length === 0) {
        setErrorMessage("No images found in the archive.");
        setStatus(ReaderState.IDLE);
        return;
      }
      setPages(extractedPages);
      setStatus(ReaderState.READING);
    } catch (e) {
      console.error(e);
      setErrorMessage("Failed to load file. Please ensure it is a valid .cbz or .zip.");
      setStatus(ReaderState.IDLE);
    }
  };

  const goToPage = useCallback((index: number) => {
    window.speechSynthesis.cancel();
    speakingRef.current = false;
    
    if (index >= 0 && index < pages.length) {
      setCurrentIndex(index);
    } else if (index >= pages.length) {
      setIsPlaying(false);
    }
  }, [pages.length]);

  const handleNext = useCallback(() => {
    goToPage(currentIndex + 1);
  }, [currentIndex, goToPage]);

  const handlePrev = useCallback(() => {
    goToPage(currentIndex - 1);
  }, [currentIndex, goToPage]);

  const performBatchAnalysis = useCallback(async (startIndex: number) => {
    if (isAnalyzing) return;
    
    const pagesToAnalyze: { base64: string; index: number }[] = [];
    
    // Look ahead to find pages that need analysis
    // We try to fill the batch, skipping already cached/failed ones
    let searchedCount = 0;
    let currentSearchIndex = startIndex;
    
    while (pagesToAnalyze.length < BATCH_SIZE && searchedCount < BATCH_SIZE * 2 && currentSearchIndex < pages.length) {
        const idx = currentSearchIndex;
        if (!cache[idx] && !failedPages.has(idx)) {
            try {
                const b64 = await blobUrlToBase64(pages[idx].url);
                pagesToAnalyze.push({ base64: b64, index: idx });
            } catch (e) {
                console.error(`Failed to load image for page ${idx}`, e);
            }
        }
        currentSearchIndex++;
        searchedCount++;
    }

    if (pagesToAnalyze.length === 0) return;

    setIsAnalyzing(true);
    try {
        const results = await analyzeBatch(pagesToAnalyze);
        
        // Update cache with results
        if (results.size > 0) {
            setCache(prev => {
                const newCache = { ...prev };
                results.forEach((text, idx) => {
                    newCache[idx] = text;
                });
                return newCache;
            });
        } else {
            // If result is empty map, it means analysis failed or no text found.
            // Mark these pages as failed to stop retry loop
            setFailedPages(prev => {
                const newFailed = new Set(prev);
                pagesToAnalyze.forEach(p => newFailed.add(p.index));
                return newFailed;
            });
            
            if (!isPlaying) {
                 setErrorMessage("Analysis failed. Please check your API Key or try again.");
            }
        }

    } catch (e) {
        console.error("Batch analysis failed", e);
        setFailedPages(prev => {
            const newFailed = new Set(prev);
            pagesToAnalyze.forEach(p => newFailed.add(p.index));
            return newFailed;
        });
    } finally {
        setIsAnalyzing(false);
    }
  }, [pages, cache, isAnalyzing, failedPages, isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
        window.speechSynthesis.cancel();
        return;
    }

    const currentText = cache[currentIndex];

    // 1. Text Available: Speak
    if (currentText && !speakingRef.current) {
        speakingRef.current = true;
        const isShort = currentText.length < 5;
        const utterance = new SpeechSynthesisUtterance(currentText);
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || voices[0];
        if (preferredVoice) utterance.voice = preferredVoice;
        utterance.rate = 1.0;
        
        utterance.onend = () => {
            speakingRef.current = false;
            setTimeout(() => {
                if (isPlaying) handleNext();
            }, isShort ? 500 : 1500);
        };
        
        utterance.onerror = () => {
             speakingRef.current = false;
             if (isPlaying) handleNext();
        };

        window.speechSynthesis.speak(utterance);
    }
    // 2. No Text & Not Analyzing & Not Failed: Fetch
    else if (!currentText && !isAnalyzing && !failedPages.has(currentIndex)) {
        performBatchAnalysis(currentIndex);
    }
    // 3. Failed: Skip
    else if (failedPages.has(currentIndex) && !speakingRef.current) {
        // Skip this page after a brief delay
        const timer = setTimeout(() => {
            if (isPlaying) handleNext();
        }, 2000);
        return () => clearTimeout(timer);
    }

    // Pre-fetch next pages while current is reading
    if (currentText && !isAnalyzing) {
        // Simple check: is the immediate next page missing?
        const nextIdx = currentIndex + 1;
        if (nextIdx < pages.length && !cache[nextIdx] && !failedPages.has(nextIdx)) {
            performBatchAnalysis(nextIdx);
        }
    }

  }, [isPlaying, currentIndex, cache, isAnalyzing, handleNext, performBatchAnalysis, failedPages, pages.length]);

  const handleManualAnalyze = () => {
    // Retry failed pages if manually triggered
    if (failedPages.has(currentIndex)) {
        setFailedPages(prev => {
            const next = new Set(prev);
            next.delete(currentIndex);
            return next;
        });
    }
    performBatchAnalysis(currentIndex);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (status !== ReaderState.READING) return;
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === ' ') {
          e.preventDefault();
          setIsPlaying(p => !p);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, handleNext, handlePrev]);

  if (status === ReaderState.IDLE || status === ReaderState.LOADING_FILE) {
    return <FileUpload onFileSelect={handleFileSelect} isLoading={status === ReaderState.LOADING_FILE} />;
  }

  const currentPageData = pages[currentIndex];
  const currentTranscription = cache[currentIndex];
  const hasFailed = failedPages.has(currentIndex);

  return (
    <div className="relative min-h-screen bg-black flex flex-col items-center overflow-hidden font-sans">
      
      {/* Clean View: No Text Overlay. Only subtle status indicators. */}
      <div className="absolute top-4 right-4 z-40 flex flex-col gap-2 pointer-events-none">
          {isPlaying && (
              <div className="bg-green-500/20 backdrop-blur-md border border-green-500/50 text-green-200 px-4 py-2 rounded-full flex items-center gap-2 shadow-lg animate-pulse">
                  <Volume2 className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Auto-Reading</span>
              </div>
          )}
          {isAnalyzing && (
              <div className="bg-indigo-500/20 backdrop-blur-md border border-indigo-500/50 text-indigo-200 px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs font-bold uppercase tracking-wider">Extracting...</span>
              </div>
          )}
           {hasFailed && (
              <div className="bg-red-500/20 backdrop-blur-md border border-red-500/50 text-red-200 px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
                  <XCircle className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Extraction Failed</span>
              </div>
          )}
      </div>

      <div className="flex-1 w-full h-full flex items-center justify-center p-4 pb-24 pt-4">
        <img 
            src={currentPageData.url} 
            alt={`Page ${currentIndex + 1}`}
            className="max-h-full max-w-full object-contain shadow-2xl" 
        />
      </div>

      {errorMessage && (
        <div className="absolute top-24 right-4 bg-red-900/90 text-red-200 px-6 py-4 rounded-xl flex items-center gap-3 z-50 shadow-xl border border-red-700 animate-bounce">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="ml-2 hover:text-white font-bold">×</button>
        </div>
      )}

      <Controls 
        currentIndex={currentIndex}
        totalLength={pages.length}
        isPlaying={isPlaying}
        isAnalyzing={isAnalyzing}
        hasAnalysis={!!currentTranscription}
        onPrev={handlePrev}
        onNext={handleNext}
        onSeek={goToPage}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        onAnalyze={handleManualAnalyze}
      />
    </div>
  );
}

export default App;