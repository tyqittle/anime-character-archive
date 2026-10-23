"""Guard the content-to-site publication contract, including manual compatibility entries."""
import unittest
from pathlib import Path

import yaml


class DeploymentTopologyTests(unittest.TestCase):
    def test_all_shared_publishers_have_a_site_publication_edge(self):
        root = Path(__file__).resolve().parents[1]
        directory = root / ".github" / "workflows"
        deployment = yaml.safe_load((directory / "deploy-content.yml").read_text(encoding="utf-8"))
        events = deployment.get("on", deployment.get(True))
        subscribed = set(events["workflow_run"]["workflows"])
        self.assertIn("Shared animation preview pipeline", subscribed)
        self.assertIn("Refresh static archive sources", subscribed)
        for path in directory.glob("*.yml"):
            source = path.read_text(encoding="utf-8")
            if "uses: ./.github/workflows/preview-pipeline.yml" in source:
                self.assertIn(yaml.safe_load(source)["name"], subscribed)
        self.assertEqual(events["workflow_run"]["branches"], ["main"])
        self.assertEqual(events["workflow_run"]["types"], ["completed"])
        self.assertEqual(deployment["permissions"], {"contents": "read", "pages": "write"})
        job = deployment["jobs"]["publish"]
        self.assertIn("conclusion == 'success'", job["if"])
        self.assertIn("head_repository.full_name == github.repository", job["if"])
        self.assertEqual(job["steps"][0]["with"]["ref"], "main")
        self.assertNotIn("download-artifact", (directory / "deploy-content.yml").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
