import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

const processes = [];
let exiting = false;
let activeProcesses = 0;

function run(args) {
  const child = spawn(npmCmd, ['run', ...args], {
    stdio: 'inherit',
    shell: false,
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
