import json
import os
from pathlib import Path
import subprocess
import shutil
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
if name == 'ssh' and os.environ.get('FAIL_REMOTE_RSYNC') == '1' and any('command -v rsync' in arg for arg in sys.argv):
    sys.exit(1)
if name == 'ssh' and os.environ.get('FAIL_HEALTH') == '1' and any('healthcheck run' in arg for arg in sys.argv):
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

    def test_missing_option_values_fail_before_connecting(self):
        for args in (("--dataset",), ("--dataset", ""), ("--image-archive", ""), ("--unknown",)):
            with self.subTest(args=args):
                self.assertNotEqual(self.run_deploy(*args).returncode, 0)
                self.assertFalse(self.log.exists())

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
        self.assertIn("--exclude=*", sync)
        real_rsync = shutil.which("rsync", path=os.environ["PATH"])
        if real_rsync:
            (self.dataset / "capture.json").write_text("private capture")
            (self.dataset / "images" / "private.sqlite3-wal").write_text("sqlite")
            destination = self.dataset.parent / "copied"
            filters = [arg for arg in sync if arg.startswith(("--exclude=", "--include="))]
            subprocess.run([real_rsync, "-a", *filters, str(self.dataset) + "/", str(destination)], check=True)
            self.assertEqual(sorted(str(p.relative_to(destination)) for p in destination.rglob("*") if p.is_file()),
                             ["dataset.json", "images/photo.jpg"])
        ssh_commands = [call[-1] for call in self.calls() if call[0] == "ssh"]
        rsync_check = next(i for i, command in enumerate(ssh_commands) if "command -v rsync" in command)
        mkdir = next(i for i, command in enumerate(ssh_commands) if "mkdir -p" in command)
        self.assertLess(rsync_check, mkdir)

    def test_podman_archive_skips_registry_and_installs_boot_service(self):
        result = self.run_deploy("--image-archive", str(self.archive), CONTAINER_ENGINE="podman")
        self.assertEqual(result.returncode, 0, result.stderr)
        commands = "\n".join(call[-1] for call in self.calls() if call[0] == "ssh")
        self.assertIn("podman load -i", commands)
        self.assertIn(".rdr2-image.mock.tar", commands)
        self.assertNotIn(" pull map", commands)
        self.assertNotIn("docker compose", commands)
        self.assertIn("-f compose.podman.yaml", commands)
        self.assertIn("seq 1 30", commands)
        self.assertNotIn("ps -q map", commands)
        for call in self.calls():
            if call[0] == "ssh":
                checked = subprocess.run(["bash", "-n", "-c", call[-1]], capture_output=True, text=True)
                self.assertEqual(checked.returncode, 0, checked.stderr)
        self.assertIn("[Install]\nWantedBy=default.target", commands)
        self.assertIn("map-apps-test-map.service", commands)
        self.assertIn("systemctl --user enable --now", commands)
        unit_command = next(command for command in commands.splitlines() if "systemd/user" in command)
        self.assertIn("$HOME/.config/systemd/user", unit_command)

        scp_calls = [call for call in self.calls() if call[0] == "scp"]
        self.assertTrue(scp_calls)
        self.assertTrue(all("StrictHostKeyChecking=yes" in " ".join(call) for call in scp_calls))

    def test_remote_rsync_preflight_precedes_mkdir(self):
        result = self.run_deploy("--dataset", str(self.dataset), FAIL_REMOTE_RSYNC="1")
        self.assertNotEqual(result.returncode, 0)
        commands = [call[-1] for call in self.calls() if call[0] == "ssh"]
        self.assertTrue(any("command -v rsync" in command for command in commands))
        self.assertFalse(any("mkdir -p" in command for command in commands))

    def test_failed_podman_health_does_not_install_systemd(self):
        result = self.run_deploy(FAIL_HEALTH="1", CONTAINER_ENGINE="podman")
        self.assertNotEqual(result.returncode, 0)
        commands = [call[-1] for call in self.calls() if call[0] == "ssh"]
        self.assertTrue(any("healthcheck run" in command for command in commands))
        self.assertFalse(any("systemctl --user enable --now" in command for command in commands))

    def test_unsafe_data_path_fails_before_connecting(self):
        env_file = self.dataset / "unsafe.env"
        env_file.write_text((REPO / ".env.docker.example").read_text().replace("SERVER_DATA_DIR=./data", "SERVER_DATA_DIR=../outside"))
        result = self.run_deploy(ENV_FILE=str(env_file))
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.log.exists())

    def test_malicious_dotenv_is_rejected_without_execution(self):
        marker = self.dataset / "executed"
        env_file = self.dataset / "malicious.env"
        env_file.write_text(
            f"MAP_IMAGE=example/map:latest\nSERVER_DATA_DIR=./data\nEVIL=$(touch {marker})\n"
        )
        result = self.run_deploy(ENV_FILE=str(env_file))
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(marker.exists())

    def test_invalid_project_port_and_data_values_fail_before_ssh(self):
        for text in (
            "COMPOSE_PROJECT_NAME=bad name\nMAP_IMAGE=example/map:latest\nHTTP_PORT=8081\nSERVER_DATA_DIR=./data\n",
            "COMPOSE_PROJECT_NAME=rdr2-map\nMAP_IMAGE=example/map:latest\nHTTP_PORT=abc\nSERVER_DATA_DIR=./data\n",
            "COMPOSE_PROJECT_NAME=rdr2-map\nMAP_IMAGE=example/map:latest\nHTTP_PORT=8081\nSERVER_DATA_DIR=./data/../x\n",
        ):
            with self.subTest(text=text):
                env_file = self.dataset / f"invalid-{abs(hash(text))}.env"
                env_file.write_text(text + "BIND_HOST=0.0.0.0\n")
                if self.log.exists():
                    self.log.unlink()
                result = self.run_deploy(ENV_FILE=str(env_file))
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(self.log.exists())


if __name__ == "__main__":
    unittest.main()
