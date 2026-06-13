"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs_1 = require("fs");
const REQUIRED = ['SPEC.dog', 'constitution.dog', 'data-model.dog'];
const OPTIONAL = ['COPY.dog', 'plan.dog', 'DESIGN-SYSTEM.dog', 'INDEX.dog'];
function activate(context) {
    const collection = vscode.languages.createDiagnosticCollection('dotdog');
    function validateDoc(doc) {
        if (doc.languageId !== 'dotdog')
            return;
        const dir = path.dirname(doc.uri.fsPath);
        const diagnostics = [];
        // Check for .dog files in the project directory
        let existingFiles = [];
        try {
            existingFiles = (0, fs_1.readdirSync)(dir).filter(f => f.endsWith('.dog'));
        }
        catch { }
        // Check required files
        for (const req of REQUIRED) {
            if (!existingFiles.includes(req)) {
                const range = new vscode.Range(0, 0, 0, 0);
                const msg = `Missing required file: ${req}`;
                diagnostics.push(new vscode.Diagnostic(range, msg, vscode.DiagnosticSeverity.Error));
            }
        }
        // Check optional files
        for (const opt of OPTIONAL) {
            if (!existingFiles.includes(opt)) {
                const range = new vscode.Range(0, 0, 0, 0);
                const msg = `Missing optional file: ${opt}`;
                diagnostics.push(new vscode.Diagnostic(range, msg, vscode.DiagnosticSeverity.Warning));
            }
        }
        // Quick entity scan in current file
        const text = doc.getText();
        const entityMatches = text.match(/^### Entity:\s*(.+)/gm);
        const relMatches = text.match(/^### Relationship:\s*(.+)/gm);
        const entities = entityMatches ? entityMatches.map(m => m.replace(/^### Entity:\s*/, '')) : [];
        const rels = relMatches || [];
        // Check entities have YAML blocks
        for (let i = 0; i < doc.lineCount; i++) {
            const line = doc.lineAt(i).text;
            const em = line.match(/^### Entity:\s*(.+)/);
            if (em) {
                // Look for YAML block in following lines
                let hasYaml = false;
                for (let j = i + 1; j < Math.min(i + 20, doc.lineCount); j++) {
                    if (doc.lineAt(j).text.startsWith('```')) {
                        hasYaml = true;
                        break;
                    }
                    if (doc.lineAt(j).text.match(/^###\s/))
                        break;
                }
                if (!hasYaml) {
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(i, 0, i, line.length), `Entity "${em[1]}" has no YAML block`, vscode.DiagnosticSeverity.Warning));
                }
            }
        }
        // Score
        const missing = REQUIRED.filter(r => !existingFiles.includes(r));
        const score = 100 - Math.round((missing.length * 3 + OPTIONAL.filter(o => !existingFiles.includes(o)).length) / 20 * 100);
        // Score message (info)
        if (existingFiles.length > 0) {
            const range = new vscode.Range(0, 0, 0, 0);
            diagnostics.push(new vscode.Diagnostic(range, `${existingFiles.length} .dog files, ${score}% complete | ${entities.length} entities, ${rels.length} relationships`, score === 100 ? vscode.DiagnosticSeverity.Information : vscode.DiagnosticSeverity.Warning));
        }
        collection.set(doc.uri, diagnostics);
    }
    // Validate on open and save
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(validateDoc), vscode.workspace.onDidSaveTextDocument(validateDoc), vscode.window.onDidChangeActiveTextEditor(e => { if (e)
        validateDoc(e.document); }), collection);
    // Validate already open files
    vscode.workspace.textDocuments.forEach(validateDoc);
}
function deactivate() { }
