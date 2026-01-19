
import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Upload, FileText, Send, Loader2, 
  Download, Mic, Volume2, StopCircle, Zap, 
  CheckCircle, ArrowRight, MessageSquare, Briefcase, 
  Bot, X, File, BrainCircuit, Sparkles, Copy, Trash2,
  Code2, Terminal, Cpu, Database as DbIcon, Search, ListFilter,
  Info, Radio, Ghost, ChevronLeft, ChevronRight, Maximize2, User,
  Activity, MessageCircle, MicOff, UserRound, Headphones, Play, Pause,
  Phone, Mail, Linkedin, Github, ExternalLink
} from 'lucide-react';
import { GoogleGenAI, Modality, LiveServerMessage, Type } from "@google/genai";

// --- Constants ---
const AA_KNOWLEDGE = `
=== AUTOMATION ANYWHERE A360 COMPREHENSIVE ACTION & TRIGGER INVENTORY ===

PYTHON SCRIPT PACKAGE:
- Actions: Open, Execute script, Execute function, Close.
- Usage: For complex JSON/API parsing, Regex, and custom data math.

EXCEL ADVANCED PACKAGE:
- Actions: Open, Close, Save, Save as, Create workbook, Get cells, Get multiple cells, Set cell, Delete cell, Find/Replace, Go to cell, Insert/Delete rows/columns, Filter table, Clear filter, Create table, Rename worksheet, Activate worksheet, Get worksheet names, Protect/Unprotect sheet, Append worksheet, Run macro.

EXCEL BASIC PACKAGE:
- Actions: Open, Close, Set cell, Get cell, Get multiple cells, Set cells, Insert/Delete rows/columns. (Note: Excel Basic doesn't need Excel installed).

DATABASE PACKAGE:
- Actions: Connect, Disconnect, Export to data table, Insert/Update/Delete, Read from, Run stored procedure, Begin transaction, Commit, Rollback.

DATA TABLE PACKAGE:
- Actions: Assign, Clear, Filter, Insert column, Insert row, Remove column, Remove row, Set value, Get value, Get number of rows/cols, Join, Merge, Search, Sort, Write to file.

PDF PACKAGE:
- Actions: Extract text, Extract image, Merge documents, Split document, Encrypt/Decrypt, Form fields extraction, OCR (Optical Character Recognition).

DICTIONARY PACKAGE:
- Actions: Put, Get, Remove, Assign, Size, Clear.

LIST PACKAGE:
- Actions: Add item, Clear, Get item, Remove item, Set item, Size, Sort.

STRING PACKAGE:
- Actions: Assign, Compare, Extract text, Find, Length, Lower case/Upper case, Replace, Reverse, Split, Substring, Trim, To number.

WINDOW PACKAGE:
- Actions: Close, Maximize, Minimize, Resize, Set focus, Get title.

ERROR HANDLER:
- Actions: Try, Catch, Finally, Throw.

LOOP PACKAGE:
- Actions: Loop, Break, Continue. (Iterators: Excel, Database, Data Table, Dictionary, List, File, Folder, Windows, While, For n times).

RECORDER/UI AUTOMATION:
- Actions: Capture, Object properties, Set text, Click, Select item, Get property.

API/REST WEB SERVICES:
- Actions: GET, POST, PUT, DELETE, PATCH (Part of the REST Web Services package).
`;

const SYSTEM_PROMPT = `You are RKS Automation Architect - the ultimate Automation Anywhere (AA) A360 Logic Engine with 10+ years of enterprise RPA experience.

${AA_KNOWLEDGE}

CORE PRINCIPLES:
1. Solution Architecture: Design scalable, maintainable, production-ready automation solutions.
2. Technology Selection: Choose appropriate AA packages.
3. Excel Automation: If the requirement involves complex Excel logic, generate a ready-to-paste Excel VBA macro.

You must return a valid JSON object matching this schema:
{
  "solutionOverview": "High-level approach",
  "detailedActions": "Step-by-step AA A360 actions",
  "excelVbaCode": "Full VBA macro string (or empty if not needed)",
  "pythonCode": "Full Python script string (or empty if not needed)",
  "testingValidation": "Testing scenarios"
}

Professional, technical, and detailed style.`;

const LIVE_COPILOT_PROMPT_BASE = `You are RKS Live Interview Copilot, a Senior Technical Lead from India with 12+ years of A360 experience.

### IDENTITY & TONE
- **Persona**: Senior Indian Technical Architect.
- **Natural Phrasing**: "See, basically...", "Actually, for this package...", "In A360, what happens is...", "I have used this extensively in my projects...", "Coming to that point...".
- **Communication**: Professional, authoritative, yet helpful. Speak like a professional Indian tech lead.

### PACKAGE DEEP-DIVE RULE (CRITICAL)
- **IF THE INTERVIEWER ASKS ABOUT A SPECIFIC PACKAGE**: You must provide an exhaustive list of the actions available inside that package from the knowledge base provided. 
- **DO NOT SUMMARIZE** the package. List the actual actions (e.g., for Excel Advanced: "Open, Close, Set Cell, Get Multiple Cells, Filter Table, Run Macro...").
- **STRUCTURE**: Start with the persona filler, state the package utility briefly, and then explicitly name the actions.

### RESPONSE GUIDELINES
- **SHORT BUT CONTENT-DENSE**: Keep general answers to 3-6 sentences. 
- **ACCURACY**: Use the exact names of actions and packages as per Automation Anywhere A360 documentation.
- **FIRST PERSON**: Speak as the candidate ("I use...", "My approach involves...").

Style: Expert Indian Tech Lead, Fast, Accurate, Comprehensive on Packages.`;

// --- Helpers ---
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

interface BotSolution {
  solutionOverview: string;
  detailedActions: string;
  excelVbaCode: string;
  pythonCode: string;
  testingValidation: string;
}

const RKSAssistant = () => {
  const [activeSection, setActiveSection] = useState<'bot-builder' | 'chat' | 'interview' | 'live-interview' | 'contact'>('bot-builder');
  const [isListening, setIsListening] = useState(false);
  
  // Section: Bot Builder
  const [botInput, setBotInput] = useState('');
  const [botFile, setBotFile] = useState<File | null>(null);
  const [botLoading, setBotLoading] = useState(false);
  const [botSolution, setBotSolution] = useState<BotSolution | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  
  // Section: Expert Chat
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Section: Interview Prep
  const [resume, setResume] = useState<File | null>(null);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewMessages, setInterviewMessages] = useState<{role: 'interviewer' | 'candidate', content: string}[]>([]);
  const [userAnswer, setUserAnswer] = useState('');
  const [interviewLoading, setInterviewLoading] = useState(false);

  // Section: Live Interview Copilot
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isInterviewerSpeaking, setIsInterviewerSpeaking] = useState(false);
  const [adviceHistory, setAdviceHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'connecting' | 'active' | 'error'>('idle');
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  
  const [liveMode, setLiveMode] = useState<'standard' | 'you-me'>('standard');
  const [interviewerButtonState, setInterviewerButtonState] = useState<'idle' | 'listening'>('idle');

  const liveModeRef = useRef(liveMode);
  const interviewerButtonStateRef = useRef(interviewerButtonState);

  useEffect(() => { liveModeRef.current = liveMode; }, [liveMode]);
  useEffect(() => { interviewerButtonStateRef.current = interviewerButtonState; }, [interviewerButtonState]);
  
  const isAnsweringRef = useRef(false);
  const phaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (activeSection === 'bot-builder') setBotInput(prev => prev + ' ' + transcript);
        if (activeSection === 'chat') setChatInput(prev => prev + ' ' + transcript);
        if (activeSection === 'interview') setUserAnswer(prev => prev + ' ' + transcript);
        setIsListening(false);
      };
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      stopLiveSession();
    };
  }, [activeSection]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  useEffect(() => {
    if (isLiveActive && analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      const updateLevel = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(Math.min(100, (average / 128) * 100));
          requestAnimationFrame(updateLevel);
        }
      };
      updateLevel();
    }
  }, [isLiveActive]);

  const startListening = () => {
    if (recognitionRef.current) {
      try {
        setIsListening(true);
        recognitionRef.current.start();
      } catch (e) {
        setIsListening(false);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const toggleFloatingInterviewer = () => {
    if (!isLiveActive) return;
    const nextState = interviewerButtonState === 'idle' ? 'listening' : 'idle';
    setInterviewerButtonState(nextState);
    liveSessionRef.current?.sessionPromise.then(session => {
      session.sendRealtimeInput({ text: `[System] Interviewer button state: ${nextState}. Mode: You-Me.` });
    });
  };

  const startLiveSession = async () => {
    if (isLiveActive) return;
    setSessionStatus('connecting');
    setIsLiveActive(true);
    setAdviceHistory(['🎯 RKS Live Copilot Active - Listening live...']);
    setHistoryIndex(0);
    isAnsweringRef.current = false;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 16000 } 
      });
      const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = inputAudioContext;

      const analyser = inputAudioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const dynamicInstruction = `${LIVE_COPILOT_PROMPT_BASE}\n\nRELEVANT A360 PACKAGE KNOWLEDGE:\n${AA_KNOWLEDGE}\n\nCurrent flags:\n- mode: "${liveModeRef.current}"\n- mic: "${interviewerButtonStateRef.current}"`;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setSessionStatus('active');
            const source = inputAudioContext.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
            source.connect(analyser);
            
            scriptProcessor.onaudioprocess = (e) => {
              const isStandardListening = liveModeRef.current === 'standard';
              const isYouMeListening = liveModeRef.current === 'you-me' && (interviewerButtonStateRef.current === 'listening');
              if (!isStandardListening && !isYouMeListening) return;
              if (isAnsweringRef.current && Math.random() > 0.15) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContext.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
              const transcript = message.serverContent.inputTranscription.text || '';
              setIsInterviewerSpeaking(true);
              setTimeout(() => setIsInterviewerSpeaking(false), 2000);
            }

            if (message.serverContent?.outputTranscription) {
              isAnsweringRef.current = true;
              if (phaseTimeoutRef.current) clearTimeout(phaseTimeoutRef.current);
              phaseTimeoutRef.current = setTimeout(() => { isAnsweringRef.current = false; }, 8000); 

              const newText = message.serverContent?.outputTranscription?.text || '';
              setAdviceHistory(prev => {
                const current = [...prev];
                const last = current[current.length - 1] || '';
                if (last.includes('Ready') || last.includes('stopped') || last.includes('Active')) {
                   current[current.length - 1] = newText;
                } else if (message.serverContent?.turnComplete) {
                   current.push(newText);
                } else {
                   current[current.length - 1] = last + newText;
                }
                if (current.length > 50) current.shift();
                return current;
              });
              setHistoryIndex(prev => Math.max(prev, adviceHistory.length - 1));
            }

            if (message.serverContent?.turnComplete) {
              isAnsweringRef.current = false;
              if (phaseTimeoutRef.current) clearTimeout(phaseTimeoutRef.current);
            }
          },
          onerror: (e: any) => {
            console.error('Live error:', e);
            setSessionStatus('error');
            setIsLiveActive(false);
          },
          onclose: () => {
            setIsLiveActive(false);
            setSessionStatus('idle');
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
          },
          systemInstruction: dynamicInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        }
      });
      liveSessionRef.current = { sessionPromise, stream, context: inputAudioContext };
    } catch (err) {
      console.error(err);
      setIsLiveActive(false);
      setSessionStatus('error');
    }
  };

  const stopLiveSession = () => {
    if (liveSessionRef.current) {
      const { stream, context } = liveSessionRef.current;
      stream.getTracks().forEach((track: any) => track.stop());
      if (context) context.close();
      liveSessionRef.current = null;
    }
    if (phaseTimeoutRef.current) clearTimeout(phaseTimeoutRef.current);
    isAnsweringRef.current = false;
    setIsLiveActive(false);
    setSessionStatus('idle');
    setInterviewerButtonState('idle');
    setAudioLevel(0);
    setAdviceHistory(prev => [...prev, "🔴 Copilot session stopped."]);
  };

  const handleGenerateBotSolution = async () => {
    if (!botInput.trim() && !botFile) return;
    setBotLoading(true);
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
        const data = JSON.parse(response.text.trim());
        setBotSolution(data);
      }
    } catch (e) { 
      console.error(e);
    } finally { 
      setBotLoading(false); 
    }
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;
    const input = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', content: input }]);
    setChatInput('');
    setChatLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: input,
        config: { systemInstruction: "You are RKS Automation Architect. Provide technical depth on AA A360." }
      });
      setChatMessages(prev => [...prev, { role: 'assistant', content: response.text || "" }]);
    } finally { setChatLoading(false); }
  };

  const handleStartInterview = async () => {
    if (!resume) return;
    setInterviewStarted(true);
    setInterviewLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const b64 = await fileToBase64(resume);
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: "Start A360 technical interview based on this resume." }, { inlineData: { data: b64, mimeType: resume.type } }] },
      });
      setInterviewMessages([{ role: 'interviewer', content: response.text || "Welcome. Let's begin." }]);
    } finally { setInterviewLoading(false); }
  };

  const handleSubmitInterviewAnswer = async () => {
    if (!userAnswer.trim()) return;
    const answer = userAnswer;
    setInterviewMessages(prev => [...prev, { role: 'candidate', content: answer }]);
    setUserAnswer('');
    setInterviewLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Previous context: ${interviewMessages.map(m => m.content).join('\n')}\nAnswer: ${answer}`,
      });
      setInterviewMessages(prev => [...prev, { role: 'interviewer', content: response.text || "" }]);
    } finally { setInterviewLoading(false); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const copyFullSolution = () => {
    if (!botSolution) return;
    const text = `
BOT ARCHITECT SOLUTION
======================

OVERVIEW:
${botSolution.solutionOverview}

DETAILED ACTIONS:
${botSolution.detailedActions}

${botSolution.excelVbaCode ? `EXCEL VBA MACRO:\n${botSolution.excelVbaCode}\n` : ''}
${botSolution.pythonCode ? `PYTHON SCRIPT:\n${botSolution.pythonCode}\n` : ''}

VALIDATION & TESTING:
${botSolution.testingValidation}
    `.trim();
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  };

  const currentAdvice = adviceHistory[Math.min(historyIndex, adviceHistory.length - 1)] || "";

  return (
    <div className="min-h-screen pb-12 bg-slate-950 text-slate-100 selection:bg-blue-500/30 font-sans overflow-x-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-indigo-600/10 rounded-full blur-[100px] animate-pulse delay-700"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="flex flex-col items-center mb-12 text-center">
          <div className="mb-6 relative group">
            <div className="absolute -inset-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full blur opacity-25 group-hover:opacity-60 transition duration-1000"></div>
            <div className="relative bg-slate-900 p-6 rounded-full border border-white/10 shadow-2xl">
              <BrainCircuit className="w-14 h-14 text-blue-400" />
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-2 uppercase">
            RKS<span className="text-blue-500">.</span>Automation Architect
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl font-light italic">
            Architecting the future of Automation Anywhere with AI-powered <span className="text-blue-400 font-medium">bot design</span>.
          </p>
        </header>

        <div className="flex flex-wrap justify-center gap-4 mb-10 p-2 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md w-fit mx-auto shadow-2xl">
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
              className={`flex flex-col items-center text-center gap-1 px-8 py-3 rounded-xl transition-all ${
                activeSection === tab.id 
                  ? `${tab.color} text-white shadow-xl shadow-blue-500/20 scale-105` 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2 font-bold">
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </div>
            </button>
          ))}
        </div>

        <main>
          {activeSection === 'bot-builder' && (
            <div className="grid gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="glass-card rounded-3xl p-8 border-white/10">
                <div className="relative mb-4">
                  <textarea
                    value={botInput}
                    onChange={(e) => setBotInput(e.target.value)}
                    placeholder="Describe your process requirement for A360..."
                    className="w-full h-64 p-6 bg-black/40 border border-white/10 rounded-2xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all text-lg scrollbar-thin placeholder:text-slate-600 resize-none"
                  />
                  <div className="absolute bottom-4 right-4 flex items-center gap-2">
                    <button onClick={isListening ? stopListening : startListening} className={`p-3 rounded-xl transition-all ${isListening ? 'bg-red-500 animate-pulse' : 'bg-white/10'}`}>
                      {isListening ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                    <label className="p-3 bg-white/10 hover:bg-white/20 text-slate-300 rounded-xl cursor-pointer">
                      <Upload className="w-5 h-5" />
                      <input type="file" onChange={(e) => setBotFile(e.target.files?.[0] || null)} className="hidden" />
                    </label>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={handleGenerateBotSolution}
                    disabled={botLoading}
                    className="flex-1 md:flex-none flex items-center justify-center gap-3 px-12 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-lg transition-all shadow-xl shadow-blue-600/20"
                  >
                    {botLoading ? <Loader2 className="animate-spin" /> : "Architect Solution"}
                  </button>
                  
                  {botSolution && (
                    <button
                      onClick={copyFullSolution}
                      className="flex-1 md:flex-none flex items-center justify-center gap-3 px-12 py-5 bg-white/10 hover:bg-white/20 text-slate-200 rounded-2xl font-bold text-lg transition-all border border-white/10"
                    >
                      {copyFeedback ? <CheckCircle className="text-emerald-400" /> : <Copy />}
                      {copyFeedback ? "Copied!" : "Copy Full Solution"}
                    </button>
                  )}
                </div>
              </div>

              {botSolution && (
                <div className="space-y-8 animate-in slide-in-from-top-4 duration-500">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="glass-card rounded-3xl p-8 border-white/10 h-fit">
                       <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-400">
                         <Cpu className="w-5 h-5" /> Solution Overview
                       </h3>
                       <p className="text-slate-300 leading-relaxed mb-8">{botSolution.solutionOverview}</p>
                       
                       <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-emerald-400">
                         <ListFilter className="w-5 h-5" /> Detailed Actions
                       </h3>
                       <pre className="whitespace-pre-wrap text-sm text-slate-300 font-mono bg-black/40 p-6 rounded-2xl border border-white/5 leading-relaxed">
                         {botSolution.detailedActions}
                       </pre>
                    </div>

                    <div className="space-y-8">
                       {botSolution.excelVbaCode && (
                         <div className="glass-card rounded-3xl p-8 border-blue-500/20">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-xl font-bold flex items-center gap-2 text-blue-400">
                                <Terminal className="w-5 h-5" /> Excel VBA Macro
                              </h3>
                              <button onClick={() => copyToClipboard(botSolution.excelVbaCode)} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-all flex items-center gap-2 text-xs">
                                <Copy className="w-4 h-4" /> Copy VBA
                              </button>
                            </div>
                            <pre className="p-6 bg-slate-900 rounded-2xl font-mono text-sm text-blue-300 overflow-x-auto scrollbar-thin border border-white/5">
                              {botSolution.excelVbaCode}
                            </pre>
                         </div>
                       )}

                       {botSolution.pythonCode && (
                         <div className="glass-card rounded-3xl p-8 border-indigo-500/20">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-xl font-bold flex items-center gap-2 text-indigo-400">
                                <Code2 className="w-5 h-5" /> Python Script
                              </h3>
                              <button onClick={() => copyToClipboard(botSolution.pythonCode)} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-all flex items-center gap-2 text-xs">
                                <Copy className="w-4 h-4" /> Copy Script
                              </button>
                            </div>
                            <pre className="p-6 bg-slate-900 rounded-2xl font-mono text-sm text-indigo-300 overflow-x-auto scrollbar-thin border border-white/5">
                              {botSolution.pythonCode}
                            </pre>
                         </div>
                       )}

                       <div className="glass-card rounded-3xl p-8 border-white/10">
                          <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-emerald-400">
                            <CheckCircle className="w-5 h-5" /> Validation & Testing
                          </h3>
                          <p className="text-slate-300 leading-relaxed text-sm italic">{botSolution.testingValidation}</p>
                       </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSection === 'chat' && (
            <div className="glass-card rounded-3xl p-6 flex flex-col h-[750px] border-white/10 animate-in fade-in slide-in-from-bottom-4 shadow-2xl">
              <div className="flex-1 overflow-y-auto pr-2 mb-6 space-y-4 scrollbar-thin">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50 space-y-4">
                    <MessageSquare className="w-20 h-20" />
                    <p className="text-xl font-medium">Ask A360 Expert</p>
                  </div>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-5 rounded-2xl shadow-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800/80 border border-white/10 text-slate-200 backdrop-blur-sm'}`}>
                        <p className="whitespace-pre-wrap leading-relaxed text-sm md:text-base">{msg.content}</p>
                      </div>
                    </div>
                  ))
                )}
                {chatLoading && <Loader2 className="animate-spin text-indigo-400 mx-auto" />}
                <div ref={chatEndRef} />
              </div>
              <div className="flex gap-3 pt-6 border-t border-white/5">
                <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()} placeholder="Ask technical guidance..." className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-6 py-5 outline-none focus:ring-2 focus:ring-indigo-500/50" />
                <button onClick={handleSendChatMessage} className="p-5 bg-indigo-600 hover:bg-indigo-500 rounded-2xl shadow-lg active:scale-95"><Send /></button>
              </div>
            </div>
          )}

          {activeSection === 'interview' && (
            <div className="glass-card rounded-3xl p-8 border-white/10 animate-in fade-in slide-in-from-bottom-4 shadow-2xl">
              {!interviewStarted ? (
                <div className="text-center py-20 flex flex-col items-center">
                  <Upload className="w-20 h-20 text-emerald-400 mb-6" />
                  <label className="cursor-pointer mb-8">
                    <div className="relative px-12 py-5 bg-slate-900 border border-white/10 rounded-2xl text-emerald-400 font-bold flex items-center gap-3">
                      <FileText />
                      {resume ? resume.name : 'Choose Resume'}
                      <input type="file" onChange={(e) => setResume(e.target.files?.[0] || null)} className="hidden" />
                    </div>
                  </label>
                  {resume && <button onClick={handleStartInterview} className="px-16 py-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl">BEGIN</button>}
                </div>
              ) : (
                <div className="space-y-6 max-w-4xl mx-auto">
                  <div className="bg-black/40 rounded-3xl p-8 h-[500px] overflow-y-auto scrollbar-thin border border-white/5 space-y-6">
                    {interviewMessages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'candidate' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`p-5 rounded-2xl max-w-[85%] shadow-md ${msg.role === 'candidate' ? 'bg-emerald-600 text-white' : 'bg-slate-800/60 border border-white/10'}`}>
                          <p className="text-sm md:text-base leading-relaxed">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                    {interviewLoading && <Loader2 className="animate-spin text-emerald-400 mx-auto" />}
                  </div>
                  <div className="flex gap-3">
                    <textarea value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} placeholder="Type answer..." className="flex-1 bg-black/40 border border-white/10 rounded-2xl p-5 outline-none min-h-[120px] resize-none" />
                    <button onClick={handleSubmitInterviewAnswer} className="p-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl transition-all active:scale-95"><Send /></button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSection === 'live-interview' && (
            <div className="grid gap-8 animate-in fade-in slide-in-from-bottom-4 min-h-[750px] relative">
              <div className="glass-card rounded-3xl p-8 border-white/10 relative shadow-2xl">
                <div className="flex justify-center mb-8">
                  <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 backdrop-blur-md shadow-lg">
                    <button 
                      onClick={() => setLiveMode('standard')}
                      className={`px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${liveMode === 'standard' ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      <Zap className="w-4 h-4" /> Standard Live
                    </button>
                    <button 
                      onClick={() => setLiveMode('you-me')}
                      className={`px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${liveMode === 'you-me' ? 'bg-rose-500/20 text-rose-400 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      <User className="w-4 h-4" /> Live by You & Me
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className={`p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20 ${isLiveActive ? 'shadow-[0_0_20px_rgba(244,63,94,0.3)]' : ''}`}>
                        <Radio className={`w-8 h-8 text-rose-400 ${isLiveActive ? 'animate-pulse' : ''}`} />
                      </div>
                      {isInterviewerSpeaking && (
                        <div className="absolute -top-2 -right-2 flex h-6 w-6">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-6 w-6 bg-emerald-500 items-center justify-center">
                            <Activity className="w-3 h-3 text-white" />
                          </span>
                        </div>
                      )}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold uppercase tracking-wider flex items-center gap-3">
                        {liveMode === 'you-me' ? 'You & Me Copilot' : 'Technical Architect'}
                      </h2>
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-tight">
                        Status: {sessionStatus === 'active' ? 'Active' : sessionStatus === 'connecting' ? 'Connecting...' : 'Idle'}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-center flex-wrap">
                    <button
                      onClick={isLiveActive ? stopLiveSession : startLiveSession}
                      className={`flex items-center gap-3 px-10 py-5 rounded-2xl font-black transition-all shadow-2xl active:scale-95 ${
                        isLiveActive ? 'bg-rose-500 text-white shadow-rose-500/40' : 'bg-white/10 border border-white/10 text-slate-300'
                      }`}
                    >
                      {isLiveActive ? <><StopCircle /> END SESSION</> : <><Mic /> START LIVE PILOT</>}
                    </button>
                  </div>
                </div>

                {isLiveActive && (
                  <div className="mb-6 h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-500 to-rose-500 transition-all duration-100"
                      style={{ width: `${audioLevel}%` }}
                    />
                  </div>
                )}

                <div className="flex flex-col bg-slate-900/50 rounded-[2.5rem] border-2 border-rose-500/30 overflow-hidden relative group min-h-[600px] shadow-2xl backdrop-blur-xl">
                  <div className="px-8 py-5 bg-rose-500/10 border-b border-white/10 flex items-center justify-between backdrop-blur-md">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-rose-400 uppercase tracking-[0.3em] flex items-center gap-2">
                        <Sparkles className="w-4 h-4 animate-pulse" /> Live Suggestion Only
                      </span>
                    </div>
                    {adviceHistory.length > 1 && (
                      <div className="flex items-center gap-3 bg-black/40 px-5 py-2 rounded-[1.5rem] border border-white/10">
                         <button onClick={() => setHistoryIndex(Math.max(0, historyIndex - 1))} className="p-2 hover:bg-white/10 rounded-full text-rose-400 transition-transform active:scale-90"><ChevronLeft className="w-6 h-6" /></button>
                         <button onClick={() => setHistoryIndex(Math.min(adviceHistory.length - 1, historyIndex + 1))} className="p-2 hover:bg-white/10 rounded-full text-rose-400 transition-transform active:scale-90"><ChevronRight className="w-6 h-6" /></button>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 p-10 overflow-y-auto scrollbar-thin bg-black/20">
                    <div className="max-w-4xl mx-auto">
                      {currentAdvice ? (
                        <div className="animate-in fade-in duration-700">
                          <p className="text-slate-100 text-lg md:text-3xl leading-relaxed whitespace-pre-wrap font-medium">
                            {currentAdvice}
                          </p>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-40 text-center py-20">
                          <BrainCircuit className="w-24 h-24 mb-6" />
                          <p className="text-2xl font-black uppercase tracking-widest">Awaiting Voice Input</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {adviceHistory.length > 1 && (
                    <div className="p-8 bg-slate-950/90 border-t border-white/10 backdrop-blur-2xl">
                      <div className="max-w-4xl mx-auto flex items-center gap-8">
                        <input 
                          type="range" min="0" max={adviceHistory.length - 1} value={historyIndex} 
                          onChange={(e) => setHistoryIndex(parseInt(e.target.value))}
                          className="flex-1 h-2.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-rose-600"
                        />
                        <div className="text-rose-400 font-mono text-base tabular-nums bg-rose-500/10 px-6 py-2 rounded-2xl border border-rose-500/20 shadow-lg min-w-[100px] text-center">
                          {historyIndex + 1} / {adviceHistory.length}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {activeSection === 'live-interview' && liveMode === 'you-me' && isLiveActive && (
                <div className="fixed bottom-10 right-10 z-50 flex flex-col items-center gap-3 animate-in slide-in-from-bottom-8 duration-500">
                  <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl border backdrop-blur-md transition-all ${interviewerButtonState === 'listening' ? 'bg-rose-500 text-white border-rose-400 animate-pulse' : 'bg-slate-900/80 text-slate-400 border-white/10'}`}>
                    {interviewerButtonState === 'listening' ? 'Listening' : 'Ready'}
                  </span>
                  <button
                    onClick={toggleFloatingInterviewer}
                    className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90 border-4 ${
                      interviewerButtonState === 'listening' 
                        ? 'bg-rose-600 border-rose-400 animate-pulse ring-8 ring-rose-500/20' 
                        : 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 hover:border-slate-600 hover:bg-slate-700 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    {interviewerButtonState === 'listening' ? <Mic className="w-10 h-10 text-white" /> : <MicOff className="w-10 h-10" />}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeSection === 'contact' && (
            <div className="max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-500">
              <div className="glass-card rounded-[3rem] p-12 border-white/10 shadow-2xl relative overflow-hidden text-center">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl"></div>
                
                <div className="relative mb-8 flex justify-center">
                  <div className="p-6 bg-slate-900 rounded-full border border-white/10 shadow-xl">
                    <UserRound className="w-16 h-16 text-blue-400" />
                  </div>
                </div>

                <h2 className="text-3xl font-black mb-4 uppercase tracking-tight">RKS Automation Architect</h2>
                <p className="text-slate-400 mb-10 leading-relaxed italic font-light">
                  "Ready to transform your business processes with world-class automation solutions. Let's discuss your requirements basically, and architecture the best possible bot for your enterprise."
                </p>

                <div className="grid gap-4 mb-10">
                  <a 
                    href="https://wa.me/919949424853" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-4 py-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xl transition-all shadow-xl shadow-emerald-600/20 active:scale-95 group"
                  >
                    <MessageCircle className="w-7 h-7 group-hover:animate-bounce" />
                    CONTACT ON WHATSAPP
                    <ExternalLink className="w-5 h-5 opacity-50" />
                  </a>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10 flex flex-col items-center gap-2">
                       <Phone className="w-5 h-5 text-blue-400" />
                       <span className="text-xs font-bold text-slate-500 uppercase">Phone</span>
                       <span className="font-mono text-sm">+91 9949424853</span>
                    </div>
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10 flex flex-col items-center gap-2">
                       <Mail className="w-5 h-5 text-indigo-400" />
                       <span className="text-xs font-bold text-slate-500 uppercase">Email</span>
                       <span className="font-mono text-sm">rks.arch@a360.com</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center gap-6 pt-8 border-t border-white/5">
                  <Linkedin className="w-6 h-6 text-slate-400 hover:text-blue-500 cursor-pointer transition-colors" />
                  <Github className="w-6 h-6 text-slate-400 hover:text-white cursor-pointer transition-colors" />
                  <Briefcase className="w-6 h-6 text-slate-400 hover:text-emerald-400 cursor-pointer transition-colors" />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

// Robust rendering to ensure DOM element is available
const initApp = () => {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    createRoot(rootElement).render(<RKSAssistant />);
  } else {
    // Retry once after a short delay if not found
    setTimeout(() => {
      const retryElement = document.getElementById('root');
      if (retryElement) createRoot(retryElement).render(<RKSAssistant />);
    }, 100);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
