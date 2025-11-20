'use client'

import { useState } from 'react'
import Image from 'next/image'

interface ImageGalleryProps {
  images: string[]
  alt?: string
}

export default function ImageGallery({ images, alt = 'Report image' }: ImageGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentImage, setCurrentImage] = useState(0)
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set())

  if (!images || images.length === 0) return null

  const validImages = images.filter((_, index) => !imageErrors.has(index))
  if (validImages.length === 0) return null

  const openLightbox = (index: number) => {
    setCurrentImage(index)
    setLightboxOpen(true)
  }

  const closeLightbox = () => {
    setLightboxOpen(false)
  }

  const nextImage = () => {
    setCurrentImage((prev) => (prev + 1) % validImages.length)
  }

  const prevImage = () => {
    setCurrentImage((prev) => (prev - 1 + validImages.length) % validImages.length)
  }

  const handleImageError = (index: number) => {
    setImageErrors(prev => new Set(prev).add(index))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') closeLightbox()
    if (e.key === 'ArrowLeft') prevImage()
    if (e.key === 'ArrowRight') nextImage()
  }

  return (
    <>
      {/* Image Grid */}
      <div className={`grid gap-2 ${
        validImages.length === 1 ? 'grid-cols-1' :
        validImages.length === 2 ? 'grid-cols-2' :
        'grid-cols-2 md:grid-cols-3'
      }`}>
        {images.map((image, index) => {
          if (imageErrors.has(index)) return null

          return (
            <div
              key={index}
              className="relative aspect-video bg-neutral-800 rounded-lg overflow-hidden cursor-pointer group"
              onClick={() => openLightbox(index)}
            >
              <img
                src={image}
                alt={`${alt} ${index + 1}`}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                onError={() => handleImageError(index)}
                loading="lazy"
              />
              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </div>
            </div>
          )
        })}
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4"
          onClick={closeLightbox}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors text-white z-10"
            aria-label="Đóng"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Image counter */}
          <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1.5 rounded-full text-sm font-medium">
            {currentImage + 1} / {validImages.length}
          </div>

          {/* Previous button */}
          {validImages.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                prevImage()
              }}
              className="absolute left-4 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors text-white"
              aria-label="Ảnh trước"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Main image */}
          <div
            className="max-w-6xl max-h-[90vh] relative"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={validImages[currentImage]}
              alt={`${alt} ${currentImage + 1}`}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
          </div>

          {/* Next button */}
          {validImages.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                nextImage()
              }}
              className="absolute right-4 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors text-white"
              aria-label="Ảnh kế tiếp"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Thumbnails */}
          {validImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 bg-black/50 p-2 rounded-full max-w-[90vw] overflow-x-auto custom-scrollbar">
              {validImages.map((image, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation()
                    setCurrentImage(index)
                  }}
                  className={`w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden transition-all ${
                    currentImage === index
                      ? 'ring-2 ring-white scale-105'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={image}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
