import React, { useState } from 'react'
import { MapPin, ShieldCheck, Camera, Copy, Check, ExternalLink } from 'lucide-react'

export interface TamperProofData {
  sha256_hash?: string | null
  verified?: boolean
  has_gps?: boolean
  latitude?: number | null
  longitude?: number | null
  altitude?: number | null
  capture_timestamp?: string | null
  camera_make?: string | null
  camera_model?: string | null
  google_maps_url?: string | null
}

export const GeotagBadge: React.FC<{ data?: TamperProofData | null }> = ({ data }) => {
  const [copied, setCopied] = useState(false)

  if (!data) return null

  const handleCopyHash = () => {
    if (data.sha256_hash) {
      navigator.clipboard.writeText(data.sha256_hash)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
      {/* GPS Badge */}
      {data.has_gps && data.latitude != null && data.longitude != null ? (
        <a
          href={data.google_maps_url || `https://www.google.com/maps?q=${data.latitude},${data.longitude}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-medium hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
          title={`GPS Coordinates: ${data.latitude}, ${data.longitude}${data.altitude ? ` (Alt: ${data.altitude}m)` : ''}`}
        >
          <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>{data.latitude.toFixed(4)}°, {data.longitude.toFixed(4)}°</span>
          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
        </a>
      ) : null}

      {/* Camera / Hardware stamp */}
      {data.camera_model ? (
        <div
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px]"
          title={`Captured on ${data.camera_make || ''} ${data.camera_model}${data.capture_timestamp ? ` at ${data.capture_timestamp}` : ''}`}
        >
          <Camera className="w-3 h-3 text-slate-400" />
          <span>{data.camera_model}</span>
        </div>
      ) : null}

      {/* SHA-256 Tamper-Proof Cryptographic Hash */}
      {data.sha256_hash ? (
        <button
          onClick={handleCopyHash}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[11px] font-mono hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
          title={`SHA-256 Checksum: ${data.sha256_hash}\nClick to copy immutable audit signature`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>SHA-256: {data.sha256_hash.slice(0, 8)}...{data.sha256_hash.slice(-4)}</span>
          {copied ? (
            <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Copy className="w-2.5 h-2.5 opacity-60" />
          )}
        </button>
      ) : null}
    </div>
  )
}
