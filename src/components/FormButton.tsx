"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { MeshGradient } from "@paper-design/shaders-react"
import "./FormButton.css"

interface FormField {
  id: string
  name: string
  label: string
  type: 'text' | 'email' | 'url' | 'textarea' | 'select'
  placeholder?: string
  required?: boolean
  options?: string[] // For select type
}

interface FormButtonProps {
  buttonText?: string
  title: string
  description?: string
  fields: FormField[]
  onSubmit: (formData: Record<string, string>) => void | Promise<void>
  submitButtonText?: string
  className?: string
  disabled?: boolean
  icon?: React.ReactNode
}

export default function FormButton({
  buttonText,
  title,
  description,
  fields,
  onSubmit,
  submitButtonText = "Submit",
  className = "",
  disabled = false,
  icon
}: FormButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleExpand = () => {
    setIsExpanded(true)
  }

  const handleClose = () => {
    setIsExpanded(false)
    setFormData({})
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    try {
      await onSubmit(formData)
      handleClose()
    } catch (error) {
      console.error('Form submission error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (fieldId: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }))
  }

  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
  }, [isExpanded])

  return (
    <>
      <AnimatePresence initial={false}>
        {!isExpanded && (
          <motion.div className="inline-block relative">
            <motion.div
              style={{
                borderRadius: "12px",
              }}
              layout
              layoutId="form-card"
              className="absolute inset-0 bg-[#DC2626] items-center justify-center transform-gpu will-change-transform"
            ></motion.div>
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              exit={{ opacity: 1, scale: 1 }}
              layout={false}
              onClick={handleExpand}
              disabled={disabled}
              className={`nice-button ${disabled ? 'disabled' : ''} ${className}`}
            >
              {icon || buttonText}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <div className="fixed inset-0 z-50 flex items-center justify-center safe-area-inset-all">
            {/* Blur Background - Target only content area */}
            <div
              className="absolute inset-0 bg-black/20"
              onClick={handleClose}
            />
            
            
            <div
              className="relative flex max-h-[80vh] w-full max-w-[500px] overflow-hidden bg-[#004FE5] shadow-2xl z-10 modal-responsive form-modal"
            >
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none gradient-overlay"
              >
                <MeshGradient
                  speed={1}
                  colors={["#2452F1", "#022474", "#163DB9", "#0B1D99"]}
                  distortion={0.8}
                  swirl={0.1}
                  grainMixer={0}
                  grainOverlay={0}
                  className="inset-0 sticky top-0"
                  style={{ height: "100%", width: "100%" }}
                />
              </div>
              
              <div
                className="relative z-10 flex flex-col w-full max-h-[90vh]"
              >
                {/* Header */}
                <div className="flex items-center justify-between p-6 pb-4">
                  <div className="flex-1">
                    <h2 className="text-2xl font-semibold text-white leading-none tracking-[-0.03em]">
                      {title}
                    </h2>
                    {description && (
                      <p className="text-sm text-white/80 mt-2 leading-normal">
                        {description}
                      </p>
                    )}
                  </div>
                  
                  {/* Close Button */}
                  <button
                    onClick={handleClose}
                    className="flex h-8 w-8 items-center justify-center text-white/80 hover:text-white hover:bg-white/10  duration-200 rounded-lg"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Form Content */}
                <div className="flex-1 px-6 pb-6 overflow-y-auto">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {fields.map((field) => (
                      <div key={field.id}>
                        <label
                          htmlFor={field.id}
                          className="block text-[10px] font-mono font-normal text-white mb-2 tracking-[0.5px] uppercase"
                        >
                          {field.label} {field.required && "*"}
                        </label>
                        
                        {field.type === 'textarea' ? (
                          <textarea
                            id={field.id}
                            name={field.name}
                            rows={3}
                            placeholder={field.placeholder}
                            required={field.required}
                            value={formData[field.id] || ''}
                            onChange={(e) => handleInputChange(field.id, e.target.value)}
                            className="w-full px-4 py-3 rounded-lg bg-[#001F63]/80 border border-white/10 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all resize-none text-sm"
                          />
                        ) : field.type === 'select' ? (
                          <select
                            id={field.id}
                            name={field.name}
                            required={field.required}
                            value={formData[field.id] || ''}
                            onChange={(e) => handleInputChange(field.id, e.target.value)}
                            className="w-full px-4 py-2.5 rounded-lg bg-[#001F63]/80 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all appearance-none cursor-pointer text-sm h-10 select-arrow"
                          >
                            <option value="" className="bg-[#001F63]">Select an option</option>
                            {field.options?.map((option) => (
                              <option key={option} value={option} className="bg-[#001F63]">
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={field.type}
                            id={field.id}
                            name={field.name}
                            placeholder={field.placeholder}
                            required={field.required}
                            value={formData[field.id] || ''}
                            onChange={(e) => handleInputChange(field.id, e.target.value)}
                            className="w-full px-4 py-2.5 rounded-lg bg-[#001F63]/80 border border-white/10 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all text-sm h-10"
                          />
                        )}
                      </div>
                    ))}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full px-6 py-3 rounded-lg bg-white text-[#0041C1] font-medium hover:bg-white/90 transition-colors tracking-[-0.03em] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                    >
                      {isSubmitting ? 'Submitting...' : submitButtonText}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
