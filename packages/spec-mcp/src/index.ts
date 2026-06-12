// MCP Server for Spec Platform
// AI coding agents query spec genomes at build time.
// Claude Code / Cursor / Copilot / Hermes all speak MCP.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { z } from 'zod';
import type { SpecGenome } from '@spec/engine';

// --- Tools ---

const SPECS_DIR = resolve(process.env.SPECS_DIR || join(process.cwd(), 'specs'));

function listProjects(): string[] {
  if (!existsSync(SPECS_DIR)) return [];
  return readdirSync(SPECS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

function listSpecs(project: string): string[] {
  const dir = join(SPECS_DIR, project, 'specs');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => f);
}

function getSpec(project: string, file: string): string | null {
  // Search locations: project/specs/file, specs/project/file, root/file
  const paths = [
    join(SPECS_DIR, project, 'specs', file),
    join(SPECS_DIR, project, file),
    join(process.cwd(), 'specs', project, file),
    join(process.cwd(), file),
  ];
  for (const p of paths) {
    if (existsSync(p)) return readFileSync(p, 'utf-8');
  }
  return null;
}

function searchSpecs(project: string, query: string): Array<{ file: string; line: number; content: string }> {
  const results: Array<{ file: string; line: number; content: string }> = [];
  const files = listSpecs(project);
  const lower = query.toLowerCase();
  for (const file of files) {
    const content = getSpec(project, file);
    if (!content) continue;
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (line.toLowerCase().includes(lower)) {
        results.push({ file, line: i + 1, content: line.trim() });
      }
    });
  }
  return results.slice(0, 20); // max 20 results
}

function getPRD(project: string): string | null {
  return getSpec(project, 'SPEC.md');
}

function getDataModel(project: string): string | null {
  return getSpec(project, 'data-model.md');
}

function getCopy(project: string): string | null {
  return getSpec(project, 'COPY.md');
}

function getDesignSystem(project: string): string | null {
  return getSpec(project, 'DESIGN-SYSTEM.md');
}

function getConstitution(project: string): string | null {
  return getSpec(project, 'constitution.md');
}

// --- Server ---

const server = new McpServer({
  name: 'spec-platform',
  version: '0.1.0',
});

server.tool(
  'listProjects',
  'List all available projects in the spec platform',
  {},
  async () => {
    const projects = listProjects();
    return {
      content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }],
    };
  }
);

server.tool(
  'listSpecs',
  'List all spec files in a project',
  { project: z.string().describe('Project name') },
  async ({ project }) => {
    const files = listSpecs(project);
    return {
      content: [{ type: 'text', text: JSON.stringify(files, null, 2) }],
    };
  }
);

server.tool(
  'getSpec',
  'Get the full content of a spec file',
  {
    project: z.string().describe('Project name'),
    file: z.string().describe('Spec file name (e.g. SPEC.md, data-model.md, COPY.md)'),
  },
  async ({ project, file }) => {
    const content = getSpec(project, file);
    if (!content) {
      return {
        content: [{ type: 'text', text: `File not found: ${project}/${file}` }],
      };
    }
    return {
      content: [{ type: 'text', text: content }],
    };
  }
);

server.tool(
  'searchSpecs',
  'Search across all spec files in a project',
  {
    project: z.string().describe('Project name'),
    query: z.string().describe('Search query'),
  },
  async ({ project, query }) => {
    const results = searchSpecs(project, query);
    return {
      content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
    };
  }
);

server.tool(
  'getPRD',
  'Get the product requirements document (SPEC.md) for a project',
  { project: z.string().describe('Project name') },
  async ({ project }) => {
    const content = getPRD(project);
    if (!content) {
      return {
        content: [{ type: 'text', text: `SPEC.md not found for project: ${project}` }],
      };
    }
    return {
      content: [{ type: 'text', text: content }],
    };
  }
);

server.tool(
  'getDataModel',
  'Get the data model spec for a project',
  { project: z.string().describe('Project name') },
  async ({ project }) => {
    const content = getDataModel(project);
    if (!content) {
      return {
        content: [{ type: 'text', text: `data-model.md not found for project: ${project}` }],
      };
    }
    return {
      content: [{ type: 'text', text: content }],
    };
  }
);

server.tool(
  'getCopy',
  'Get every UI string for a project',
  { project: z.string().describe('Project name') },
  async ({ project }) => {
    const content = getCopy(project);
    if (!content) {
      return {
        content: [{ type: 'text', text: `COPY.md not found for project: ${project}` }],
      };
    }
    return {
      content: [{ type: 'text', text: content }],
    };
  }
);

server.tool(
  'getDesignSystem',
  'Get the design system spec for a project',
  { project: z.string().describe('Project name') },
  async ({ project }) => {
    const content = getDesignSystem(project);
    if (!content) {
      return {
        content: [{ type: 'text', text: `DESIGN-SYSTEM.md not found for project: ${project}` }],
      };
    }
    return {
      content: [{ type: 'text', text: content }],
    };
  }
);

server.tool(
  'getConstitution',
  'Get the immutable rules for a project',
  { project: z.string().describe('Project name') },
  async ({ project }) => {
    const content = getConstitution(project);
    if (!content) {
      return {
        content: [{ type: 'text', text: `constitution.md not found for project: ${project}` }],
      };
    }
    return {
      content: [{ type: 'text', text: content }],
    };
  }
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Spec MCP Server running on stdio');
  console.error(`Specs directory: ${SPECS_DIR}`);
  console.error(`Projects: ${listProjects().join(', ') || 'none'}`);
}

main().catch(console.error);
