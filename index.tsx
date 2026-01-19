
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Upload, FileText, Send, Loader2, 
  Download, Mic, Volume2, StopCircle, Zap, 
  CheckCircle, ArrowRight, MessageSquare, Briefcase, 
  Bot, X, File, BrainCircuit, Sparkles, Copy, Trash2,
  Code2, Terminal, Cpu, Database as DbIcon, Search, ListFilter,
  Info, Radio, Ghost, ChevronLeft, ChevronRight, Maximize2, User,
  Activity, MessageCircle, MicOff, UserRound, Headphones, Play, Pause,
  Phone, Mail, Linkedin, Github, ExternalLink, AlertCircle, RefreshCcw,
  FileDown, WifiOff, Ear
} from 'lucide-react';
import { GoogleGenAI, Modality, LiveServerMessage, Type } from "@google/genai";

// --- Types ---
interface BotSolution {
  solutionOverview: string;
  detailedActions: string;
  excelVbaCode: string;
  pythonCode: string;
  testingValidation: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

// --- Constants ---
const API_COOLDOWN = 2000; // 2 seconds
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const AA_KNOWLEDGE = `
=== AUTOMATION ANYWHERE A360 COMPREHENSIVE ACTION & TRIGGER INVENTORY ===
PYTHON SCRIPT PACKAGE: Open, Execute script, Execute function, Close.
EXCEL ADVANCED PACKAGE: Open, Close, Save, Save as, Create workbook, Get cells, Get multiple cells, Set cell, Delete cell, Find/Replace, Go to cell, Insert/Delete rows/columns, Filter table, Clear filter, Create table, Rename worksheet, Activate worksheet, Get worksheet names, Protect/Unprotect sheet, Append worksheet, Run macro.
EXCEL BASIC PACKAGE: Open, Close, Set cell, Get cell, Get multiple cells, Set cells, Insert/Delete rows/columns.
DATABASE PACKAGE: Connect, Disconnect, Export to data table, Insert/Update/Delete, Read from, Run stored procedure, Begin transaction, Commit, Rollback.
DATA TABLE PACKAGE: Assign, Clear, Filter, Insert column, Insert row, Remove column, Remove row, Set value, Get value, Get number of rows/cols, Join, Merge, Search, Sort, Write to file.
PDF PACKAGE: Extract text, Extract image, Merge documents, Split document, Encrypt/Decrypt, Form fields extraction, OCR.
DICTIONARY PACKAGE: Put, Get, Remove, Assign, Size, Clear.
LIST PACKAGE: Add item, Clear, Get item, Remove item, Set item, Size, Sort.
STRING PACKAGE: Assign, Compare, Extract text, Find, Length, Lower case/Upper case, Replace, Reverse, Split, Substring, Trim, To number.
WINDOW PACKAGE: Close, Maximize, Minimize, Resize, Set focus, Get title.
ERROR HANDLER: Try, Catch, Finally, Throw.
LOOP PACKAGE: Loop, Break, Continue. (Iterators: Excel, Database, Data Table, Dictionary, List, File, Folder, Windows, While, For n times).
RECORDER/UI AUTOMATION: Capture, Object properties, Set text, Click, Select item, Get property.
API/REST WEB SERVICES: GET, POST, PUT, DELETE, PATCH.
`;

const SYSTEM_PROMPT = `You are RKS Automation Architect - the ultimate Automation Anywhere (AA) A360 Logic Engine.
${AA_KNOWLEDGE}
CORE PRINCIPLES:
1. Solution Architecture: Design scalable, maintainable solutions.
2. Technology Selection: Choose appropriate AA packages.
3. Excel Automation: If needed, generate a ready-to-paste Excel VBA macro.

You must return a valid JSON object matching this schema:
{
  "solutionOverview": "High-level approach",
  "detailedActions": "Step-by-step AA A360 actions",
  "excelVbaCode": "Full VBA macro string (or empty if not needed)",
  "pythonCode": "Full Python script string (or empty if not needed)",
  "testingValidation": "Testing scenarios"
}`;

// --- UI Components ---
const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-white/5 rounded-xl ${className}`} />
);

const SolutionSkeleton = () => (
  <div className="space-y-8 animate-in fade-in duration-500">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="glass-card rounded-3xl p-8 border-white/10 h-fit space-y-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-6 w-1/3 mt-8" />
        <Skeleton className="h-64 w-full" />
      </div>
      <div className="space-y-8">
        <div className="glass-card rounded-3xl p-8 border-white/10 space-y-4">
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="glass-card rounded-3xl p-8 border-white/10 space-y-4">
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    </div>
  </div>
);

// --- Helpers ---
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const debounce = (fn: Function, delay: number) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

const RKSAssistant = () => {
  const [activeSection, setActiveSection] = useState<'bot-builder' | 'chat' | 'interview' | 'live-interview' | 'contact'>('bot-builder');
  const [isListening, setIsListening] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [lastApiCall, setLastApiCall] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Section States
  const [botInput, setBotInput] = useState(() => localStorage.getItem('botDraft') || '');
  const [botFile, setBotFile] = useState<File | null>(null);
  const [botLoading, setBotLoading] = useState(false);
  const [botError, setBotError] = useState<string | null>(null);
  const [botSolution, setBotSolution] = useState<BotSolution | null>(null);
  
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'assistant', content: string}[]>(() => {
    const saved = localStorage.getItem('chatHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [resume, setResume] = useState<File | null>(null);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewMessages, setInterviewMessages] = useState<{role: 'interviewer' | 'candidate', content: string}[]>([]);
  const [userAnswer, setUserAnswer] = useState('');
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewError, setInterviewError] = useState<string | null>(null);

  const [isLiveActive, setIsLiveActive] = useState(false);
  const [adviceHistory, setAdviceHistory] = useState<string[]>([]);
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'connecting' | 'active' | 'error'>('idle');
  const liveSessionRef = useRef<any>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [liveMode, setLiveMode] = useState<'standard' | 'you-me'>('standard');
  const [interviewerButtonState, setInterviewerButtonState] = useState<'idle' | 'listening'>('idle');

  // Refs for audio process stability
  const liveModeRef = useRef(liveMode);
  const interviewerButtonStateRef = useRef(interviewerButtonState);

  useEffect(() => { liveModeRef.current = liveMode; }, [liveMode]);
  useEffect(() => { interviewerButtonStateRef.current = interviewerButtonState; }, [interviewerButtonState]);

  // --- Offline Support ---
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addToast("You are back online.", "success");
    };
    const handleOffline = () => {
      setIsOnline(false);
      addToast("You are offline. Some features may not work.", "error");
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- Session Management ---
  useEffect(() => {
    localStorage.setItem('chatHistory', JSON.stringify(chatMessages));
  }, [chatMessages]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem('botDraft', botInput);
    }, 1000);
    return () => clearTimeout(timeout);
  }, [botInput]);

  // --- Toast Logic ---
  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // --- File Validation ---
  const validateFile = (file: File) => {
    const allowedTypes = ['image/', 'application/pdf', 'text/', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (file.size > MAX_FILE_SIZE) throw new Error('File too large (max 10MB)');
    if (!allowedTypes.some(type => file.type.startsWith(type) || file.type === type)) {
      throw new Error('Invalid file type. Supported: PDF, Images, Text, Word.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (f: File | null) => void) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      try {
        validateFile(file);
        setter(file);
        addToast(`File ${file.name} uploaded.`, 'success');
      } catch (err: any) {
        addToast(err.message, 'error');
        setter(null);
      }
    }
  };

  // --- API Rate Limiting Helper ---
  const checkRateLimit = () => {
    if (!isOnline) {
      addToast("Connection required to access AI features.", "error");
      return false;
    }
    const now = Date.now();
    if (now - lastApiCall < API_COOLDOWN) {
      addToast("Please wait a moment between requests.", "info");
      return false;
    }
    setLastApiCall(now);
    return true;
  };

  // --- API Handlers ---
  const handleGenerateBotSolution = async () => {
    if (!botInput.trim() && !botFile) return;
    if (!checkRateLimit()) return;

    setBotLoading(true);
    setBotError(null);
    setBotSolution(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const parts: any[] = [{ text: `Generate AA A360 architectural solution for: "${botInput}"` }];
      if (botFile) {
        const base64 = await fileToBase64(botFile);
        parts.push({ inlineData: { data: base64, mimeType: botFile.type } });
      }
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts },
        config: { 
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              solutionOverview: { type: Type.STRING },
              detailedActions: { type: Type.STRING },
              excelVbaCode: { type: Type.STRING },
              pythonCode: { type: Type.STRING },
              testingValidation: { type: Type.STRING }
            },
            required: ["solutionOverview", "detailedActions", "testingValidation"]
          }
        }
      });
      if (response.text) {
        setBotSolution(JSON.parse(response.text.trim()));
        addToast("Solution architected successfully!", "success");
      }
    } catch (e) { 
      setBotError("Failed to generate solution. Our AI engine encountered an error.");
      addToast("Failed to architect solution.", "error");
    } finally { 
      setBotLoading(false); 
    }
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    if (!checkRateLimit()) return;

    const input = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', content: input }]);
    setChatInput('');
    setChatLoading(true);
    setChatError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: input,
        config: { systemInstruction: "You are RKS Automation Architect. Provide technical depth on AA A360." }
      });
      setChatMessages(prev => [...prev, { role: 'assistant', content: response.text || "" }]);
    } catch (e) {
      setChatError("Message failed to send.");
      addToast("Chat error. Check connection.", "error");
    } finally { setChatLoading(false); }
  };

  const handleStartInterview = async () => {
    if (!resume) return;
    setInterviewStarted(true);
    setInterviewLoading(true);
    setInterviewError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const b64 = await fileToBase64(resume);
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: "Start A360 technical interview based on this resume." }, { inlineData: { data: b64, mimeType: resume.type } }] },
      });
      setInterviewMessages([{ role: 'interviewer', content: response.text || "Welcome. Let's begin." }]);
      addToast("Interview session started.", "success");
    } catch (e) {
      setInterviewError("Failed to initialize interview.");
      addToast("Interview system failed.", "error");
    } finally { setInterviewLoading(false); }
  };

  const handleSubmitInterviewAnswer = async () => {
    if (!userAnswer.trim() || interviewLoading) return;
    const answer = userAnswer;
    setInterviewMessages(prev => [...prev, { role: 'candidate', content: answer }]);
    setUserAnswer('');
    setInterviewLoading(true);
    setInterviewError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Previous context: ${interviewMessages.map(m => m.content).join('\n')}\nAnswer: ${answer}`,
      });
      setInterviewMessages(prev => [...prev, { role: 'interviewer', content: response.text || "" }]);
    } catch (e) {
      setInterviewError("Could not submit answer.");
      addToast("Response error.", "error");
    } finally { setInterviewLoading(false); }
  };

  // --- Solution Export ---
  const processedSolution = useMemo(() => {
    if (!botSolution) return null;
    return {
      ...botSolution,
      copyText: `
--------------------------------------------------
RKS AUTOMATION ARCHITECT - BOT SOLUTION
--------------------------------------------------
1. SOLUTION OVERVIEW: ${botSolution.solutionOverview}
2. DETAILED ACTIONS: ${botSolution.detailedActions}
3. VBA: ${botSolution.excelVbaCode || 'N/A'}
4. PYTHON: ${botSolution.pythonCode || 'N/A'}
5. TESTING: ${botSolution.testingValidation}
--------------------------------------------------
`.trim()
    };
  }, [botSolution]);

  const exportSolutionAsTxt = () => {
    if (!processedSolution) return;
    const blob = new Blob([processedSolution.copyText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RKS-A360-Solution-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    addToast("Solution exported as text file.", "success");
  };

  const copyWithAnimation = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast("Copied to clipboard!", "success");
    } catch (err) {
      addToast("Failed to copy.", "error");
    }
  };

  // --- Speech Recognition ---
  const recognitionRef = useRef<any>(null);
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        if (activeSection === 'bot-builder') setBotInput(prev => prev + ' ' + transcript);
        if (activeSection === 'chat') setChatInput(prev => prev + ' ' + transcript);
        if (activeSection === 'interview') setUserAnswer(prev => prev + ' ' + transcript);
        setIsListening(false);
      };
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, [activeSection]);

  const startListening = () => {
    if (recognitionRef.current) {
      setIsListening(true);
      recognitionRef.current.start();
    } else {
      addToast("Speech recognition not supported.", "error");
    }
  };

  // --- Live Logic ---
  const startLiveSession = async () => {
    if (isLiveActive) return;
    setSessionStatus('connecting');
    setIsLiveActive(true);
    setAdviceHistory(['🎯 RKS Live Copilot Active...']);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const analyser = inputCtx.createAnalyser(); analyser.fftSize = 256;
      analyserRef.current = analyser;
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setSessionStatus('active');
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptNode = inputCtx.createScriptProcessor(4096, 1, 1);
            source.connect(analyser);
            scriptNode.onaudioprocess = (e) => {
              // Check modes via refs to prevent stale closures
              const currentMode = liveModeRef.current;
              const currentInterviewerState = interviewerButtonStateRef.current;

              if (currentMode === 'standard' || (currentMode === 'you-me' && currentInterviewerState === 'listening')) {
                const data = e.inputBuffer.getChannelData(0);
                const int16 = new Int16Array(data.length);
                for (let i = 0; i < data.length; i++) int16[i] = data[i] * 32768;
                sessionPromise.then(s => s.sendRealtimeInput({ 
                  media: { data: btoa(String.fromCharCode(...new Uint8Array(int16.buffer))), mimeType: 'audio/pcm;rate=16000' } 
                }));
              }
            };
            source.connect(scriptNode); scriptNode.connect(inputCtx.destination);
          },
          onmessage: (m: any) => {
             if (m.serverContent?.outputTranscription) {
               setAdviceHistory(prev => {
                 const newHistory = [...prev];
                 if (newHistory.length > 0 && !newHistory[newHistory.length - 1].endsWith('\n')) {
                    newHistory[newHistory.length - 1] += m.serverContent.outputTranscription.text;
                 } else {
                    newHistory.push(m.serverContent.outputTranscription.text);
                 }
                 return newHistory;
               });
               if (m.serverContent.turnComplete) {
                 setAdviceHistory(prev => [...prev, '']);
               }
             }
          },
          onerror: () => setSessionStatus('error'),
          onclose: () => {
             setSessionStatus('idle');
             setIsLiveActive(false);
          }
        },
        config: { 
          responseModalities: [Modality.AUDIO], 
          outputAudioTranscription: {},
          systemInstruction: "You are RKS Live Interview Copilot. Identify: Senior Indian Technical Architect. Provide natural, authoritative advice for the candidate. Focus on Automation Anywhere A360."
        }
      });
      liveSessionRef.current = { stream, ctx: inputCtx, sessionPromise };
    } catch { setSessionStatus('error'); setIsLiveActive(false); }
  };

  const stopLiveSession = () => {
    if (liveSessionRef.current) {
      liveSessionRef.current.stream.getTracks().forEach((t: any) => t.stop());
      liveSessionRef.current.ctx.close();
      liveSessionRef.current = null;
    }
    setIsLiveActive(false);
    setSessionStatus('idle');
  };

  const toggleInterviewerListening = () => {
    setInterviewerButtonState(prev => prev === 'idle' ? 'listening' : 'idle');
  };

  return (
    <div className="min-h-screen pb-12 transition-colors duration-500 font-sans overflow-x-hidden bg-slate-950 text-slate-100 selection:bg-blue-500/30">
      {/* Toast Notifications */}
      <div className="fixed top-5 right-5 z-[100] flex flex-col gap-3 max-w-[calc(100vw-40px)]">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center gap-3 px-4 md:px-6 py-3 md:py-4 rounded-2xl shadow-2xl backdrop-blur-xl border animate-in slide-in-from-right-10 duration-300 ${toast.type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' : toast.type === 'error' ? 'bg-rose-500/20 text-rose-400 border-rose-500/20' : 'bg-blue-500/20 text-blue-400 border-blue-500/20'}`}>
            {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
            <span className="font-medium text-sm md:text-base">{toast.message}</span>
          </div>
        ))}
      </div>

      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-indigo-600/10 rounded-full blur-[100px] animate-pulse delay-700"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="flex flex-col items-center mb-8 md:mb-12 text-center relative">
          <div className="absolute top-0 right-0 flex gap-2">
            {!isOnline && (
              <div className="flex items-center gap-2 bg-rose-500/10 text-rose-500 px-3 py-2 rounded-xl border border-rose-500/20 animate-pulse">
                <WifiOff className="w-4 h-4" />
                <span className="text-xs font-bold uppercase hidden md:inline">Offline</span>
              </div>
            )}
          </div>

          <div className="mb-4 md:mb-6 relative group">
            <div className="absolute -inset-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full blur opacity-25 group-hover:opacity-60 transition duration-1000"></div>
            <div className="relative p-4 md:p-6 rounded-full border border-white/10 shadow-2xl bg-slate-900 transition-colors duration-500">
              <BrainCircuit className="w-10 h-10 md:w-14 md:h-14 text-blue-400" />
            </div>
          </div>
          <h1 className="text-3xl md:text-6xl font-black tracking-tight mb-2 uppercase">
            RKS<span className="text-blue-500">.</span>Automation Architect
          </h1>
          <p className="text-slate-400 text-sm md:text-lg max-w-2xl font-light italic">
            Architecting the future of Automation Anywhere with AI-powered <span className="text-blue-400 font-medium">bot design</span>.
          </p>
        </header>

        <nav className="flex flex-wrap justify-center gap-2 md:gap-4 mb-8 md:mb-10 p-2 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md w-full md:w-fit mx-auto shadow-2xl">
          {[
            { id: 'bot-builder', icon: Bot, label: 'Bot Architect', color: 'bg-blue-600' },
            { id: 'chat', icon: MessageSquare, label: 'Expert Chat', color: 'bg-indigo-600' },
            { id: 'interview', icon: Briefcase, label: 'Interview Prep', color: 'bg-emerald-600' },
            { id: 'live-interview', icon: Radio, label: 'Live Copilot', color: 'bg-rose-600' },
            { id: 'contact', icon: User, label: 'Contact', color: 'bg-slate-700' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`flex-1 md:flex-none flex flex-col items-center text-center gap-1 px-3 md:px-8 py-2 md:py-3 rounded-xl transition-all min-h-[44px] ${
                activeSection === tab.id ? `${tab.color} text-white shadow-xl shadow-blue-500/20 scale-105` : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs md:text-base">
                <tab.icon className="w-4 h-4 md:w-5 md:h-5" />
                <span className="hidden md:inline">{tab.label}</span>
              </div>
            </button>
          ))}
        </nav>

        <main className="touch-pan-y">
          {activeSection === 'bot-builder' && (
            <div className="grid gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="glass-card rounded-3xl p-4 md:p-8 border-white/10">
                <div className="relative mb-4">
                  <textarea
                    value={botInput}
                    onChange={(e) => setBotInput(e.target.value)}
                    placeholder="Describe your process requirement for A360..."
                    className="w-full h-48 md:h-64 p-4 md:p-6 border border-white/10 rounded-2xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all text-sm md:text-lg placeholder:text-slate-600 resize-none bg-black/40 text-slate-100"
                  />
                  <div className="absolute bottom-4 right-4 flex items-center gap-2">
                    <button onClick={isListening ? () => {} : startListening} className={`p-3 rounded-xl transition-all min-w-[44px] min-h-[44px] flex items-center justify-center border border-white/10 ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white/10 hover:bg-white/20'}`}>
                      {isListening ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                    <label className="p-3 bg-white/10 hover:bg-white/20 rounded-xl cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center border border-white/10">
                      <Upload className="w-5 h-5" />
                      <input type="file" onChange={(e) => handleFileChange(e, setBotFile)} className="hidden" />
                    </label>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 md:gap-4 items-center">
                  <button
                    onClick={handleGenerateBotSolution}
                    disabled={botLoading}
                    className="flex-1 md:flex-none flex items-center justify-center gap-3 px-6 md:px-12 py-3 md:py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-base md:text-lg transition-all shadow-xl disabled:opacity-50 min-h-[44px]"
                  >
                    {botLoading ? <Loader2 className="animate-spin w-5 h-5" /> : "Architect Solution"}
                  </button>
                  
                  {processedSolution && !botLoading && (
                    <div className="flex gap-2 w-full md:w-auto">
                      <button onClick={() => copyWithAnimation(processedSolution.copyText)} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 md:px-8 py-3 bg-white/10 hover:bg-white/20 text-slate-200 rounded-2xl font-bold border border-white/10 min-h-[44px]">
                        <Copy className="w-4 h-4 md:w-5 md:h-5" /> Copy
                      </button>
                      <button onClick={exportSolutionAsTxt} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 md:px-8 py-3 bg-white/10 hover:bg-white/20 text-slate-200 rounded-2xl font-bold border border-white/10 min-h-[44px]">
                        <FileDown className="w-4 h-4 md:w-5 md:h-5" /> Export
                      </button>
                    </div>
                  )}

                  {botError && (
                    <button onClick={handleGenerateBotSolution} className="flex items-center gap-2 text-rose-500 font-bold px-4 py-2 hover:bg-rose-500/10 rounded-xl transition-all min-h-[44px]">
                      <RefreshCcw className="w-4 h-4" /> Retry
                    </button>
                  )}
                </div>
              </div>

              {botLoading && <SolutionSkeleton />}

              {processedSolution && !botLoading && (
                <div className="space-y-6 md:space-y-8 animate-in slide-in-from-top-4 duration-500">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                    <div className="glass-card rounded-3xl p-6 md:p-8 border-white/10 h-fit">
                       <h3 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2 text-blue-400"><Cpu className="w-5 h-5" /> Solution Overview</h3>
                       <p className="text-slate-300 text-sm md:text-base leading-relaxed mb-6 md:mb-8">{processedSolution.solutionOverview}</p>
                       <h3 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2 text-emerald-400"><ListFilter className="w-5 h-5" /> Detailed Actions</h3>
                       <pre className="whitespace-pre-wrap text-xs md:text-sm font-mono p-4 md:p-6 rounded-2xl border border-white/5 bg-black/40 text-slate-300">{processedSolution.detailedActions}</pre>
                    </div>
                    <div className="space-y-6 md:space-y-8">
                       {processedSolution.excelVbaCode && (
                         <div className="glass-card rounded-3xl p-6 md:p-8 border-blue-500/20">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg md:text-xl font-bold flex items-center gap-2 text-blue-400"><Terminal className="w-5 h-5" /> VBA Macro</h3>
                              <button onClick={() => copyWithAnimation(processedSolution.excelVbaCode)} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"><Copy className="w-4 h-4" /></button>
                            </div>
                            <pre className="p-4 rounded-2xl font-mono text-xs overflow-x-auto scrollbar-thin bg-slate-900 text-blue-300">{processedSolution.excelVbaCode}</pre>
                         </div>
                       )}
                       {processedSolution.pythonCode && (
                         <div className="glass-card rounded-3xl p-6 md:p-8 border-indigo-500/20">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg md:text-xl font-bold flex items-center gap-2 text-indigo-400"><Code2 className="w-5 h-5" /> Python Script</h3>
                              <button onClick={() => copyWithAnimation(processedSolution.pythonCode)} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"><Copy className="w-4 h-4" /></button>
                            </div>
                            <pre className="p-4 rounded-2xl font-mono text-xs overflow-x-auto scrollbar-thin bg-slate-900 text-indigo-300">{processedSolution.pythonCode}</pre>
                         </div>
                       )}
                       <div className="glass-card rounded-3xl p-6 md:p-8 border-white/10">
                          <h3 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2 text-emerald-400"><CheckCircle className="w-5 h-5" /> Validation & Testing</h3>
                          <p className="text-slate-400 italic text-xs md:text-sm">{processedSolution.testingValidation}</p>
                       </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSection === 'chat' && (
            <div className="glass-card rounded-3xl p-4 md:p-6 flex flex-col h-[70vh] md:h-[750px] border-white/10 animate-in fade-in slide-in-from-bottom-4 relative">
              <div className="flex-1 overflow-y-auto pr-2 mb-4 md:mb-6 space-y-4 scrollbar-thin">
                {chatMessages.length === 0 && !chatLoading && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50 space-y-4">
                    <MessageSquare className="w-16 h-16 md:w-20 md:h-20" />
                    <p className="text-lg md:text-xl font-medium">Ask A360 Expert</p>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[90%] md:max-w-[85%] p-4 md:p-5 rounded-2xl shadow-lg border ${msg.role === 'user' ? 'bg-indigo-600 text-white border-indigo-500' : 'backdrop-blur-sm border-white/10 bg-slate-800/80 text-slate-100'}`}>
                      <p className="whitespace-pre-wrap leading-relaxed text-sm md:text-base">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="p-4 md:p-5 rounded-2xl w-full md:w-2/3 border border-white/10 space-y-2 bg-slate-800/80">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {chatError && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-rose-500/20 text-rose-500 px-4 py-2 rounded-full border border-rose-500/20 flex items-center gap-3 text-xs md:text-sm whitespace-nowrap">
                  <AlertCircle className="w-4 h-4" /> {chatError}
                  <button onClick={handleSendChatMessage} className="underline font-bold">Retry</button>
                </div>
              )}

              <div className="flex gap-2 md:gap-3 pt-4 md:pt-6 border-t border-white/5">
                <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()} placeholder="Ask technical guidance..." className="flex-1 border border-white/10 rounded-2xl px-4 md:px-6 py-3 md:py-5 outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm md:text-base min-h-[44px] bg-black/40 text-slate-100" />
                <button onClick={handleSendChatMessage} disabled={chatLoading} className="p-3 md:p-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl disabled:opacity-50 min-w-[44px] flex items-center justify-center"><Send className="w-5 h-5" /></button>
              </div>
            </div>
          )}

          {activeSection === 'interview' && (
            <div className="glass-card rounded-3xl p-6 md:p-8 border-white/10 animate-in fade-in slide-in-from-bottom-4 shadow-2xl min-h-[500px] flex flex-col justify-center">
              {!interviewStarted ? (
                <div className="text-center flex flex-col items-center py-10">
                  <Upload className="w-16 h-16 md:w-20 md:h-20 text-emerald-500 mb-6" />
                  <label className="cursor-pointer mb-8 w-full md:w-auto">
                    <div className="relative px-6 md:px-12 py-4 md:py-5 border border-white/10 rounded-2xl text-emerald-500 font-bold flex items-center justify-center gap-3 hover:opacity-80 transition-all min-h-[44px] bg-slate-900">
                      <FileText className="w-5 h-5" /> <span className="text-sm md:text-base truncate">{resume ? resume.name : 'Choose Resume'}</span>
                      <input type="file" onChange={(e) => handleFileChange(e, setResume)} className="hidden" />
                    </div>
                  </label>
                  {resume && (
                    <button onClick={handleStartInterview} disabled={interviewLoading} className="w-full md:w-auto px-12 md:px-16 py-4 md:py-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl disabled:opacity-50 flex items-center justify-center gap-3 min-h-[44px]">
                      {interviewLoading ? <Loader2 className="animate-spin w-5 h-5" /> : "BEGIN INTERVIEW"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-6 max-w-4xl mx-auto w-full">
                  <div className="rounded-3xl p-4 md:p-8 h-[50vh] md:h-[500px] overflow-y-auto scrollbar-thin border border-white/5 space-y-4 md:space-y-6 bg-black/40">
                    {interviewMessages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'candidate' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`p-4 md:p-5 rounded-2xl max-w-[90%] md:max-w-[85%] shadow-md border ${msg.role === 'candidate' ? 'bg-emerald-600 text-white border-emerald-500' : 'border-white/10 bg-slate-800/60 text-slate-100'}`}>
                          <p className="text-sm md:text-base leading-relaxed">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                    {interviewLoading && <Skeleton className="h-20 w-3/4" />}
                  </div>
                  <div className="flex flex-col gap-4">
                    {interviewError && <div className="text-rose-500 flex items-center gap-2 text-sm"><AlertCircle className="w-4 h-4" /> {interviewError}</div>}
                    <div className="flex gap-2 md:gap-3">
                      <textarea value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} placeholder="Type your answer here..." className="flex-1 border border-white/10 rounded-2xl p-4 md:p-5 outline-none min-h-[100px] md:min-h-[120px] resize-none focus:ring-2 focus:ring-emerald-500/50 text-sm md:text-base bg-black/40 text-slate-100" />
                      <button onClick={handleSubmitInterviewAnswer} disabled={interviewLoading} className="p-4 md:p-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl disabled:opacity-50 min-w-[44px] flex items-center justify-center"><Send className="w-5 h-5" /></button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSection === 'live-interview' && (
            <div className="grid gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-4 min-h-[500px] md:min-h-[750px] relative">
              <div className="glass-card rounded-3xl p-4 md:p-8 border-white/10 relative">
                <div className="flex justify-center mb-6 md:mb-8">
                  <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 backdrop-blur-md w-full md:w-auto">
                    <button onClick={() => setLiveMode('standard')} className={`flex-1 md:flex-none px-4 md:px-8 py-2 md:py-3 rounded-xl font-bold transition-all text-sm md:text-base min-h-[44px] ${liveMode === 'standard' ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500'}`}>Standard</button>
                    <button onClick={() => setLiveMode('you-me')} className={`flex-1 md:flex-none px-4 md:px-8 py-2 md:py-3 rounded-xl font-bold transition-all text-sm md:text-base min-h-[44px] ${liveMode === 'you-me' ? 'bg-rose-500/20 text-rose-400 shadow-lg' : 'text-slate-500'}`}>You & Me</button>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className={`p-3 md:p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20 ${isLiveActive ? 'shadow-[0_0_20px_rgba(244,63,94,0.3)]' : ''}`}>
                      <Radio className={`w-6 h-6 md:w-8 md:h-8 text-rose-500 ${isLiveActive ? 'animate-pulse' : ''}`} />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl font-bold uppercase tracking-wider">{liveMode === 'you-me' ? 'You & Me Copilot' : 'Technical Architect'}</h2>
                      <p className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-tighter">Status: {sessionStatus}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    {liveMode === 'you-me' && isLiveActive && (
                      <button 
                        onClick={toggleInterviewerListening}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold transition-all border min-h-[44px] ${interviewerButtonState === 'listening' ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20' : 'bg-white/5 border-white/10 text-slate-400'}`}
                      >
                        {interviewerButtonState === 'listening' ? <><Ear className="w-5 h-5 animate-bounce" /> LISTENING...</> : <><MicOff className="w-5 h-5" /> TAP WHEN INTERVIEWER SPEAKS</>}
                      </button>
                    )}
                    <button onClick={isLiveActive ? stopLiveSession : startLiveSession} className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-8 md:px-10 py-4 md:py-5 rounded-2xl font-black transition-all min-h-[44px] ${isLiveActive ? 'bg-rose-500 text-white shadow-rose-500/40' : 'bg-white/10 border border-white/10 text-slate-300 hover:bg-white/20'}`}>
                      {isLiveActive ? <><StopCircle className="w-5 h-5" /> STOP</> : <><Mic className="w-5 h-5" /> START PILOT</>}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col rounded-[2rem] border-2 border-rose-500/30 overflow-hidden relative min-h-[400px] bg-slate-900/50">
                  <div className="px-6 md:px-8 py-4 md:py-5 bg-rose-500/10 border-b border-white/10 flex items-center justify-between">
                    <span className="text-[10px] md:text-xs font-black text-rose-500 uppercase tracking-widest flex items-center gap-2"><Sparkles className="w-3 h-3 md:w-4 md:h-4 animate-pulse" /> Live Analysis</span>
                  </div>
                  <div className="flex-1 p-6 md:p-10 overflow-y-auto scrollbar-thin bg-black/20">
                    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
                      {adviceHistory.length > 0 ? adviceHistory.map((adv, i) => adv && <p key={i} className="text-slate-100 text-base md:text-2xl leading-relaxed whitespace-pre-wrap">{adv}</p>) : <div className="text-slate-600 text-center py-10 md:py-20 italic text-sm md:text-base">Awaiting live audio stream...</div>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'contact' && (
            <div className="max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-500">
              <div className="glass-card rounded-[2rem] md:rounded-[3rem] p-6 md:p-12 border-white/10 shadow-2xl relative overflow-hidden text-center">
                <div className="relative mb-6 md:mb-8 flex justify-center">
                  <div className="p-4 md:p-6 rounded-full border border-white/10 shadow-xl bg-slate-900">
                    <UserRound className="w-12 h-12 md:w-16 md:h-16 text-blue-400" />
                  </div>
                </div>
                <h2 className="text-2xl md:text-3xl font-black mb-3 md:mb-4 uppercase tracking-tight">RKS Automation Architect</h2>
                <p className="text-slate-400 mb-8 md:mb-10 leading-relaxed italic font-light text-sm md:text-base">"Ready to transform your business processes with world-class automation solutions."</p>
                <div className="grid gap-3 md:gap-4 mb-8 md:mb-10">
                  <a href="https://wa.me/919949424853" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-4 py-4 md:py-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-lg md:text-xl transition-all shadow-xl active:scale-95 group min-h-[44px]">
                    <MessageCircle className="w-6 h-6 group-hover:animate-bounce" /> CONTACT ON WHATSAPP
                  </a>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <div className="p-4 md:p-6 rounded-2xl border border-white/10 flex flex-col items-center gap-2 bg-white/5">
                       <Phone className="w-5 h-5 text-blue-400" />
                       <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase">Phone</span>
                       <span className="font-mono text-xs md:text-sm font-bold">+91 9949424853</span>
                    </div>
                    <div className="p-4 md:p-6 rounded-2xl border border-white/10 flex flex-col items-center gap-2 bg-white/5">
                       <Mail className="w-5 h-5 text-indigo-400" />
                       <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase">Email</span>
                       <span className="font-mono text-[10px] md:text-xs break-all font-bold">rajkumarss.rpa@gmail.com</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

// Robust rendering
const initApp = () => {
  const rootElement = document.getElementById('root');
  if (rootElement) createRoot(rootElement).render(<RKSAssistant />);
  else setTimeout(initApp, 100);
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp);
else initApp();
