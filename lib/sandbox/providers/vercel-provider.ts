import { Sandbox } from '@vercel/sandbox';
import { SandboxProvider, SandboxInfo, CommandResult } from '../types';
// SandboxProviderConfig available through parent class
import fs from 'fs';
import path from 'path';

export class VercelProvider extends SandboxProvider {
  private existingFiles: Set<string> = new Set();

  private cleanEnvValue(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1).trim();
    }
    return trimmed;
  }

  private getVercelIdsFromEnvOrProject(): { teamId?: string; projectId?: string } {
    const envTeamId = this.cleanEnvValue(process.env.VERCEL_TEAM_ID);
    const envProjectId = this.cleanEnvValue(process.env.VERCEL_PROJECT_ID);
    if (envTeamId && envProjectId) return { teamId: envTeamId, projectId: envProjectId };

    try {
      const projectJsonPath = path.join(process.cwd(), '.vercel', 'project.json');
      if (!fs.existsSync(projectJsonPath)) {
        return { teamId: envTeamId, projectId: envProjectId };
      }
      const raw = fs.readFileSync(projectJsonPath, 'utf-8');
      const parsed = JSON.parse(raw) as { orgId?: string; projectId?: string };
      return {
        teamId: envTeamId || this.cleanEnvValue(parsed.orgId),
        projectId: envProjectId || this.cleanEnvValue(parsed.projectId),
      };
    } catch {
      return { teamId: envTeamId, projectId: envProjectId };
    }
  }

  async createSandbox(): Promise<SandboxInfo> {
    try {
      
      // Kill existing sandbox if any
      if (this.sandbox) {
        try {
          await this.sandbox.stop();
        } catch (e) {
          console.error('Failed to stop existing sandbox:', e);
        }
        this.sandbox = null;
      }
      
      // Clear existing files tracking
      this.existingFiles.clear();

      // Create Vercel sandbox
      
      const sandboxConfig: any = {
        timeout: 600000, // 10 minutes in ms (increased from 5)
        runtime: 'node22', // Use node22 runtime for Vercel sandboxes
        ports: [5173] // Vite port
      };

      // Try authentication methods in order for resilience:
      // PAT -> OIDC -> default
      const attempts: Array<any> = [];
      const vercelToken = this.cleanEnvValue(process.env.VERCEL_TOKEN);
      const ids = this.getVercelIdsFromEnvOrProject();
      const vercelTeamId = ids.teamId;
      const vercelProjectId = ids.projectId;
      const vercelOidcToken = this.cleanEnvValue(process.env.VERCEL_OIDC_TOKEN);

      if (vercelToken && vercelTeamId && vercelProjectId) {
        attempts.push({
          ...sandboxConfig,
          teamId: vercelTeamId,
          projectId: vercelProjectId,
          token: vercelToken,
        });
      }
      if (vercelOidcToken) {
        attempts.push({
          ...sandboxConfig,
          token: vercelOidcToken,
          ...(vercelTeamId ? { teamId: vercelTeamId } : {}),
          ...(vercelProjectId ? { projectId: vercelProjectId } : {}),
        });
        attempts.push({
          ...sandboxConfig,
          oidcToken: vercelOidcToken,
        });
      }
      attempts.push({ ...sandboxConfig, __clearAuthEnv: true });

      let lastError: any = null;
      for (const cfg of attempts) {
        try {
          const clearAuthEnv = Boolean((cfg as any).__clearAuthEnv);
          if (clearAuthEnv) {
            delete (cfg as any).__clearAuthEnv;
          }
          this.sandbox = await this.createSandboxWithOptionalEnvIsolation(cfg, clearAuthEnv);
          lastError = null;
          break;
        } catch (e: any) {
          lastError = e;
        }
      }

      if (!this.sandbox) {
        throw lastError || new Error('Failed to create Vercel sandbox with available auth methods');
      }
      
      const sandboxId = this.sandbox.sandboxId;
      // Sandbox created successfully
      
      // Get the sandbox URL using the correct Vercel Sandbox API
      const sandboxUrl = this.sandbox.domain(5173);

      this.sandboxInfo = {
        sandboxId,
        url: sandboxUrl,
        provider: 'vercel',
        createdAt: new Date()
      };

      return this.sandboxInfo;

    } catch (error) {
      console.error('[VercelProvider] Error creating sandbox:', error);
      throw error;
    }
  }

  private async extractStdout(result: any): Promise<string> {
    try {
      if (typeof result.stdout === 'function') {
        return await result.stdout();
      } else {
        return result.stdout || '';
      }
    } catch (e) {
      return '';
    }
  }

  private async extractStderr(result: any): Promise<string> {
    try {
      if (typeof result.stderr === 'function') {
        return await result.stderr();
      } else {
        return result.stderr || '';
      }
    } catch (e) {
      return '';
    }
  }

  async runCommand(command: string): Promise<CommandResult> {
    if (!this.sandbox) {
      throw new Error('No active sandbox');
    }

    
    try {
      // Parse command into cmd and args (matching PR syntax)
      const parts = command.split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);
      
      // Vercel uses runCommand with cmd and args object (based on PR)
      const result = await this.sandbox.runCommand({
        cmd: cmd,
        args: args,
        cwd: '/vercel/sandbox',
        env: {}
      });
      
      // Handle stdout and stderr - they might be functions in Vercel SDK
      const stdout = await this.extractStdout(result);
      const stderr = await this.extractStderr(result);
      
      return {
        stdout: stdout,
        stderr: stderr,
        exitCode: result.exitCode || 0,
        success: result.exitCode === 0
      };
    } catch (error: any) {
      return {
        stdout: '',
        stderr: error.message || 'Command failed',
        exitCode: 1,
        success: false
      };
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (!this.sandbox) {
      throw new Error('No active sandbox');
    }

    // Vercel sandbox default working directory is /vercel/sandbox
    const fullPath = path.startsWith('/') ? path : `/vercel/sandbox/${path}`;
    
    // Writing file to sandbox
    
    // Based on Vercel SDK docs, writeFiles expects path and Buffer content
    try {
      const buffer = Buffer.from(content, 'utf-8');
      // Writing file with buffer
      
      await this.sandbox.writeFiles([{
        path: fullPath,
        content: buffer
      }]);
      
      this.existingFiles.add(path);
    } catch (writeError: any) {
      // Log detailed error information
      console.error(`[VercelProvider] writeFiles failed for ${fullPath}:`, {
        error: writeError,
        message: writeError?.message,
        response: writeError?.response,
        statusCode: writeError?.response?.status,
        responseData: writeError?.response?.data
      });
      
      // Fallback to command-based approach if writeFiles fails
      // Falling back to command-based file write
      
      // Ensure directory exists
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
      if (dir) {
        const mkdirResult = await this.sandbox.runCommand({
          cmd: 'mkdir',
          args: ['-p', dir]
        });
        // Directory created
      }
      
      // Write file using echo and redirection
      const escapedContent = content
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\$/g, '\\$')
        .replace(/`/g, '\\`')
        .replace(/\n/g, '\\n');
      
      const writeResult = await this.sandbox.runCommand({
        cmd: 'sh',
        args: ['-c', `echo "${escapedContent}" > "${fullPath}"`]
      });
      
      // File written
      
      if (writeResult.exitCode === 0) {
        this.existingFiles.add(path);
      } else {
        throw new Error(`Failed to write file via command: ${writeResult.stderr}`);
      }
    }
  }

  async readFile(path: string): Promise<string> {
    if (!this.sandbox) {
      throw new Error('No active sandbox');
    }

    // Vercel sandbox default working directory is /vercel/sandbox
    const fullPath = path.startsWith('/') ? path : `/vercel/sandbox/${path}`;
    
    const result = await this.sandbox.runCommand({
      cmd: 'cat',
      args: [fullPath]
    });
    
    // Handle stdout and stderr - they might be functions in Vercel SDK
    const stdout = await this.extractStdout(result);
    const stderr = await this.extractStderr(result);
    
    if (result.exitCode !== 0) {
      throw new Error(`Failed to read file: ${stderr}`);
    }
    
    return stdout;
  }

  async listFiles(directory: string = '/vercel/sandbox'): Promise<string[]> {
    if (!this.sandbox) {
      throw new Error('No active sandbox');
    }

    const result = await this.sandbox.runCommand({
      cmd: 'sh',
      args: ['-c', `find ${directory} -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.next/*" -not -path "*/dist/*" -not -path "*/build/*" | sed "s|^${directory}/||"`],
      cwd: '/'
    });
    
    // Handle stdout - it might be a function in Vercel SDK
    const stdout = await this.extractStdout(result);
    
    if (result.exitCode !== 0) {
      return [];
    }
    
    return stdout.split('\n').filter((line: string) => line.trim() !== '');
  }

  async installPackages(packages: string[]): Promise<CommandResult> {
    if (!this.sandbox) {
      throw new Error('No active sandbox');
    }

    const flags = process.env.NPM_FLAGS || '';
    
    // Installing packages
    
    // Build args array
    const args = ['install'];
    if (flags) {
      args.push(...flags.split(' '));
    }
    args.push(...packages);
    
    const result = await this.sandbox.runCommand({
      cmd: 'npm',
      args: args,
      cwd: '/vercel/sandbox'
    });
    
    // Handle stdout and stderr - they might be functions in Vercel SDK
    let stdout = '';
    let stderr = '';
    
    try {
      if (typeof result.stdout === 'function') {
        stdout = await result.stdout();
      } else {
        stdout = result.stdout || '';
      }
    } catch (e) {
      stdout = '';
    }
    
    try {
      if (typeof result.stderr === 'function') {
        stderr = await result.stderr();
      } else {
        stderr = result.stderr || '';
      }
    } catch (e) {
      stderr = '';
    }
    
    // Restart Vite if configured and successful
    if (result.exitCode === 0 && process.env.AUTO_RESTART_VITE === 'true') {
      await this.restartViteServer();
    }
    
    return {
      stdout: stdout,
      stderr: stderr,
      exitCode: result.exitCode || 0,
      success: result.exitCode === 0
    };
  }

  async setupViteApp(): Promise<void> {
    if (!this.sandbox) {
      throw new Error('No active sandbox');
    }

    // Setting up Vite app for sandbox
    
    // Create directory structure
    const mkdirResult = await this.sandbox.runCommand({
      cmd: 'mkdir',
      args: ['-p', '/vercel/sandbox/src']
    });
    // Directory structure created
    
    // Create package.json
    const packageJson = {
      name: "sandbox-app",
      version: "1.0.0",
      type: "module",
      scripts: {
        dev: "vite --host",
        build: "vite build",
        preview: "vite preview"
      },
      dependencies: {
        react: "^18.2.0",
        "react-dom": "^18.2.0"
      },
      devDependencies: {
        "@vitejs/plugin-react": "^4.0.0",
        vite: "^4.3.9",
        tailwindcss: "^3.3.0",
        postcss: "^8.4.31",
        autoprefixer: "^10.4.16"
      }
    };
    
    await this.writeFile('package.json', JSON.stringify(packageJson, null, 2));
    
    // Create vite.config.js
    const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: [
      '.vercel.run',  // Allow all Vercel sandbox domains
      '.e2b.dev',     // Allow all E2B sandbox domains
      'localhost'
    ],
    hmr: {
      clientPort: 443,
      protocol: 'wss'
    }
  }
})`;
    
    await this.writeFile('vite.config.js', viteConfig);
    
    // Create tailwind.config.js
    const tailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`;
    
    await this.writeFile('tailwind.config.js', tailwindConfig);
    
    // Create postcss.config.js
    const postcssConfig = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`;
    
    await this.writeFile('postcss.config.js', postcssConfig);
    
    // Create index.html
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sandbox App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`;
    
    await this.writeFile('index.html', indexHtml);
    
    // Create src/main.jsx
    const mainJsx = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`;
    
    await this.writeFile('src/main.jsx', mainJsx);
    
    // Create src/App.jsx
    const appJsx = `function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="text-center max-w-2xl">
        <p className="text-lg text-gray-400">
          Vercel Sandbox Ready<br/>
          Start building your React app with Vite and Tailwind CSS!
        </p>
      </div>
    </div>
  )
}

export default App`;
    
    await this.writeFile('src/App.jsx', appJsx);
    
    // Create src/index.css
    const indexCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background-color: rgb(17 24 39);
}`;
    
    await this.writeFile('src/index.css', indexCss);
    
    // Installing npm dependencies
    
    // Install dependencies
    try {
      const installResult = await this.sandbox.runCommand({
        cmd: 'npm',
        args: ['install'],
        cwd: '/vercel/sandbox'
      });
      
      // npm install completed
      
      if (installResult.exitCode === 0) {
        // Dependencies installed successfully
      } else {
        console.warn('[VercelProvider] npm install had issues:', installResult.stderr);
      }
    } catch (error: any) {
      console.error('[VercelProvider] npm install error:', {
        message: error?.message,
        response: error?.response?.status,
        responseText: error?.text
      });
      // Try alternative approach - run as shell command
      try {
        const altResult = await this.sandbox.runCommand({
          cmd: 'sh',
          args: ['-c', 'cd /vercel/sandbox && npm install'],
          cwd: '/vercel/sandbox'
        });
        if (altResult.exitCode === 0) {
          // Alternative npm install succeeded
        } else {
          console.warn('[VercelProvider] Alternative npm install also had issues:', altResult.stderr);
        }
      } catch (altError) {
        console.error('[VercelProvider] Alternative npm install also failed:', altError);
        console.warn('[VercelProvider] Continuing without npm install - packages may need to be installed manually');
      }
    }
    
    // Start Vite dev server
    // Starting Vite dev server
    
    // Kill any existing Vite processes
    await this.sandbox.runCommand({
      cmd: 'sh',
      args: ['-c', 'pkill -f vite || true'],
      cwd: '/'
    });
    
    // Start Vite in background
    await this.sandbox.runCommand({
      cmd: 'sh',
      args: ['-c', 'nohup npm run dev > /tmp/vite.log 2>&1 &'],
      cwd: '/vercel/sandbox'
    });
    
    // Poll until Vite is ready (max 30s)
    await this.waitForVite();
    
    // Track initial files
    this.existingFiles.add('src/App.jsx');
    this.existingFiles.add('src/main.jsx');
    this.existingFiles.add('src/index.css');
    this.existingFiles.add('index.html');
    this.existingFiles.add('package.json');
    this.existingFiles.add('vite.config.js');
    this.existingFiles.add('tailwind.config.js');
    this.existingFiles.add('postcss.config.js');
  }

  async restartViteServer(): Promise<void> {
    if (!this.sandbox) {
      throw new Error('No active sandbox');
    }

    // Restarting Vite server
    
    // Kill existing Vite process
    await this.sandbox.runCommand({
      cmd: 'sh',
      args: ['-c', 'pkill -f vite || true'],
      cwd: '/'
    });
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Start Vite in background
    await this.sandbox.runCommand({
      cmd: 'sh',
      args: ['-c', 'nohup npm run dev > /tmp/vite.log 2>&1 &'],
      cwd: '/vercel/sandbox'
    });
    
    // Poll until Vite is ready (max 30s)
    await this.waitForVite();
  }

  private async waitForVite(maxWaitMs = 30000): Promise<void> {
    const pollInterval = 2000;
    const start = Date.now();
    let viteProcessChecked = false;
    
    while (Date.now() - start < maxWaitMs) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      // First check if Vite process is running
      if (!viteProcessChecked) {
        try {
          const psResult = await this.sandbox!.runCommand({
            cmd: 'sh',
            args: ['-c', 'pgrep -f "vite" || echo "not_running"'],
            cwd: '/'
          });
          
          const psStdout = await this.extractStdout(psResult);
          if (psStdout?.includes('not_running')) {
            console.warn('[VercelProvider] Vite process not running, attempting to start...');
            // Try to start Vite again
            await this.sandbox!.runCommand({
              cmd: 'sh',
              args: ['-c', 'cd /vercel/sandbox && nohup npm run dev > /tmp/vite.log 2>&1 &'],
              cwd: '/'
            });
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
          viteProcessChecked = true;
        } catch (e) {
          console.warn('[VercelProvider] Error checking Vite process:', e);
        }
      }
      
      // Check if Vite is responding on port 5173
      try {
        const result = await this.sandbox!.runCommand({
          cmd: 'sh',
          args: ['-c', 'curl -s -o /dev/null -w "%{http_code}" http://localhost:5173'],
          cwd: '/'
        });
        const resultStdout = await this.extractStdout(result);
        const code = resultStdout?.trim();
        if (code && code !== '0' && code !== '000') {
          console.log('[VercelProvider] Vite ready, HTTP status:', code);
          
          // Additional check: verify Vite is actually serving content
          try {
            const contentCheck = await this.sandbox!.runCommand({
              cmd: 'sh',
              args: ['-c', 'curl -s http://localhost:5173 | head -c 100'],
              cwd: '/'
            });
            const contentCheckStdout = await this.extractStdout(contentCheck);
            if (contentCheckStdout && contentCheckStdout.length > 10) {
              console.log('[VercelProvider] Vite is serving content');
              return;
            }
          } catch {
            // Continue polling
          }
        }
      } catch {
        // keep polling
      }
    }
    
    // Fallback: Check logs and give it more time
    console.warn('[VercelProvider] Vite readiness check timed out, checking logs...');
    try {
      const logResult = await this.sandbox!.runCommand({
        cmd: 'sh',
        args: ['-c', 'tail -n 20 /tmp/vite.log'],
        cwd: '/'
      });
      const logStdout = await this.extractStdout(logResult);
      console.log('[VercelProvider] Vite logs:', logStdout);
    } catch {
      console.warn('[VercelProvider] Could not read Vite logs');
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  getSandboxUrl(): string | null {
    return this.sandboxInfo?.url || null;
  }

  getSandboxInfo(): SandboxInfo | null {
    return this.sandboxInfo;
  }

  async terminate(): Promise<void> {
    if (this.sandbox) {
      try {
        await this.sandbox.stop();
      } catch (e) {
        console.error('Failed to terminate sandbox:', e);
      }
      this.sandbox = null;
      this.sandboxInfo = null;
    }
  }

  isAlive(): boolean {
    return !!this.sandbox;
  }

  private async createSandboxWithOptionalEnvIsolation(config: any, clearAuthEnv: boolean) {
    if (!clearAuthEnv) {
      return Sandbox.create(config);
    }

    const original = {
      oidc: process.env.VERCEL_OIDC_TOKEN,
      token: process.env.VERCEL_TOKEN,
      team: process.env.VERCEL_TEAM_ID,
      project: process.env.VERCEL_PROJECT_ID,
    };

    try {
      delete process.env.VERCEL_OIDC_TOKEN;
      delete process.env.VERCEL_TOKEN;
      delete process.env.VERCEL_TEAM_ID;
      delete process.env.VERCEL_PROJECT_ID;
      return await Sandbox.create(config);
    } finally {
      if (original.oidc !== undefined) process.env.VERCEL_OIDC_TOKEN = original.oidc;
      if (original.token !== undefined) process.env.VERCEL_TOKEN = original.token;
      if (original.team !== undefined) process.env.VERCEL_TEAM_ID = original.team;
      if (original.project !== undefined) process.env.VERCEL_PROJECT_ID = original.project;
    }
  }
}
