use std::fs;

use dotdog::speckit;
use tempfile::tempdir;

fn fixture(root: &std::path::Path) {
    let feature = root.join("specs/001-login");
    fs::create_dir_all(feature.join("contracts")).unwrap();
    fs::create_dir_all(root.join(".specify/memory")).unwrap();
    fs::write(
        root.join(".specify/memory/constitution.md"),
        "# Constitution\n\nSpecifications precede implementation.\n",
    )
    .unwrap();
    fs::write(
        feature.join("spec.md"),
        "# Feature Specification: Login\n\n### User Story 1 - Sign in (Priority: P1)\n\nA user signs in.\n\n### Functional Requirements\n\n- **FR-001**: System MUST authenticate the user.\n\n### Key Entities\n\n- **User**: A registered account.\n\n### Measurable Outcomes\n\n- **SC-001**: Login completes.\n",
    )
    .unwrap();
    fs::write(
        feature.join("tasks.md"),
        "# Tasks\n\n- [ ] T001 [US1] Implement login\n",
    )
    .unwrap();
    fs::write(feature.join("plan.md"), "# Plan\n\nUse the API.\n").unwrap();
}

#[test]
fn imports_managed_artifacts_with_stable_public_metadata() {
    let root = tempdir().unwrap();
    fixture(root.path());

    let imported = speckit::import(root.path(), None, false).unwrap();
    assert_eq!(imported.root, ".");
    assert_eq!(imported.output, ".doghouse/speckit");
    assert_eq!(imported.features.len(), 1);
    assert_eq!(imported.features[0].id, "001-login");
    assert_eq!(
        imported.features[0].artifacts,
        [
            "SPEC.dog",
            "constitution.dog",
            "data-model.dog",
            "plan.dog",
            "research.dog",
            "quickstart.dog",
            "contracts.dog",
        ]
    );
    assert_eq!(imported.summary.written, 7);
    assert_eq!(imported.actions.len(), 7);

    let rerun = speckit::import(root.path(), None, false).unwrap();
    assert_eq!(rerun.summary.written, 0);
    assert_eq!(rerun.summary.unchanged, 7);
    let manifest: serde_json::Value = serde_json::from_slice(
        &fs::read(root.path().join(".doghouse/speckit/import.json")).unwrap(),
    )
    .unwrap();
    assert_eq!(manifest["version"], 1);
    assert_eq!(manifest["source"], "github-spec-kit");
    assert_eq!(manifest["output"], ".doghouse/speckit");
}

#[test]
fn preserves_human_edits_unless_force_is_explicit() {
    let root = tempdir().unwrap();
    fixture(root.path());
    speckit::import(root.path(), None, false).unwrap();
    let generated = root.path().join(".doghouse/speckit/001-login/SPEC.dog");
    fs::write(&generated, "# Human edit\n").unwrap();

    let preserved = speckit::import(root.path(), None, false).unwrap();
    assert_eq!(preserved.summary.skipped, 1);
    assert_eq!(fs::read_to_string(&generated).unwrap(), "# Human edit\n");

    let replaced = speckit::import(root.path(), None, true).unwrap();
    assert_eq!(replaced.summary.written, 1);
}

#[test]
fn rejects_protected_and_parent_outputs() {
    let root = tempdir().unwrap();
    fixture(root.path());
    for output in [".git/import", ".GIT/import", "specs", ".SPECIFY/output"] {
        let error = speckit::import(root.path(), Some(output.as_ref()), false).unwrap_err();
        assert!(error.to_string().contains("cannot overwrite"));
    }
    let error = speckit::import(root.path(), Some("../outside".as_ref()), false).unwrap_err();
    assert!(error.to_string().contains("must be a subdirectory"));
}
