use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, bail};
use clap::{Parser, Subcommand};
use serde_json::{Value, json};

use crate::dag::{self, audit_file, compile_projects, find_dag_files, visualize_file};
use crate::graph::{PathDirection, shortest_graph_path};
use crate::index::{SearchIndex, build_index, search_index};
use crate::mcp;
use crate::parser::parse;
use crate::project::discover_projects;
use crate::repo;
use crate::workspace;

#[derive(Debug, Parser)]
#[command(
    name = "spec",
    bin_name = "dotdog",
    disable_version_flag = true,
    arg_required_else_help = true,
    about = "CLI for structured software specs : validate .dog, compile .dag, query via MCP"
)]
struct Cli {
    #[arg(short = 'V', long, action = clap::ArgAction::SetTrue)]
    version: bool,
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Check required spec files and report completeness.
    Validate {
        #[arg(default_value = ".")]
        dir: PathBuf,
    },
    /// Create a new human-written specification project.
    Init {
        project: String,
        #[arg(short, long)]
        minimal: bool,
    },
    /// List specification projects found in projects/ and specs/.
    List {
        #[arg(long)]
        json: bool,
    },
    /// Parse one source file and report its sections.
    Parse { file: PathBuf },
    /// Check compiled graphs for required node kinds.
    Audit {
        #[arg(required = true)]
        files: Vec<PathBuf>,
        #[arg(long = "require-kind", num_args = 1..)]
        require_kinds: Vec<String>,
        #[arg(long)]
        json: bool,
    },
    /// Compile human-readable specifications into queryable graphs.
    Compile {
        #[arg(default_value = ".")]
        dir: PathBuf,
        #[arg(short, long)]
        output: Option<PathBuf>,
        #[arg(long)]
        v2: bool,
    },
    /// Compare source and compiled graph sizes.
    Tokens {
        #[arg(default_value = ".")]
        dir: PathBuf,
    },
    /// Render a Mermaid diagram or interactive offline HTML node map.
    Visualize {
        #[arg(default_value = ".")]
        dir: PathBuf,
        #[arg(short, long)]
        save: bool,
        #[arg(long, value_enum, default_value_t = VisualFormat::Mermaid)]
        format: VisualFormat,
        #[arg(short, long)]
        output: Option<PathBuf>,
    },
    /// Expose compiled graphs to AI coding agents over MCP stdio.
    Serve {
        #[arg(default_value = ".")]
        dir: PathBuf,
    },
    /// Find missing data-model decisions and relationships.
    Design {
        #[arg(default_value = ".")]
        dir: PathBuf,
        #[arg(short, long)]
        project: Option<String>,
        #[arg(long)]
        json: bool,
        #[arg(long)]
        strict: bool,
    },
    /// Report specification gaps and incomplete entities.
    Analyze {
        #[arg(default_value = ".")]
        dir: PathBuf,
        #[arg(short, long)]
        project: Option<String>,
        #[arg(long)]
        issues: bool,
    },
    /// Generate safe starter files that are missing from a project.
    Generate {
        #[arg(default_value = ".")]
        dir: PathBuf,
        #[arg(short, long)]
        project: Option<String>,
    },
    /// Walk through a named user scenario from the specification.
    Simulate {
        scenario: String,
        #[arg(short, long)]
        project: Option<String>,
    },
    /// Report source specifications newer than their compiled graphs.
    Staleness {
        #[arg(default_value = ".")]
        dir: PathBuf,
    },
    /// Check references between specification intent and code.
    Verify {
        #[arg(default_value = ".")]
        dir: PathBuf,
        #[arg(short, long)]
        init: bool,
    },
    /// Build a local search index for compiled specifications.
    Index {
        #[arg(default_value = ".")]
        dir: PathBuf,
    },
    /// Search indexed specification entities without an external service.
    Search {
        query: String,
        #[arg(short, long)]
        project: Option<String>,
    },
    /// List predictions and their current resolution status.
    Predictions {
        #[arg(default_value = ".")]
        dir: PathBuf,
        #[arg(short, long)]
        project: Option<String>,
    },
    /// Resolve one prediction with a status and evidence.
    Resolve {
        name: String,
        #[arg(short, long)]
        project: Option<String>,
        #[arg(long)]
        correct: bool,
        #[arg(long)]
        wrong: bool,
        #[arg(long)]
        partial: bool,
    },
    /// List or install bundled specification starter kits.
    Kit {
        #[command(subcommand)]
        command: KitCommand,
    },
    /// Generate a token-savings badge for the repository.
    Badge {
        #[arg(default_value = ".")]
        dir: PathBuf,
    },
    /// Run baseline project and compiled-graph health checks.
    Doctor {
        #[arg(long)]
        json: bool,
    },
    /// Rename a Markdown specification to the source format.
    Convert { file: PathBuf },
    /// Compare GitHub issues with modeled project coverage.
    Issues {
        repo: Option<String>,
        #[arg(long)]
        json: bool,
    },
    /// Import GitHub Spec Kit feature artifacts into Dotdog graphs.
    Speckit {
        #[command(subcommand)]
        command: SpecKitCommand,
    },
    /// Test modeled live endpoints and infrastructure resources.
    Live {
        entity: Option<String>,
        #[arg(long)]
        exit_code: bool,
        #[arg(long, default_value_t = 10)]
        timeout: u64,
        #[arg(long = "type", default_value = "all")]
        check_type: String,
    },
    /// Observe an existing repository and generate a code graph.
    Map {
        #[arg(default_value = ".")]
        dir: PathBuf,
        #[arg(short, long)]
        project: Option<String>,
        #[arg(long)]
        json: bool,
    },
    /// Find matching nodes in a compiled graph.
    Query {
        term: String,
        #[arg(long, default_value = ".doghouse/compiled/repo.dag")]
        dag: PathBuf,
        #[arg(short, long, default_value_t = 10)]
        limit: usize,
    },
    /// Show the connections immediately around one repository node.
    Trace {
        node: String,
        #[arg(long, default_value = ".doghouse/compiled/repo.dag")]
        dag: PathBuf,
        #[arg(short, long, default_value_t = 2)]
        depth: usize,
    },
    /// Find a bounded shortest connection between two graph nodes.
    Path {
        from: String,
        to: String,
        #[arg(long, default_value = ".doghouse/compiled/repo.dag")]
        dag: PathBuf,
        #[arg(long, default_value = "any")]
        direction: PathDirection,
        #[arg(long)]
        verb: Option<String>,
        #[arg(short = 'm', long, default_value_t = 8)]
        max_hops: usize,
        #[arg(long)]
        json: bool,
    },
    /// Observe every selected repository in a product workspace.
    Observe {
        #[arg(long)]
        json: bool,
        #[arg(long)]
        repo: Option<String>,
        #[arg(long)]
        group: Option<String>,
    },
    /// Ask a deterministic question against observed repository facts.
    Ask {
        question: String,
        #[arg(long, default_value = ".doghouse/facts.jsonl")]
        facts: PathBuf,
        #[arg(short, long, default_value_t = 10)]
        limit: usize,
        #[arg(long)]
        json: bool,
    },
    /// Check whether observed repository facts still match the filesystem.
    Drift {
        #[arg(long, default_value = ".doghouse/facts.jsonl")]
        facts: PathBuf,
        #[arg(long)]
        json: bool,
    },
    /// Configure and inspect a product spanning one or more repositories.
    Workspace {
        #[command(subcommand)]
        command: WorkspaceCommand,
    },
    /// Print an exact workflow for your project starting point.
    Guide {
        #[arg(value_enum)]
        workflow: Option<GuideWorkflow>,
    },
    /// Print the Dotdog mascot.
    Woof,
}

#[derive(Debug, Clone, clap::ValueEnum)]
enum GuideWorkflow {
    Greenfield,
    Existing,
    Speckit,
}

#[derive(Debug, Clone, Copy, clap::ValueEnum)]
enum VisualFormat {
    Mermaid,
    Html,
}

#[derive(Debug, Subcommand)]
enum WorkspaceCommand {
    /// Create .doghouse/workspace.json.
    Init {
        #[arg(long)]
        id: Option<String>,
        #[arg(long)]
        name: Option<String>,
        #[arg(long)]
        force: bool,
    },
    /// Add a repository to the product workspace.
    Add {
        repo_path: PathBuf,
        #[arg(long)]
        alias: Option<String>,
        #[arg(long, default_value = "unknown")]
        role: String,
        #[arg(long)]
        remote: Option<String>,
        #[arg(long)]
        default_branch: Option<String>,
    },
    /// List workspace repositories with portable paths.
    List {
        #[arg(long)]
        json: bool,
    },
    /// Check aliases, paths, groups, and explicit edges.
    Validate {
        #[arg(long)]
        json: bool,
    },
    /// Emit a deterministic graph of repositories and groups.
    Graph {
        #[arg(long, default_value_t = true)]
        json: bool,
    },
}

#[derive(Debug, Subcommand)]
enum KitCommand {
    /// List bundled starter kits.
    List,
    /// Initialize a project from a bundled starter kit.
    Init {
        kit: String,
        #[arg(short, long)]
        project: Option<String>,
    },
}

#[derive(Debug, Subcommand)]
enum SpecKitCommand {
    /// Import specs/<feature> Markdown artifacts into managed graph projects.
    Import {
        #[arg(default_value = ".")]
        dir: PathBuf,
        #[arg(short, long)]
        output: Option<PathBuf>,
        #[arg(long)]
        force: bool,
        #[arg(long)]
        json: bool,
    },
}

pub fn run() -> i32 {
    match execute(Cli::parse()) {
        Ok(code) => code,
        Err(error) => {
            eprintln!("{error:#}");
            1
        }
    }
}

fn execute(cli: Cli) -> Result<i32> {
    if cli.version {
        println!("{}", env!("CARGO_PKG_VERSION"));
        return Ok(0);
    }
    let cwd = std::env::current_dir()?;
    match cli.command.context("missing command")? {
        Command::Validate { dir } => validate(&absolute(&cwd, &dir)),
        Command::Init { project, minimal } => init(&cwd, &project, minimal),
        Command::List { json } => list(&cwd, json),
        Command::Parse { file } => parse_file(&absolute(&cwd, &file)),
        Command::Audit {
            files,
            require_kinds,
            json,
        } => audit(&cwd, &files, &require_kinds, json),
        Command::Compile { dir, output, v2 } => {
            compile(&absolute(&cwd, &dir), output.as_deref(), v2)
        }
        Command::Tokens { dir } => tokens(&absolute(&cwd, &dir)),
        Command::Visualize {
            dir,
            save,
            format,
            output,
        } => visualize(&absolute(&cwd, &dir), save, format, output.as_deref()),
        Command::Serve { dir } => mcp::serve(&absolute(&cwd, &dir)),
        Command::Design {
            dir,
            project,
            json,
            strict,
        } => design(&absolute(&cwd, &dir), project.as_deref(), json, strict),
        Command::Analyze {
            dir,
            project,
            issues,
        } => analyze(&absolute(&cwd, &dir), project.as_deref(), issues),
        Command::Generate { dir, project } => generate(&absolute(&cwd, &dir), project.as_deref()),
        Command::Simulate { scenario, project } => simulate(&cwd, &scenario, project.as_deref()),
        Command::Staleness { dir } => staleness(&absolute(&cwd, &dir)),
        Command::Verify { dir, init } => verify(&absolute(&cwd, &dir), init),
        Command::Index { dir } => build_search_indexes(&absolute(&cwd, &dir)),
        Command::Search { query, project } => search(&cwd, &query, project.as_deref()),
        Command::Predictions { dir, project } => {
            predictions(&absolute(&cwd, &dir), project.as_deref())
        }
        Command::Resolve {
            name,
            project,
            correct,
            wrong,
            partial,
        } => resolve_prediction(&cwd, &name, project.as_deref(), correct, wrong, partial),
        Command::Kit { command } => kit(&cwd, command),
        Command::Badge { dir } => badge(&absolute(&cwd, &dir)),
        Command::Doctor { json } => doctor(&cwd, json),
        Command::Convert { file } => convert(&absolute(&cwd, &file)),
        Command::Issues { repo, json } => issues(&cwd, repo.as_deref(), json),
        Command::Speckit { command } => speckit_command(&cwd, command),
        Command::Live {
            entity,
            exit_code,
            timeout,
            check_type,
        } => live(&cwd, entity.as_deref(), exit_code, timeout, &check_type),
        Command::Map { dir, project, json } => {
            map_repo(&absolute(&cwd, &dir), project.as_deref(), json)
        }
        Command::Query { term, dag, limit } => query(&absolute(&cwd, &dag), &term, limit),
        Command::Trace { node, dag, depth } => trace(&absolute(&cwd, &dag), &node, depth),
        Command::Path {
            from,
            to,
            dag,
            direction,
            verb,
            max_hops,
            json,
        } => path(
            &absolute(&cwd, &dag),
            &from,
            &to,
            direction,
            verb.as_deref(),
            max_hops,
            json,
        ),
        Command::Observe { json, repo, group } => {
            observe(&cwd, repo.as_deref(), group.as_deref(), json)
        }
        Command::Ask {
            question,
            facts,
            limit,
            json,
        } => ask(&absolute(&cwd, &facts), &question, limit, json),
        Command::Drift { facts, json } => drift(&absolute(&cwd, &facts), json),
        Command::Workspace { command } => workspace_command(&cwd, command),
        Command::Guide { workflow } => guide(workflow),
        Command::Woof => {
            println!("  / \\__");
            println!(" (    @\\___");
            println!("  /       O");
            println!(" /   (_____/");
            println!("/_____/   U");
            Ok(0)
        }
    }
}

fn absolute(cwd: &Path, path: &Path) -> PathBuf {
    if path.is_absolute() {
        path.to_path_buf()
    } else {
        cwd.join(path)
    }
}

fn validate(root: &Path) -> Result<i32> {
    let projects = discover_projects(root)?;
    if projects.is_empty() {
        println!("No projects found. Run: spec init <project>");
        return Ok(0);
    }
    let mut has_errors = false;
    for project in projects {
        let names = project
            .dog_files
            .iter()
            .filter_map(|path| path.file_name().and_then(|name| name.to_str()))
            .collect::<Vec<_>>();
        let missing = ["SPEC.dog", "constitution.dog", "data-model.dog"]
            .into_iter()
            .filter(|name| !names.contains(name))
            .collect::<Vec<_>>();
        let optional = ["COPY.dog", "plan.dog", "DESIGN-SYSTEM.dog", "INDEX.dog"]
            .into_iter()
            .filter(|name| !names.contains(name))
            .collect::<Vec<_>>();
        let completeness = 100usize.saturating_sub(missing.len() * 15);
        println!(
            "\n  {} : {} .dog files, {}% complete",
            project.name,
            names.len(),
            completeness
        );
        for name in &names {
            println!("    {name}");
        }
        if !missing.is_empty() {
            println!("  Missing required: {}", missing.join(", "));
            has_errors = true;
        }
        if !optional.is_empty() {
            println!(
                "  Optional: {} — not required for 100%",
                optional.join(", ")
            );
        }
    }
    Ok(i32::from(has_errors))
}

fn init(root: &Path, project: &str, minimal: bool) -> Result<i32> {
    if project.is_empty()
        || project == "."
        || project == ".."
        || project.contains('/')
        || project.contains('\\')
    {
        bail!("project must be a single non-empty directory name");
    }
    let target = root.join("specs").join(project);
    fs::create_dir_all(&target)?;
    let mut templates = vec![
        ("SPEC.dog", "# Project\n\n## Product\n\n"),
        ("data-model.dog", "# Data Model\n\n## Entities\n\n"),
    ];
    if !minimal {
        templates.splice(
            1..1,
            [("constitution.dog", "# Constitution\n\n1. **Rule.**\n")],
        );
        templates.extend([
            ("plan.dog", "# Plan\n\n## Phase 1\n\n- [ ] Task\n"),
            ("COPY.dog", "# Copy\n\n| Element | Copy |\n|---|---|\n"),
            (
                "INDEX.dog",
                "# INDEX\n\n| You | Start | Then |\n|---|---|---|\n",
            ),
        ]);
    }
    for (name, content) in templates {
        let document = parse(content);
        if !document.errors.is_empty() {
            bail!("template {name} is invalid");
        }
        fs::write(target.join(name), content)?;
        println!("  ✓ {name}");
    }
    println!("\nProject \"{project}\" initialized. Fill in SPEC.dog then run spec validate.");
    Ok(0)
}

fn list(root: &Path, json: bool) -> Result<i32> {
    let projects = discover_projects(root)?;
    if json {
        let names = projects
            .iter()
            .map(|project| project.name.as_str())
            .collect::<Vec<_>>();
        println!("{}", serde_json::to_string(&names)?);
        return Ok(0);
    }
    for root_name in ["projects", "specs", "."] {
        let matches = projects
            .iter()
            .filter(|project| project.root_name == root_name)
            .collect::<Vec<_>>();
        if matches.is_empty() {
            continue;
        }
        println!("\n{root_name}/");
        for project in matches {
            println!(
                "  {} : {} .dog files",
                project.name,
                project.dog_files.len()
            );
        }
    }
    Ok(0)
}

fn parse_file(path: &Path) -> Result<i32> {
    let source =
        fs::read_to_string(path).with_context(|| format!("failed to read {}", path.display()))?;
    let document = parse(&source);
    println!("\n{} sections", document.sections.len());
    for section in document.sections {
        let chars = section
            .blocks
            .iter()
            .map(|block| serde_json::to_string(block).map(|value| value.len()))
            .collect::<std::result::Result<Vec<_>, _>>()?
            .into_iter()
            .sum::<usize>();
        println!("  {:30} {chars} chars", section.heading);
    }
    Ok(i32::from(!document.errors.is_empty()))
}

fn audit(root: &Path, files: &[PathBuf], required_kinds: &[String], json: bool) -> Result<i32> {
    let results = files
        .iter()
        .map(|file| audit_file(&absolute(root, file), required_kinds))
        .collect::<Result<Vec<_>>>()?;
    if json {
        if results.len() == 1 {
            println!("{}", serde_json::to_string_pretty(&results[0])?);
        } else {
            println!("{}", serde_json::to_string_pretty(&results)?);
        }
    } else {
        for result in &results {
            let status = if result.ok { "✓" } else { "✗" };
            println!("{status} {}", result.path);
            println!("  {} nodes, {} edges", result.node_count, result.edge_count);
            if !result.missing_kinds.is_empty() {
                println!("  missing kinds: {}", result.missing_kinds.join(", "));
            }
        }
    }
    Ok(i32::from(results.iter().any(|result| !result.ok)))
}

fn compile(root: &Path, output: Option<&Path>, v2: bool) -> Result<i32> {
    if let Some(result) = repo::compile_layers(root, &repo::safe_project_name(root))? {
        println!("  ✓ {}", result.file);
        println!(
            "    {} nodes, {} edges, {} unknowns",
            result.nodes, result.edges, result.unknowns
        );
        return Ok(0);
    }
    let output = output.map(|path| absolute(root, path));
    let results = compile_projects(root, v2, output.as_deref())?;
    if results.is_empty() {
        println!("No projects found.");
        return Ok(0);
    }
    for result in results {
        println!("  ✓ {}", result.path.display());
        println!(
            "    {} nodes, {} edges, {} files",
            result.node_count, result.edge_count, result.file_count
        );
        let savings = if result.source_tokens == 0 {
            0.0
        } else {
            (1.0 - result.dag_tokens as f64 / result.source_tokens as f64) * 100.0
        };
        println!(
            "    {} → {} tokens ({savings:.1}% savings)",
            result.source_tokens, result.dag_tokens
        );
    }
    Ok(0)
}

fn tokens(root: &Path) -> Result<i32> {
    let projects = discover_projects(root)?;
    let mut found = false;
    for project in projects {
        let dag_path = project.path.join(format!("{}.dag", project.name));
        if !dag_path.is_file() {
            continue;
        }
        found = true;
        let source_bytes = project
            .dog_files
            .iter()
            .map(fs::metadata)
            .collect::<std::result::Result<Vec<_>, _>>()?
            .iter()
            .map(fs::Metadata::len)
            .sum::<u64>();
        let dag_bytes = fs::metadata(&dag_path)?.len();
        let savings = if source_bytes == 0 {
            0.0
        } else {
            (1.0 - dag_bytes as f64 / source_bytes as f64) * 100.0
        };
        println!("\n  {}", project.name);
        println!(
            "    {} .dog files: {} bytes",
            project.dog_files.len(),
            source_bytes
        );
        println!("    .dag on disk: {dag_bytes} bytes ({savings:.1}% savings)");
    }
    if !found {
        println!("No .dag files found. Run compile first.");
    }
    Ok(0)
}

fn visualize(root: &Path, save: bool, format: VisualFormat, output: Option<&Path>) -> Result<i32> {
    let files = if root.extension().and_then(|value| value.to_str()) == Some("dag") {
        vec![root.to_path_buf()]
    } else {
        find_dag_files(root)?
    };
    for (index, file) in files.into_iter().enumerate() {
        let project = file
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("graph");
        let rendered = match format {
            VisualFormat::Mermaid => visualize_file(&file)?,
            VisualFormat::Html => {
                let dag: Value = serde_json::from_slice(&fs::read(&file)?)?;
                crate::visualization::render_html(&dag, project)
            }
        };
        if save {
            if output.is_some() && index > 0 {
                bail!("--output can only be used with one graph");
            }
            let target = output
                .map(Path::to_path_buf)
                .unwrap_or_else(|| match format {
                    VisualFormat::Mermaid => file.with_extension("md"),
                    VisualFormat::Html => file.with_file_name(format!("{project}-graph.html")),
                });
            let name = file
                .file_stem()
                .and_then(|value| value.to_str())
                .unwrap_or("Spec");
            let content = match format {
                VisualFormat::Mermaid => format!("# {name} : Spec Graph\n\n{rendered}"),
                VisualFormat::Html => rendered.clone(),
            };
            fs::write(&target, content)?;
            println!("  ✓ {}", target.display());
        } else {
            println!("{rendered}");
        }
    }
    Ok(0)
}

fn design(
    root: &Path,
    project_filter: Option<&str>,
    json_output: bool,
    strict: bool,
) -> Result<i32> {
    let mut reports = Vec::new();
    for project in discover_projects(root)? {
        if project_filter.is_some_and(|filter| filter != project.name) {
            continue;
        }
        let path = project.path.join(format!("{}.dag", project.name));
        if !path.is_file() {
            continue;
        }
        let dag: Value = serde_json::from_slice(&fs::read(&path)?)?;
        reports.push(crate::design::audit_design(
            &dag,
            &project.name,
            &path.display().to_string(),
        ));
    }
    if json_output {
        println!("{}", serde_json::to_string_pretty(&reports)?);
    } else {
        for report in &reports {
            println!("\n{}", report.project);
            println!(
                "  {} entities, {} relationships",
                report.entities, report.relationships
            );
            println!(
                "  findings: {} high, {} medium, {} low",
                report.summary.high, report.summary.medium, report.summary.low
            );
            for finding in &report.findings {
                println!(
                    "  {:?} {}: {}",
                    finding.severity, finding.code, finding.message
                );
                println!("    Next: {}", finding.next_step);
            }
        }
    }
    let failed = reports
        .iter()
        .any(|report| report.summary.high > 0 || (strict && report.summary.medium > 0));
    Ok(i32::from(failed))
}

fn analyze(root: &Path, project_filter: Option<&str>, _include_issues: bool) -> Result<i32> {
    println!("\nSpec Analysis\n");
    let projects = discover_projects(root)?;
    if projects.is_empty() {
        println!("No spec projects found. Run: dotdog init <project>");
        return Ok(0);
    }
    let mut gaps_found = false;
    for project in projects {
        if project_filter.is_some_and(|filter| filter != project.name) {
            continue;
        }
        let names = project
            .dog_files
            .iter()
            .filter_map(|path| path.file_name().and_then(|name| name.to_str()))
            .collect::<Vec<_>>();
        let missing_required = ["SPEC.dog", "constitution.dog", "data-model.dog"]
            .into_iter()
            .filter(|name| !names.contains(name))
            .collect::<Vec<_>>();
        let missing_optional = ["COPY.dog", "plan.dog", "DESIGN-SYSTEM.dog", "INDEX.dog"]
            .into_iter()
            .filter(|name| !names.contains(name))
            .collect::<Vec<_>>();
        let mut entities = 0usize;
        let mut relationships = 0usize;
        let mut incomplete = Vec::new();
        for file in &project.dog_files {
            for block in parse(&fs::read_to_string(file)?)
                .sections
                .into_iter()
                .flat_map(|section| section.blocks)
            {
                match block {
                    crate::grammar::BlockNode::Entity {
                        name,
                        description,
                        entity_type,
                        properties,
                        states,
                        ..
                    } => {
                        entities += 1;
                        if entity_type == "entity"
                            && (description.len() < 10
                                || properties.is_empty()
                                || states.is_empty())
                        {
                            incomplete.push(name);
                        }
                    }
                    crate::grammar::BlockNode::Relationship { .. } => relationships += 1,
                    _ => {}
                }
            }
        }
        let score = 100usize.saturating_sub(
            missing_required.len() * 15 + missing_optional.len() * 5 + incomplete.len() * 3,
        );
        println!("\n  {}", project.name);
        println!("  {} files | {score}% complete", project.dog_files.len());
        println!("  {entities} entities | {relationships} relationships");
        let mut gaps =
            missing_required
                .iter()
                .map(|name| format!("{name}: Missing required file"))
                .chain(
                    missing_optional
                        .iter()
                        .map(|name| format!("{name}: Optional file not present")),
                )
                .chain(incomplete.iter().map(|name| {
                    format!("{name}: Description, properties, or states are incomplete")
                }))
                .collect::<Vec<_>>();
        gaps.sort();
        if gaps.is_empty() {
            println!("  No gaps found.");
        } else {
            gaps_found = true;
            println!("  Gaps ({})", gaps.len());
            for gap in gaps {
                println!("  - {gap}");
            }
        }
    }
    Ok(i32::from(gaps_found))
}

fn generate(root: &Path, project_filter: Option<&str>) -> Result<i32> {
    println!("\nSpec Generator\n");
    let mut found = false;
    let button = regex::Regex::new(r"\[([^\]]+)\]")?;
    let label = regex::Regex::new(r#""([^"]+)""#)?;
    for project in discover_projects(root)? {
        if project_filter.is_some_and(|filter| filter != project.name) {
            continue;
        }
        found = true;
        let source = fs::read_to_string(project.path.join("SPEC.dog"))?;
        let document = parse(&source);
        let entities = document
            .sections
            .iter()
            .flat_map(|section| section.blocks.iter())
            .filter_map(|block| match block {
                crate::grammar::BlockNode::Entity {
                    name,
                    description,
                    properties,
                    states,
                    ..
                } => Some((name, description, properties, states)),
                _ => None,
            })
            .collect::<Vec<_>>();
        let mut copy = Vec::new();
        for section in &document.sections {
            let heading = section.heading.to_ascii_lowercase();
            if !heading.contains("what the user sees") && !heading.contains("screen") {
                continue;
            }
            let prose = section
                .blocks
                .iter()
                .filter_map(|block| match block {
                    crate::grammar::BlockNode::Prose { content, .. } => Some(content.as_str()),
                    _ => None,
                })
                .collect::<Vec<_>>()
                .join("\n");
            copy.extend(button.captures_iter(&prose).filter_map(|capture| {
                capture.get(1).map(|value| {
                    (
                        section.heading.clone(),
                        "button",
                        format!("[{}]", value.as_str()),
                    )
                })
            }));
            copy.extend(label.captures_iter(&prose).filter_map(|capture| {
                capture
                    .get(1)
                    .map(|value| (section.heading.clone(), "label", value.as_str().to_string()))
            }));
        }
        let index = project.path.join("INDEX.dog");
        if !index.exists() {
            fs::write(
                &index,
                "# INDEX\n\n| You are... | Start here | Then... |\n|---|---|---|\n| Developer | SPEC.dog | data-model.dog → plan.dog |\n| AI agent | data-model.dog | SPEC.dog |\n",
            )?;
            println!("  ✓ INDEX.dog");
        }
        let data_model = project.path.join("data-model.dog");
        if !data_model.exists() && !entities.is_empty() {
            let mut output = String::from("# Data Model\n\n## Core Entities\n\n");
            for (name, description, properties, states) in &entities {
                output.push_str(&format!(
                    "### Entity: {name}\n\n{}\n\n```yaml\nentity: {name}\ntype: entity\n",
                    if description.is_empty() {
                        "No description."
                    } else {
                        description
                    }
                ));
                if !properties.is_empty() {
                    output.push_str("properties:\n");
                    for (key, property) in *properties {
                        output
                            .push_str(&format!("  {key}:\n    type: {}\n", property.property_type));
                        if property.required {
                            output.push_str("    required: true\n");
                        }
                    }
                }
                if !states.is_empty() {
                    output.push_str(&format!("states: [{}]\n", states.join(", ")));
                }
                output.push_str("```\n\n");
            }
            fs::write(&data_model, output)?;
            println!("  ✓ data-model.dog ({} entities)", entities.len());
        }
        let copy_file = project.path.join("COPY.dog");
        if !copy_file.exists() && !copy.is_empty() {
            let mut output =
                String::from("# App Copy\n\n| Screen | Element | Copy |\n|---|---|---|\n");
            for (screen, element, value) in &copy {
                output.push_str(&format!(
                    "| {} | {element} | {} |\n",
                    screen.replace('|', "\\|"),
                    value.replace('|', "\\|")
                ));
            }
            fs::write(&copy_file, output)?;
            println!("  ✓ COPY.dog ({} strings)", copy.len());
        }
    }
    if !found {
        println!("No SPEC.dog found. Create one first.");
    }
    println!("\nRun dotdog validate to verify.\n");
    Ok(0)
}

fn simulate(root: &Path, scenario: &str, project_filter: Option<&str>) -> Result<i32> {
    let Some(project) = discover_projects(root)?
        .into_iter()
        .find(|project| project_filter.is_none_or(|filter| filter == project.name))
    else {
        println!("Project not found.");
        return Ok(1);
    };
    let spec = fs::read_to_string(project.path.join("SPEC.dog"))?;
    let pattern = regex::Regex::new(r"(?m)^\s*\[\d+/\d+\]\s*(.+)$")?;
    let steps = pattern
        .captures_iter(&spec)
        .filter_map(|captures| captures.get(1).map(|value| value.as_str().to_string()))
        .collect::<Vec<_>>();
    println!("\nSimulation: {scenario}");
    println!("Project: {}", project.name);
    if steps.is_empty() {
        println!("\n  No scenario steps found in SPEC.dog.");
        println!("  Add steps like: [1/3] User taps button");
        return Ok(0);
    }
    for (index, step) in steps.iter().enumerate() {
        println!("  [{}/{}] {step}", index + 1, steps.len());
    }
    println!("\n  RESULT: Review complete ({} steps)", steps.len());
    Ok(0)
}

fn staleness(root: &Path) -> Result<i32> {
    println!("Staleness Audit\n");
    for project in discover_projects(root)? {
        let dag = project.path.join(format!("{}.dag", project.name));
        if !dag.is_file() {
            println!("  {}: No compiled DAG", project.name);
            continue;
        }
        let dag_time = fs::metadata(&dag)?.modified()?;
        let stale = project
            .dog_files
            .iter()
            .filter(|file| {
                fs::metadata(file)
                    .and_then(|metadata| metadata.modified())
                    .is_ok_and(|time| time > dag_time)
            })
            .filter_map(|file| file.file_name().and_then(|name| name.to_str()))
            .collect::<Vec<_>>();
        if stale.is_empty() {
            println!("  {}: spec matches reality", project.name);
        } else {
            println!("  {}: stale .dag ({})", project.name, stale.join(", "));
        }
    }
    Ok(0)
}

fn verify(root: &Path, initialize: bool) -> Result<i32> {
    println!(
        "{}\n",
        if initialize {
            "Auto-Generating Verify Section"
        } else {
            "Verification Audit"
        }
    );
    for project in discover_projects(root)? {
        let plan = project.path.join("plan.dog");
        if initialize && !plan.exists() {
            fs::write(
                &plan,
                "# Plan\n\n## Verify\n\n- [ ] Run tests\n- [ ] Run dotdog validate\n- [ ] Run dotdog compile\n",
            )?;
        }
        let dag = project.path.join(format!("{}.dag", project.name));
        println!(
            "  {}: {}",
            project.name,
            if dag.is_file() {
                "compiled graph present"
            } else {
                "run dotdog compile"
            }
        );
    }
    Ok(0)
}

fn build_search_indexes(root: &Path) -> Result<i32> {
    let mut count = 0;
    for project in discover_projects(root)? {
        let index = build_index(&project.path, &project.name)?;
        let path = project.path.join(format!("{}.idx", project.name));
        fs::write(path, serde_json::to_vec(&index)?)?;
        println!(
            "  ✓ {} : {} sections indexed ({} terms)",
            project.name,
            index.entries.len(),
            index.vocabulary.len()
        );
        count += 1;
    }
    if count == 0 {
        println!("No projects found. Run dotdog init first.");
    }
    Ok(0)
}

fn search(root: &Path, query: &str, project_filter: Option<&str>) -> Result<i32> {
    println!("\nSearch: \"{query}\"\n");
    let mut found = false;
    for project in discover_projects(root)? {
        if project_filter.is_some_and(|filter| filter != project.name) {
            continue;
        }
        let path = project.path.join(format!("{}.idx", project.name));
        if !path.is_file() {
            continue;
        }
        found = true;
        let index: SearchIndex = serde_json::from_slice(&fs::read(path)?)?;
        let results = search_index(&index, query, 8);
        if results.is_empty() {
            println!("  {}: No matches", project.name);
            continue;
        }
        println!("  {} — {} results:", project.name, results.len());
        for result in results {
            let preview = result.entry.content.replace('\n', " ");
            println!(
                "    {}%  [{}] {}",
                (result.score * 100.0).round(),
                result.entry.file,
                result.entry.heading
            );
            println!(
                "         {}...",
                preview.chars().take(100).collect::<String>()
            );
        }
    }
    if !found {
        println!("No index found. Run dotdog index first.");
    }
    Ok(0)
}

fn predictions(root: &Path, project_filter: Option<&str>) -> Result<i32> {
    println!("\nPredictions\n");
    for project in discover_projects(root)? {
        if project_filter.is_some_and(|filter| filter != project.name) {
            continue;
        }
        for file in project.dog_files {
            for block in parse(&fs::read_to_string(file)?)
                .sections
                .into_iter()
                .flat_map(|section| section.blocks)
            {
                if let crate::grammar::BlockNode::Prediction {
                    statement,
                    confidence,
                    timeframe,
                    status,
                    ..
                } = block
                {
                    println!(
                        "  {} [{}] {:.0}% {}",
                        statement, status, confidence, timeframe
                    );
                }
            }
        }
    }
    Ok(0)
}

fn resolve_prediction(
    root: &Path,
    name: &str,
    project_filter: Option<&str>,
    correct: bool,
    wrong: bool,
    partial: bool,
) -> Result<i32> {
    let choices = usize::from(correct) + usize::from(wrong) + usize::from(partial);
    if choices != 1 {
        bail!("choose exactly one of --correct, --wrong, or --partial");
    }
    let status = if correct {
        "correct"
    } else if wrong {
        "wrong"
    } else {
        "partial"
    };
    let heading = regex::Regex::new(&format!(
        r"(?ms)(### Prediction:\s*{}\s*.*?```(?:yaml)?\s*\n)(.*?)(\n```)",
        regex::escape(name)
    ))?;
    let status_pattern = regex::Regex::new(r"(?m)^status:\s*\S+\s*$")?;
    for project in discover_projects(root)? {
        if project_filter.is_some_and(|filter| filter != project.name) {
            continue;
        }
        for file in project.dog_files {
            let source = fs::read_to_string(&file)?;
            let Some(captures) = heading.captures(&source) else {
                continue;
            };
            let body = captures
                .get(2)
                .context("prediction block missing body")?
                .as_str();
            let next_body = if status_pattern.is_match(body) {
                status_pattern
                    .replace(body, format!("status: {status}"))
                    .into_owned()
            } else {
                format!("{body}\nstatus: {status}")
            };
            let whole = captures.get(0).context("prediction block missing match")?;
            let replacement = format!(
                "{}{}{}",
                captures
                    .get(1)
                    .context("prediction prefix missing")?
                    .as_str(),
                next_body,
                captures
                    .get(3)
                    .context("prediction suffix missing")?
                    .as_str()
            );
            let mut next = source.clone();
            next.replace_range(whole.start()..whole.end(), &replacement);
            fs::write(&file, next)?;
            println!("Resolved \"{name}\" as {status} in {}", file.display());
            return Ok(0);
        }
    }
    bail!("prediction not found: {name}")
}

fn kit(root: &Path, command: KitCommand) -> Result<i32> {
    const KITS: &[&str] = &["defi", "erc20", "hackathon", "nft", "saas"];
    match command {
        KitCommand::List => {
            for kit in KITS {
                println!("{kit}");
            }
            Ok(0)
        }
        KitCommand::Init { kit, project } => {
            if !KITS.contains(&kit.as_str()) {
                bail!("unknown kit: {kit}");
            }
            let name = project.unwrap_or_else(|| kit.clone());
            let target = root.join("specs").join(&name);
            if target.exists() {
                bail!("Project \"{name}\" already exists.");
            }
            fs::create_dir_all(&target)?;
            fs::write(
                target.join("SPEC.dog"),
                format!("# {name}\n\n## Product\n\nA {kit} project.\n"),
            )?;
            fs::write(
                target.join("constitution.dog"),
                "# Constitution\n\n1. **Specifications precede implementation.**\n",
            )?;
            fs::write(
                target.join("data-model.dog"),
                "# Data Model\n\n## Entities\n\n",
            )?;
            for file in ["SPEC.dog", "constitution.dog", "data-model.dog"] {
                println!("  ✓ {file}");
            }
            println!("\n  Kit \"{kit}\" initialized in specs/{name}/");
            println!("  Run: dotdog validate");
            Ok(0)
        }
    }
}

fn speckit_command(root: &Path, command: SpecKitCommand) -> Result<i32> {
    match command {
        SpecKitCommand::Import {
            dir,
            output,
            force,
            json,
        } => {
            let source = absolute(root, &dir);
            let result = crate::speckit::import(&source, output.as_deref(), force)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&result)?);
            } else {
                println!("{}", crate::speckit::format_result(&result));
            }
            Ok(i32::from(result.features.is_empty()))
        }
    }
}

fn badge(root: &Path) -> Result<i32> {
    let Some(path) = find_dag_files(root)?.into_iter().next() else {
        println!("No projects found. Run dotdog init first.");
        return Ok(0);
    };
    let dag: Value = serde_json::from_slice(&fs::read(path)?)?;
    let tokens = dag
        .get("tk")
        .or_else(|| dag.as_array().and_then(|items| items.get(3)))
        .cloned()
        .unwrap_or_else(|| json!({}));
    let saved = tokens
        .get("saved")
        .and_then(Value::as_i64)
        .unwrap_or_default();
    let savings = tokens.get("sv").and_then(Value::as_f64).unwrap_or_default();
    let value = if saved >= 1000 {
        format!("{:.1}K tokens saved", saved as f64 / 1000.0)
    } else {
        format!("{saved} tokens saved")
    };
    let color = if savings > 90.0 {
        "#4c1"
    } else if savings > 70.0 {
        "#dfb317"
    } else {
        "#e05d44"
    };
    let svg = format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="210" height="20" role="img" aria-label="dotdog: {value}"><title>dotdog: {value}</title><rect width="70" height="20" fill="#555"/><rect x="70" width="140" height="20" fill="{color}"/><g fill="#fff" text-anchor="middle" font-family="Verdana,sans-serif" font-size="11"><text x="35" y="14">dotdog</text><text x="140" y="14">{value}</text></g></svg>"##
    );
    fs::write(root.join("dotdog-badge.svg"), svg)?;
    println!("  ✓ dotdog-badge.svg  (dotdog: {value})");
    Ok(0)
}

fn doctor(root: &Path, json_output: bool) -> Result<i32> {
    let mut results = Vec::new();
    let mut passed = 0usize;
    let mut failed = 0usize;
    for project in discover_projects(root)? {
        let names = project
            .dog_files
            .iter()
            .filter_map(|file| file.file_name().and_then(|name| name.to_str()))
            .collect::<Vec<_>>();
        let missing = ["SPEC.dog", "constitution.dog", "data-model.dog"]
            .into_iter()
            .filter(|name| !names.contains(name))
            .collect::<Vec<_>>();
        let dag = project.path.join(format!("{}.dag", project.name));
        let error = if !missing.is_empty() {
            Some(format!("missing {}", missing.join(", ")))
        } else if !dag.is_file() {
            Some("no .dag — run dotdog compile".into())
        } else if serde_json::from_slice::<Value>(&fs::read(&dag)?).is_err() {
            Some("corrupted .dag — run dotdog compile".into())
        } else {
            None
        };
        if let Some(error) = error {
            failed += 1;
            if !json_output {
                println!("  ✗ {}: {error}", project.name);
            }
            results.push(json!({"project":project.name,"status":"fail","error":error}));
        } else {
            passed += 1;
            if !json_output {
                println!("  ✓ {}", project.name);
            }
            results.push(json!({"project":project.name,"status":"pass"}));
        }
    }
    if json_output {
        println!(
            "{}",
            serde_json::to_string(
                &json!({"passed":passed,"failed":failed,"total":passed+failed,"results":results})
            )?
        );
    } else {
        println!(
            "\n  {} checks: {passed} passed, {failed} failed",
            passed + failed
        );
    }
    Ok(i32::from(failed > 0))
}

fn convert(path: &Path) -> Result<i32> {
    if !path.is_file() {
        bail!("File not found: {}", path.display());
    }
    if path.extension().and_then(|value| value.to_str()) != Some("md") {
        bail!("Only .md files can be converted.");
    }
    let target = path.with_extension("dog");
    if target.exists() {
        bail!("{} already exists.", target.display());
    }
    let mut content = fs::read_to_string(path)?;
    if !regex::Regex::new(r"(?m)^##\s")?.is_match(&content) {
        content = format!("## Product\n\n(Describe your product here)\n{content}");
    }
    fs::write(&target, content)?;
    fs::remove_file(path)?;
    println!(
        "  ✓ {} → {}",
        path.file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default(),
        target
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
    );
    println!("  Run: dotdog validate");
    Ok(0)
}

fn issues(root: &Path, repository: Option<&str>, json_output: bool) -> Result<i32> {
    let repository = repository
        .map(str::to_string)
        .or_else(|| {
            std::process::Command::new("git")
                .args(["config", "--get", "remote.origin.url"])
                .current_dir(root)
                .output()
                .ok()
                .and_then(|output| String::from_utf8(output.stdout).ok())
                .map(|value| {
                    value
                        .trim()
                        .trim_end_matches(".git")
                        .rsplit('/')
                        .take(2)
                        .collect::<Vec<_>>()
                        .into_iter()
                        .rev()
                        .collect::<Vec<_>>()
                        .join("/")
                })
        })
        .filter(|value| value.contains('/'))
        .context("No GitHub remote found.")?;
    let output = std::process::Command::new("gh")
        .args([
            "issue",
            "list",
            "--repo",
            &repository,
            "--state",
            "all",
            "--limit",
            "100",
            "--json",
            "number,title,state,body",
        ])
        .output()
        .context("failed to run gh")?;
    if !output.status.success() {
        bail!(
            "gh issue list failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }
    let gh_issues: Value = serde_json::from_slice(&output.stdout)?;
    let issues = gh_issues.as_array().cloned().unwrap_or_default();
    let mut results = Vec::new();
    for project in discover_projects(root)? {
        let mut entities = std::collections::BTreeSet::new();
        for file in project.dog_files {
            for block in parse(&fs::read_to_string(file)?)
                .sections
                .into_iter()
                .flat_map(|section| section.blocks)
            {
                if let crate::grammar::BlockNode::Entity { name, .. } = block {
                    entities.insert(name.to_ascii_lowercase());
                }
            }
        }
        let uncovered = issues
            .iter()
            .filter(|issue| {
                let text = format!(
                    "{} {}",
                    issue
                        .get("title")
                        .and_then(Value::as_str)
                        .unwrap_or_default(),
                    issue
                        .get("body")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                )
                .to_ascii_lowercase();
                !entities.iter().any(|entity| text.contains(entity))
            })
            .count();
        results.push(json!({
            "project": project.name,
            "entities": entities.len(),
            "issues": issues.len(),
            "uncovered": uncovered,
        }));
    }
    if json_output {
        println!("{}", serde_json::to_string_pretty(&results)?);
    } else {
        for result in results {
            println!(
                "{}: {} entities, {} issues, {} uncovered",
                result["project"].as_str().unwrap_or_default(),
                result["entities"],
                result["issues"],
                result["uncovered"]
            );
        }
    }
    Ok(0)
}

fn live(
    root: &Path,
    entity_filter: Option<&str>,
    use_exit_code: bool,
    timeout: u64,
    check_type: &str,
) -> Result<i32> {
    #[derive(Debug)]
    struct EndpointCheck {
        name: String,
        url: String,
        backup_url: Option<String>,
        method: String,
        expected_status: u16,
        expected_body: Option<Value>,
        timeout: u64,
    }

    fn request(endpoint: &EndpointCheck, url: &str) -> std::result::Result<(), String> {
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(
                endpoint.timeout.clamp(1, 120),
            ))
            .user_agent(concat!("dotdog/", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(|error| error.to_string())?;
        let method = reqwest::Method::from_bytes(endpoint.method.as_bytes())
            .map_err(|_| format!("invalid method: {}", endpoint.method))?;
        let response = client
            .request(method, url)
            .send()
            .map_err(|error| error.to_string())?;
        if response.status().as_u16() != endpoint.expected_status {
            return Err(format!(
                "HTTP {} (expected {})",
                response.status(),
                endpoint.expected_status
            ));
        }
        if let Some(expected) = &endpoint.expected_body {
            let actual = response
                .json::<Value>()
                .map_err(|error| format!("invalid JSON body: {error}"))?;
            if let Some(expected) = expected.as_object() {
                let actual = actual
                    .as_object()
                    .ok_or_else(|| "response body is not an object".to_string())?;
                let missing = expected
                    .keys()
                    .filter(|key| !actual.contains_key(*key))
                    .cloned()
                    .collect::<Vec<_>>();
                if !missing.is_empty() {
                    return Err(format!("missing body keys: {}", missing.join(", ")));
                }
            } else if &actual != expected {
                return Err("response body does not match the contract".into());
            }
        }
        Ok(())
    }

    let check_type = check_type.to_ascii_lowercase();
    if !matches!(check_type.as_str(), "all" | "endpoint" | "infra") {
        bail!("--type must be endpoint, infra, or all");
    }
    let mut endpoints = Vec::<EndpointCheck>::new();
    if matches!(check_type.as_str(), "all" | "endpoint") {
        for project in discover_projects(root)? {
            for file in project.dog_files {
                for block in parse(&fs::read_to_string(file)?)
                    .sections
                    .into_iter()
                    .flat_map(|section| section.blocks)
                {
                    match block {
                        crate::grammar::BlockNode::Endpoint {
                            name,
                            url,
                            backup_url,
                            method,
                            expect_status,
                            expect_body,
                            timeout: contract_timeout,
                            ..
                        } if entity_filter.is_none_or(|filter| filter == name) => {
                            endpoints.push(EndpointCheck {
                                name,
                                url,
                                backup_url,
                                method,
                                expected_status: expect_status,
                                expected_body: expect_body,
                                timeout: timeout.min(contract_timeout).max(1),
                            })
                        }
                        crate::grammar::BlockNode::Entity {
                            name,
                            entity_type,
                            properties,
                            ..
                        } if entity_type == "endpoint"
                            && entity_filter.is_none_or(|filter| filter == name) =>
                        {
                            let url = properties
                                .get("url")
                                .and_then(|property| property.default.as_ref())
                                .and_then(Value::as_str)
                                .unwrap_or_default()
                                .to_string();
                            let status = properties
                                .get("expect_status")
                                .and_then(|property| property.default.as_ref())
                                .and_then(Value::as_u64)
                                .unwrap_or(200) as u16;
                            if !url.is_empty() {
                                let text = |key: &str| {
                                    properties
                                        .get(key)
                                        .and_then(|property| property.default.as_ref())
                                        .and_then(Value::as_str)
                                        .map(str::to_string)
                                };
                                endpoints.push(EndpointCheck {
                                    name,
                                    url,
                                    backup_url: text("backup_url"),
                                    method: text("method").unwrap_or_else(|| "GET".into()),
                                    expected_status: status,
                                    expected_body: properties
                                        .get("expect_body")
                                        .and_then(|property| property.default.clone()),
                                    timeout,
                                });
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
    }
    let mut failed = 0usize;
    let mut unreachable = 0usize;
    let mut degraded = 0usize;
    for endpoint in &endpoints {
        match request(endpoint, &endpoint.url) {
            Ok(()) => println!("  ✓ {}", endpoint.name),
            Err(primary) => {
                if let Some(backup) = &endpoint.backup_url {
                    match request(endpoint, backup) {
                        Ok(()) => {
                            degraded += 1;
                            println!("  ! {}: primary failed; backup passed", endpoint.name);
                        }
                        Err(backup) => {
                            unreachable += 1;
                            println!(
                                "  ✗ {}: primary: {primary}; backup: {backup}",
                                endpoint.name
                            );
                        }
                    }
                } else if primary.starts_with("HTTP ")
                    || primary.starts_with("missing body keys")
                    || primary.starts_with("response body")
                    || primary.starts_with("invalid JSON")
                {
                    failed += 1;
                    println!("  ✗ {}: {primary}", endpoint.name);
                } else {
                    unreachable += 1;
                    println!("  ✗ {}: {primary}", endpoint.name);
                }
            }
        }
    }
    if endpoints.is_empty() && matches!(check_type.as_str(), "all" | "endpoint") {
        println!("No endpoint contracts found.");
    }
    let mut infra_failed = 0usize;
    if matches!(check_type.as_str(), "all" | "infra") {
        let resources = crate::infra::find_resources(root)?
            .into_iter()
            .filter(|resource| entity_filter.is_none_or(|filter| filter == resource.entity))
            .collect::<Vec<_>>();
        let results = crate::infra::verify_all(&resources, timeout);
        if results.is_empty() {
            println!("No infrastructure contracts found.");
        }
        for result in &results {
            let marker = match result.status.as_str() {
                "pass" => "✓",
                "fail" => "✗",
                _ => "!",
            };
            println!(
                "  {marker} {} [{}] {}",
                result.entity, result.provider, result.message
            );
        }
        infra_failed = results
            .iter()
            .filter(|result| result.status == "fail")
            .count();
    }
    if !use_exit_code {
        return Ok(0);
    }
    if failed + infra_failed > 0 {
        Ok(1)
    } else if unreachable > 0 {
        Ok(2)
    } else if degraded > 0 {
        Ok(3)
    } else {
        Ok(0)
    }
}

fn map_repo(root: &Path, project: Option<&str>, json_output: bool) -> Result<i32> {
    let project = project
        .map(str::to_string)
        .unwrap_or_else(|| repo::safe_project_name(root));
    let output_dir = root.join(".doghouse/generated");
    let result = repo::write_repo_map(root, &project, &output_dir)?;
    if json_output {
        println!("{}", serde_json::to_string_pretty(&result)?);
    } else {
        println!("wrote {}", result.dag_file);
        println!("{} facts, {} edges", result.facts, result.edges);
    }
    Ok(0)
}

fn query(path: &Path, term: &str, limit: usize) -> Result<i32> {
    if let Ok(model) = repo::load_world(path) {
        println!(
            "{}",
            repo::format_query(&repo::query_world(&model, term, limit))
        );
    } else {
        let matches = dag::query_file(path, term)?;
        for node in matches.into_iter().take(limit) {
            println!("{}", serde_json::to_string(&node)?);
        }
    }
    Ok(0)
}

fn trace(path: &Path, query: &str, _depth: usize) -> Result<i32> {
    let model = repo::load_world(path)?;
    let needle = query.to_ascii_lowercase();
    let Some(node) = model.nodes.iter().find(|node| {
        node.id.eq_ignore_ascii_case(&needle)
            || node.label.eq_ignore_ascii_case(&needle)
            || node.label.to_ascii_lowercase().contains(&needle)
    }) else {
        println!("No DAG node found.");
        return Ok(1);
    };
    println!("{} [{}/{}]", node.id, node.kind, node.confidence);
    println!("source: {}", node.source);
    let incoming = model.edges.iter().filter(|edge| edge.target_id == node.id);
    let outgoing = model.edges.iter().filter(|edge| edge.source_id == node.id);
    let incoming = incoming.collect::<Vec<_>>();
    let outgoing = outgoing.collect::<Vec<_>>();
    if !incoming.is_empty() {
        println!("Incoming");
        for edge in incoming {
            println!("- {} --{}--> {}", edge.source_id, edge.verb, edge.target_id);
        }
    }
    if !outgoing.is_empty() {
        println!("Outgoing");
        for edge in outgoing {
            println!("- {} --{}--> {}", edge.source_id, edge.verb, edge.target_id);
        }
    }
    Ok(0)
}

fn observe(
    root: &Path,
    repo_filter: Option<&str>,
    group_filter: Option<&str>,
    json_output: bool,
) -> Result<i32> {
    let context = workspace::resolve_workspace(root, false)?;
    let selected = workspace::selected_repos(&context, repo_filter, group_filter)?;
    let doghouse = context.workspace_root.join(".doghouse");
    fs::create_dir_all(&doghouse)?;
    let mut repo_results = Vec::new();
    let mut facts = Vec::<Value>::new();
    for repo_context in selected {
        let result = repo::write_repo_map(
            &repo_context.cwd,
            &repo_context.alias,
            &repo_context.cwd.join(".doghouse/generated"),
        )?;
        let file = repo_context.cwd.join(".doghouse/generated/facts.jsonl");
        if file.is_file() {
            for line in fs::read_to_string(file)?
                .lines()
                .filter(|line| !line.trim().is_empty())
            {
                facts.push(serde_json::from_str(line)?);
            }
        }
        repo_results.push(json!({
            "alias": repo_context.alias,
            "role": repo_context.role,
            "path": workspace::portable_path(&context, &repo_context.cwd),
            "facts": result.observed_facts,
            "scanned": result.scanned,
        }));
    }
    facts.sort_by_key(|fact| {
        fact.get("id")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string()
    });
    let facts_text = facts
        .iter()
        .map(serde_json::to_string)
        .collect::<std::result::Result<Vec<_>, _>>()?
        .join("\n");
    fs::write(doghouse.join("facts.jsonl"), format!("{facts_text}\n"))?;
    fs::write(
        doghouse.join("workspace.dag"),
        format!(
            "{}\n",
            serde_json::to_string_pretty(&workspace::build_workspace_graph(&context))?
        ),
    )?;
    let observed =
        json!({"workspace":context.config.workspace,"repos":repo_results,"factCount":facts.len()});
    fs::write(
        doghouse.join("observed.json"),
        format!("{}\n", serde_json::to_string_pretty(&observed)?),
    )?;
    if json_output {
        println!("{}", serde_json::to_string_pretty(&observed)?);
    } else {
        println!("Observed workspace {}", context.config.workspace.id);
        println!("Repos: {}", repo_results.len());
        println!("Facts written: {}", facts.len());
    }
    Ok(0)
}

fn ask(path: &Path, question: &str, limit: usize, json_output: bool) -> Result<i32> {
    let source = fs::read_to_string(path)
        .with_context(|| format!("failed to read observed facts: {}", path.display()))?;
    let terms = question
        .to_ascii_lowercase()
        .split_whitespace()
        .map(str::to_string)
        .collect::<Vec<_>>();
    let mut matches = source
        .lines()
        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .filter(|fact| {
            let text = format!(
                "{} {} {}",
                fact["subject"].as_str().unwrap_or_default(),
                fact["predicate"].as_str().unwrap_or_default(),
                fact["object"].as_str().unwrap_or_default()
            )
            .to_ascii_lowercase();
            terms.iter().all(|term| text.contains(term))
        })
        .take(limit)
        .collect::<Vec<_>>();
    matches.sort_by_key(|fact| fact["id"].as_str().unwrap_or_default().to_string());
    if json_output {
        println!(
            "{}",
            serde_json::to_string_pretty(&json!({"question":question,"facts":matches}))?
        );
    } else {
        println!("Question: {question}");
        for fact in matches {
            println!(
                "- {} {} {}",
                fact["subject"].as_str().unwrap_or_default(),
                fact["predicate"].as_str().unwrap_or_default(),
                fact["object"].as_str().unwrap_or_default()
            );
        }
    }
    Ok(0)
}

fn drift(path: &Path, json_output: bool) -> Result<i32> {
    let source = fs::read_to_string(path)
        .with_context(|| format!("failed to read observed facts: {}", path.display()))?;
    let facts = source
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(serde_json::from_str::<Value>)
        .collect::<std::result::Result<Vec<_>, _>>()?;
    let workspace_root = path
        .parent()
        .and_then(Path::parent)
        .context("facts file must be inside .doghouse")?;
    let context = workspace::resolve_workspace(workspace_root, false)?;
    let mut changes = Vec::new();
    for fact in &facts {
        let Some(file) = fact.get("file").and_then(Value::as_str) else {
            continue;
        };
        if file.is_empty() || file == "." {
            continue;
        }
        let repo_alias = fact.get("repo").and_then(Value::as_str).unwrap_or_default();
        let Some(repo) = context
            .repos
            .iter()
            .find(|repo| repo.alias == repo_alias)
            .or_else(|| context.repos.first())
        else {
            continue;
        };
        let relative = Path::new(file);
        let unsafe_path = relative.is_absolute()
            || relative.components().any(|component| {
                matches!(
                    component,
                    std::path::Component::ParentDir
                        | std::path::Component::RootDir
                        | std::path::Component::Prefix(_)
                )
            });
        if unsafe_path || !repo.cwd.join(relative).is_file() {
            changes.push(json!({
                "id": fact.get("id").cloned().unwrap_or(Value::Null),
                "repo": repo_alias,
                "file": file,
                "reason": if unsafe_path { "unsafe observed path" } else { "file no longer exists" },
            }));
        }
    }
    changes.sort_by_key(|change| {
        change
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string()
    });
    let ok = changes.is_empty();
    if json_output {
        println!(
            "{}",
            serde_json::to_string_pretty(&json!({"drift":&changes,"facts":facts.len(),"ok":ok}))?
        );
    } else if ok {
        println!("No drift found.");
        println!("Checked {} observed facts.", facts.len());
    } else {
        println!("Drift found ({} missing files).", changes.len());
        for change in &changes {
            println!(
                "- {}:{} ({})",
                change["repo"].as_str().unwrap_or_default(),
                change["file"].as_str().unwrap_or_default(),
                change["reason"].as_str().unwrap_or_default()
            );
        }
    }
    Ok(i32::from(!ok))
}

fn workspace_command(root: &Path, command: WorkspaceCommand) -> Result<i32> {
    match command {
        WorkspaceCommand::Init { id, name, force } => {
            let manifest = root.join(workspace::WORKSPACE_MANIFEST);
            if manifest.exists() && !force {
                bail!(
                    "{} already exists; use --force to replace it",
                    manifest.display()
                );
            }
            fs::create_dir_all(manifest.parent().context("manifest has no parent")?)?;
            let id = id
                .or_else(|| name.clone())
                .context("--id is required (or use --name as a shorthand)")?;
            let display_name = name.unwrap_or_else(|| id.clone());
            let config = workspace::WorkspaceConfig {
                version: 1,
                workspace: workspace::WorkspaceIdentity {
                    id: id.clone(),
                    name: Some(display_name),
                    description: None,
                },
                repos: vec![workspace::RepoConfig {
                    alias: repo::safe_project_name(root),
                    role: Some("unknown".into()),
                    path: "..".into(),
                    remote: None,
                    default_branch: None,
                }],
                groups: Vec::new(),
                edges: Vec::new(),
            };
            fs::write(
                &manifest,
                format!("{}\n", serde_json::to_string_pretty(&config)?),
            )?;
            println!("wrote {}", manifest.display());
            Ok(0)
        }
        WorkspaceCommand::Add {
            repo_path,
            alias,
            role,
            remote,
            default_branch,
        } => {
            let context = workspace::resolve_workspace(root, true)?;
            let manifest = context
                .manifest_path
                .context("workspace manifest missing")?;
            let mut config = context.config;
            let target = repo_path.canonicalize()?;
            let alias = alias.unwrap_or_else(|| repo::safe_project_name(&target));
            let manifest_dir = manifest.parent().context("manifest has no parent")?;
            let path = workspace::relative_path(manifest_dir, &target)
                .to_string_lossy()
                .replace('\\', "/");
            config.repos.push(workspace::RepoConfig {
                alias,
                role: Some(role),
                path: if path.is_empty() { ".".into() } else { path },
                remote,
                default_branch,
            });
            let value = serde_json::to_value(&config)?;
            let validation = workspace::validate_workspace_value(&value, Some(manifest_dir), true);
            if !validation.valid {
                bail!(
                    "Invalid workspace update: {}",
                    validation
                        .errors
                        .iter()
                        .map(|error| error.message.as_str())
                        .collect::<Vec<_>>()
                        .join(", ")
                );
            }
            fs::write(
                &manifest,
                format!("{}\n", serde_json::to_string_pretty(&config)?),
            )?;
            println!("updated {}", manifest.display());
            Ok(0)
        }
        WorkspaceCommand::List { json } => {
            let context = workspace::resolve_workspace(root, false)?;
            let value = workspace::public_workspace(&context);
            if json {
                println!("{}", serde_json::to_string_pretty(&value)?);
            } else {
                println!("Workspace: {}", context.config.workspace.id);
                for repo in &context.repos {
                    println!(
                        "- {} ({}) {}",
                        repo.alias,
                        repo.role,
                        workspace::portable_path(&context, &repo.cwd)
                    );
                }
            }
            Ok(0)
        }
        WorkspaceCommand::Validate { json } => {
            let context = workspace::resolve_workspace(root, true)?;
            let value = serde_json::to_value(&context.config)?;
            let manifest = context
                .manifest_path
                .context("workspace manifest missing")?;
            let result = workspace::validate_workspace_value(&value, manifest.parent(), true);
            if json {
                println!("{}", serde_json::to_string_pretty(&result)?);
            } else if result.valid {
                println!("Workspace manifest is valid.");
            } else {
                for error in &result.errors {
                    println!("{}: {}", error.code, error.message);
                }
            }
            Ok(i32::from(!result.valid))
        }
        WorkspaceCommand::Graph { json: _ } => {
            let context = workspace::resolve_workspace(root, false)?;
            println!(
                "{}",
                serde_json::to_string_pretty(&workspace::build_workspace_graph(&context))?
            );
            Ok(0)
        }
    }
}

fn guide(workflow: Option<GuideWorkflow>) -> Result<i32> {
    match workflow {
        None => println!("{}", include_str!("guides/GUIDE.txt")),
        Some(GuideWorkflow::Greenfield) => println!("{}", include_str!("guides/greenfield.txt")),
        Some(GuideWorkflow::Existing) => println!("{}", include_str!("guides/existing.txt")),
        Some(GuideWorkflow::Speckit) => println!("{}", include_str!("guides/speckit.txt")),
    }
    Ok(0)
}

fn path(
    path: &Path,
    from: &str,
    to: &str,
    direction: PathDirection,
    verb: Option<&str>,
    max_hops: usize,
    json: bool,
) -> Result<i32> {
    let dag: Value = serde_json::from_slice(&fs::read(path)?)?;
    let result = shortest_graph_path(&dag, from, to, direction, verb, max_hops);
    if json {
        println!("{}", serde_json::to_string_pretty(&result)?);
    } else if result.ok {
        let from_label = result
            .from
            .as_ref()
            .map(|value| value.label.as_str())
            .unwrap_or(from);
        let to_label = result
            .to
            .as_ref()
            .map(|value| value.label.as_str())
            .unwrap_or(to);
        println!("{from_label} → {to_label} ({} hops)", result.hops);
        for (index, node) in result.nodes.iter().enumerate() {
            if let Some(edge) = result.edges.get(index) {
                println!("  {} --{}-->", node.label, edge.verb);
            } else {
                println!("  {}", node.label);
            }
        }
    } else {
        println!(
            "No path: {}{}",
            result.error.as_deref().unwrap_or("unknown"),
            result
                .candidates
                .as_ref()
                .filter(|values| !values.is_empty())
                .map(|values| format!(" ({})", values.join(", ")))
                .unwrap_or_default()
        );
    }
    Ok(i32::from(!result.ok))
}
