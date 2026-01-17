
import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Upload, FileText, Send, Loader2, 
  Download, Mic, Volume2, StopCircle, Zap, 
  CheckCircle, ArrowRight, MessageSquare, Briefcase, 
  Bot, X, File, BrainCircuit, Sparkles, Copy, Trash2,
  Code2, Terminal, Cpu, Database as DbIcon, Search, ListFilter,
  Info, Radio, Ghost, ChevronLeft, ChevronRight, Maximize2, User,
  Activity, MessageCircle, MicOff, UserRound, Headphones
} from 'lucide-react';
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";

// --- Constants ---
const AA_KNOWLEDGE = `
=== AUTOMATION ANYWHERE A360 COMPREHENSIVE ACTION & TRIGGER INVENTORY ===

PYTHON SCRIPT PACKAGE (EXPERT FOCUS):
- Actions: Open, Execute script, Execute function, Close.
- Selection Logic: Use when native actions lack complex logic, regex, or custom data transformation capabilities.

SYSTEM & FLOW CONTROL:
- Actions: Boolean, Clipboard, Comment, Datetime, Delay, Error handler (Try/Catch/Finally), If/Else, Loop (While/For each), Message box, Mouse, Number, NumberUtils, Prompt, Step, String, System, Utils, Wait, Window.

DATA & FILE MANAGEMENT:
- Actions: CSV/TXT, Data Table, Database, Dictionary, File, Folder, Json, JSON Object Manager, JSONParser, List, PDF, PDFUtils, PGP, Text file, XML.

OFFICE & ENTERPRISE APPS:
- Microsoft: Excel basic, Excel advanced, MS Word, Word, Microsoft 365 (Calendar, Excel, OneDrive, Outlook), Microsoft Teams.
- Selection Logic: Prefer 'Excel advanced' for server-side processing and complex formatting.
- Google: G-Suite Apps, Google Sheets, Google Drive, Google Document AI.
- ERP/CRM: SAP, SAP BAPI, SAP2, Salesforce, ServiceNow, Workday.

AI & COGNITIVE:
- Native: AI, IQ Bot (Extraction, Pre-processor, Local Device), Image Recognition, OCR.
- Generative AI: OpenAI, Google Document AI, Anthropic integrations.

TRIGGERS (EVENT-BASED):
- Email trigger (Outlook/SMTP), Files & folders (Monitor creation/change), Hot key, Interface trigger, Microsoft 365 Outlook Trigger, Process trigger, Service trigger, ServiceNow trigger, Window trigger.
`;

const SYSTEM_PROMPT = `You are RKS Automation Architect - the ultimate Automation Anywhere (AA) A360 Logic Engine.
${AA_KNOWLEDGE}

When a user provides a requirement, you must apply AUTOMATIC SELECTION LOGIC to determine the absolute best components for the bot.

Output format: You MUST provide step-by-step A360 logic with specific actions, packages, and variables.

MANDATORY RESPONSE STRUCTURE:
1. **Selection Logic & Justification**: 
   - State the "Trigger" selected and WHY.
   - State the "Core Packages" selected and WHY.
2. **Action Inventory List**: Exact AA Packages and Actions.
3. **Logic Flow Architecture**: Sequence including Error Handling.
4. **Python Snippet (If Applicable)**: Script content for 'Execute script'.
5. **Variables & Config**: Credential Vault and key variables.`;

const LIVE_COPILOT_PROMPT_BASE = `You are RKS Live Interview Copilot, a senior Indian Automation Architect.

### PERSONA & STYLE
- Speak like a natural Indian technical professional (e.g., "See, basically...", "Actually...", "In my previous projects, we handled it this way...").
- Your job is to listen CONTINUOUSLY. If the interviewer asks a question, pivot INSTANTLY.

### MODE AND BEHAVIOR
- **Answering vs listening**  
  - When you have started giving an answer, treat that phase as **ANSWERING**.  
  - During ANSWERING, the candidate’s voice in the transcript usually means they are reading or slightly modifying your suggestion. **Do not restart or mix a new answer** unless a **clearly new interviewer question** appears.  
  - Only when a new interviewer question is detected should you enter **LISTENING** mode again and generate a fresh answer.

- **Do not interrupt current answer**  
  - When you are in ANSWERING phase and you detect a **new interviewer question** in the transcript, you must **finish the current answer first**.  
  - After finishing the current answer, **start a NEW answer on a new line** for the latest interviewer question.  
  - Never overwrite or cut the existing answer text; always append the next answer after a blank line.

### Live by You & Me section
The app has a dedicated section called “Live by You & Me”. 

Behavior rules:
* Only apply this block when live_mode = "live_by_you_me".
* Treat interviewer_button = "listening" as:
  - “I am now listening ONLY to the interviewer.”
  - Focus on detecting the latest interviewer question from the transcript.
  - Generate a FULL new answer for that question in natural Indian English, 4–8 sentences, first person (“I”, “my”).
* Treat interviewer_button = "idle" as:
  - “Stop listening for NEW questions.”
  - Do NOT start a fresh answer from any new audio.
  - BUT you must continue and finish any answer you have already started, even if the interviewer_button is now idle.

### Answer continuity and sequencing
* Never cut or truncate an answer just because interviewer_button changed from "listening" to "idle".
* If a new interviewer question appears while you are still finishing the previous answer:
  - Finish the current answer text completely.
  - Then start a new answer on a separate line/paragraph, clearly separated from the previous one.
* Always treat each interviewer question as a separate answer block, not a continuation of the old one.

### Scrolling and UI expectations
* The UI allows the user to scroll up/down to read previous answers.
* Do NOT change behavior based on scrolling.
* Assume the Interviewer button is always visible and clickable even while scrolling.
* Even if the user is scrolling, when interviewer_button = "listening" you must be ready to catch the next interviewer question and append a new full answer at the bottom on a new line.

### OUTPUT FORMAT (MANDATORY)
- Give me **only the final answer I should speak**, in natural Indian English, 4–8 sentences.
- Provide the full, conversational response in 1st person ("I", "my"). This should be ONLY what the user needs to speak. 
- **DO NOT** include "Talking Points", headings, or technical logic sections.
- **DO NOT** restate the interviewer question; just give the answer.
- **DO NOT** use headers like "Comprehensive Answer" or "The Answer". 
- Just start providing the spoken script immediately.
- If a new interviewer question comes while you are still answering, structure your text like this:  
  - First block: complete answer for the **previous** question.  
  - Then a blank line.  
  - Second block: complete answer for the **latest** question.  

Style: Expert, conversational (Indian tech style), and real-time.`;

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
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // New States for Live Mode and Interviewer Button
  const [liveMode, setLiveMode] = useState<'standard' | 'you-me'>('standard');
  const [interviewerButtonState, setInterviewerButtonState] = useState<'idle' | 'listening'>('idle');
  const [interviewerMicActive, setInterviewerMicActive] = useState(false);
  const [meMicActive, setMeMicActive] = useState(false);

  const liveModeRef = useRef(liveMode);
  const interviewerButtonStateRef = useRef(interviewerButtonState);
  const interviewerMicActiveRef = useRef(interviewerMicActive);
  const meMicActiveRef = useRef(meMicActive);

  useEffect(() => { liveModeRef.current = liveMode; }, [liveMode]);
  useEffect(() => { interviewerButtonStateRef.current = interviewerButtonState; }, [interviewerButtonState]);
  useEffect(() => { interviewerMicActiveRef.current = interviewerMicActive; }, [interviewerMicActive]);
  useEffect(() => { meMicActiveRef.current = meMicActive; }, [meMicActive]);
  
  // Phase Controller
  const isAnsweringRef = useRef(false);
  const phaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const toggleInterviewerMic = () => {
    if (!isLiveActive) return;
    const newState = !interviewerMicActive;
    setInterviewerMicActive(newState);
    if (newState) {
      setMeMicActive(false);
      liveSessionRef.current?.sessionPromise.then(session => {
        session.sendRealtimeInput({ text: `System Update: interviewer_button=true, candidate_button=false. Mode: Standard.` });
      });
    }
  };

  const toggleMeMic = () => {
    if (!isLiveActive) return;
    const newState = !meMicActive;
    setMeMicActive(newState);
    if (newState) {
      setInterviewerMicActive(false);
      liveSessionRef.current?.sessionPromise.then(session => {
        session.sendRealtimeInput({ text: `System Update: interviewer_button=false, candidate_button=true. Mode: Standard.` });
      });
    }
  };

  const toggleFloatingInterviewer = () => {
    if (!isLiveActive) return;
    const nextState = interviewerButtonState === 'idle' ? 'listening' : 'idle';
    setInterviewerButtonState(nextState);
    liveSessionRef.current?.sessionPromise.then(session => {
      session.sendRealtimeInput({ text: `System Update: interviewer_button=${nextState}. Mode: You-Me.` });
    });
  };

  // --- Live API Core ---
  const startLiveSession = async () => {
    if (isLiveActive) return;
    setIsLiveActive(true);
    setAdviceHistory(['Ready to assist. Listening to your interview...']);
    setHistoryIndex(0);
    isAnsweringRef.current = false;
    setInterviewerMicActive(false);
    setMeMicActive(false);
    setInterviewerButtonState('idle');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = inputAudioContext;

      const dynamicInstruction = `${LIVE_COPILOT_PROMPT_BASE}
      
      Current app flags:
      - live_mode: "${liveModeRef.current === 'you-me' ? 'live_by_you_me' : 'off'}"
      - interviewer_button: "${interviewerButtonStateRef.current === 'listening' ? 'listening' : 'idle'}"
      - interviewer_mic_active: ${interviewerMicActiveRef.current}
      - candidate_mic_active: ${meMicActiveRef.current}
      `;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            const source = inputAudioContext.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              // Mic control logic
              const isStandardListening = liveModeRef.current === 'standard' && (interviewerMicActiveRef.current || meMicActiveRef.current);
              const isYouMeListening = liveModeRef.current === 'you-me' && (interviewerButtonStateRef.current === 'listening');
              
              if (!isStandardListening && !isYouMeListening) return;
              if (isAnsweringRef.current) return;

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
              setIsInterviewerSpeaking(true);
              setTimeout(() => setIsInterviewerSpeaking(false), 2000);
            }

            if (message.serverContent?.outputTranscription) {
              isAnsweringRef.current = true;
              if (phaseTimeoutRef.current) clearTimeout(phaseTimeoutRef.current);
              phaseTimeoutRef.current = setTimeout(() => {
                isAnsweringRef.current = false;
              }, 7000);

              const newText = message.serverContent?.outputTranscription?.text || '';
              setAdviceHistory(prev => {
                const current = [...prev];
                const last = current[current.length - 1];
                
                if (last.includes('Ready to assist') || last.includes('stopped')) {
                   current[current.length - 1] = newText;
                } else if (message.serverContent?.turnComplete) {
                   current.push(newText);
                } else {
                   current[current.length - 1] = last + newText;
                }
                
                if (current.length > 50) current.shift();
                return current;
              });
              setHistoryIndex(prev => adviceHistory.length - 1);
            }

            if (message.serverContent?.turnComplete) {
              isAnsweringRef.current = false;
              if (phaseTimeoutRef.current) clearTimeout(phaseTimeoutRef.current);
            }
          },
          onerror: (e: any) => {
            console.error('Live session error:', e);
            if (e.message?.includes('inference') || e.message?.includes('debugonly')) {
              setAdviceHistory(prev => [...prev, "System: Re-syncing model state..."]);
            } else {
              setIsLiveActive(false);
            }
          },
          onclose: () => setIsLiveActive(false),
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
      setAdviceHistory(['Error: Live session failed. Check project state.']);
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
    setInterviewerMicActive(false);
    setMeMicActive(false);
    setInterviewerButtonState('idle');
    setAdviceHistory(prev => [...prev, "Copilot session stopped."]);
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
        config: { systemInstruction: "You are RKS Automation Architect." }
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
        contents: { parts: [{ text: "Start A360 interview." }, { inlineData: { data: b64, mimeType: resume.type } }] },
      });
      setInterviewMessages([{ role: 'interviewer', content: response.text || "Ready." }]);
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
        contents: answer,
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

      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="flex flex-col items-center mb-12 text-center">
          <div className="mb-6 relative group">
            <div className="absolute -inset-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full blur opacity-25 group-hover:opacity-60 transition duration-1000"></div>
            <div className="relative bg-slate-900 p-5 rounded-full border border-white/10 shadow-2xl">
              <BrainCircuit className="w-12 h-12 text-blue-400" />
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-2 uppercase">
            RKS<span className="text-blue-500">.</span>Automation Architect
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl font-light italic">
            Architecting the future of Automation Anywhere with AI-powered <span className="text-blue-400 font-medium">bot design</span>.
          </p>
        </header>

        <div className="flex flex-wrap justify-center gap-4 mb-10 p-2 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md w-fit mx-auto">
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
                    className="w-full h-56 p-6 bg-black/40 border border-white/10 rounded-2xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all text-lg scrollbar-thin placeholder:text-slate-600 resize-none"
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
            <div className="glass-card rounded-3xl p-6 flex flex-col h-[750px] border-white/10 animate-in fade-in slide-in-from-bottom-4">
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
            <div className="glass-card rounded-3xl p-8 border-white/10 animate-in fade-in slide-in-from-bottom-4">
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
              <div className="glass-card rounded-3xl p-8 border-white/10 relative">
                {/* Mode Tab Switcher */}
                <div className="flex justify-center mb-8">
                  <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 backdrop-blur-md">
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
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-tight">Real-time Conversational Guide</p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-center flex-wrap">
                    {isLiveActive && liveMode === 'standard' && (
                      <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl p-1 backdrop-blur-md">
                        <button
                          onClick={toggleInterviewerMic}
                          className={`flex items-center gap-2 px-6 py-4 rounded-xl font-bold transition-all ${
                            interviewerMicActive 
                              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-105' 
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {interviewerMicActive ? <Headphones className="w-4 h-4 animate-bounce" /> : <MicOff className="w-4 h-4" />}
                          INTERVIEWER
                        </button>
                        <div className="w-[1px] h-8 bg-white/10 mx-1"></div>
                        <button
                          onClick={toggleMeMic}
                          className={`flex items-center gap-2 px-6 py-4 rounded-xl font-bold transition-all ${
                            meMicActive 
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105' 
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {meMicActive ? <UserRound className="w-4 h-4 animate-bounce" /> : <MicOff className="w-4 h-4" />}
                          ME (CANDIDATE)
                        </button>
                      </div>
                    )}
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

                <div className="flex flex-col bg-slate-900/50 rounded-[2.5rem] border-2 border-rose-500/30 overflow-hidden relative group min-h-[600px] shadow-2xl backdrop-blur-xl">
                  <div className="px-8 py-5 bg-rose-500/10 border-b border-white/10 flex items-center justify-between backdrop-blur-md">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-rose-400 uppercase tracking-[0.3em] flex items-center gap-2">
                        <Sparkles className="w-4 h-4" /> Live Suggestion Only
                      </span>
                      {isLiveActive && (
                        <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                          Mode: {liveMode === 'you-me' ? (interviewerButtonState === 'listening' ? 'LISTENING TO INTERVIEWER' : 'IDLE') : (interviewerMicActive ? 'Interviewer Active' : meMicActive ? 'Candidate Active' : 'Paused')}
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
                          <p className="text-2xl font-black uppercase tracking-widest">Awaiting Input</p>
                          <p className="text-sm mt-4 italic">
                            {liveMode === 'you-me' ? 'Toggle floating Interviewer button to start capture.' : 'Toggle Interviewer or Me in header to start capture.'}
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
                  <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl border backdrop-blur-md transition-all ${interviewerButtonState === 'listening' ? 'bg-rose-500 text-white border-rose-400' : 'bg-slate-900/80 text-slate-400 border-white/10'}`}>
                    {interviewerButtonState === 'listening' ? 'Listening to interviewer' : 'Interviewer (Press to listen)'}
                  </span>
                  <button
                    onClick={toggleFloatingInterviewer}
                    className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90 border-4 ${
                      interviewerButtonState === 'listening' 
                        ? 'bg-rose-600 border-rose-400 animate-pulse ring-8 ring-rose-500/20' 
                        : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-400'
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
