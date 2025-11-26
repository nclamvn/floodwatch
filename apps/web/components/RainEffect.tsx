'use client'

import { useEffect, useRef } from 'react'

interface RainDrop {
  x: number
  y: number
  length: number
  speed: number
  opacity: number
}

interface Splash {
  x: number
  y: number
  radius: number
  opacity: number
  maxRadius: number
}

export default function RainEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Rain drops configuration
    const drops: RainDrop[] = []
    const splashes: Splash[] = []
    const dropCount = Math.min(150, Math.floor(window.innerWidth / 8)) // Responsive drop count

    // Initialize drops
    for (let i = 0; i < dropCount; i++) {
      drops.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        length: Math.random() * 15 + 8,
        speed: Math.random() * 8 + 12,
        opacity: Math.random() * 0.4 + 0.2,
      })
    }

    // Check if dark mode
    const isDarkMode = () => {
      return document.documentElement.classList.contains('dark')
    }

    // Animation loop
    let animationId: number
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const dark = isDarkMode()

      // Draw rain drops
      drops.forEach((drop) => {
        ctx.beginPath()
        ctx.moveTo(drop.x, drop.y)
        ctx.lineTo(drop.x + 1, drop.y + drop.length)

        // Create gradient for raindrop
        const gradient = ctx.createLinearGradient(
          drop.x, drop.y,
          drop.x, drop.y + drop.length
        )

        if (dark) {
          // Dark mode - light gray/white rain
          gradient.addColorStop(0, `rgba(200, 200, 200, 0)`)
          gradient.addColorStop(0.5, `rgba(180, 180, 180, ${drop.opacity})`)
          gradient.addColorStop(1, `rgba(220, 220, 220, ${drop.opacity * 1.5})`)
        } else {
          // Light mode - dark gray/black rain
          gradient.addColorStop(0, `rgba(60, 60, 60, 0)`)
          gradient.addColorStop(0.4, `rgba(80, 80, 80, ${drop.opacity * 1.5})`)
          gradient.addColorStop(1, `rgba(100, 100, 100, ${drop.opacity * 2})`)
        }

        ctx.strokeStyle = gradient
        ctx.lineWidth = 1.5
        ctx.lineCap = 'round'
        ctx.stroke()

        // Update drop position
        drop.y += drop.speed
        drop.x += 0.5 // Slight wind effect

        // Reset drop when it goes off screen
        if (drop.y > canvas.height) {
          // Create splash effect
          if (Math.random() > 0.7) {
            splashes.push({
              x: drop.x,
              y: canvas.height - 5,
              radius: 1,
              opacity: 0.4,
              maxRadius: Math.random() * 8 + 4,
            })
          }

          drop.y = -drop.length
          drop.x = Math.random() * canvas.width
        }
      })

      // Draw and update splashes
      splashes.forEach((splash, index) => {
        ctx.beginPath()
        ctx.arc(splash.x, splash.y, splash.radius, 0, Math.PI * 2)

        if (dark) {
          ctx.strokeStyle = `rgba(180, 180, 180, ${splash.opacity})`
        } else {
          ctx.strokeStyle = `rgba(80, 80, 80, ${splash.opacity * 1.5})`
        }
        ctx.lineWidth = 1
        ctx.stroke()

        // Update splash
        splash.radius += 0.5
        splash.opacity -= 0.02

        // Remove splash when faded
        if (splash.opacity <= 0 || splash.radius >= splash.maxRadius) {
          splashes.splice(index, 1)
        }
      })

      animationId = requestAnimationFrame(animate)
    }

    animate()

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 5,
      }}
      aria-hidden="true"
    />
  )
}
