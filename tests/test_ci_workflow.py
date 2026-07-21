from pathlib import Path

WORKFLOW_PATH = Path(".github/workflows/docs-quality-guardrails.yml")


def test_frontend_dependencies_are_installed_before_quality_gate() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

    setup_node_position = workflow.index("uses: actions/setup-node@v4")
    npm_ci_position = workflow.index("run: npm ci")
    quality_gate_position = workflow.index("run: make check")

    assert setup_node_position < npm_ci_position < quality_gate_position
    assert 'node-version: "22"' in workflow
    assert "cache: npm" in workflow
