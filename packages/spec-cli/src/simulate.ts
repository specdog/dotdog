// spec simulate — run a simulation scenario

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

export async function simulate(scenario: string, project: string): Promise<void> {
  console.log(chalk.bold(`\nSimulation: ${scenario} (project: ${project})\n`));
  console.log(chalk.gray('Simulation engine coming in 0.2.0.'));
  console.log(chalk.gray('Reads SPEC.md scenarios, walks through steps, checks pre/postconditions.'));
}
