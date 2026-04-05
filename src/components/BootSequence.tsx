import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';

interface BootSequenceProps {
  onComplete: () => void;
}

export const BootSequence: React.FC<BootSequenceProps> = ({ onComplete }) => {
  const [lines, setLines] = useState<string[]>([]);
  const [phase, setPhase] = useState<'initial' | 'modules' | 'checks' | 'final' | 'done'>('initial');

  const initialLines = [
    "───────────────────────────────────────────────────────────",
    "███╗   ██╗ ██████╗ █████╗ ██╗",
    "████╗  ██║██╔════╝██╔══██╗██║",
    "██╔██╗ ██║██║     ███████║██║",
    "██║╚██╗██║██║     ██╔══██║██║",
    "██║ ╚████║╚██████╗██║  ██║██║",
    "╚═╝  ╚═══╝ ╚═════╝╚═╝  ╚═╝╚═╝",
    "        N C A I   S Y S T E M",
    "   No Commands • All Instructions",
    "────────────────────────────────────────────────────────────",
    "",
    "NCAI BIOS v1.03  (C) 1991–2026 Dex Industries",
    "CPU: 486DX-Turbo (AI Enhanced)",
    "RAM Check: 8192 MB OK",
    "VRAM Check: 4096 MB OK",
    "L1 Cache: ENABLED",
    "L2 Cache: ENABLED",
    "AI Co‑Processor: ONLINE",
    "Pi‑Agent Link: SYNCED",
    "",
    "POST................. OK",
    "Bootloader........... OK",
    "Kernel.AI............ OK",
    "RetroUI.sys.......... OK",
    "Firebase.link........ OK",
    "Ollama.cloud......... OK",
    "",
    "Initializing modules:",
  ];

  const checks = [
    "",
    "Running system checks:",
    "",
    "> Checking network............... OK",
    "> Checking Pi heartbeat.......... OK",
    "> Checking Docker daemon......... OK",
    "> Checking Git integration....... OK",
    "> Checking Dex‑Mode.............. ENABLED",
    "> Checking Printer Curse......... NOT DETECTED",
    "> Checking BootyBot handshake.... VERIFIED",
    "",
    "Finalizing boot sequence...",
    "",
  ];

  useEffect(() => {
    let currentLine = 0;
    const interval = setInterval(() => {
      if (currentLine < initialLines.length) {
        setLines(prev => [...prev, initialLines[currentLine]]);
        currentLine++;
      } else {
        clearInterval(interval);
        setPhase('modules');
      }
    }, 65);
    return () => clearInterval(interval);
  }, []);

  const runModules = async () => {
    const mods = [
      { id: 'kernel', label: '[CORE] Loading AI Kernel', intermediate: null },
      { id: 'root', label: '[CORE] Mounting /root', intermediate: null },
      { id: 'scan', label: '[CORE] Scanning directories', intermediate: null },
      { id: 'planner', label: '[AGENT] Planner', intermediate: 78 },
      { id: 'coder', label: '[AGENT] Coder', intermediate: 52 },
      { id: 'bughunt', label: '[AGENT] Bughunt', intermediate: 80 },
      { id: 'assistant', label: '[AGENT] Assistant', intermediate: null },
    ];

    for (const mod of mods) {
      if (mod.intermediate) {
        setLines(prev => [...prev, `${mod.label.padEnd(34)} ${renderProgressBar(mod.intermediate!)}`]);
        await new Promise(r => setTimeout(r, 400));
      }
      setLines(prev => [...prev, `${mod.label.padEnd(34)} ${renderProgressBar(100)}`]);
      if (mod.id === 'scan' || mod.id === 'planner' || mod.id === 'coder' || mod.id === 'bughunt') {
        setLines(prev => [...prev, ""]); // Add spacing as in user request
      }
      await new Promise(r => setTimeout(r, 200));
    }
    setPhase('checks');
  };

  useEffect(() => {
    if (phase === 'modules') {
      runModules();
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'checks') {
      let currentCheck = 0;
      const interval = setInterval(() => {
        if (currentCheck < checks.length) {
          setLines(prev => [...prev, checks[currentCheck]]);
          currentCheck++;
        } else {
          clearInterval(interval);
          setPhase('final');
        }
      }, 130);
      return () => clearInterval(interval);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'final') {
      const runFinal = async () => {
        const finalSteps = [
          { id: 'ui', label: 'Loading UI.......................' },
          { id: 'parser', label: 'Preparing instruction parser.....' },
          { id: 'buffers', label: 'Allocating retro buffers.........' },
        ];
        for (const step of finalSteps) {
          await new Promise(r => setTimeout(r, 550));
          setLines(prev => [...prev, `${step.label.padEnd(33)} ${renderBlockBar(100)}`]);
        }
        setPhase('done');
      };
      runFinal();
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'done') {
      const timer = setTimeout(() => {
        onComplete();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [phase, onComplete]);

  const renderProgressBar = (value: number, char: string = '■', total: number = 24) => {
    const filled = Math.floor((value / 100) * total);
    const empty = total - filled;
    return `[${char.repeat(filled)}${'.'.repeat(empty)}] ${value}%`;
  };

  const renderBlockBar = (value: number, char: string = '▓', total: number = 20) => {
    const filled = Math.floor((value / 100) * total);
    const empty = total - filled;
    return `${char.repeat(filled)}${' '.repeat(empty)} ${value}%`;
  };

  return (
    <div className="fixed inset-0 bg-black text-[#00ff41] font-mono p-8 overflow-y-auto z-[100] selection:bg-[#00ff41] selection:text-black">
      <div className="max-w-3xl mx-auto whitespace-pre leading-tight">
        {lines.map((line, i) => (
          <div key={i} className="min-h-[1.2em]">{line}</div>
        ))}
        
        {phase === 'done' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 text-white font-bold animate-pulse"
          >
            SYSTEM READY. BOOTING UI...
          </motion.div>
        )}
      </div>
      
      {/* CRT Scanline Effect */}
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] z-[101]" />
    </div>
  );
};
