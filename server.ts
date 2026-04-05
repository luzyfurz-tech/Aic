import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { Ollama } from "ollama";
import fetch from "node-fetch";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import multer from "multer";
import { chromium, Browser, BrowserContext, Page } from "playwright";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const relativePath = (req.query.path as string) || "";
    const absolutePath = path.join(process.cwd(), relativePath);
    cb(null, absolutePath);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 8181;

  app.use(express.json());

  // --- BROWSER API ---
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  async function ensureBrowser() {
    if (!browser) {
      browser = await chromium.launch({ headless: true });
      context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      });
      page = await context.newPage();
    }
    return { browser, context, page };
  }

  app.post("/api/browser/goto", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "No URL provided" });
    try {
      const { page } = await ensureBrowser();
      await page!.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      const screenshot = await page!.screenshot({ type: 'jpeg', quality: 80 });
      res.json({ 
        url: page!.url(), 
        title: await page!.title(),
        screenshot: screenshot.toString('base64') 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/browser/screenshot", async (req, res) => {
    try {
      const { page } = await ensureBrowser();
      const screenshot = await page!.screenshot({ type: 'jpeg', quality: 80 });
      res.json({ 
        url: page!.url(), 
        title: await page!.title(),
        screenshot: screenshot.toString('base64') 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/browser/click", async (req, res) => {
    const { x, y } = req.body;
    try {
      const { page } = await ensureBrowser();
      await page!.mouse.click(x, y);
      // Wait a bit for potential navigation or UI change
      await page!.waitForTimeout(500);
      const screenshot = await page!.screenshot({ type: 'jpeg', quality: 80 });
      res.json({ 
        url: page!.url(), 
        title: await page!.title(),
        screenshot: screenshot.toString('base64') 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/browser/type", async (req, res) => {
    const { text, key } = req.body;
    try {
      const { page } = await ensureBrowser();
      if (key) {
        await page!.keyboard.press(key);
      } else {
        await page!.keyboard.type(text);
      }
      await page!.waitForTimeout(500);
      const screenshot = await page!.screenshot({ type: 'jpeg', quality: 80 });
      res.json({ 
        url: page!.url(), 
        title: await page!.title(),
        screenshot: screenshot.toString('base64') 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/browser/scroll", async (req, res) => {
    const { direction } = req.body;
    try {
      const { page } = await ensureBrowser();
      if (direction === 'down') {
        await page!.mouse.wheel(0, 500);
      } else {
        await page!.mouse.wheel(0, -500);
      }
      await page!.waitForTimeout(300);
      const screenshot = await page!.screenshot({ type: 'jpeg', quality: 80 });
      res.json({ 
        url: page!.url(), 
        title: await page!.title(),
        screenshot: screenshot.toString('base64') 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- LOCAL FILE SYSTEM API ---
  const BASE_DIR = process.cwd();

  app.post("/api/files/upload", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    res.json({ success: true, file: req.file.filename });
  });

  app.get("/api/files", async (req, res) => {
    const relativePath = (req.query.path as string) || "";
    const absolutePath = path.join(BASE_DIR, relativePath);

    try {
      // Security check: ensure path is within BASE_DIR
      if (!absolutePath.startsWith(BASE_DIR)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const entries = await fs.readdir(absolutePath, { withFileTypes: true });
      const files = await Promise.all(entries.map(async (entry) => {
        const entryPath = path.join(absolutePath, entry.name);
        const stats = await fs.stat(entryPath);
        return {
          id: Buffer.from(path.relative(BASE_DIR, entryPath)).toString('base64'),
          name: entry.name,
          type: entry.isDirectory() ? 'dir' : 'file',
          size: stats.size,
          date: stats.mtime.toISOString().split('T')[0],
          parentId: relativePath ? Buffer.from(relativePath).toString('base64') : null,
          path: path.relative(BASE_DIR, entryPath)
        };
      }));
      res.json(files);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/files/content", async (req, res) => {
    const filePath = req.query.path as string;
    if (!filePath) return res.status(400).json({ error: "No path provided" });

    const absolutePath = path.join(BASE_DIR, filePath);
    try {
      if (!absolutePath.startsWith(BASE_DIR)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const content = await fs.readFile(absolutePath, "utf-8");
      res.json({ content });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/files/save", async (req, res) => {
    const { path: filePath, content } = req.body;
    if (!filePath) return res.status(400).json({ error: "No path provided" });

    const absolutePath = path.join(BASE_DIR, filePath);
    try {
      if (!absolutePath.startsWith(BASE_DIR)) {
        return res.status(403).json({ error: "Access denied" });
      }
      // Ensure parent directory exists
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, content, "utf-8");
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/files/mkdir", async (req, res) => {
    const { path: dirPath } = req.body;
    if (!dirPath) return res.status(400).json({ error: "No path provided" });

    const absolutePath = path.join(BASE_DIR, dirPath);
    try {
      if (!absolutePath.startsWith(BASE_DIR)) {
        return res.status(403).json({ error: "Access denied" });
      }
      await fs.mkdir(absolutePath, { recursive: true });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/files/delete", async (req, res) => {
    const { path: itemPath } = req.body;
    if (!itemPath) return res.status(400).json({ error: "No path provided" });

    const absolutePath = path.join(BASE_DIR, itemPath);
    try {
      if (!absolutePath.startsWith(BASE_DIR)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const stats = await fs.stat(absolutePath);
      if (stats.isDirectory()) {
        await fs.rm(absolutePath, { recursive: true, force: true });
      } else {
        await fs.unlink(absolutePath);
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/files/rename", async (req, res) => {
    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) return res.status(400).json({ error: "Paths missing" });

    const absoluteOldPath = path.join(BASE_DIR, oldPath);
    const absoluteNewPath = path.join(BASE_DIR, newPath);
    try {
      if (!absoluteOldPath.startsWith(BASE_DIR) || !absoluteNewPath.startsWith(BASE_DIR)) {
        return res.status(403).json({ error: "Access denied" });
      }
      await fs.rename(absoluteOldPath, absoluteNewPath);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // System Execution Endpoint (For Local Mode)
  app.post("/api/system/exec", async (req, res) => {
    const { command } = req.body;
    if (!command) return res.status(400).json({ error: "No command provided" });

    try {
      // For security, you might want to restrict this in production
      // but for a self-hosted Pi tool, we allow it.
      const { stdout, stderr } = await execAsync(command);
      res.json({ output: stdout || stderr });
    } catch (error: any) {
      res.status(500).json({ 
        error: "Execution failed", 
        output: error.stderr || error.message 
      });
    }
  });

  // Streaming Terminal Endpoint
  app.get("/api/system/terminal", (req, res) => {
    const command = req.query.command as string;
    if (!command) return res.status(400).json({ error: "No command provided" });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const [cmd, ...args] = command.split(" ");
    const child = spawn(cmd, args, { shell: true, cwd: BASE_DIR });

    child.stdout.on("data", (data) => {
      res.write(`data: ${JSON.stringify({ type: 'stdout', data: data.toString() })}\n\n`);
    });

    child.stderr.on("data", (data) => {
      res.write(`data: ${JSON.stringify({ type: 'stderr', data: data.toString() })}\n\n`);
    });

    child.on("close", (code) => {
      res.write(`data: ${JSON.stringify({ type: 'exit', code })}\n\n`);
      res.end();
    });

    child.on("error", (err) => {
      res.write(`data: ${JSON.stringify({ type: 'error', data: err.message })}\n\n`);
      res.end();
    });

    req.on("close", () => {
      child.kill();
    });
  });

  // API Proxy for Ollama Tags (List Models)
  app.get("/api/models", async (req, res) => {
    const apiKey = req.headers.authorization?.split(" ")[1];
    const hostHeader = req.headers['x-ollama-host'] as string;
    try {
      const ollamaHost = hostHeader || process.env.OLLAMA_HOST || "https://ollama.com";
      const ollamaApiKey = process.env.OLLAMA_API_KEY || apiKey;

      const response = await fetch(`${ollamaHost}/api/tags`, {
        headers: ollamaApiKey ? { Authorization: `Bearer ${ollamaApiKey}` } : {},
      });
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch models" });
    }
  });

  // API Proxy for Ollama Chat (Streaming)
  app.post("/api/chat", async (req, res) => {
    const { model, messages, stream } = req.body;
    const apiKey = req.headers.authorization?.split(" ")[1];
    const hostHeader = req.headers['x-ollama-host'] as string;
    try {
      const ollamaHost = hostHeader || process.env.OLLAMA_HOST || "https://ollama.com";
      const ollamaApiKey = process.env.OLLAMA_API_KEY || apiKey;
      const ollama = new Ollama({
        host: ollamaHost,
        headers: ollamaApiKey ? { Authorization: `Bearer ${ollamaApiKey}` } : {},
      });

      if (stream) {
        const response = await ollama.chat({ model, messages, stream: true });
        res.setHeader("Content-Type", "text/event-stream");
        for await (const part of response) {
          res.write(`data: ${JSON.stringify(part)}\n\n`);
        }
        res.end();
      } else {
        const response = await ollama.chat({ model, messages, stream: false });
        res.json(response);
      }
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
