import http.cookiejar
import json
import re
import shutil
import time
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path
from typing import Optional

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"


class ItchDownloader:
    MIN_INTERVAL_S = 6.0

    def __init__(self, page_url: str, cache_dir: Path):
        self.page_url = page_url.rstrip("/")
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
        self.opener.addheaders = [("User-Agent", USER_AGENT)]
        self.last_request = 0.0

    def _throttle(self) -> None:
        remaining = self.MIN_INTERVAL_S - (time.monotonic() - self.last_request)
        if remaining > 0:
            time.sleep(remaining)
        self.last_request = time.monotonic()

    def _text(self, url: str, form: Optional[dict] = None) -> str:
        self._throttle()
        body = urllib.parse.urlencode(form).encode() if form is not None else None
        request = urllib.request.Request(url, data=body, headers={"Referer": self.page_url})
        with self.opener.open(request, timeout=90) as response:
            return response.read().decode("utf-8", "replace")

    @staticmethod
    def _csrf_token(html: str) -> str:
        match = re.search(r'name="csrf_token"\s+value="([^"]+)"', html)
        if match is None:
            match = re.search(r'value="([^"]+)"\s+name="csrf_token"', html)
        if match is None:
            raise RuntimeError("csrf_token not found on itch.io page")
        return match.group(1)

    @staticmethod
    def _upload_id(html: str, filename: str) -> str:
        for block in re.finditer(r'<div class="upload">.*?</div>\s*</div>', html, re.S):
            if filename in block.group(0):
                found = re.search(r'data-upload_id="(\d+)"', block.group(0))
                if found:
                    return found.group(1)
        raise RuntimeError(f"upload {filename} not listed on the itch.io download page")

    def fetch(self, filename: str, save_as: Optional[str] = None) -> Path:
        dest = self.cache_dir / (save_as or filename)
        if dest.exists() and dest.stat().st_size > 0:
            return dest
        token = self._csrf_token(self._text(self.page_url + "/purchase"))
        download_url = json.loads(self._text(self.page_url + "/download_url", {"csrf_token": token}))["url"]
        page = self._text(download_url)
        token = self._csrf_token(page)
        upload_id = self._upload_id(page, filename)
        cdn_url = json.loads(self._text(f"{self.page_url}/file/{upload_id}", {"csrf_token": token}))["url"]
        tmp = dest.with_suffix(dest.suffix + ".part")
        self._throttle()
        with self.opener.open(urllib.request.Request(cdn_url), timeout=120) as response, open(tmp, "wb") as out:
            shutil.copyfileobj(response, out)
        if tmp.stat().st_size == 0:
            raise RuntimeError("empty download from itch.io CDN")
        tmp.replace(dest)
        return dest


class DirectDownloader:
    def __init__(self, cache_dir: Path):
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def fetch(self, url: str, filename: str) -> Path:
        dest = self.cache_dir / filename
        if dest.exists() and dest.stat().st_size > 0:
            return dest
        last_error = None
        for attempt in range(1, 4):
            try:
                request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
                tmp = dest.with_suffix(dest.suffix + ".part")
                with urllib.request.urlopen(request, timeout=120) as response, open(tmp, "wb") as out:
                    shutil.copyfileobj(response, out)
                if tmp.stat().st_size == 0:
                    raise RuntimeError("empty response body")
                tmp.replace(dest)
                return dest
            except Exception as error:
                last_error = error
                if attempt < 3:
                    time.sleep(2 * attempt)
        raise RuntimeError(f"failed to download {url}: {last_error}")


class ArchiveExtractor:
    def __init__(self, allowed_suffixes: tuple, max_member_bytes: int):
        self.allowed_suffixes = tuple(suffix.lower() for suffix in allowed_suffixes)
        self.max_member_bytes = max_member_bytes

    def extract(self, zip_path: Path, extract_dir: Path) -> None:
        if extract_dir.exists():
            shutil.rmtree(extract_dir)
        extract_dir.mkdir(parents=True)
        base = extract_dir.resolve()
        with zipfile.ZipFile(zip_path) as archive:
            for member in archive.infolist():
                if member.is_dir() or not member.filename.lower().endswith(self.allowed_suffixes):
                    continue
                if any(part.startswith(("__MACOSX", "._")) for part in Path(member.filename).parts):
                    continue
                if member.file_size > self.max_member_bytes:
                    raise RuntimeError(f"{member.filename}: member too large")
                target = (base / member.filename).resolve()
                if base != target and base not in target.parents:
                    raise RuntimeError(f"{member.filename}: path escapes the extraction directory")
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(member) as source, open(target, "wb") as out:
                    shutil.copyfileobj(source, out)
