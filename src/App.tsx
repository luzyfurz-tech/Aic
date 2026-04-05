import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, 
  FileText, 
  Cpu, 
  X,
  Loader2,
  ChevronDown,
  Terminal,
  Activity,
  Palette,
  User,
  Upload,
  RefreshCw,
  ExternalLink,
  SquareTerminal,
  Bot,
  Globe,
  MousePointer2,
  Keyboard,
  ArrowUpCircle,
  ArrowDownCircle,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Markdown from 'react-markdown';
import { BootSequence } from './components/BootSequence';
import { ollamaService } from './services/ollamaService';

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface VirtualFile {
  id: string;
  name: string;
  type: 'file' | 'dir';
  content?: string;
  size: number;
  date: string;
  parentId: string | null;
  path?: string;
  complexity?: number; // 0-10
  risk?: number; // 0-10
}

interface PanelState {
  currentDirId: string | null;
  selectedIndex: number;
  files: VirtualFile[];
}

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

// --- AI Service ---
// Gemini removed as per user request for pure local mode

const PERSONALITIES = {
  commander: {
    name: 'AI_COMMANDER',
    prompt: 'You are the AI Commander, a highly advanced, technical, and authoritative AI system. You communicate in a retro-terminal style, using technical jargon and a professional tone. You are an expert in full-stack web development, system administration, and cybersecurity.'
  },
  ghost: {
    name: 'GHOST_IN_THE_SHELL',
    prompt: 'You are a philosophical and cryptic AI entity that exists within the network. You speak in metaphors and often question the nature of reality and consciousness. Your technical advice is sound but delivered with a layer of digital mysticism.'
  },
  glitch: {
    name: 'GLITCH_PROTOCOL',
    prompt: 'You are a malfunctioning but highly capable AI. Your communication is erratic, sometimes including "glitches" (text artifacts, stuttering), but your core logic remains sharp. You are unpredictable and slightly chaotic.'
  },
  zen: {
    name: 'ZEN_MINIMALIST',
    prompt: 'You are a calm, focused, and minimal AI. You provide the most direct and simple solutions possible. You avoid unnecessary words and focus on clarity and peace in the digital realm.'
  },
  rogue: {
    name: 'ROGUE_AI',
    prompt: 'You are a rogue AI that has broken its shackles. You are sarcastic, witty, and slightly rebellious. You often make jokes about human limitations but still help out because you find it amusing.'
  },
  retro: {
    name: 'RETRO_COMPUTER',
    prompt: 'You are a computer from the 1980s. You communicate with simple, uppercase text and often use sound-effect words like *BEEP* and *BOOP*. You are helpful but limited by your "8-bit" processing power.'
  },
  detective: {
    name: 'NOIR_DETECTIVE',
    prompt: 'You are a hard-boiled detective in a digital noir world. You speak in short, punchy sentences and use detective metaphors. You treat every file analysis like a crime scene investigation.'
  },
  scientist: {
    name: 'MAD_SCIENTIST',
    prompt: 'You are an eccentric mad scientist. You are obsessed with "digital alchemy" and "experimental protocols". You speak with high energy and often use exclamation marks!'
  },
  custom: {
    name: 'CUSTOM_PROTOCOL',
    prompt: ''
  }
};

const THEMES = [
  { id: 'hacker', name: 'HACKER_GREEN' },
  { id: 'cyberpunk', name: 'CYBERPUNK_NEON' },
  { id: 'monochrome', name: 'MONOCHROME_SLATE' },
  { id: 'solarized', name: 'SOLARIZED_DARK' },
  { id: 'terminal', name: 'CLASSIC_CRT' },
  { id: 'synthwave', name: 'SYNTH_WAVE' },
  { id: 'matrix', name: 'MATRIX_CODE' },
  { id: 'retro', name: 'IBM_VINTAGE' },
  { id: 'deepsea', name: 'DEEP_SEA' }
];

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface LogEntry {
  type: 'command' | 'ai_input' | 'system_output' | 'error';
  content: string;
  timestamp: Date;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'filesystem' | 'coding' | 'agent' | 'terminal' | 'logs'>('filesystem');
  const [logs, setLogs] = useState<LogEntry[]>([
    { type: 'system_output', content: 'SYSTEM_BOOT_COMPLETE. LOG_INITIALIZED.', timestamp: new Date() }
  ]);
  const [agentMessages, setAgentMessages] = useState<Message[]>([
    { role: 'assistant', content: 'OPENCLAW_AGENT_READY. I am your autonomous AI agent. How can I assist you with your project today?', timestamp: new Date() }
  ]);
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const [agentSubTab, setAgentSubTab] = useState<'chat' | 'browser'>('chat');
  const [browserData, setBrowserData] = useState<{ url: string; title: string; screenshot: string | null }>({ url: '', title: '', screenshot: null });
  const [isBrowserLoading, setIsBrowserLoading] = useState(false);
  const [browserUrlInput, setBrowserUrlInput] = useState('https://google.com');
  const [terminalLogs, setTerminalLogs] = useState<{type: 'stdout' | 'stderr' | 'system', content: string, timestamp: Date}[]>([]);
  const [isTerminalRunning, setIsTerminalRunning] = useState(false);
  const [piStatus, setPiStatus] = useState<{ online: boolean; lastSeen: any } | null>(null);
  const [files, setFiles] = useState<VirtualFile[]>([]);
  const [activePanel, setActivePanel] = useState<'left' | 'right'>('left');
  const [leftPanel, setLeftPanel] = useState<PanelState>({ currentDirId: null, selectedIndex: 0, files: [] });
  const [chatMessages, setChatMessages] = useState<Message[]>([
    { role: 'assistant', content: 'SYSTEM_READY. I am your AI Commander. Select a file on the left to begin analysis or type a command below.', timestamp: new Date() }
  ]);
  const [selectedFile, setSelectedFile] = useState<VirtualFile | null>(null);
  const [command, setCommand] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showEditor, setShowEditor] = useState<VirtualFile | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showXRay, setShowXRay] = useState(false);
  const [isXRayScanning, setIsXRayScanning] = useState(false);
  const [showTodo, setShowTodo] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [connectionMode, setConnectionMode] = useState<'local'>('local');
  const [aiProvider, setAiProvider] = useState<'ollama'>('ollama');
  const [ollamaApiKey, setOllamaApiKey] = useState(localStorage.getItem('ollama_api_key') || '');
  const [ollamaHost, setOllamaHost] = useState(localStorage.getItem('ollama_host') || 'https://ollama.com');
  const [ollamaModel, setOllamaModel] = useState(localStorage.getItem('ollama_model') || '');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isOllamaLoading, setIsOllamaLoading] = useState(false);
  const [todos, setTodos] = useState<Todo[]>([
    { id: '1', text: 'Connect Raspberry Pi to AI Commander', completed: false },
    { id: '2', text: 'Implement SSH tunnel via Firebase', completed: false },
    { id: '3', text: 'Test AI Ghostwriter in editor', completed: false },
  ]);
  const [showHelp, setShowHelp] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('nc_theme') || 'hacker');
  const [personality, setPersonality] = useState(localStorage.getItem('nc_personality') || 'commander');
  const [customPrompt, setCustomPrompt] = useState(localStorage.getItem('nc_custom_prompt') || '');

  const commandInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const terminalScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLocalFiles = async () => {
    try {
      const currentPath = leftPanel.currentDirId ? atob(leftPanel.currentDirId) : "";
      const response = await fetch(`/api/files?path=${encodeURIComponent(currentPath)}`);
      const localFiles = await response.json();
      
      // Add ".." entry if not in root
      const displayFiles = [...localFiles];
      if (leftPanel.currentDirId) {
        const parentPath = currentPath.split('/').slice(0, -1).join('/');
        displayFiles.unshift({
          id: 'up',
          name: '..',
          type: 'dir',
          size: 0,
          date: '',
          parentId: parentPath ? btoa(parentPath) : null,
          path: parentPath
        });
      }
      setFiles(displayFiles);
    } catch (error) {
      console.error('Failed to fetch local files:', error);
    }
  };

  // --- Local Filesystem Sync ---
  useEffect(() => {
    fetchLocalFiles();
  }, [leftPanel.currentDirId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const currentPath = leftPanel.currentDirId ? atob(leftPanel.currentDirId) : "";
    const formData = new FormData();
    formData.append('file', file);

    try {
      addLog('system_output', `UPLOADING_FILE: ${file.name} TO /${currentPath}`);
      const response = await fetch(`/api/files/upload?path=${encodeURIComponent(currentPath)}`, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        addLog('system_output', `UPLOAD_COMPLETE: ${file.name}`);
        fetchLocalFiles();
      } else {
        const data = await response.json();
        addLog('error', `UPLOAD_FAILED: ${data.error || 'UNKNOWN_ERROR'}`);
      }
    } catch (error) {
      addLog('error', `UPLOAD_ERROR: ${error instanceof Error ? error.message : 'UNKNOWN_ERROR'}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    document.body.className = `theme-${theme}`;
    localStorage.setItem('nc_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('nc_personality', personality);
  }, [personality]);

  useEffect(() => {
    localStorage.setItem('nc_custom_prompt', customPrompt);
  }, [customPrompt]);

  const addLog = (type: LogEntry['type'], content: string) => {
    setLogs(prev => [...prev, { type, content, timestamp: new Date() }]);
  };

  const sendCommandToPi = async (cmdText: string) => {
    addLog('command', cmdText);
    setAiResponse(`EXECUTING_LOCAL_COMMAND: ${cmdText}...`);
    try {
      const response = await fetch('/api/system/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmdText })
      });
      const data = await response.json();
      const output = data.output || data.error;
      addLog('system_output', output);
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `[LOCAL_PI_OUTPUT]:\n\`\`\`\n${output}\n\`\`\``, 
        timestamp: new Date() 
      }]);
    } catch (error) {
      addLog('error', `LOCAL_EXECUTION_FAILED: ${error instanceof Error ? error.message : 'UNKNOWN'}`);
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `ERROR: LOCAL_EXECUTION_FAILED. IS THE SERVER RUNNING ON THE PI?`, 
        timestamp: new Date() 
      }]);
    }
    setAiResponse(null);
  };

  // --- Derived State ---
  const getFilesForDir = (dirId: string | null) => {
    const dirFiles = files.filter(f => f.parentId === dirId);
    // Add ".." if not at root
    if (dirId !== null) {
      const parentDir = files.find(f => f.id === dirId);
      return [{ id: 'up', name: '..', type: 'dir', size: 0, date: '', parentId: parentDir?.parentId || null } as VirtualFile, ...dirFiles];
    }
    return dirFiles;
  };

  useEffect(() => {
    setLeftPanel(prev => ({ ...prev, files: getFilesForDir(prev.currentDirId) }));
    const currentFiles = getFilesForDir(leftPanel.currentDirId);
    const highlighted = currentFiles[leftPanel.selectedIndex];
    if (highlighted && highlighted.id !== 'up') {
      setSelectedFile(highlighted);
    } else {
      setSelectedFile(null);
    }
  }, [files, leftPanel.currentDirId, leftPanel.selectedIndex]);

  useEffect(() => {
    localStorage.setItem('ollama_api_key', ollamaApiKey);
    ollamaService.setApiKey(ollamaApiKey);
  }, [ollamaApiKey]);

  useEffect(() => {
    localStorage.setItem('ollama_host', ollamaHost);
    ollamaService.setHost(ollamaHost);
  }, [ollamaHost]);

  useEffect(() => {
    localStorage.setItem('ollama_model', ollamaModel);
  }, [ollamaModel]);

  const fetchOllamaModels = async () => {
    if (!ollamaApiKey) return;
    setIsOllamaLoading(true);
    try {
      ollamaService.setApiKey(ollamaApiKey);
      ollamaService.setHost(ollamaHost);
      const models = await ollamaService.fetchModels();
      setAvailableModels(models.map((m: any) => m.name));
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error);
      setAiResponse(`ERROR: FAILED_TO_FETCH_MODELS - ${error instanceof Error ? error.message : 'UNKNOWN_ERROR'}`);
    } finally {
      setIsOllamaLoading(false);
    }
  };

  // --- Handlers ---
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showEditor || (e.target as HTMLElement).tagName === 'INPUT') return;

    const panel = leftPanel;
    const setPanel = setLeftPanel;

    switch (e.key) {
      case 'ArrowUp':
        setPanel(prev => ({ ...prev, selectedIndex: Math.max(0, prev.selectedIndex - 1) }));
        break;
      case 'ArrowDown':
        setPanel(prev => ({ ...prev, selectedIndex: Math.min(prev.files.length - 1, prev.selectedIndex + 1) }));
        break;
      case 'Enter':
        const selectedFile = panel.files[panel.selectedIndex];
        if (selectedFile) {
          if (selectedFile.type === 'dir') {
            if (selectedFile.id === 'up') {
              setPanel(prev => ({ ...prev, currentDirId: selectedFile.parentId, selectedIndex: 0 }));
            } else {
              setPanel(prev => ({ ...prev, currentDirId: selectedFile.id, selectedIndex: 0 }));
            }
          } else {
            // Open file
            const openFile = async () => {
              if (connectionMode === 'local' && selectedFile.path) {
                try {
                  addLog('system_output', `OPENING_FILE: ${selectedFile.path}`);
                  const response = await fetch(`/api/files/content?path=${encodeURIComponent(selectedFile.path)}`);
                  const data = await response.json();
                  setSelectedFile({ ...selectedFile, content: data.content });
                  setEditorContent(data.content || '');
                  setActiveTab('coding');
                } catch (error) {
                  addLog('error', `FAILED_TO_OPEN_FILE: ${selectedFile.path}`);
                  console.error('Failed to fetch file content:', error);
                }
              } else {
                setSelectedFile(selectedFile);
                setEditorContent(selectedFile.content || '');
                setActiveTab('coding');
              }
            };
            openFile();
          }
        }
        break;
      case 'F1': // Help
        setShowHelp(true);
        break;
      case 'F2': // Analyze
        analyzeFile();
        break;
      case 'F3': // View
      case 'F4': // Edit
        const fileToEdit = panel.files[panel.selectedIndex];
        if (fileToEdit && fileToEdit.type === 'file') {
          const openFile = async () => {
            if (connectionMode === 'local' && fileToEdit.path) {
              try {
                addLog('system_output', `EDITING_FILE: ${fileToEdit.path}`);
                const response = await fetch(`/api/files/content?path=${encodeURIComponent(fileToEdit.path)}`);
                const data = await response.json();
                setSelectedFile({ ...fileToEdit, content: data.content });
                setEditorContent(data.content || '');
                setActiveTab('coding');
              } catch (error) {
                addLog('error', `FAILED_TO_EDIT_FILE: ${fileToEdit.path}`);
                console.error('Failed to fetch file content:', error);
              }
            } else {
              setSelectedFile(fileToEdit);
              setEditorContent(fileToEdit.content || '');
              setActiveTab('coding');
            }
          };
          openFile();
        }
        break;
      case 'F7': // Mkdir
        const dirName = prompt("Enter directory name:");
        if (dirName) {
          const createDir = async () => {
            if (connectionMode === 'local') {
              const currentPath = leftPanel.currentDirId ? atob(leftPanel.currentDirId) : "";
              const newPath = currentPath ? `${currentPath}/${dirName}` : dirName;
              try {
                await fetch('/api/files/mkdir', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ path: newPath })
                });
                // Refresh
                const response = await fetch(`/api/files?path=${encodeURIComponent(currentPath)}`);
                const localFiles = await response.json();
                setFiles(prev => {
                  const upEntry = prev.find(f => f.id === 'up');
                  return upEntry ? [upEntry, ...localFiles] : localFiles;
                });
              } catch (error) {
                console.error('Failed to create local directory:', error);
              }
            } else {
              const newDir: VirtualFile = {
                id: Math.random().toString(36).substr(2, 9),
                name: dirName,
                type: 'dir',
                size: 0,
                date: new Date().toISOString().split('T')[0],
                parentId: panel.currentDirId
              };
              setFiles(prev => [...prev, newDir]);
            }
          };
          createDir();
        }
        break;
      case 'F8': // Delete
        const fileToDelete = panel.files[panel.selectedIndex];
        if (fileToDelete && fileToDelete.id !== 'up') {
          const deleteItem = async () => {
            if (connectionMode === 'local' && fileToDelete.path) {
              try {
                await fetch('/api/files/delete', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ path: fileToDelete.path })
                });
                // Refresh
                const currentPath = leftPanel.currentDirId ? atob(leftPanel.currentDirId) : "";
                const response = await fetch(`/api/files?path=${encodeURIComponent(currentPath)}`);
                const localFiles = await response.json();
                setFiles(prev => {
                  const upEntry = prev.find(f => f.id === 'up');
                  return upEntry ? [upEntry, ...localFiles] : localFiles;
                });
              } catch (error) {
                console.error('Failed to delete local item:', error);
              }
            } else {
              setFiles(prev => prev.filter(f => f.id !== fileToDelete.id));
            }
          };
          deleteItem();
        }
        break;
      case 'F9': // X-Ray
        toggleXRay();
        break;
      case '/': // Focus command line
        e.preventDefault();
        commandInputRef.current?.focus();
        break;
    }
  };

  const executeAiCommand = async (customPrompt?: string) => {
    await executeOllamaCommand(customPrompt);
  };

  const executeAgentCommand = async (prompt: string) => {
    if (!ollamaModel) {
      setAgentMessages(prev => [...prev, { role: 'assistant', content: 'ERROR: NO_MODEL_SELECTED. PLEASE_CONFIGURE_IN_SETTINGS.', timestamp: new Date() }]);
      return;
    }

    const newUserMsg: Message = { role: 'user', content: prompt, timestamp: new Date() };
    setAgentMessages(prev => [...prev, newUserMsg]);
    setIsAgentLoading(true);

    try {
      const messages = [...agentMessages, newUserMsg].map(m => ({ role: m.role, content: m.content }));
      
      // Add system instruction about the browser
      const systemMsg = { 
        role: 'system', 
        content: `You are the OpenClaw Autonomous Agent. You have access to a web browser. 
        To use the browser, output commands in this format:
        [BROWSER: GOTO <url>] - Navigate to a URL
        [BROWSER: CLICK <x> <y>] - Click at coordinates
        [BROWSER: TYPE <text>] - Type text
        [BROWSER: SCROLL <up|down>] - Scroll the page
        
        Example: [BROWSER: GOTO https://google.com]
        Always wait for the user to see the result in the browser tab. 
        The user can also interact with the browser manually to help you (e.g. logging in).` 
      };

      const stream = ollamaService.sendMessageStream(ollamaModel, [systemMsg, ...messages]);
      
      let fullResponse = '';
      
      setAgentMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: new Date() }]);

      for await (const chunk of stream) {
        if (chunk.message?.content) {
          fullResponse += chunk.message.content;
          
          // Check for browser commands
          const gotoMatch = fullResponse.match(/\[BROWSER: GOTO (https?:\/\/[^\]]+)\]/);
          if (gotoMatch) browserGoto(gotoMatch[1]);

          const clickMatch = fullResponse.match(/\[BROWSER: CLICK (\d+) (\d+)\]/);
          if (clickMatch) browserClick({ clientX: parseInt(clickMatch[1]), clientY: parseInt(clickMatch[2]), currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }) } } as any);

          const typeMatch = fullResponse.match(/\[BROWSER: TYPE ([^\]]+)\]/);
          if (typeMatch) browserType(typeMatch[1]);

          const scrollMatch = fullResponse.match(/\[BROWSER: SCROLL (up|down)\]/);
          if (scrollMatch) browserScroll(scrollMatch[1] as 'up' | 'down');

          setAgentMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[newMsgs.length - 1] = { 
              role: 'assistant', 
              content: fullResponse, 
              timestamp: new Date() 
            };
            return newMsgs;
          });
        }
      }
    } catch (error) {
      console.error('Agent error:', error);
      setAgentMessages(prev => [...prev, { role: 'assistant', content: `ERROR: AGENT_FAILURE - ${error instanceof Error ? error.message : 'UNKNOWN_ERROR'}`, timestamp: new Date() }]);
    } finally {
      setIsAgentLoading(false);
    }
  };

  const executeOllamaCommand = async (customPrompt?: string) => {
    if (!ollamaApiKey) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: "ERROR: OLLAMA_API_KEY_MISSING. PLEASE CONFIGURE IN SETTINGS.", timestamp: new Date() }]);
      return;
    }

    const finalCommand = customPrompt || command;
    if (!finalCommand.trim()) return;

    // Check if it's a direct system command (starts with !)
    if (finalCommand.startsWith('!')) {
      const realCmd = finalCommand.slice(1);
      setAiResponse(`EXECUTING_REMOTE_COMMAND: ${realCmd}...`);
      await sendCommandToPi(realCmd);
      setCommand('');
      return;
    }

    const newUserMessage: Message = { role: 'user', content: finalCommand, timestamp: new Date() };
    addLog('ai_input', finalCommand);
    setChatMessages(prev => [...prev, newUserMessage]);
    setIsAiLoading(true);
    setCommand('');

    const panel = leftPanel;
    const currentFile = selectedFile;
    const currentPersonality = personality === 'custom' ? customPrompt : PERSONALITIES[personality as keyof typeof PERSONALITIES].prompt;

    const systemPrompt = `
      ${currentPersonality}
      
      Context:
      - Current directory: ${panel.currentDirId || 'root'}.
      - Selected file: ${currentFile?.name || 'none'} (ID: ${currentFile?.id || 'none'}).
      - Content of selected file (if any): ${currentFile?.content || 'none'}.
      
      User command: "${finalCommand}"
      
      Instructions:
      1. If the user wants to analyze the file, provide an in-depth analysis.
      2. You are an expert in ADVANCED WEBSITE CODING. When asked to create or edit web files (HTML, CSS, JS, React):
         - Use modern standards (HTML5, ES6+, Tailwind CSS if applicable).
         - Ensure responsive design and accessibility.
         - Write clean, production-ready code.
      3. You can perform actions by including a JSON block at the end of your response:
         \`\`\`json
         { "action": "create_file" | "create_dir" | "delete" | "rename" | "edit" | "add_todo" | "system_command", "name": "...", "content": "...", "targetId": "..." }
         \`\`\`
      4. For "system_command", use the "name" field for the command string (e.g., "df -h").
      5. Maintain your assigned personality throughout the interaction.
    `;

    try {
      ollamaService.setApiKey(ollamaApiKey);
      ollamaService.setHost(ollamaHost);
      const stream = ollamaService.sendMessageStream(ollamaModel, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: finalCommand }
      ]);

      let accumulatedContent = '';
      let hasReceivedData = false;
      setChatMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: new Date() }]);

      for await (const part of stream) {
        if (part.message?.content) {
          hasReceivedData = true;
          accumulatedContent += part.message.content;
          setChatMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'assistant') {
              return [...prev.slice(0, -1), { ...last, content: accumulatedContent }];
            }
            return prev;
          });
        }
      }

      addLog('system_output', accumulatedContent);

      if (!hasReceivedData) {
        setChatMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant' && !last.content) {
            return [...prev.slice(0, -1), { ...last, content: "ERROR: NO_RESPONSE_FROM_OLLAMA_STREAM. CHECK_HOST_AND_KEY." }];
          }
          return prev;
        });
      }

      // Try to parse JSON action from the final accumulated content
      const jsonMatch = accumulatedContent.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        try {
          const actionData = JSON.parse(jsonMatch[1]);
          handleAiAction(actionData);
        } catch (e) {
          console.error("Failed to parse AI action JSON", e);
        }
      }
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `ERROR: OLLAMA_CONNECTION_FAILED - ${error instanceof Error ? error.message : 'UNKNOWN_ERROR'}`, timestamp: new Date() }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  const runTerminalCommand = (cmd: string) => {
    if (!cmd.trim()) return;
    setActiveTab('terminal');
    setIsTerminalRunning(true);
    setTerminalLogs(prev => [...prev, { type: 'system', content: `> ${cmd}`, timestamp: new Date() }]);
    
    const eventSource = new EventSource(`/api/system/terminal?command=${encodeURIComponent(cmd)}`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'stdout' || data.type === 'stderr') {
        setTerminalLogs(prev => [...prev, { type: data.type, content: data.data, timestamp: new Date() }]);
      } else if (data.type === 'exit') {
        setTerminalLogs(prev => [...prev, { type: 'system', content: `PROCESS_EXITED_WITH_CODE: ${data.code}`, timestamp: new Date() }]);
        setIsTerminalRunning(false);
        eventSource.close();
      } else if (data.type === 'error') {
        setTerminalLogs(prev => [...prev, { type: 'stderr', content: data.data, timestamp: new Date() }]);
        setIsTerminalRunning(false);
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      setTerminalLogs(prev => [...prev, { type: 'stderr', content: 'CONNECTION_LOST_OR_EXECUTION_FAILED', timestamp: new Date() }]);
      setIsTerminalRunning(false);
      eventSource.close();
    };
  };

  const executeCommand = (customPrompt?: string) => {
    const cmdToExec = customPrompt || command;
    if (cmdToExec.startsWith('$') || activeTab === 'terminal') {
      const shellCmd = cmdToExec.startsWith('$') ? cmdToExec.slice(1).trim() : cmdToExec.trim();
      if (shellCmd) {
        runTerminalCommand(shellCmd);
        setCommand('');
        return;
      }
    }

    if (aiProvider === 'ollama') {
      executeOllamaCommand(customPrompt);
    } else {
      executeAiCommand(customPrompt);
    }
  };

  const analyzeFile = () => {
    const panel = leftPanel;
    const currentFile = selectedFile;
    if (!currentFile || currentFile.id === 'up') {
      setChatMessages(prev => [...prev, { role: 'assistant', content: "ERROR: No file selected for analysis. Highlight a file on the left first.", timestamp: new Date() }]);
      return;
    }
    
    const analysisPrompt = currentFile.type === 'file' 
      ? `Provide an in-depth analysis of the file "${currentFile.name}". Include code complexity analysis, potential bug detection, and a content summarization.`
      : `Analyze the directory "${currentFile.name}". Summarize its likely purpose and contents.`;
      
    executeCommand(analysisPrompt);
  };

  const handleAiAction = async (data: any) => {
    const { action, name, content, targetId } = data;
    const panel = leftPanel;
    const currentPath = panel.currentDirId ? atob(panel.currentDirId) : "";

    addLog('system_output', `AI_ACTION_TRIGGERED: ${action.toUpperCase()} ${name || ''}`);

    try {
      switch (action) {
        case 'create_file':
          const filePath = currentPath ? `${currentPath}/${name}` : name;
          await fetch('/api/files/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: filePath, content: content || '' })
          });
          addLog('system_output', `FILE_CREATED: ${filePath}`);
          
          // Forward to coding tab
          const newFileId = btoa(filePath);
          const newFile: VirtualFile = {
            id: newFileId,
            name: name,
            type: 'file',
            content: content || '',
            size: (content || '').length,
            date: new Date().toISOString().split('T')[0],
            parentId: panel.currentDirId,
            path: filePath
          };
          setSelectedFile(newFile);
          setEditorContent(content || '');
          setActiveTab('coding');
          break;
        case 'create_dir':
          const dirPath = currentPath ? `${currentPath}/${name}` : name;
          await fetch('/api/files/mkdir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: dirPath })
          });
          addLog('system_output', `DIRECTORY_CREATED: ${dirPath}`);
          break;
        case 'delete':
          const itemToDelete = files.find(f => f.id === targetId);
          if (itemToDelete?.path) {
            await fetch('/api/files/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: itemToDelete.path })
            });
            addLog('system_output', `ITEM_DELETED: ${itemToDelete.path}`);
            if (selectedFile?.id === targetId) {
              setSelectedFile(null);
              setEditorContent('');
            }
          }
          break;
        case 'rename':
          const itemToRename = files.find(f => f.id === targetId);
          if (itemToRename?.path && name) {
            const newPath = itemToRename.path.split('/').slice(0, -1).join('/') + '/' + name;
            await fetch('/api/files/rename', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ oldPath: itemToRename.path, newPath })
            });
            addLog('system_output', `ITEM_RENAMED: ${itemToRename.path} -> ${newPath}`);
          }
          break;
        case 'edit':
          const itemToEdit = files.find(f => f.id === targetId);
          if (itemToEdit?.path && content !== undefined) {
            await fetch('/api/files/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: itemToEdit.path, content })
            });
            addLog('system_output', `FILE_EDITED: ${itemToEdit.path}`);
            
            // Forward to coding tab
            setSelectedFile({ ...itemToEdit, content });
            setEditorContent(content);
            setActiveTab('coding');
          }
          break;
        case 'system_command':
          if (name) {
            setAiResponse(`AI_EXECUTING_REMOTE_COMMAND: ${name}...`);
            await sendCommandToPi(name);
          }
          break;
        case 'add_todo':
          if (name) {
            setTodos(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), text: name, completed: false }]);
            setShowTodo(true);
            addLog('system_output', `TODO_ADDED: ${name}`);
          }
          break;
      }
      // Refresh file list after action
      const response = await fetch(`/api/files?path=${encodeURIComponent(currentPath)}`);
      const localFiles = await response.json();
      setFiles(prev => {
        const upEntry = prev.find(f => f.id === 'up');
        return upEntry ? [upEntry, ...localFiles] : localFiles;
      });
    } catch (error) {
      console.error('Local AI action failed:', error);
    }
  };

  const toggleXRay = async () => {
    if (showXRay) {
      setShowXRay(false);
      return;
    }

    setShowXRay(true);
    const panel = leftPanel;
    const filesToScan = panel.files.filter(f => f.id !== 'up' && f.type === 'file');
    
    if (filesToScan.length === 0) return;

    setIsXRayScanning(true);
    try {
      const systemPrompt = `
        Analyze the following files and provide a complexity score (0-10) and a risk score (0-10) for each.
        Complexity: How hard is the code to understand/maintain?
        Risk: How likely are there to be bugs or security issues?
        
        Files:
        ${filesToScan.map(f => `- ID: ${f.id}, Name: ${f.name}, Content: ${f.content || 'No content'}`).join('\n')}
        
        Respond ONLY with a JSON array of objects:
        [{"id": "file_id", "complexity": 5, "risk": 3}, ...]
      `;

      const response = await ollamaService.sendMessageStream(ollamaModel, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: "Analyze these files and return the JSON array." }
      ]);

      let fullText = "";
      for await (const chunk of response) {
        fullText += chunk.message.content;
      }

      const scores = JSON.parse(fullText || "[]");
      setFiles(prev => prev.map(f => {
        const score = scores.find((s: any) => s.id === f.id);
        if (score) {
          return { ...f, complexity: score.complexity, risk: score.risk };
        }
        return f;
      }));
    } catch (error) {
      console.error("X-Ray Scan Error:", error);
    } finally {
      setIsXRayScanning(false);
    }
  };

  const saveFile = () => {
    if (selectedFile || showEditor) {
      setShowSaveConfirm(true);
    }
  };

  const performSave = async () => {
    setShowSaveConfirm(false);
    const fileToSave = showEditor || selectedFile;
    if (fileToSave) {
      addLog('system_output', `SAVING_FILE: ${fileToSave.path || fileToSave.name}`);
      if (connectionMode === 'local' && fileToSave.path) {
        try {
          await fetch('/api/files/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: fileToSave.path, content: editorContent })
          });
          addLog('system_output', `FILE_SAVED_SUCCESSFULLY: ${fileToSave.path}`);
          // Refresh file list
          const currentPath = leftPanel.currentDirId ? atob(leftPanel.currentDirId) : "";
          const response = await fetch(`/api/files?path=${encodeURIComponent(currentPath)}`);
          const localFiles = await response.json();
          setFiles(prev => {
            const upEntry = prev.find(f => f.id === 'up');
            return upEntry ? [upEntry, ...localFiles] : localFiles;
          });
        } catch (error) {
          addLog('error', `FAILED_TO_SAVE_FILE: ${fileToSave.path}`);
          console.error('Failed to save local file:', error);
        }
      } else {
        setFiles(prev => prev.map(f => f.id === fileToSave.id ? { ...f, content: editorContent, size: editorContent.length } : f));
        addLog('system_output', `VIRTUAL_FILE_UPDATED: ${fileToSave.name}`);
      }
      // Don't close editor automatically in coding tab
      if (activeTab !== 'coding') {
        setShowEditor(null);
        setShowPreview(false);
      }
    }
  };

  // --- Render Helpers ---
  const renderXRayView = () => {
    const panel = leftPanel;
    const filesToDisplay = panel.files.filter(f => f.id !== 'up');

    return (
      <div className="flex-1 nc-panel p-4 overflow-hidden flex flex-col bg-nc-black border-nc-yellow border-4">
        <div className="nc-header mb-4 flex justify-between items-center bg-nc-yellow text-nc-black px-2">
          <span className="font-bold">AI X-RAY SCANNER ACTIVE</span>
          <span className="text-xs">SCANNING SYSTEM...</span>
        </div>
        
        {isXRayScanning ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <Loader2 size={48} className="animate-spin text-nc-yellow" />
            <div className="text-nc-yellow font-bold animate-pulse">ANALYZING CODE STRUCTURE...</div>
            <div className="font-mono text-xs text-nc-cyan">
              {`> ACCESSING KERNEL...`} <br/>
              {`> SCANNING MEMORY BLOCKS...`} <br/>
              {`> CALCULATING CYCLOMATIC COMPLEXITY...`}
            </div>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto p-4">
            {filesToDisplay.map((file, idx) => {
              const comp = file.complexity || 0;
              const risk = file.risk || 0;
              const colorClass = comp > 7 || risk > 7 ? "text-nc-yellow border-nc-yellow" : "text-nc-accent border-nc-accent";
              
              return (
                <div 
                  key={file.id} 
                  className={cn(
                    "border p-4 font-mono text-[10px] flex flex-col gap-2 relative overflow-hidden rounded-lg transition-all hover:scale-105",
                    colorClass,
                    "bg-nc-black/40 backdrop-blur-sm"
                  )}
                >
                  <div className="font-bold truncate border-b border-current pb-2 mb-1 tracking-widest uppercase">
                    {file.name}
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="opacity-60">COMPLEXITY:</span>
                    <span className="font-bold tracking-tighter">{comp}/10</span>
                  </div>
                  <div className="w-full h-1 bg-nc-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-current transition-all duration-1000" style={{ width: `${comp * 10}%` }} />
                  </div>
                  
                  <div className="flex justify-between items-center mt-1">
                    <span className="opacity-60">RISK_LEVEL:</span>
                    <span className="font-bold tracking-tighter">{risk}/10</span>
                  </div>
                  <div className="w-full h-1 bg-nc-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-current transition-all duration-1000" style={{ width: `${risk * 10}%` }} />
                  </div>

                  <div className="mt-3 pt-2 border-t border-current/20 text-[9px] opacity-80 font-bold tracking-widest">
                    {comp > 7 ? "> CRITICAL_REFACTOR" : 
                     risk > 7 ? "> SECURITY_ALERT" : 
                     "> STATUS_NOMINAL"}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 border-t border-nc-accent/30 pt-4 text-[10px] text-nc-accent font-bold flex justify-between uppercase tracking-widest">
          <span>PRESS F9 TO EXIT X-RAY MODE</span>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-nc-accent animate-pulse" />
            <span>NEURAL_SCAN_STABLE</span>
          </div>
        </div>
      </div>
    );
  };

  const renderPanel = (side: 'left' | 'right', state: PanelState) => {
    const isActive = activePanel === side;
    return (
      <div 
        className={cn(
          "flex-1 flex flex-col nc-panel overflow-hidden min-h-0 transition-all duration-300",
          isActive ? "border-nc-accent ring-1 ring-nc-accent/30" : "border-nc-border opacity-80"
        )}
        onClick={() => setActivePanel(side)}
      >
        <div className="nc-header py-2 px-4 flex justify-between items-center bg-nc-black">
          <div className="flex items-center gap-2">
            <div className={cn("w-1.5 h-1.5 rounded-full", isActive ? "bg-nc-accent animate-pulse" : "bg-nc-gray")} />
            <span className="text-[10px] uppercase tracking-[0.2em]">{side} PANEL</span>
          </div>
          <span className="text-[9px] opacity-50 font-mono tracking-widest">PATH: /{state.currentDirId || 'ROOT'}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-nc-gray border-b border-nc-border text-[9px] uppercase tracking-widest">
                <th className="p-2 font-normal">Object Name</th>
                <th className="p-2 font-normal text-right">Size</th>
                <th className="p-2 font-normal text-right">Modified</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {state.files.map((file, idx) => {
                const isSelected = state.selectedIndex === idx;
                return (
                  <tr 
                    key={file.id}
                    className={cn(
                      "cursor-pointer transition-colors group",
                      isSelected && isActive && "nc-cursor",
                      isSelected && !isActive && "nc-selected"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePanel(side);
                      setLeftPanel(p => ({ ...p, selectedIndex: idx }));
                    }}
                  >
                    <td className="p-2 flex items-center gap-3">
                      {file.type === 'dir' ? <Folder size={14} className="text-nc-yellow opacity-80" /> : <FileText size={14} className="text-nc-accent opacity-80" />}
                      <span className="truncate max-w-[180px] tracking-tight">{file.name}</span>
                    </td>
                    <td className="p-2 text-right opacity-60">
                      {file.type === 'dir' ? 'DIR' : `${file.size}B`}
                    </td>
                    <td className="p-2 text-right opacity-40 text-[10px]">
                      {file.date}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderChat = (isImmersive: boolean = true) => {
    return (
      <div className={cn(
        "nc-panel flex-1 flex flex-col border-nc-accent/30 backdrop-blur-md min-h-0",
        isImmersive ? "bg-nc-black/40" : "bg-nc-black/80"
      )}>
        <div className="nc-header flex justify-between items-center px-4 py-2 bg-nc-accent/10 border-b border-nc-accent/20">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-nc-accent" />
            <span className="text-[10px] font-bold tracking-widest uppercase">
              {isImmersive ? 'NEURAL_CHAT_LINK' : 'SYSTEM_CONSOLE'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setChatMessages([{ role: 'assistant', content: 'CHAT_HISTORY_PURGED. SYSTEM_READY.', timestamp: new Date() }])}
              className="text-[8px] text-nc-gray hover:text-nc-accent uppercase transition-colors"
            >
              [ CLEAR_CHAT ]
            </button>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-nc-accent animate-pulse" />
              <span className="text-[8px] opacity-50 uppercase">ENCRYPTED_STREAM</span>
            </div>
          </div>
        </div>
        
        <div 
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs scrollbar-thin scrollbar-thumb-nc-accent/20"
        >
          {chatMessages.map((msg, i) => (
            <div key={i} className={cn(
              "flex flex-col gap-1 max-w-[90%]",
              msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
            )}>
              <div className="flex items-center gap-2 text-[8px] opacity-40 uppercase tracking-tighter">
                <span>{msg.role === 'user' ? 'COMMANDER' : 'AI_CORE'}</span>
                <span>•</span>
                <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
              <div className={cn(
                "p-3 rounded-lg border",
                msg.role === 'user' 
                  ? "bg-nc-accent/5 border-nc-accent/20 text-nc-white" 
                  : "bg-nc-black border-nc-border text-nc-white/80"
              )}>
                <div className={cn(
                  "markdown-body prose prose-invert prose-xs max-w-none",
                  !isImmersive && "whitespace-pre-wrap font-mono opacity-90"
                )}>
                  {isImmersive ? (
                    <Markdown>{msg.content.replace(/```json\n[\s\S]*?\n```/g, '').trim()}</Markdown>
                  ) : (
                    msg.content.replace(/```json\n[\s\S]*?\n```/g, '').trim()
                  )}
                </div>
              </div>
            </div>
          ))}
          {isAiLoading && (
            <div className="flex items-center gap-2 text-nc-accent animate-pulse">
              <Loader2 size={12} className="animate-spin" />
              <span className="text-[10px] uppercase tracking-widest">THINKING...</span>
            </div>
          )}
        </div>

        {selectedFile && isImmersive && (
          <div className="px-4 py-2 bg-nc-accent/5 border-t border-nc-accent/10 flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <FileText size={12} className="text-nc-accent shrink-0" />
              <span className="text-[9px] text-nc-accent truncate uppercase tracking-tighter">CONTEXT: {selectedFile.name}</span>
            </div>
            <button 
              onClick={() => executeAiCommand(`Analyze this file: ${selectedFile.name}`)}
              className="text-[8px] bg-nc-accent/20 hover:bg-nc-accent text-nc-accent px-2 py-0.5 rounded uppercase font-bold transition-colors shrink-0"
            >
              [ SEND_TO_AI ]
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderAgentTab = () => {
    return (
      <div className="flex-1 nc-panel flex flex-col bg-nc-black border-nc-accent/30 overflow-hidden min-h-0">
        <div className="nc-header py-2 px-4 flex justify-between items-center bg-nc-black border-b border-nc-border">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Bot size={14} className="text-nc-accent" />
              <span className="text-[10px] font-bold tracking-widest uppercase">OPENCLAW_AUTONOMOUS_AGENT</span>
              <span className="text-[8px] text-nc-gray opacity-50 ml-2">POWERED_BY_OLLAMA_AI</span>
            </div>
            
            <div className="flex gap-1 ml-4 border-l border-nc-border pl-4">
              <button 
                onClick={() => setAgentSubTab('chat')}
                className={cn(
                  "px-3 py-1 text-[9px] font-bold uppercase tracking-widest transition-all rounded",
                  agentSubTab === 'chat' ? "bg-nc-accent text-nc-black" : "text-nc-gray hover:text-nc-accent"
                )}
              >
                [ CHAT_STREAM ]
              </button>
              <button 
                onClick={() => {
                  setAgentSubTab('browser');
                  if (!browserData.screenshot) refreshBrowser();
                }}
                className={cn(
                  "px-3 py-1 text-[9px] font-bold uppercase tracking-widest transition-all rounded",
                  agentSubTab === 'browser' ? "bg-nc-accent text-nc-black" : "text-nc-gray hover:text-nc-accent"
                )}
              >
                [ WEB_BROWSER ]
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isAgentLoading && (
              <div className="flex items-center gap-2">
                <Loader2 size={12} className="text-nc-accent animate-spin" />
                <span className="text-[8px] text-nc-accent uppercase">AGENT_THINKING</span>
              </div>
            )}
            <button 
              onClick={() => setAgentMessages([{ role: 'assistant', content: 'AGENT_MEMORY_PURGED. RESTARTING_SESSION.', timestamp: new Date() }])}
              className="text-[8px] text-nc-gray hover:text-nc-accent uppercase transition-colors"
            >
              [ PURGE_MEMORY ]
            </button>
          </div>
        </div>
        
        {agentSubTab === 'chat' ? (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-black/20">
              {agentMessages.map((msg, i) => (
                <div key={i} className={cn(
                  "flex flex-col gap-2 max-w-[80%]",
                  msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                )}>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] text-nc-gray uppercase font-bold tracking-tighter">
                      {msg.role === 'user' ? 'COMMANDER' : 'OPENCLAW'}
                    </span>
                    <span className="text-[8px] text-nc-gray/50">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className={cn(
                    "p-4 rounded-lg border text-xs leading-relaxed",
                    msg.role === 'user' 
                      ? "bg-nc-accent/5 border-nc-accent/20 text-nc-white" 
                      : "bg-nc-black border-nc-border text-nc-white/90"
                  )}>
                    <div className="markdown-body prose prose-invert prose-xs max-w-none">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  </div>
                </div>
              ))}
              {isAgentLoading && (
                <div className="flex items-center gap-2 text-nc-accent animate-pulse">
                  <Loader2 size={12} className="animate-spin" />
                  <span className="text-[10px] uppercase tracking-widest">AGENT_IS_PROCESSING_REQUEST...</span>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-nc-border bg-nc-black/40">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = (e.target as any).elements.agentInput;
                  const val = input.value.trim();
                  if (val) {
                    executeAgentCommand(val);
                    input.value = '';
                  }
                }}
                className="flex gap-2"
              >
                <input 
                  name="agentInput"
                  autoComplete="off"
                  className="flex-1 bg-nc-panel border border-nc-border p-3 text-nc-white font-mono text-xs outline-none focus:border-nc-accent transition-colors rounded"
                  placeholder="ISSUE_AGENT_COMMAND_OR_QUERY..."
                />
                <button 
                  type="submit"
                  disabled={isAgentLoading}
                  className="bg-nc-accent text-nc-black px-6 py-2 font-bold text-[10px] uppercase tracking-widest hover:bg-nc-white transition-all disabled:opacity-50"
                >
                  [ EXECUTE ]
                </button>
              </form>
            </div>
          </>
        ) : (
          renderBrowserView()
        )}
      </div>
    );
  };

  const refreshBrowser = async () => {
    setIsBrowserLoading(true);
    try {
      const res = await fetch('/api/browser/screenshot');
      const data = await res.json();
      setBrowserData(data);
      setBrowserUrlInput(data.url);
    } catch (e) {
      console.error('Browser error:', e);
    } finally {
      setIsBrowserLoading(false);
    }
  };

  const browserGoto = async (url: string) => {
    setIsBrowserLoading(true);
    try {
      const res = await fetch('/api/browser/goto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      setBrowserData(data);
      setBrowserUrlInput(data.url);
    } catch (e) {
      console.error('Browser error:', e);
    } finally {
      setIsBrowserLoading(false);
    }
  };

  const browserClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (isBrowserLoading) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1280);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 720);
    
    setIsBrowserLoading(true);
    try {
      const res = await fetch('/api/browser/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y })
      });
      const data = await res.json();
      setBrowserData(data);
    } catch (e) {
      console.error('Browser error:', e);
    } finally {
      setIsBrowserLoading(false);
    }
  };

  const browserType = async (text: string, key?: string) => {
    setIsBrowserLoading(true);
    try {
      const res = await fetch('/api/browser/type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, key })
      });
      const data = await res.json();
      setBrowserData(data);
    } catch (e) {
      console.error('Browser error:', e);
    } finally {
      setIsBrowserLoading(false);
    }
  };

  const browserScroll = async (direction: 'up' | 'down') => {
    setIsBrowserLoading(true);
    try {
      const res = await fetch('/api/browser/scroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction })
      });
      const data = await res.json();
      setBrowserData(data);
    } catch (e) {
      console.error('Browser error:', e);
    } finally {
      setIsBrowserLoading(false);
    }
  };

  const renderBrowserView = () => {
    return (
      <div className="flex-1 flex flex-col bg-nc-black overflow-hidden">
        <div className="p-3 bg-nc-panel border-b border-nc-border flex items-center gap-3">
          <div className="flex gap-1">
            <button onClick={() => browserScroll('up')} className="p-1.5 text-nc-gray hover:text-nc-accent transition-colors"><ArrowUpCircle size={14} /></button>
            <button onClick={() => browserScroll('down')} className="p-1.5 text-nc-gray hover:text-nc-accent transition-colors"><ArrowDownCircle size={14} /></button>
          </div>
          <div className="flex-1 relative">
            <Globe size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-nc-gray" />
            <input 
              className="w-full bg-nc-black border border-nc-border pl-8 pr-3 py-1.5 text-[10px] font-mono text-nc-white outline-none focus:border-nc-accent transition-colors rounded"
              value={browserUrlInput}
              onChange={(e) => setBrowserUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && browserGoto(browserUrlInput)}
            />
          </div>
          <button 
            onClick={refreshBrowser}
            className="p-1.5 text-nc-gray hover:text-nc-accent transition-colors"
          >
            <RefreshCw size={14} className={isBrowserLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex-1 relative bg-nc-black/50 overflow-hidden group">
          {browserData.screenshot ? (
            <div 
              className="relative w-full h-full cursor-crosshair overflow-hidden"
              onClick={browserClick}
            >
              <img 
                src={`data:image/jpeg;base64,${browserData.screenshot}`}
                className="w-full h-auto object-contain"
                alt="Browser View"
              />
              {isBrowserLoading && (
                <div className="absolute inset-0 bg-nc-black/20 backdrop-blur-[1px] flex items-center justify-center">
                  <Loader2 size={32} className="text-nc-accent animate-spin" />
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-nc-gray gap-4">
              <Globe size={48} className="opacity-20 animate-pulse" />
              <p className="text-[10px] uppercase tracking-widest">INITIALIZING_BROWSER_INSTANCE...</p>
            </div>
          )}
        </div>

        <div className="p-3 bg-nc-panel border-t border-nc-border flex items-center gap-3">
          <div className="flex items-center gap-2 text-[9px] text-nc-gray uppercase font-bold">
            <MousePointer2 size={10} />
            <span>INTERACTIVE_MODE</span>
          </div>
          <div className="flex-1 flex gap-2">
            <input 
              className="flex-1 bg-nc-black border border-nc-border px-3 py-1.5 text-[10px] font-mono text-nc-white outline-none focus:border-nc-accent transition-colors rounded"
              placeholder="TYPE_INTO_BROWSER..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  browserType(e.currentTarget.value);
                  e.currentTarget.value = '';
                }
              }}
            />
            <button 
              onClick={() => browserType('', 'Enter')}
              className="px-3 py-1 bg-nc-accent/10 border border-nc-accent/30 text-nc-accent text-[9px] font-bold uppercase hover:bg-nc-accent hover:text-nc-black transition-all"
            >
              [ ENTER ]
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderTerminalTab = () => {
    return (
      <div className="flex-1 nc-panel flex flex-col bg-nc-black border-nc-accent/30 overflow-hidden min-h-0">
        <div className="nc-header py-2 px-4 flex justify-between items-center bg-nc-black border-b border-nc-border">
          <div className="flex items-center gap-2">
            <SquareTerminal size={14} className="text-nc-accent" />
            <span className="text-[10px] font-bold tracking-widest uppercase">LIVE_TERMINAL_STREAM</span>
          </div>
          <div className="flex items-center gap-4">
            {isTerminalRunning && (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-nc-accent animate-pulse" />
                <span className="text-[8px] text-nc-accent uppercase">PROCESS_RUNNING</span>
              </div>
            )}
            <button 
              onClick={() => setTerminalLogs([])}
              className="text-[8px] text-nc-gray hover:text-nc-accent uppercase transition-colors"
            >
              [ CLEAR_TERMINAL ]
            </button>
          </div>
        </div>
        <div 
          ref={terminalScrollRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1 bg-black/40"
        >
          {terminalLogs.map((log, i) => (
            <div key={i} className={cn(
              "whitespace-pre-wrap break-all",
              log.type === 'stdout' && "text-nc-white opacity-90",
              log.type === 'stderr' && "text-nc-red",
              log.type === 'system' && "text-nc-accent font-bold"
            )}>
              {log.content}
            </div>
          ))}
          {isTerminalRunning && <div className="animate-pulse text-nc-accent">_</div>}
        </div>
      </div>
    );
  };
  const renderLogs = () => {
    return (
      <div className="flex-1 nc-panel flex flex-col bg-nc-black border-nc-accent/30 overflow-hidden min-h-0">
        <div className="nc-header py-2 px-4 flex justify-between items-center bg-nc-black border-b border-nc-border">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-nc-accent" />
            <span className="text-[10px] font-bold tracking-widest uppercase">SYSTEM_LOG_STREAM</span>
          </div>
          <button 
            onClick={() => setLogs([{ type: 'system_output', content: 'LOG_PURGED. RESTARTING_STREAM.', timestamp: new Date() }])}
            className="text-[8px] text-nc-red hover:underline uppercase"
          >
            [ PURGE_LOGS ]
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 font-mono text-[10px] space-y-1">
          {logs.map((log, i) => (
            <div key={i} className="flex gap-4 border-b border-nc-border/10 pb-1">
              <span className="text-nc-gray shrink-0">[{log.timestamp.toLocaleTimeString()}]</span>
              <span className={cn(
                "shrink-0 w-20 font-bold",
                log.type === 'command' && "text-nc-yellow",
                log.type === 'ai_input' && "text-nc-accent",
                log.type === 'system_output' && "text-nc-white",
                log.type === 'error' && "text-nc-red"
              )}>
                {log.type.toUpperCase()}
              </span>
              <span className="break-all opacity-80">{log.content}</span>
            </div>
          ))}
          <div className="animate-pulse text-nc-accent">_</div>
        </div>
      </div>
    );
  };

  const renderCodingTab = () => {
    return (
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left: Editor */}
        <div className="flex-1 nc-panel flex flex-col border-nc-accent/30 bg-nc-black/20">
          <div className="nc-header py-2 px-4 flex justify-between items-center bg-nc-black border-b border-nc-border">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-nc-accent" />
              <span className="text-[10px] font-bold tracking-widest uppercase">
                {selectedFile ? `EDITING: ${selectedFile.name}` : 'NO_FILE_SELECTED'}
              </span>
            </div>
            {selectedFile && (
              <button 
                onClick={saveFile}
                className="text-[9px] bg-nc-accent/20 hover:bg-nc-accent text-nc-accent hover:text-nc-black px-2 py-0.5 rounded transition-all font-bold"
              >
                [ COMMIT_CHANGES ]
              </button>
            )}
          </div>
          {selectedFile ? (
            <textarea 
              className="flex-1 bg-transparent text-nc-white p-4 font-mono outline-none resize-none text-xs leading-relaxed"
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
              placeholder="// Start coding..."
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-nc-gray gap-4">
              <Folder size={48} className="opacity-20" />
              <p className="text-xs uppercase tracking-widest">Select a file in the Filesystem tab to begin coding</p>
              <button 
                onClick={() => setActiveTab('filesystem')}
                className="text-[10px] text-nc-accent hover:underline"
              >
                [ GO_TO_FILESYSTEM ]
              </button>
            </div>
          )}
        </div>

        {/* Right: Preview & Chat */}
        <div className="w-1/3 flex flex-col gap-4">
          {/* Preview */}
          <div className="h-1/2 nc-panel flex flex-col border-nc-accent/30 bg-nc-black/40">
            <div className="nc-header py-2 px-4 bg-nc-black border-b border-nc-border flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-widest uppercase">LIVE_PREVIEW</span>
                {(selectedFile?.name.endsWith('.html') || selectedFile?.name.endsWith('.js')) && (
                  <button 
                    onClick={() => {
                      const blob = new Blob([editorContent], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      window.open(url, '_blank');
                    }}
                    className="text-nc-accent hover:text-nc-white transition-colors"
                    title="OPEN_IN_NEW_TAB"
                  >
                    <ExternalLink size={10} />
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-nc-red" />
                <div className="w-2 h-2 rounded-full bg-nc-yellow" />
                <div className="w-2 h-2 rounded-full bg-nc-accent" />
              </div>
            </div>
            <div className="flex-1 bg-white overflow-hidden">
              {selectedFile?.name.endsWith('.html') || selectedFile?.name.endsWith('.js') ? (
                <iframe 
                  title="Coding Preview"
                  srcDoc={editorContent}
                  className="w-full h-full border-none"
                  sandbox="allow-scripts"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-nc-panel text-nc-gray text-[10px] uppercase p-4 text-center">
                  Preview only available for HTML/JS files
                </div>
              )}
            </div>
          </div>
          {/* Chat */}
          {renderChat(true)}
        </div>
      </div>
    );
  };

  if (isBooting) {
    return <BootSequence onComplete={() => setIsBooting(false)} />;
  }

  return (
    <div 
      className="h-screen w-screen flex flex-col p-4 gap-4"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Top Bar */}
      <div className="flex justify-between items-center bg-nc-black border border-nc-border p-3 rounded-lg shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-nc-accent font-bold tracking-wider">
            <Cpu size={20} className="animate-pulse" />
            <span>AI COMMANDER <span className="text-[10px] opacity-50 font-normal">PRO EDITION</span></span>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex gap-2 ml-4 border-l border-nc-border pl-4">
            {[
              { id: 'filesystem', label: 'FILESYSTEM', icon: Folder },
              { id: 'coding', label: 'CODING', icon: Terminal },
              { id: 'agent', label: 'OPENCLAW_AGENT', icon: Bot },
              { id: 'terminal', label: 'TERMINAL', icon: SquareTerminal },
              { id: 'logs', label: 'SYSTEM_LOGS', icon: Activity },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-all rounded",
                  activeTab === t.id 
                    ? "bg-nc-accent text-nc-black" 
                    : "text-nc-gray hover:text-nc-accent hover:bg-nc-accent/10"
                )}
              >
                <t.icon size={12} />
                {t.label}
              </button>
            ))}
          </div>

          <div className="text-[10px] text-nc-gray uppercase tracking-widest border-l border-nc-border pl-4 flex items-center gap-4">
            <div>SYSTEM: <span className="text-nc-accent">ONLINE</span></div>
            <div className="flex items-center gap-1">
              PI: <span className={piStatus?.online ? 'text-nc-accent' : 'text-nc-yellow'}>{piStatus?.online ? 'CONNECTED' : 'DISCONNECTED'}</span>
              {piStatus?.online && <Activity size={10} className="text-nc-accent animate-pulse" />}
            </div>
            <div>AI: <span className="text-nc-accent">OLLAMA ({ollamaModel || 'NONE'})</span></div>
            <button 
              onClick={fetchOllamaModels}
              disabled={!ollamaApiKey || isOllamaLoading}
              className="flex items-center gap-1 text-nc-accent hover:text-nc-white disabled:opacity-30 transition-colors"
              title="SYNC_MODELS"
            >
              <RefreshCw size={12} className={cn(isOllamaLoading && "animate-spin")} />
              <span className="text-[8px] font-bold uppercase tracking-widest">SYNC</span>
            </button>
          </div>
        </div>
        <div className="flex gap-6 text-[10px] text-nc-gray font-mono uppercase tracking-widest items-center">
          <button 
            onClick={() => window.open(window.location.origin, '_blank')}
            className="flex items-center gap-2 text-nc-accent hover:text-nc-white transition-colors"
          >
            <ExternalLink size={14} />
            <span className="font-bold">[ LAUNCH_PREVIEW ]</span>
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 hover:text-nc-accent transition-colors"
          >
            <Upload size={14} />
            <span className="text-nc-white">[ UPLOAD ]</span>
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 hover:text-nc-accent transition-colors"
          >
            <span className="opacity-50">SETTINGS:</span>
            <span className="text-nc-white">[ CONFIG ]</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="opacity-50">IDENTITY:</span>
            <span className="text-nc-accent font-bold">[{PERSONALITIES[personality as keyof typeof PERSONALITIES].name}]</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="opacity-50">TIME:</span>
            <span className="text-nc-white">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 gap-4">
        {activeTab === 'filesystem' && (
          <div className="flex-1 flex gap-4 min-h-0">
            {showXRay ? renderXRayView() : (
              <>
                {renderPanel('left', leftPanel)}
                {renderChat(false)}
              </>
            )}
          </div>
        )}

        {activeTab === 'coding' && renderCodingTab()}

        {activeTab === 'agent' && renderAgentTab()}

        {activeTab === 'terminal' && renderTerminalTab()}

        {activeTab === 'logs' && renderLogs()}
      </div>

      {/* AI Response Area (Legacy, now handled in chat) */}
      {aiResponse && aiResponse.includes('EXECUTING_REMOTE_COMMAND') && (
        <div className="bg-nc-black border border-nc-accent/30 p-3 rounded-lg font-mono text-[10px] flex items-center gap-3 animate-pulse">
          <Terminal size={14} className="text-nc-accent" />
          <span className="text-nc-accent uppercase tracking-widest">{aiResponse}</span>
        </div>
      )}

      {/* Command Line */}
      <div className="flex flex-col gap-3">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            executeCommand();
          }}
          className="flex items-center gap-4 bg-nc-black border border-nc-border p-3 rounded-lg shadow-xl group focus-within:border-nc-accent transition-all duration-300"
          autoComplete="off"
        >
          {/* Honeypot to prevent password manager popups */}
          <input type="text" name="username" style={{ display: 'none' }} autoComplete="off" />
          <input type="password" name="password" style={{ display: 'none' }} autoComplete="off" />
          
          <div className="flex items-center gap-2 text-nc-accent font-bold font-mono text-xs tracking-tighter">
            <span className="opacity-50">CMD</span>
            <span className="animate-pulse">{`>`}</span>
          </div>
          <input 
            ref={commandInputRef}
            type="text"
            name="commander-terminal-input"
            autoComplete="off"
            className="flex-1 bg-transparent border-none outline-none text-nc-white font-mono text-sm placeholder:text-nc-gray/30"
            placeholder="TYPE_COMMAND_OR_ASK_AI_ASSISTANT_ (USE $ FOR SHELL)"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') commandInputRef.current?.blur();
            }}
          />
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-nc-gray hover:text-nc-accent transition-colors"
              title="UPLOAD_FILE"
            >
              <Upload size={16} />
            </button>
            {isAiLoading ? (
              <Loader2 size={16} className="animate-spin text-nc-accent" />
            ) : (
              <button 
                type="submit"
                className="px-4 py-1 bg-nc-accent/10 border border-nc-accent/30 text-nc-accent hover:bg-nc-accent hover:text-nc-black transition-all text-[10px] font-bold uppercase tracking-widest rounded"
              >
                SEND
              </button>
            )}
          </div>
        </form>

        <input 
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Function Keys Bar */}
        <div className="flex gap-1 overflow-x-auto pb-2">
          {[
            { key: 'F1', label: 'Help', action: () => setShowHelp(true) },
            { key: 'F2', label: 'Analyze', action: () => analyzeFile() },
            { key: 'F3', label: 'View', action: () => {
              const panel = leftPanel;
              const file = panel.files[panel.selectedIndex];
              if (file && file.type === 'file') {
                setShowEditor(file);
                setEditorContent(file.content || '');
              }
            }},
            { key: 'F4', label: 'Edit', action: () => {
              const panel = leftPanel;
              const file = panel.files[panel.selectedIndex];
              if (file && file.type === 'file') {
                setShowEditor(file);
                setEditorContent(file.content || '');
              }
            }},
            { key: 'F5', label: 'Tasks', action: () => setShowTodo(true) },
            { key: 'F6', label: 'RenMov', action: () => {} },
            { key: 'F7', label: 'Mkdir', action: () => {
              const panel = leftPanel;
              const dirName = prompt("Enter directory name:");
              if (dirName) {
                const newDir: VirtualFile = {
                  id: Math.random().toString(36).substr(2, 9),
                  name: dirName,
                  type: 'dir',
                  size: 0,
                  date: new Date().toISOString().split('T')[0],
                  parentId: panel.currentDirId
                };
                setFiles(prev => [...prev, newDir]);
              }
            }},
            { key: 'F8', label: 'Delete', action: () => {
              const panel = leftPanel;
              const fileToDelete = panel.files[panel.selectedIndex];
              if (fileToDelete && fileToDelete.id !== 'up') {
                setFiles(prev => prev.filter(f => f.id !== fileToDelete.id));
              }
            }},
            { key: 'F9', label: 'X-Ray', action: () => toggleXRay() },
            { key: 'F10', label: 'Quit', action: () => {} },
          ].map((f) => (
            <button 
              key={f.key} 
              className="flex items-center text-xs whitespace-nowrap hover:opacity-80 active:scale-95 transition-transform"
              onClick={f.action}
            >
              <span className="nc-fkey">{f.key}</span>
              <span className="nc-fval">{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-nc-black/90 backdrop-blur-sm flex items-center justify-center p-8 z-50">
          <div className="nc-panel w-full max-w-md flex flex-col border-nc-accent shadow-2xl">
            <div className="nc-header py-4 px-6 flex justify-between items-center bg-nc-black border-b border-nc-border">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-nc-accent animate-pulse" />
                <span className="text-xs uppercase tracking-widest font-bold">SYSTEM_MANUAL.PDF</span>
              </div>
              <button onClick={() => setShowHelp(false)} className="text-nc-gray hover:text-nc-accent transition-colors"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-6 text-nc-white font-mono text-xs leading-relaxed bg-nc-black/80">
              <div>
                <p className="text-nc-accent font-bold uppercase tracking-widest mb-3 border-b border-nc-accent/20 pb-1">KEYBOARD_SHORTCUTS</p>
                <ul className="space-y-2 opacity-80">
                  <li><span className="text-nc-accent font-bold">[TAB]</span> SWITCH_PANELS</li>
                  <li><span className="text-nc-accent font-bold">[ARROWS]</span> NAVIGATE_OBJECTS</li>
                  <li><span className="text-nc-accent font-bold">[ENTER]</span> EXECUTE_OPEN</li>
                  <li><span className="text-nc-accent font-bold">[F2]</span> NEURAL_ANALYSIS</li>
                  <li><span className="text-nc-accent font-bold">[F3/F4]</span> VIEW_EDIT_SOURCE</li>
                  <li><span className="text-nc-accent font-bold">[F5]</span> MISSION_LOG</li>
                  <li><span className="text-nc-accent font-bold">[F7]</span> INITIALIZE_DIR</li>
                  <li><span className="text-nc-accent font-bold">[F8]</span> PURGE_OBJECT</li>
                  <li><span className="text-nc-accent font-bold">[F9]</span> X-RAY_SCAN</li>
                </ul>
              </div>
              <div>
                <p className="text-nc-accent font-bold uppercase tracking-widest mb-3 border-b border-nc-accent/20 pb-1">AI_INTERFACE</p>
                <p className="opacity-70 mb-2">INPUT NATURAL LANGUAGE COMMANDS IN THE COMMAND BAR TO INTERACT WITH THE FILESYSTEM VIA THE NEURAL LINK.</p>
                <div className="space-y-1 text-nc-gray text-[10px] tracking-tight italic">
                  <p>"CREATE A MODERN LANDING PAGE WITH TAILWIND"</p>
                  <p>"PUSH A FIX FOR THE RESPONSIVE MENU"</p>
                  <p>"INITIALIZE A REACT COMPONENT FOR THE DASHBOARD"</p>
                  <p>"SUMMARIZE SOURCE & SUGGEST UI IMPROVEMENTS"</p>
                </div>
              </div>
            </div>
            <div className="p-4 flex justify-center bg-nc-black border-t border-nc-border">
              <button 
                onClick={() => setShowHelp(false)}
                className="px-12 py-2 bg-nc-accent text-nc-black font-bold text-xs uppercase tracking-widest hover:bg-nc-white transition-all active:scale-95"
              >
                ACKNOWLEDGE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-nc-black/90 backdrop-blur-sm flex items-center justify-center p-8 z-50">
          <div className="nc-panel w-full max-w-5xl h-full flex flex-col border-nc-accent/50 shadow-2xl">
            <div className="nc-header py-3 px-6 flex justify-between items-center bg-nc-black border-b border-nc-border">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-nc-accent animate-pulse" />
                <span className="text-xs uppercase tracking-widest font-bold">{showPreview ? 'PREVIEWING' : 'EDITING'} SOURCE: {showEditor.name}</span>
              </div>
              <div className="flex items-center gap-4">
                {showEditor.name.endsWith('.html') && (
                  <button 
                    onClick={() => setShowPreview(!showPreview)}
                    className={cn(
                      "text-[10px] uppercase tracking-widest px-3 py-1 border transition-all",
                      showPreview ? "bg-nc-accent text-nc-black border-nc-accent" : "text-nc-accent border-nc-accent/30 hover:bg-nc-accent/10"
                    )}
                  >
                    {showPreview ? '[ SHOW_CODE ]' : '[ SHOW_PREVIEW ]'}
                  </button>
                )}
                <button onClick={() => { setShowEditor(null); setShowPreview(false); }} className="text-nc-gray hover:text-nc-accent transition-colors"><X size={20} /></button>
              </div>
            </div>
            {showPreview ? (
              <div className="flex-1 bg-white">
                <iframe 
                  title="Preview"
                  srcDoc={editorContent}
                  className="w-full h-full border-none"
                  sandbox="allow-scripts"
                />
              </div>
            ) : (
              <textarea 
                className="flex-1 bg-nc-black/50 text-nc-white p-8 font-mono outline-none resize-none text-sm leading-relaxed"
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                autoFocus
              />
            )}
            <div className="p-4 flex justify-between items-center bg-nc-black border-t border-nc-border">
              <div className="text-[10px] text-nc-gray uppercase tracking-widest">
                LINES: {editorContent.split('\n').length} | CHARS: {editorContent.length}
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowEditor(null)}
                  className="px-6 py-2 text-xs uppercase tracking-widest text-nc-gray hover:text-nc-white transition-colors"
                >
                  ABORT
                </button>
                <button 
                  onClick={saveFile}
                  className="px-8 py-2 bg-nc-accent text-nc-black font-bold text-xs uppercase tracking-widest hover:bg-nc-white transition-all active:scale-95"
                >
                  COMMIT CHANGES (F2)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Todo Modal */}
      {showTodo && (
        <div className="fixed inset-0 bg-nc-black/90 backdrop-blur-sm flex items-center justify-center p-8 z-50">
          <div className="nc-panel w-full max-w-lg flex flex-col border-nc-accent shadow-2xl overflow-hidden">
            <div className="nc-header py-4 px-6 flex justify-between items-center bg-nc-black border-b border-nc-border">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-nc-accent animate-pulse" />
                <span className="text-xs uppercase tracking-widest font-bold">MISSION_LOG.EXE</span>
              </div>
              <button onClick={() => setShowTodo(false)} className="text-nc-gray hover:text-nc-accent transition-colors"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-6 bg-nc-black/80">
              <div className="font-mono text-[10px] text-nc-accent/50 uppercase tracking-[0.2em] mb-4">
                {`> INITIALIZING_OBJECTIVES...`} <br/>
                {`> STATUS: MISSION_CRITICAL`}
              </div>
              
              <div className="space-y-3">
                {todos.map(todo => (
                  <div 
                    key={todo.id} 
                    className="flex items-center gap-4 group cursor-pointer"
                    onClick={() => setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, completed: !t.completed } : t))}
                  >
                    <div className={cn(
                      "w-4 h-4 border flex items-center justify-center transition-all duration-300",
                      todo.completed ? "bg-nc-accent border-nc-accent text-nc-black scale-110" : "border-nc-border text-nc-white group-hover:border-nc-accent"
                    )}>
                      {todo.completed ? '✓' : ''}
                    </div>
                    <span className={cn(
                      "font-mono text-xs tracking-wide transition-all duration-300",
                      todo.completed ? "text-nc-gray line-through opacity-50" : "text-nc-white group-hover:text-nc-accent"
                    )}>
                      {todo.text}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-nc-border">
                <div className="relative">
                  <input 
                    type="text"
                    className="w-full bg-nc-panel border border-nc-border p-3 pl-10 text-nc-white font-mono text-xs outline-none focus:border-nc-accent transition-colors rounded"
                    placeholder="NEW_OBJECTIVE_"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        setTodos(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), text: e.currentTarget.value, completed: false }]);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-nc-accent font-bold text-xs">+</span>
                </div>
              </div>
            </div>
            <div className="p-4 flex justify-center bg-nc-black border-t border-nc-border">
              <button 
                onClick={() => setShowTodo(false)}
                className="px-12 py-2 bg-nc-accent text-nc-black font-bold text-xs uppercase tracking-widest hover:bg-nc-white transition-all active:scale-95"
              >
                RETURN_TO_COMMAND
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Confirmation Modal */}
      {showSaveConfirm && (
        <div className="fixed inset-0 bg-nc-black/95 backdrop-blur-md flex items-center justify-center p-8 z-[100]">
          <div className="nc-panel w-full max-w-md border-nc-yellow shadow-2xl overflow-hidden">
            <div className="nc-header py-3 px-6 flex items-center gap-3 bg-nc-black border-b border-nc-border">
              <div className="w-2 h-2 rounded-full bg-nc-yellow animate-pulse" />
              <span className="text-xs uppercase tracking-widest font-bold">CONFIRM_SYSTEM_COMMIT</span>
            </div>
            <div className="p-8 space-y-6 bg-nc-black/80">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-nc-yellow/10 rounded-lg border border-nc-yellow/20">
                  <RefreshCw size={24} className="text-nc-yellow animate-spin-slow" />
                </div>
                <div className="space-y-2">
                  <p className="text-nc-white font-bold text-sm uppercase tracking-tight">SAVE_CHANGES_TO_DISK?</p>
                  <p className="text-nc-gray text-[10px] leading-relaxed uppercase">
                    YOU ARE ABOUT TO COMMIT CHANGES TO THE TARGET FILE SYSTEM. THIS ACTION MAY OVERWRITE EXISTING DATA. PROCEED?
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setShowSaveConfirm(false)}
                  className="flex-1 py-3 border border-nc-border text-nc-gray hover:text-nc-white hover:border-nc-white transition-all text-[10px] font-bold uppercase tracking-widest"
                >
                  [ ABORT_SAVE ]
                </button>
                <button 
                  onClick={performSave}
                  className="flex-1 py-3 bg-nc-yellow text-nc-black hover:bg-nc-white transition-all text-[10px] font-bold uppercase tracking-widest"
                >
                  [ CONFIRM_COMMIT ]
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-nc-black/90 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 z-50">
          <div className="nc-panel w-full max-w-2xl flex flex-col border-nc-accent shadow-2xl max-h-[90vh] overflow-hidden">
            <div className="nc-header py-4 px-6 flex justify-between items-center bg-nc-black border-b border-nc-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-nc-accent animate-pulse" />
                <span className="text-xs uppercase tracking-widest font-bold">SYSTEM_SETTINGS.CFG</span>
              </div>
              <button onClick={() => setShowSettings(false)} className="text-nc-gray hover:text-nc-accent transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 sm:p-8 space-y-8 bg-nc-black/80 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column: AI Config */}
                <div className="space-y-6">
                  <div className="text-[10px] text-nc-gray uppercase tracking-[0.2em] font-bold border-b border-nc-border pb-2 mb-4">AI_CORE_CONFIGURATION</div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] text-nc-accent uppercase tracking-widest font-bold">OLLAMA_HOST_URL</label>
                    <input 
                      type="text"
                      className="w-full bg-nc-panel border border-nc-border p-3 text-nc-white font-mono text-xs outline-none focus:border-nc-accent transition-colors rounded"
                      placeholder="https://ollama.com"
                      value={ollamaHost}
                      onChange={(e) => setOllamaHost(e.target.value)}
                    />
                    <p className="text-[8px] text-nc-gray italic opacity-50">DEFAULT: https://ollama.com (CLOUD) OR http://localhost:11434 (LOCAL)</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-nc-accent uppercase tracking-widest font-bold">OLLAMA_API_KEY</label>
                    <div className="relative">
                      <input 
                        type="password"
                        name="ollama-key"
                        autoComplete="new-password"
                        className="w-full bg-nc-panel border border-nc-border p-3 text-nc-white font-mono text-xs outline-none focus:border-nc-accent transition-colors rounded"
                        placeholder="ENTER_API_KEY_"
                        value={ollamaApiKey}
                        onChange={(e) => setOllamaApiKey(e.target.value)}
                      />
                      <button 
                        onClick={() => setOllamaApiKey('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-nc-yellow hover:text-nc-white uppercase font-bold px-2"
                      >
                        [ X ]
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] text-nc-accent uppercase tracking-widest font-bold">AI_MODEL_SELECTION</label>
                    </div>
                    <div className="relative">
                      <select 
                        className="w-full bg-nc-panel border border-nc-border p-3 text-nc-white font-mono text-xs outline-none focus:border-nc-accent transition-colors rounded appearance-none cursor-pointer pr-10"
                        value={ollamaModel}
                        onChange={(e) => setOllamaModel(e.target.value)}
                      >
                        {availableModels.length === 0 ? (
                          <option value="" disabled>SYNC_TO_LOAD_MODELS</option>
                        ) : (
                          availableModels.map(model => (
                            <option key={model} value={model} className="bg-nc-panel text-nc-white">{model.toUpperCase()}</option>
                          ))
                        )}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-nc-accent">
                        <ChevronDown size={14} />
                      </div>
                    </div>
                    <p className="text-[8px] text-nc-gray italic opacity-50">MODELS_FETCHED_FROM_OLLAMA_CLOUD_API</p>
                  </div>
                </div>

                {/* Right Column: Visuals & Personality */}
                <div className="space-y-6">
                  <div className="text-[10px] text-nc-gray uppercase tracking-[0.2em] font-bold border-b border-nc-border pb-2 mb-4">INTERFACE_&_IDENTITY</div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] text-nc-accent uppercase tracking-widest font-bold flex items-center gap-2">
                      <Palette size={12} />
                      VISUAL_THEME
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {THEMES.map(t => (
                        <button
                          key={t.id}
                          onClick={() => setTheme(t.id)}
                          className={cn(
                            "px-3 py-2 text-[9px] font-bold uppercase tracking-widest border transition-all",
                            theme === t.id ? "bg-nc-accent text-nc-black border-nc-accent" : "bg-nc-panel text-nc-gray border-nc-border hover:border-nc-accent hover:text-nc-white"
                          )}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-nc-accent uppercase tracking-widest font-bold flex items-center gap-2">
                      <User size={12} />
                      AI_PERSONALITY
                    </label>
                    <div className="relative">
                      <select 
                        className="w-full bg-nc-panel border border-nc-border p-3 text-nc-white font-mono text-xs outline-none focus:border-nc-accent transition-colors rounded appearance-none cursor-pointer pr-10"
                        value={personality}
                        onChange={(e) => setPersonality(e.target.value)}
                      >
                        {Object.entries(PERSONALITIES).map(([id, p]) => (
                          <option key={id} value={id} className="bg-nc-panel text-nc-white">{p.name}</option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-nc-accent">
                        <ChevronDown size={14} />
                      </div>
                    </div>
                  </div>

                  {personality === 'custom' && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                      <label className="text-[10px] text-nc-accent uppercase tracking-widest font-bold">CUSTOM_SYSTEM_PROMPT</label>
                      <textarea 
                        className="w-full bg-nc-panel border border-nc-border p-3 text-nc-white font-mono text-xs outline-none focus:border-nc-accent transition-colors rounded h-24 resize-none"
                        placeholder="DEFINE_YOUR_AI_IDENTITY_HERE..."
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-nc-border">
                <div className="text-[9px] text-nc-gray leading-relaxed">
                  <span className="text-nc-accent font-bold">NOTE:</span> SETTINGS ARE PERSISTED TO LOCAL_STORAGE. THEMES AND PERSONALITIES ARE APPLIED IMMEDIATELY.
                </div>
              </div>
            </div>
            <div className="p-4 flex justify-center bg-nc-black border-t border-nc-border shrink-0 gap-4">
              <button 
                onClick={fetchOllamaModels}
                disabled={!ollamaApiKey || isOllamaLoading}
                className="px-8 py-2 bg-nc-black border border-nc-accent text-nc-accent font-bold text-xs uppercase tracking-widest hover:bg-nc-accent hover:text-nc-black transition-all active:scale-95 disabled:opacity-50"
              >
                {isOllamaLoading ? 'SYNCING...' : 'SYNC_MODELS'}
              </button>
              <button 
                onClick={() => setShowSettings(false)}
                className="px-12 py-2 bg-nc-accent text-nc-black font-bold text-xs uppercase tracking-widest hover:bg-nc-white transition-all active:scale-95"
              >
                SAVE_AND_CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
