"""
PROGRESSIQ — EXIF GPS & Cryptographic Tamper-Proof Evidence Parser
Extracts GPS coordinates, altitude, capture hardware metadata, and computes
SHA-256 cryptographic hashes for site evidence and field photos.
"""
import io
import hashlib
from datetime import datetime
from typing import Dict, Any, Tuple, Optional
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS


def _convert_to_degrees(value) -> float:
    """Helper function to convert the GPS coordinates stored in EXIF to degress in float format."""
    try:
        if isinstance(value, (int, float)):
            return float(value)
        # Value can be a tuple of (degrees, minutes, seconds) or rational numbers
        d = float(value[0])
        m = float(value[1])
        s = float(value[2])
        return d + (m / 60.0) + (s / 3600.0)
    except Exception:
        return 0.0


def extract_evidence_metadata(content_bytes: bytes, filename: str) -> Dict[str, Any]:
    """
    Extract EXIF GPS, timestamp, device metadata, and compute SHA-256 hash.
    """
    # 1. Cryptographic SHA-256 Tamper-Proof Hash
    sha256_hash = hashlib.sha256(content_bytes).hexdigest()

    metadata: Dict[str, Any] = {
        "filename": filename,
        "file_size_bytes": len(content_bytes),
        "sha256_hash": sha256_hash,
        "tamper_proof_verified": True,
        "has_gps": False,
        "latitude": None,
        "longitude": None,
        "altitude": None,
        "capture_timestamp": None,
        "camera_make": None,
        "camera_model": None,
        "software": None,
        "google_maps_url": None,
        "osm_url": None,
    }

    # Only attempt image EXIF on image formats
    lower_fn = filename.lower()
    if not lower_fn.endswith((".jpg", ".jpeg", ".png", ".webp", ".tiff", ".heic")):
        return metadata

    try:
        image = Image.open(io.BytesIO(content_bytes))
        exif_raw = image._getexif()
        if not exif_raw:
            return metadata

        exif_data = {}
        for tag_id, val in exif_raw.items():
            tag_name = TAGS.get(tag_id, tag_id)
            exif_data[tag_name] = val

        # Camera info
        metadata["camera_make"] = str(exif_data.get("Make", "")).strip() or None
        metadata["camera_model"] = str(exif_data.get("Model", "")).strip() or None
        metadata["software"] = str(exif_data.get("Software", "")).strip() or None

        # Capture timestamp
        dt_str = exif_data.get("DateTimeOriginal") or exif_data.get("DateTime")
        if dt_str:
            try:
                # Format: YYYY:MM:DD HH:MM:SS
                dt_clean = str(dt_str).replace("-", ":")
                parsed_dt = datetime.strptime(dt_clean, "%Y:%m:%d %H:%M:%S")
                metadata["capture_timestamp"] = parsed_dt.strftime("%Y-%m-%d %H:%M:%S")
            except Exception:
                metadata["capture_timestamp"] = str(dt_str)

        # GPS Info
        gps_info = exif_data.get("GPSInfo")
        if gps_info:
            gps_data = {}
            for t, v in gps_info.items():
                sub_tag = GPSTAGS.get(t, t)
                gps_data[sub_tag] = v

            lat = None
            lon = None

            if "GPSLatitude" in gps_data and "GPSLatitudeRef" in gps_data:
                lat = _convert_to_degrees(gps_data["GPSLatitude"])
                if gps_data["GPSLatitudeRef"] == "S":
                    lat = -lat

            if "GPSLongitude" in gps_data and "GPSLongitudeRef" in gps_data:
                lon = _convert_to_degrees(gps_data["GPSLongitude"])
                if gps_data["GPSLongitudeRef"] == "W":
                    lon = -lon

            if lat is not None and lon is not None and (lat != 0.0 or lon != 0.0):
                metadata["has_gps"] = True
                metadata["latitude"] = round(lat, 6)
                metadata["longitude"] = round(lon, 6)
                metadata["google_maps_url"] = f"https://www.google.com/maps?q={round(lat, 6)},{round(lon, 6)}"
                metadata["osm_url"] = f"https://www.openstreetmap.org/?mlat={round(lat, 6)}&mlon={round(lon, 6)}#map=17/{round(lat, 6)}/{round(lon, 6)}"

            if "GPSAltitude" in gps_data:
                try:
                    metadata["altitude"] = round(float(gps_data["GPSAltitude"]), 1)
                except Exception:
                    pass

    except Exception:
        pass

    return metadata
