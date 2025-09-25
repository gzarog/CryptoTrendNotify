import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';

function getNpmCommand() {
  const npmExecPath = process.env.npm_execpath;

  if (npmExecPath) {
    return {
      command: process.execPath,
      args: [npmExecPath, 'run'],
      useShell: false,
    };
  }

  return {
    command: isWindows ? 'npm.cmd' : 'npm',
    args: ['run'],
    // Windows can throw EINVAL when spawning npm without a shell, so allow it.
    useShell: isWindows,
  };
}

const npmCmd = getNpmCommand();

const processes = [];
let exiting = false;
let activeProcesses = 0;

function run(args) {
  const child = spawn(npmCmd.command, [...npmCmd.args, ...args], {
    stdio: 'inherit',
    shell: npmCmd.useShell,
    env: process.env,
  });

  activeProcesses += 1;

  child.on('exit', (code, signal) => {
    activeProcesses -= 1;

    if (!exiting) {
      exiting = true;

      for (const proc of processes) {
        if (proc !== child && proc.exitCode === null) {
          proc.kill(signal ?? 'SIGTERM');
        }
      }

      if (code !== 0) {
        process.exitCode = code ?? 1;
      }
    } else if (code !== 0 && (process.exitCode === undefined || process.exitCode === 0)) {
      process.exitCode = code ?? 1;
    }

    if (exiting && activeProcesses === 0) {
      process.exit(process.exitCode ?? 0);
    }
  });

  processes.push(child);
  return child;
}

function shutdown(signal) {
  if (exiting) {
    return;
  }
  exiting = true;
  for (const proc of processes) {
    if (proc.exitCode === null) {
      proc.kill(signal);
    }
  }

  if (activeProcesses === 0) {
    process.exit(process.exitCode ?? 0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

run(['push:server']);
run(['dev']);
