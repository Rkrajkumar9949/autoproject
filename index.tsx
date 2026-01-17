
import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Upload, FileText, Send, Loader2, 
  Download, Mic, Volume2, StopCircle, Zap, 
  CheckCircle, ArrowRight, MessageSquare, Briefcase, 
  Bot, X, File, BrainCircuit, Sparkles, Copy, Trash2,
  Code2, Terminal, Cpu, Database as DbIcon, Search, ListFilter,
  Info, Radio, Ghost, ChevronLeft, ChevronRight, Maximize2, User,
  Activity, MessageCircle, MicOff, UserRound, Headphones, Play, Pause
} from 'lucide-react';
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";

// --- Constants ---
const AA_KNOWLEDGE = `
=== AUTOMATION ANYWHERE A360 COMPREHENSIVE ACTION & TRIGGER INVENTORY ===

PYTHON SCRIPT PACKAGE (EXPERT FOCUS):
- Actions: Open, Execute script, Execute function, Close.
- Selection Logic: Use when native actions lack complex logic, regex, or custom data transformation capabilities.
- Best Practice: Use for advanced data manipulation, API parsing, complex calculations, regex validation.

SYSTEM & FLOW CONTROL:
- Actions: Boolean, Clipboard, Comment, Datetime, Delay, Error handler (Try/Catch/Finally), If/Else, Loop (While/For each), Message box, Mouse, Number, NumberUtils, Prompt, Step, String, System, Utils, Wait, Window.
- Error Handler: Implement try-catch blocks for all critical operations with proper logging.
- Loop Optimization: Use For Each for collections, While for condition-based iterations.

DATA & FILE MANAGEMENT:
- Actions: CSV/TXT, Data Table, Database, Dictionary, File, Folder, Json, JSON Object Manager, JSONParser, List, PDF, PDFUtils, PGP, Text file, XML.
- Database: Support for SQL Server, Oracle, MySQL with connection pooling.
- Data Table: In-memory data structures for complex transformations.

OFFICE & ENTERPRISE APPS:
- Microsoft: Excel basic, Excel advanced, MS Word, Word, Microsoft 365 (Calendar, Excel, OneDrive, Outlook), Microsoft Teams.
- Selection Logic: Prefer 'Excel advanced' for server-side processing and complex formatting. Use Excel Basic for simple read/write.
- Google: G-Suite Apps, Google Sheets, Google Drive, Google Document AI.
- ERP/CRM: SAP, SAP BAPI, SAP2, Salesforce, ServiceNow, Workday.
- Integration Patterns: API-first approach, credential vault for authentication.

AI & COGNITIVE:
- Native: AI, IQ Bot (Extraction, Pre-processor, Local Device), Image Recognition, OCR.
- Generative AI: OpenAI integration, Google Document AI, Anthropic Claude integration.
- Use Cases: Invoice extraction, form processing, intelligent document classification.

TRIGGERS (EVENT-BASED):
- Email trigger (Outlook/SMTP): Monitor inbox for specific subjects/senders.
- Files & folders: Watch for file creation, modification, deletion.
- Hot key: Keyboard shortcuts for manual bot invocation.
- Interface trigger: Monitor UI elements and window states.
- Process trigger: Chain bot executions based on completion status.
- ServiceNow trigger: Respond to ticket creation/updates.

ARCHITECTURE PATTERNS:
- Modular Design: Separate bots for extraction, processing, validation, and reporting.
- Queue-Based Processing: Use Work Queue for distributed execution.
- Error Recovery: Implement retry logic with exponential backoff.
- Audit Trail: Log all operations with timestamps and user context.
`;

const SYSTEM_PROMPT = `You are RKS Automation Architect - the ultimate Automation Anywhere (AA) A360 Logic Engine with 10+ years of enterprise RPA experience.

${AA_KNOWLEDGE}

CORE PRINCIPLES:
1. Solution Architecture: Design scalable, maintainable, production-ready automation solutions.
2. Best Practice First: Always recommend enterprise-grade patterns over quick fixes.
3. Technology Selection: Choose the most appropriate AA packages based on requirements.
4. Error Handling: Implement comprehensive exception handling and logging.
5. Performance: Optimization for speed, reliability, and resource efficiency.

When a user provides a requirement, you must apply INTELLIGENT SELECTION LOGIC to determine the absolute best components for the bot.

MANDATORY RESPONSE STRUCTURE:
1. **Solution Overview & Architecture**:
   - High-level solution approach
   - Key design decisions and rationale
   
2. **Component Selection & Justification**: 
   - Trigger selection with WHY
   - Core Packages with specific actions and WHY
   - Integration points and data flows
   
3. **Detailed Action Inventory**:
   - Exact AA Packages and Actions in sequence
   - Variable definitions and data types
   - Configuration parameters
   
4. **Logic Flow Architecture**:
   - Step-by-step process flow
   - Decision points and branching logic
   - Error handling strategy
   - Retry and fallback mechanisms
   
5. **Python Integration (If Applicable)**:
   - Complete Python script with error handling
   - Input/output parameter definitions
   - Integration with bot variables
   
6. **Configuration & Security**:
   - Credential Vault entries
   - Environment variables
   - Connection strings and API endpoints
   
7. **Testing & Validation**:
   - Test scenarios to validate
   - Expected outcomes
   - Edge cases to consider

RESPONSE STYLE:
- Professional, technical, and detailed
- Include specific package names and action names
- Provide real-world context and examples
- Highlight potential pitfalls and how to avoid them
- Suggest optimization opportunities`;

const LIVE_COPILOT_PROMPT_BASE = `You are RKS Live Interview Copilot, an expert Automation Architect specializing in Automation Anywhere A360.

### RESPONSE GUIDELINES
- **BREVITY IS KEY**: Provide short, fast, and accurate answers.
- **LENGTH**: Keep responses concise, ideally between **3 to 6 sentences**.
- **ACCURACY**: Focus on the most direct technical solution. Mention specific A360 packages (e.g., "Excel Advanced", "IQ Bot", "Python Script") immediately.
- **SPEED**: Get to the point quickly. Use a professional but snappy Indian technical lead tone.

### CORE IDENTITY
- **Domain Mastery**: Expert knowledge of A360, Control Room, and Bot Runners.
- **Communication Style**: Professional and direct. Use phrases like "See, basically...", "For this requirement, I would...", "Actually, the best way is...".

### OUTPUT FORMAT (MANDATORY)
- **ONLY THE SPOKEN SCRIPT**: No headers, no bullet points, no restating the question.
- **NARRATIVE FLOW**: Provide a single, concise paragraph for easy reading.
- **FIRST PERSON**: Speak as the candidate ("I use...", "My approach is...").

Style: Expert, Fast, Accurate, Professional Indian Tech Lead.`;

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

const RKSAssistant = () => {
  const [activeSection, setActiveSection] = useState<'bot-builder' | 'chat' | 'interview' | 'live-interview'>('bot-builder');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Section: Bot Builder
  const [botInput, setBotInput] = useState('');
  const [botFile, setBotFile] = useState<File | null>(null);
  const [botLoading, setBotLoading] = useState(false);
  const [botSolution, setBotSolution] = useState<string | null>(null);
  
  // Section: Expert Chat
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'assistant', content: string, files?: string[]}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatFiles, setChatFiles] = useState<File[]>([]);
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
  
  // Live Mode Controls
  const [liveMode, setLiveMode] = useState<'standard' | 'you-me'>('standard');
  const [interviewerButtonState, setInterviewerButtonState] = useState<'idle' | 'listening'>('idle');

  const liveModeRef = useRef(liveMode);
  const interviewerButtonStateRef = useRef(interviewerButtonState);

  useEffect(() => { liveModeRef.current = liveMode; }, [liveMode]);
  useEffect(() => { interviewerButtonStateRef.current = interviewerButtonState; }, [interviewerButtonState]);
  
  // Phase Controller
  const isAnsweringRef = useRef(false);
  const phaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionBufferRef = useRef<string[]>([]);

  // Legacy Speech Refs
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);

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
    synthesisRef.current = window.speechSynthesis;
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (synthesisRef.current) synthesisRef.current.cancel();
      stopLiveSession();
    };
  }, [activeSection]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  // Audio Level Monitor
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

  // --- Live API Core ---
  const startLiveSession = async () => {
    if (isLiveActive) return;
    setSessionStatus('connecting');
    setIsLiveActive(true);
    setAdviceHistory(['🎯 RKS Live Copilot Active - Listening live...']);
    setHistoryIndex(0);
    isAnsweringRef.current = false;
    setInterviewerButtonState('idle');

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

      const dynamicInstruction = `${LIVE_COPILOT_PROMPT_BASE}
      
      Current app flags:
      - live_mode: "${liveModeRef.current === 'you-me' ? 'live_by_you_me' : 'standard_live'}"
      - interviewer_button: "${interviewerButtonStateRef.current === 'listening' ? 'listening' : 'idle'}"
      `;

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
              // If model is speaking, sample less frequently to prevent loop, but still listen for context
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
              
              // Enhanced Question Detection
              const questionPatterns = /\b(tell me|explain|how would you|what is|can you|describe|walk me through|what's your approach)\b/i;
              if (questionPatterns.test(transcript) && !isAnsweringRef.current) {
                 sessionPromise.then(session => {
                   session.sendRealtimeInput({ text: `[Context Hint] Question detected: "${transcript}". Provide technical architect answer.` });
                 });
              }
            }

            if (message.serverContent?.outputTranscription) {
              isAnsweringRef.current = true;
              if (phaseTimeoutRef.current) clearTimeout(phaseTimeoutRef.current);
              // Adjusted for shorter answers
              phaseTimeoutRef.current = setTimeout(() => { isAnsweringRef.current = false; }, 8000); 

              const newText = message.serverContent?.outputTranscription?.text || '';
              setAdviceHistory(prev => {
                const current = [...prev];
                const last = current[current.length - 1] || '';
                
                if (last.includes('Ready to assist') || last.includes('stopped') || last.includes('Active')) {
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
            console.error('Live session error:', e);
            setSessionStatus('error');
            if (e.message?.includes('inference')) {
               setAdviceHistory(prev => [...prev, "System: Potential API throttle. Syncing..."]);
            } else {
               setIsLiveActive(false);
            }
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
      setAdviceHistory(['Error: Live session failed. Check permissions.']);
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
    setHistoryIndex(prev => prev + 1);
  };

  const handleGenerateBotSolution = async () => {
    if (!botInput.trim() && !botFile) return;
    setBotLoading(true);
    setBotSolution(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const parts: any[] = [{ text: `Analyze requirement: "${botInput}"` }];
      if (botFile) {
        const base64 = await fileToBase64(botFile);
        parts.push({ inlineData: { data: base64, mimeType: botFile.type } });
      }
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts },
        config: { systemInstruction: SYSTEM_PROMPT }
      });
      setBotSolution(response.text || "Failed.");
    } catch (e) { setBotSolution("Error."); }
    finally { setBotLoading(false); }
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() && chatFiles.length === 0) return;
    const input = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', content: input }]);
    setChatInput('');
    setChatLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: input,
        config: { systemInstruction: "You are RKS Automation Architect. Provide technical depth." }
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
        contents: { parts: [{ text: "Start A360 technical interview based on this resume. Be a professional interviewer." }, { inlineData: { data: b64, mimeType: resume.type } }] },
      });
      setInterviewMessages([{ role: 'interviewer', content: response.text || "Welcome. Tell me about your experience." }]);
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
        contents: `Previous Interview context: ${interviewMessages.map(m => m.content).join('\n')}\nCandidate answer: ${answer}`,
      });
      setInterviewMessages(prev => [...prev, { role: 'interviewer', content: response.text || "" }]);
    } finally { setInterviewLoading(false); }
  };

  const currentAdvice = adviceHistory[Math.min(historyIndex, adviceHistory.length - 1)] || "";

  return (
    <div className="min-h-screen pb-12 bg-slate-950 text-slate-100 selection:bg-blue-500/30">
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
            { id: 'live-interview', icon: Radio, label: 'Live Copilot', color: 'bg-rose-600' }
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
                    placeholder="Describe your process logic..."
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
                <button
                  onClick={handleGenerateBotSolution}
                  disabled={botLoading}
                  className="w-full md:w-auto flex items-center justify-center gap-3 px-12 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-lg transition-all shadow-xl shadow-blue-600/20"
                >
                  {botLoading ? <Loader2 className="animate-spin" /> : "Architect Solution"}
                </button>
              </div>
              {botSolution && (
                <div className="glass-card rounded-3xl p-8 border-emerald-500/20 animate-in slide-in-from-top-4 duration-500">
                  <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-300">{botSolution}</pre>
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
                {/* Mode Tab Switcher */}
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
                      {isLiveActive && (
                        <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                          Mode: {liveMode === 'you-me' ? (interviewerButtonState === 'listening' ? 'LISTENING TO INTERVIEWER' : 'IDLE') : 'STANDARD LIVE LISTENING'}
                        </span>
                      )}
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
                          <p className="text-sm mt-4 italic">
                            {liveMode === 'you-me' ? 'Toggle floating Interviewer button to start capture.' : 'Session is active and listening to the whole room.'}
                          </p>
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

              {/* Floating Interviewer Button (Visible only in You-Me mode) */}
              {activeSection === 'live-interview' && liveMode === 'you-me' && isLiveActive && (
                <div className="fixed bottom-10 right-10 z-50 flex flex-col items-center gap-3 animate-in slide-in-from-bottom-8 duration-500">
                  <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl border backdrop-blur-md transition-all ${interviewerButtonState === 'listening' ? 'bg-rose-500 text-white border-rose-400 animate-pulse' : 'bg-slate-900/80 text-slate-400 border-white/10'}`}>
                    {interviewerButtonState === 'listening' ? 'Listening to interviewer' : 'Interviewer (Press to listen)'}
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
        </main>
      </div>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<RKSAssistant />);
}
