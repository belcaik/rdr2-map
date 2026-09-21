"""Media primitives adapted from belcaik/gta-v-map (MIT, copyright 2025 belcaik)."""
import hashlib
import io
import ipaddress
import json
import socket
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlparse, urljoin
from uuid import uuid4

from PIL import Image

HOSTS = {"rdr2map.com", "cdn.mapgenie.io", "tiles.mapgenie.io", "media.mapgenie.io"}
MAX_BYTES = 20 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 40_000_000


def safe_url(url, base=None):
    url = urljoin(base, url) if base else url
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in HOSTS or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError("URL outside verified HTTPS origins")
    addresses = socket.getaddrinfo(parsed.hostname, 443, type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(item[4][0]).is_global for item in addresses):
        raise ValueError("Non-public destination")
    return url


def atomic(path, content):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + "." + uuid4().hex + ".tmp")
    try:
        temp.write_bytes(content)
        temp.replace(path)
    finally:
        temp.unlink(missing_ok=True)


def save_json(path, data):
    atomic(path, json.dumps(data, indent=2, ensure_ascii=False, allow_nan=False).encode())


def decode_image(content, mime):
    if len(content) > MAX_BYTES or not isinstance(mime, str) or mime.split(";")[0] not in {"image/png", "image/jpeg", "image/webp"}:
        raise ValueError("Invalid image MIME or size")
    try:
        with Image.open(io.BytesIO(content)) as image:
            actual = {"PNG": ("image/png", "png"), "JPEG": ("image/jpeg", "jpg"), "WEBP": ("image/webp", "webp")}.get(image.format)
            if not actual or image.width * image.height > 40_000_000:
                raise ValueError("Unsupported image or pixel limit")
            image.verify()
        with Image.open(io.BytesIO(content)) as image:
            image.load()
            return actual[0], actual[1], image.width, image.height
    except Image.DecompressionBombError as error:
        raise ValueError("Image pixel limit") from error


def confined(root, relative):
    root = Path(root).resolve()
    path = (root / relative).resolve()
    if not path.is_relative_to(root):
        raise ValueError("Path outside output")
    return path


def store_image(content, mime, kind, output):
    real_mime, extension, width, height = decode_image(content, mime)
    digest = hashlib.sha256(content).hexdigest()
    folder = "icons" if kind == "category-icon" else "images"
    relative = f"{folder}/{digest}.{extension}"
    atomic(confined(output, relative), content)
    return dict(path=relative, mime=real_mime, bytes=len(content), width=width, height=height, sha256=digest, status="downloaded", error=None)


def valid_existing(item, output):
    if item["status"] != "downloaded" or not item["path"]:
        return False
    path = confined(output, item["path"])
    try:
        if path.stat().st_size > MAX_BYTES:
            return False
        content = path.read_bytes()
        mime, _, width, height = decode_image(content, item.get("mime") or "image/jpeg")
        return hashlib.sha256(content).hexdigest() == item["sha256"] and item.get("bytes",len(content)) == len(content) and item.get("mime", mime) == mime and item.get("width", width) == width and item.get("height", height) == height
    except (OSError, ValueError):
        return False


def retry_delay(value, attempt):
    try:
        seconds = float(value)
    except (ValueError, TypeError):
        try:
            seconds = (parsedate_to_datetime(value) - datetime.now(timezone.utc)).total_seconds()
        except (ValueError, TypeError):
            seconds = 2 ** attempt
    if seconds > 120:
        raise ValueError("Retry-After exceeds run budget; resume later")
    return max(0, seconds)


def download(transport, url, retries=2, sleep=time.sleep):
    for attempt in range(retries + 1):
        try:
            response = transport(url)
        except (OSError, TimeoutError):
            if attempt >= retries:
                raise
            sleep(2 ** attempt)
            continue
        status = response["status"]
        if status == 200:
            return response["body"], response["mime"]
        if status in (0, 429, 500, 502, 503, 504) and attempt < retries:
            sleep(retry_delay(response.get("retryAfter"), attempt))
            continue
        raise ValueError(f"HTTP {status}: " + response.get("error", "download rejected"))
    raise ValueError("Retry budget exhausted")
