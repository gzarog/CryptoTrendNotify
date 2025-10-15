#!/usr/bin/env node
import { spawn } from 'node:child_process';

function getComposeInvocation() {
  const override = process.env.DOCKER_COMPOSE?.trim();

  if (override && override.length > 0) {
    const [command, ...args] = override.split(/\s+/);
    return { command, args };
  }

  return { command: 'docker', args: ['compose'] };
}

function getComposeFileArgs() {
  const value = process.env.COMPOSE_FILE ?? 'docker-compose.yml';
  return value
    .split(process.platform === 'win32' ? ';' : ':')
    .map((file) => file.trim())
    .filter(Boolean)
    .flatMap((file) => ['-f', file]);
}

function getProjectArgs() {
  const projectName = process.env.COMPOSE_PROJECT_NAME?.trim();
  return projectName && projectName.length > 0 ? ['-p', projectName] : [];
}

function runComposeStep(description, command, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n▶ ${description}`);

    const child = spawn(command, args, { stdio: 'inherit' });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command exited with code ${code}`));
      }
    });
  });
}

async function main() {
  const compose = getComposeInvocation();
  const composeFileArgs = getComposeFileArgs();
  const projectArgs = getProjectArgs();
  const sharedArgs = [...compose.args, ...projectArgs, ...composeFileArgs];
  const forwardedArgs = process.argv.slice(2);

  try {
    await runComposeStep('Stopping running containers', compose.command, [
      ...sharedArgs,
      'down',
      '--remove-orphans',
    ]);

    await runComposeStep('Rebuilding images and starting services', compose.command, [
      ...sharedArgs,
      'up',
      '--build',
      '--detach',
      ...forwardedArgs,
    ]);

    await runComposeStep('Container status', compose.command, [
      ...sharedArgs,
      'ps',
    ]);
  } catch (error) {
    console.error('\n✖ Failed to refresh containers.');
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

await main();
