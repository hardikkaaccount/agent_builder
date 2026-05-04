import { NextRequest, NextResponse } from 'next/server';

declare global {
  var activeSandbox: any;
  var activeSandboxProvider: any;
  var sandboxData: any;
}

export async function POST(request: NextRequest) {
  try {
    const { packages } = await request.json();
    // sandboxId not used - using global sandbox
    
    if (!packages || !Array.isArray(packages) || packages.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Packages array is required' 
      }, { status: 400 });
    }
    
    // Validate and deduplicate package names
    const validPackages = [...new Set(packages)]
      .filter(pkg => pkg && typeof pkg === 'string' && pkg.trim() !== '')
      .map(pkg => pkg.trim());
    
    if (validPackages.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid package names provided'
      }, { status: 400 });
    }
    
    // Log if duplicates were found
    if (packages.length !== validPackages.length) {
      console.log(`[install-packages] Cleaned packages: removed ${packages.length - validPackages.length} invalid/duplicate entries`);
      console.log(`[install-packages] Original:`, packages);
      console.log(`[install-packages] Cleaned:`, validPackages);
    }
    
    // Get active sandbox provider
    const provider = global.activeSandboxProvider;
    
    if (!provider) {
      return NextResponse.json({ 
        success: false, 
        error: 'No active sandbox provider available' 
      }, { status: 400 });
    }
    
    console.log('[install-packages] Installing packages:', validPackages);
    
    // Create a response stream for real-time updates
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    let streamClosed = false;
    
    // Function to send progress updates
    const sendProgress = async (data: any) => {
      if (streamClosed) return;
      const message = `data: ${JSON.stringify(data)}\n\n`;
      try {
        await writer.write(encoder.encode(message));
      } catch (error: any) {
        // Client may disconnect/close stream during long-running installs.
        if (error?.code === 'ERR_INVALID_STATE' || String(error?.message || '').includes('WritableStream is closed')) {
          streamClosed = true;
          return;
        }
        throw error;
      }
    };
    
    const restartDevServer = async (providerInstance: any) => {
      if (typeof providerInstance?.restartViteServer === 'function') {
        await providerInstance.restartViteServer();
        return;
      }

      await providerInstance.runCommand('pkill -f vite || true');
      await providerInstance.runCommand('cd /vercel/sandbox && nohup npm run dev > /tmp/vite.log 2>&1 &');
      await sendProgress({ type: 'status', message: 'Waiting for development server to become ready...' });

      const waitResult = await providerInstance.runCommand(
        'sh -c "for i in $(seq 1 60); do code5173=$(curl -s -o /dev/null -w \\"%{http_code}\\" http://localhost:5173 || true); code3000=$(curl -s -o /dev/null -w \\"%{http_code}\\" http://localhost:3000 || true); if [ \\"$code5173\\" = \\"200\\" ] || [ \\"$code5173\\" = \\"304\\" ] || [ \\"$code3000\\" = \\"200\\" ] || [ \\"$code3000\\" = \\"304\\" ]; then exit 0; fi; sleep 1; done; exit 1"'
      );

      if (waitResult?.exitCode !== 0) {
        throw new Error('Vite did not become ready in time after restart');
      }

      // Warm Vite cache so first browser render avoids module timeout spikes.
      await providerInstance.runCommand('sh -c "curl -s http://localhost:5173 > /tmp/vite-prewarm.html || true; curl -s http://localhost:5173/src/main.jsx > /tmp/vite-prewarm-main.js || true; curl -s http://localhost:3000 > /tmp/vite-prewarm-3000.html || true"');
    };

    // Start installation in background
    (async (providerInstance) => {
      let heartbeat: NodeJS.Timeout | null = null;
      try {
        // Keep SSE alive during long installs to avoid upstream body timeout.
        heartbeat = setInterval(async () => {
          try {
            await sendProgress({ type: 'heartbeat' });
          } catch {
            // Ignore write errors; main flow handles connection closure.
          }
        }, 15000);

        await sendProgress({ 
          type: 'start', 
          message: `Installing ${validPackages.length} package${validPackages.length > 1 ? 's' : ''}...`,
          packages: validPackages 
        });
        
        // Check which packages are already installed
        await sendProgress({ 
          type: 'status', 
          message: 'Checking installed packages...' 
        });
        
        let packagesToInstall = validPackages;
        
        try {
          // Read package.json to check existing dependencies
          let packageJsonContent = '';
          try {
            packageJsonContent = await providerInstance.readFile('package.json');
          } catch (error) {
            console.log('[install-packages] Error reading package.json:', error);
          }
          if (packageJsonContent) {
            const packageJson = JSON.parse(packageJsonContent);
            
            const dependencies = packageJson.dependencies || {};
            const devDependencies = packageJson.devDependencies || {};
            const allDeps = { ...dependencies, ...devDependencies };
            
            const alreadyInstalled = [];
            const needInstall = [];
            
            for (const pkg of validPackages) {
              // Handle scoped packages
              const pkgName = pkg.startsWith('@') ? pkg : pkg.split('@')[0];
              
              if (allDeps[pkgName]) {
                alreadyInstalled.push(pkgName);
              } else {
                needInstall.push(pkg);
              }
            }
            
            packagesToInstall = needInstall;
            
            if (alreadyInstalled.length > 0) {
              await sendProgress({ 
                type: 'info', 
                message: `Already installed: ${alreadyInstalled.join(', ')}` 
              });
            }
          }
        } catch (error) {
          console.error('[install-packages] Error checking existing packages:', error);
          // If we can't check, just try to install all packages
          packagesToInstall = validPackages;
        }
        
        if (packagesToInstall.length === 0) {
          await sendProgress({ 
            type: 'success', 
            message: 'All packages are already installed',
            installedPackages: [],
            alreadyInstalled: validPackages
          });

          await sendProgress({ 
            type: 'complete', 
            message: 'No install needed; keeping current dev server session.',
            installedPackages: []
          });
          
          return;
        }
        
        // Install only packages that aren't already installed
        await sendProgress({ 
          type: 'info', 
          message: `Installing ${packagesToInstall.length} new package(s): ${packagesToInstall.join(', ')}`
        });

        // Stop any existing development server only when we actually need to install packages.
        await sendProgress({ type: 'status', message: 'Stopping development server...' });
        try {
          await providerInstance.runCommand('pkill -f vite');
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (killError) {
          console.debug('[install-packages] No existing dev server found:', killError);
        }
        
        // Install packages using provider method
        const installResult = await providerInstance.installPackages(packagesToInstall);
        
        // Get install output - ensure stdout/stderr are strings
        const stdout = String(installResult.stdout || '');
        const stderr = String(installResult.stderr || '');
        
        if (stdout) {
          const lines = stdout.split('\n').filter(line => line.trim());
          for (const line of lines) {
            if (line.includes('npm WARN')) {
              await sendProgress({ type: 'warning', message: line });
            } else if (line.trim()) {
              await sendProgress({ type: 'output', message: line });
            }
          }
        }
        
        if (stderr) {
          const errorLines = stderr.split('\n').filter(line => line.trim());
          for (const line of errorLines) {
            if (line.includes('ERESOLVE')) {
              await sendProgress({ 
                type: 'warning', 
                message: `Dependency conflict resolved with --legacy-peer-deps: ${line}` 
              });
            } else if (line.trim()) {
              await sendProgress({ type: 'error', message: line });
            }
          }
        }
        
        if (installResult.exitCode === 0) {
          await sendProgress({ 
            type: 'success', 
            message: `Successfully installed: ${packagesToInstall.join(', ')}`,
            installedPackages: packagesToInstall
          });
        } else {
          await sendProgress({ 
            type: 'error', 
            message: 'Package installation failed' 
          });
        }
        
        // Restart development server
        await sendProgress({ type: 'status', message: 'Restarting development server...' });
        
        try {
          await restartDevServer(providerInstance);
          
          // Wait a bit for the server to start
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          await sendProgress({ 
            type: 'complete', 
            message: 'Package installation complete and dev server restarted!',
            installedPackages: packagesToInstall
          });
        } catch (error) {
          await sendProgress({ 
            type: 'error', 
            message: `Failed to restart dev server: ${(error as Error).message}` 
          });
        }
        
      } catch (error) {
        const errorMessage = (error as Error).message;
        if (errorMessage && errorMessage !== 'undefined') {
          await sendProgress({ 
            type: 'error', 
            message: errorMessage
          });
        }
      } finally {
        if (heartbeat) clearInterval(heartbeat);
        if (!streamClosed) {
          try {
            await writer.close();
          } catch (error: any) {
            if (!(error?.code === 'ERR_INVALID_STATE' || String(error?.message || '').includes('WritableStream is closed'))) {
              console.warn('[install-packages] writer.close warning:', error);
            }
          }
        }
      }
    })(provider);
    
    // Return the stream
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
    
  } catch (error) {
    console.error('[install-packages] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}
