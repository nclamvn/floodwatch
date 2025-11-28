'use client'

import { useState } from 'react'
import { MapPin, Send, AlertCircle, CheckCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import ImageUpload from './ImageUpload'

interface HelpMeFormProps {
  onSubmitSuccess?: () => void
}

type NeedsType = 'food' | 'water' | 'shelter' | 'medical' | 'clothing' | 'transport' | 'other'
type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low'

interface FormData {
  lat: number | null
  lon: number | null
  needs_type: NeedsType
  urgency: UrgencyLevel
  description: string
  people_count: number | null
  contact_name: string
  contact_phone: string
  contact_email: string
  has_children: boolean
  has_elderly: boolean
  has_disabilities: boolean
  water_level_cm: number | null
  building_floor: number | null
  images: string[]
}

export default function HelpMeForm({ onSubmitSuccess }: HelpMeFormProps) {
  const t = useTranslations('helpForm')
  const tHelp = useTranslations('help')
  const tCommon = useTranslations('common')

  const [formData, setFormData] = useState<FormData>({
    lat: null,
    lon: null,
    needs_type: 'food',
    urgency: 'medium',
    description: '',
    people_count: null,
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    has_children: false,
    has_elderly: false,
    has_disabilities: false,
    water_level_cm: null,
    building_floor: null,
    images: []
  })

  // Cloudinary config
  const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'demo'
  const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'unsigned_preset'

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Field-level validation state
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const markTouched = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }))
  }

  // Validation helpers
  const isLocationValid = formData.lat !== null && formData.lon !== null
  const isDescriptionValid = formData.description.length >= 10
  const isNameValid = formData.contact_name.trim().length > 0
  const isPhoneValid = formData.contact_phone.trim().length > 0

  const getFieldError = (field: string): string | null => {
    if (!touched[field]) return null
    switch (field) {
      case 'location':
        return !isLocationValid ? t('validation.locationRequired') : null
      case 'description':
        return !isDescriptionValid ? t('validation.descriptionMinLength') : null
      case 'contact_name':
        return !isNameValid ? t('validation.nameRequired') : null
      case 'contact_phone':
        return !isPhoneValid ? t('validation.phoneRequired') : null
      default:
        return null
    }
  }

  const getInputClassName = (field: string, baseClass: string) => {
    const fieldError = getFieldError(field)
    if (fieldError) {
      return `${baseClass} border-red-500 dark:border-red-500 focus:ring-red-500`
    }
    return baseClass
  }

  const needsTypeOptions = [
    { value: 'food', label: tHelp('needsTypes.food') },
    { value: 'water', label: tHelp('needsTypes.water') },
    { value: 'shelter', label: tHelp('needsTypes.shelter') },
    { value: 'medical', label: tHelp('needsTypes.medical') },
    { value: 'clothing', label: tHelp('needsTypes.clothing') },
    { value: 'transport', label: tHelp('needsTypes.transport') },
    { value: 'other', label: tHelp('needsTypes.other') }
  ]

  const urgencyOptions = [
    { value: 'critical', label: t('urgencyLevels.critical'), color: 'text-red-600' },
    { value: 'high', label: t('urgencyLevels.high'), color: 'text-orange-600' },
    { value: 'medium', label: t('urgencyLevels.medium'), color: 'text-yellow-600' },
    { value: 'low', label: t('urgencyLevels.low'), color: 'text-neutral-600' }
  ]

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setError(t('validation.locationRequired'))
      return
    }

    setIsGettingLocation(true)
    setError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          lat: position.coords.latitude,
          lon: position.coords.longitude
        }))
        setIsGettingLocation(false)
      },
      (error) => {
        setError(t('validation.locationRequired'))
        setIsGettingLocation(false)
        console.error('Geolocation error:', error)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    // Validation
    if (!formData.lat || !formData.lon) {
      setError(t('validation.locationRequired'))
      return
    }

    if (formData.description.length < 10) {
      setError(t('validation.locationRequired'))
      return
    }

    if (!formData.contact_name.trim()) {
      setError(t('validation.nameRequired'))
      return
    }

    if (!formData.contact_phone.trim()) {
      setError(t('validation.phoneRequired'))
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        lat: formData.lat,
        lon: formData.lon,
        needs_type: formData.needs_type,
        urgency: formData.urgency,
        description: formData.description.trim(),
        contact_name: formData.contact_name.trim(),
        contact_phone: formData.contact_phone.trim(),
        ...(formData.people_count && { people_count: formData.people_count }),
        ...(formData.contact_email.trim() && { contact_email: formData.contact_email.trim() }),
        has_children: formData.has_children,
        has_elderly: formData.has_elderly,
        has_disabilities: formData.has_disabilities,
        ...(formData.water_level_cm !== null && { water_level_cm: formData.water_level_cm }),
        ...(formData.building_floor !== null && { building_floor: formData.building_floor }),
        ...(formData.images.length > 0 && { images: formData.images })
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://188.166.248.10:8000'
      const response = await fetch(`${apiUrl}/help/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || t('error'))
      }

      // Parse response and save submission to localStorage
      const data = await response.json()
      if (data.id) {
        try {
          const stored = localStorage.getItem('floodwatch_my_requests') || '[]'
          const submissions = JSON.parse(stored)
          submissions.unshift({
            id: data.id,
            tracking_code: data.tracking_code,
            needs_type: formData.needs_type,
            created_at: new Date().toISOString()
          })
          // Keep only last 10 submissions
          localStorage.setItem('floodwatch_my_requests', JSON.stringify(submissions.slice(0, 10)))
        } catch (e) {
          console.warn('Failed to save submission to localStorage:', e)
        }
      }

      setSuccess(true)

      // Reset form
      setFormData({
        lat: null,
        lon: null,
        needs_type: 'food',
        urgency: 'medium',
        description: '',
        people_count: null,
        contact_name: '',
        contact_phone: '',
        contact_email: '',
        has_children: false,
        has_elderly: false,
        has_disabilities: false,
        water_level_cm: null,
        building_floor: null,
        images: []
      })

      // Call success callback
      if (onSubmitSuccess) {
        onSubmitSuccess()
      }

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(false), 5000)

    } catch (err) {
      setError(err instanceof Error ? err.message : t('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold text-slate-900 dark:text-neutral-50 mb-4 flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-red-600" />
        {t('requestTitle')}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            {t('location')} <span className="text-red-600">*</span>
          </label>
          <button
            type="button"
            onClick={handleGetLocation}
            disabled={isGettingLocation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-neutral-600 hover:bg-neutral-700 disabled:bg-neutral-400 text-white rounded-md transition-colors"
          >
            <MapPin className="w-4 h-4" />
            {isGettingLocation ? t('gettingLocation') :
             formData.lat && formData.lon ? `${t('gotLocation')} (${formData.lat.toFixed(6)}, ${formData.lon.toFixed(6)})` :
             t('getLocation')}
          </button>
        </div>

        {/* Needs Type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            {t('helpType')} <span className="text-red-600">*</span>
          </label>
          <select
            value={formData.needs_type}
            onChange={(e) => setFormData(prev => ({ ...prev, needs_type: e.target.value as NeedsType }))}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 focus:ring-2 focus:ring-red-600 focus:border-transparent"
          >
            {needsTypeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Urgency */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            {t('urgency')} <span className="text-red-600">*</span>
          </label>
          <select
            value={formData.urgency}
            onChange={(e) => setFormData(prev => ({ ...prev, urgency: e.target.value as UrgencyLevel }))}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 focus:ring-2 focus:ring-red-600 focus:border-transparent"
          >
            {urgencyOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            {t('description')} <span className="text-red-600">*</span>
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            onBlur={() => markTouched('description')}
            placeholder={t('descriptionPlaceholder')}
            rows={4}
            className={getInputClassName('description', 'w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 placeholder-neutral-400 focus:ring-2 focus:ring-red-600 focus:border-transparent resize-none')}
          />
          <div className="flex justify-between items-center mt-1">
            {getFieldError('description') ? (
              <span className="text-xs text-red-500">{getFieldError('description')}</span>
            ) : (
              <span className="text-xs text-neutral-400">{t('validation.descriptionHint')}</span>
            )}
            <span className={`text-xs ${formData.description.length < 10 ? 'text-red-500' : 'text-neutral-400'}`}>
              {formData.description.length}/500
            </span>
          </div>
        </div>

        {/* Image Upload */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            {t('images')}
          </label>
          <ImageUpload
            onUploadComplete={(urls) => setFormData(prev => ({ ...prev, images: urls }))}
            maxImages={3}
            cloudName={CLOUDINARY_CLOUD_NAME}
            uploadPreset={CLOUDINARY_UPLOAD_PRESET}
          />
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {t('imagesHint')}
          </p>
        </div>

        {/* People Count */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            {t('peopleCount')}
          </label>
          <div className="relative">
            <input
              type="number"
              min="1"
              value={formData.people_count || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, people_count: e.target.value ? parseInt(e.target.value) : null }))}
              placeholder="5"
              className="number-input-modern w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 placeholder-neutral-400 focus:ring-2 focus:ring-red-600 focus:border-transparent"
            />
          </div>
          <style jsx>{`
            .number-input-modern::-webkit-inner-spin-button,
            .number-input-modern::-webkit-outer-spin-button {
              -webkit-appearance: none;
              margin: 0;
            }

            .number-input-modern[type=number] {
              -moz-appearance: textfield;
              appearance: textfield;
            }
          `}</style>
        </div>

        {/* Contact Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            {t('fullName')} <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={formData.contact_name}
            onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
            onBlur={() => markTouched('contact_name')}
            placeholder={t('fullNamePlaceholder')}
            className={getInputClassName('contact_name', 'w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 placeholder-neutral-400 focus:ring-2 focus:ring-red-600 focus:border-transparent')}
          />
          {getFieldError('contact_name') && (
            <span className="text-xs text-red-500 mt-1 block">{getFieldError('contact_name')}</span>
          )}
        </div>

        {/* Contact Phone */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            {t('phone')} <span className="text-red-600">*</span>
          </label>
          <input
            type="tel"
            value={formData.contact_phone}
            onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
            onBlur={() => markTouched('contact_phone')}
            placeholder={t('phonePlaceholder')}
            className={getInputClassName('contact_phone', 'w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 placeholder-neutral-400 focus:ring-2 focus:ring-red-600 focus:border-transparent')}
          />
          {getFieldError('contact_phone') && (
            <span className="text-xs text-red-500 mt-1 block">{getFieldError('contact_phone')}</span>
          )}
        </div>

        {/* Contact Email (Optional) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            Email
          </label>
          <input
            type="email"
            value={formData.contact_email}
            onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
            placeholder="email@example.com"
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 placeholder-neutral-400 focus:ring-2 focus:ring-red-600 focus:border-transparent"
          />
        </div>

        {/* Special Conditions */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            {tHelp('form.hasChildren')} / {tHelp('form.hasElderly')} / {tHelp('form.hasDisabilities')}
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.has_children}
                onChange={(e) => setFormData(prev => ({ ...prev, has_children: e.target.checked }))}
                className="w-4 h-4 text-red-600 border-neutral-300 rounded focus:ring-red-600"
              />
              <span className="text-sm text-slate-900 dark:text-neutral-50">{tHelp('form.hasChildren')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.has_elderly}
                onChange={(e) => setFormData(prev => ({ ...prev, has_elderly: e.target.checked }))}
                className="w-4 h-4 text-red-600 border-neutral-300 rounded focus:ring-red-600"
              />
              <span className="text-sm text-slate-900 dark:text-neutral-50">{tHelp('form.hasElderly')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.has_disabilities}
                onChange={(e) => setFormData(prev => ({ ...prev, has_disabilities: e.target.checked }))}
                className="w-4 h-4 text-red-600 border-neutral-300 rounded focus:ring-red-600"
              />
              <span className="text-sm text-slate-900 dark:text-neutral-50">{tHelp('form.hasDisabilities')}</span>
            </label>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
            <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {t('success')}
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium rounded-md transition-colors"
        >
          <Send className="w-4 h-4" />
          {isSubmitting ? t('submitting') : t('submit')}
        </button>
      </form>
    </div>
  )
}
