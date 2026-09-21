import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


REPO = Path(__file__).resolve().parents[2]


class DeployTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="rdr2-deploy-test-")
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        self.log = root / "calls.jsonl"
        stub = """#!/usr/bin/env python3
import json, os, pathlib, sys
name = pathlib.Path(sys.argv[0]).name
with open(os.environ['CALL_LOG'], 'a') as log:
    log.write(json.dumps([name, *sys.argv[1:]]) + '\\n')
if name == 'ssh' and os.environ.get('FAIL_SSH') == '1':
    sys.exit(1)
if name == 'ssh' and any('mktemp .rdr2-image.' in arg for arg in sys.argv):
    print('.rdr2-image.mock.tar')
"""
        for name in ("ssh", "scp", "rsync"):
            binary = root / name
            binary.write_text(stub)
            binary.chmod(0o755)
        self.env = dict(os.environ, PATH=f"{root}:{os.environ['PATH']}", CALL_LOG=str(self.log),
                        ENV_FILE=str(REPO / ".env.docker.example"), SSH_HOST="test-host",
                        DEPLOY_DIR="apps/test-map", CONTAINER_ENGINE="docker", DATASET_DIR="")
        self.dataset = root / "dataset with spaces"
        self.dataset.mkdir()
        (self.dataset / "dataset.json").write_text("{}")
        (self.dataset / "images").mkdir()
        (self.dataset / "images" / "photo.jpg").write_bytes(b"fixture")
        (self.dataset / "old.sqlite-wal").write_bytes(b"must not transfer")
        (self.dataset / "capture.json").write_text("private capture")
        self.archive = root / "image with spaces.tar"
        self.archive.write_bytes(b"archive")

    def run_deploy(self, *args, **env):
        return subprocess.run([str(REPO / "scripts/deploy.sh"), *args], env=dict(self.env, **env),
                              text=True, capture_output=True)

    def calls(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()]

    def test_dry_run_does_not_connect(self):
        result = self.run_deploy("--dry-run", "--dataset", str(self.dataset))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(self.log.exists())
        self.assertIn("no files or services changed", result.stdout)

    def test_failed_preflight_cannot_transfer_or_start(self):
        result = self.run_deploy(FAIL_SSH="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(len(self.calls()), 1)
        self.assertEqual(self.calls()[0][-1], "true")

    def test_unsafe_inputs_fail_before_connecting(self):
        for env in ({"DEPLOY_DIR": "../outside"}, {"SSH_HOST": "-oBadOption"},
                    {"CONTAINER_ENGINE": "podman;bad"}):
            with self.subTest(env=env):
                self.assertNotEqual(self.run_deploy(**env).returncode, 0)
                self.assertFalse(self.log.exists())

    def test_docker_pulls_before_import_and_waits(self):
        result = self.run_deploy("--dataset", str(self.dataset))
        self.assertEqual(result.returncode, 0, result.stderr)
        commands = "\n".join(call[-1] for call in self.calls() if call[0] == "ssh")
        self.assertLess(commands.index(" pull map"), commands.index("db/import.js"))
        self.assertLess(commands.index("db/import.js"), commands.index(" up -d"))
        self.assertIn("--wait --wait-timeout 120", commands)
        sync = next(call for call in self.calls() if call[0] == "rsync")
        self.assertIn("--exclude=*.db", sync)
        self.assertNotIn("--delete", sync)
        self.assertIn(str(self.dataset) + "/", sync)
        self.assertIn("StrictHostKeyChecking=yes", sync[sync.index("-e") + 1])
        self.assertIn("--exclude=capture.json", sync)
        ssh_commands = [call[-1] for call in self.calls() if call[0] == "ssh"]
        self.assertLess(ssh_commands.index("command -v rsync >/dev/null 2>&1"),
                        ssh_commands.index("mkdir -p"))

    def test_podman_archive_skips_registry_and_installs_boot_service(self):
        result = self.run_deploy("--image-archive", str(self.archive), CONTAINER_ENGINE="podman")
        self.assertEqual(result.returncode, 0, result.stderr)
        commands = "\n".join(call[-1] for call in self.calls() if call[0] == "ssh")
        self.assertIn("podman load -i image.tar", commands)
        self.assertNotIn(" pull map", commands)
        self.assertNotIn("docker compose", commands)
        self.assertIn("-f compose.podman.yaml", commands)
        self.assertIn("seq 1 30", commands)
        self.assertIn("map-apps-test-map.service", commands)
        self.assertIn("systemctl --user enable --now", commands)
        unit_command = next(command for command in commands.splitlines() if "systemd/user" in command)
        self.assertIn("$HOME/.config/systemd/user", unit_command)
        self.assertIn(".rdr2-image.mock.tar", commands)

    def test_unsafe_data_path_fails_before_connecting(self):
        env_file = self.dataset / "unsafe.env"
        env_file.write_text("MAP_IMAGE=example/map:latest\nSERVER_DATA_DIR=../outside\n")
        result = self.run_deploy(ENV_FILE=str(env_file))
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.log.exists())


if __name__ == "__main__":
    unittest.main()
