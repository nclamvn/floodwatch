'use client'

import { useState } from 'react'
import Image from 'next/image'
import axios from 'axios'

interface ImageUploadProps {
  onUploadComplete: (urls: string[]) => void
  maxImages?: number
  cloudName?: string
  uploadPreset?: string
}

export default function ImageUpload({
  onUploadComplete,
  maxImages = 3,
  cloudName = 'demo',
  uploadPreset = 'unsigned_preset'
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const validateFile = (file: File): string | null => {
    // Check mime type
    if (!file.type.startsWith('image/')) {
      return 'Chỉ chấp nhận file ảnh (JPEG, PNG, GIF)'
    }

    // Check size (5MB max)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return `File quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB). Tối đa 5MB.`
    }

    return null
  }

  const uploadToCloudinary = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', uploadPreset)
    formData.append('folder', 'floodwatch')

    try {
      const response = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        formData,
        {
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / (progressEvent.total || 100)
            )
            setProgress(percentCompleted)
          }
        }
      )

      return response.data.secure_url
    } catch (err: any) {
      throw new Error(err.response?.data?.error?.message || 'Upload failed')
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])

    if (files.length === 0) return

    // Check max images
    if (uploadedUrls.length + files.length > maxImages) {
      setError(`Tối đa ${maxImages} ảnh`)
      return
    }

    // Validate all files first
    for (const file of files) {
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        return
      }
    }

    setError(null)
    setUploading(true)
    const newUrls: string[] = []

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setProgress(0)
        const url = await uploadToCloudinary(file)
        newUrls.push(url)
      }

      const allUrls = [...uploadedUrls, ...newUrls]
      setUploadedUrls(allUrls)
      onUploadComplete(allUrls)
    } catch (err: any) {
      setError(err.message || 'Lỗi khi upload ảnh')
    } finally {
      setUploading(false)
      setProgress(0)
      // Reset input
      e.target.value = ''
    }
  }

  const removeImage = (index: number) => {
    const newUrls = uploadedUrls.filter((_, i) => i !== index)
    setUploadedUrls(newUrls)
    onUploadComplete(newUrls)
  }

  return (
    <div className="space-y-3">
      {/* Upload button */}
      <div>
        <label className="block cursor-pointer">
          <div className={`px-4 py-3 border-2 border-dashed rounded-lg text-center transition ${
            uploading ? 'bg-gray-100 border-gray-300' : 'hover:border-neutral-400 hover:bg-neutral-50'
          }`}>
            {uploading ? (
              <div>
                <div className="text-sm text-gray-700 mb-2">Đang upload {progress}%...</div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-neutral-600 h-2 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div>
                <span className="text-2xl">📷</span>
                <div className="text-sm text-gray-700 mt-1">
                  Click để chọn ảnh (tối đa {maxImages} ảnh, 5MB/ảnh)
                </div>
              </div>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            disabled={uploading || uploadedUrls.length >= maxImages}
            className="hidden"
          />
        </label>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-50 text-red-800 text-sm rounded-lg">
          ❌ {error}
        </div>
      )}

      {/* Uploaded images preview */}
      {uploadedUrls.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {uploadedUrls.map((url, index) => (
            <div key={index} className="relative group h-24">
              <Image
                src={url}
                alt={`Upload ${index + 1}`}
                fill
                sizes="(max-width: 768px) 33vw, 128px"
                className="object-cover rounded-lg"
                unoptimized={!url.startsWith('/')}
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Count */}
      {uploadedUrls.length > 0 && (
        <div className="text-xs text-gray-700">
          {uploadedUrls.length}/{maxImages} ảnh
        </div>
      )}
    </div>
  )
}
