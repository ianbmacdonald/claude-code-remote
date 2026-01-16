import { spawn, ChildProcess } from 'child_process';

// Module-level state to track cloudflared process and cleanup handler
let cloudflaredProcess: ChildProcess | null = null;
let exitHandler: (() => void) | null = null;

function cleanup() {
  if (cloudflaredProcess) {
    cloudflaredProcess.kill();
    cloudflaredProcess = null;
  }
  if (exitHandler) {
    process.removeListener('exit', exitHandler);
    exitHandler = null;
  }
}

export async function startTunnel(port: number): Promise<string | null> {
  // Clean up any existing tunnel before starting a new one (handles hot reload)
  cleanup();

  // Try cloudflared first (most reliable free option)
  const cloudflaredUrl = await tryCloudflared(port);
  if (cloudflaredUrl) {
    return cloudflaredUrl;
  }

  // Could add other tunnel providers here
  // e.g., localtunnel, ngrok, etc.

  return null;
}

function tryCloudflared(port: number): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const proc = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${port}`], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // Store reference for cleanup
      cloudflaredProcess = proc;

      let output = '';
      const timeout = setTimeout(() => {
        // If we haven't found URL in 10 seconds, give up
        resolve(null);
      }, 10000);

      proc.stderr.on('data', (data: Buffer) => {
        output += data.toString();

        // cloudflared outputs the URL to stderr
        const urlMatch = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (urlMatch) {
          clearTimeout(timeout);
          resolve(urlMatch[0]);
        }
      });

      proc.on('error', () => {
        clearTimeout(timeout);
        resolve(null);
      });

      proc.on('exit', () => {
        clearTimeout(timeout);
        cloudflaredProcess = null;
        resolve(null);
      });

      // Register cleanup handler (only once per tunnel)
      exitHandler = () => {
        proc.kill();
      };
      process.on('exit', exitHandler);
    } catch {
      resolve(null);
    }
  });
}
