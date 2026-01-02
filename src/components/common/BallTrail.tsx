"use client"

import { useEffect, useRef } from "react"

export default function BallTrail() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const numBalls = 15
    const balls: { element: HTMLDivElement; x: number; y: number; scale: number }[] = []

    // Create balls
    for (let i = 0; i < numBalls; i++) {
      const ball = document.createElement("div")
      ball.classList.add("ball")
      container.appendChild(ball)
      balls.push({ element: ball, x: 0, y: 0, scale: 1 })
    }

    let mouseX = window.innerWidth / 2
    let mouseY = window.innerHeight / 2

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }

    document.addEventListener("mousemove", handleMouseMove)

    function animate() {
      let prevX = mouseX
      let prevY = mouseY

      balls.forEach((ball, index) => {
        const dx = prevX - ball.x
        const dy = prevY - ball.y

        ball.x += dx * 0.2
        ball.y += dy * 0.2

        const distance = Math.sqrt(dx * dx + dy * dy)
        ball.scale = Math.max(0.2, 1 - distance / 150)

        ball.element.style.transform = `translate(${ball.x}px, ${ball.y}px) scale(${ball.scale})`
        const opacity = Math.max(0.2, 1 - (index / numBalls) * 1.2)
        ball.element.style.opacity = `${opacity}`

        prevX = ball.x
        prevY = ball.y
      })

      requestAnimationFrame(animate)
    }

    animate()

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      balls.forEach((ball) => ball.element.remove())
    }
  }, [])

  return (
    <div ref={containerRef} className="fixed inset-0 pointer-events-none z-[9999]">
      <style>{`
        .ball {
          position: fixed;
          width: 16px;
          height: 16px;
          background-color: #f44336;
          box-shadow: 0 0 15px rgba(172, 109, 8, 0.8);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          transition: opacity 0.1s ease;
          mix-blend-mode: screen;
          z-index: 9999;
        }
      `}</style>
    </div>
  )
} 