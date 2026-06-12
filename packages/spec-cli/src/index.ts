#!/usr/bin/env node
// Spec CLI — validate specs, init projects, run simulations

import { Command } from 'commander';
import { validate } from './validate';
import { simulate } from './simulate';
import { init } from './init';
import { list } from './list';
import { analyze } from './analyze';

import { parseCommand } from './parse';

const program = new Command();

program
  .name('spec')
  .description('Spec platform CLI — manage spec genomes')
  .version('0.1.0');

program
  .command('validate [dir]')
  .description('Validate specs in a directory')
  .action((dir = '.') => validate(dir));

program
  .command('analyze [dir]')
  .description('Analyze a spec project — what is it, what is missing, what to do next')
  .option('-p, --project <name>', 'Project name (if multiple)')
  .action((dir = '.', opts) => analyze(dir, opts.project));

program
  .command('simulate <scenario>')
  .description('Run a simulation scenario')
  .option('-p, --project <name>', 'Project name', 'default')
  .action((scenario, opts) => simulate(scenario, opts.project));

program
  .command('parse <file>')
  .description('Parse a .dog file and output the AST')
  .option('--json', 'Output full JSON AST')
  .option('--summary', 'Output summary only')
  .action((file, opts) => parseCommand(file, opts));

program
  .command('init <project>')
  .description('Initialize a new spec genome project')
  .action((project) => init(project));

program
  .command('list')
  .description('List all projects')
  .action(() => list());

program.parse();
