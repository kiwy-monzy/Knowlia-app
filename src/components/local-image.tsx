'use client'
// import Image from "next/image"
import React, { useState } from "react";
import { convertImage } from '@/lib/utils'

export function LocalImage({ onLoad, src, ...props }: { onLoad?: () => void, src: string, className?: string, style?: React.CSSProperties }) {
  const [localSrc, setLocalSrc] = useState<string>('')

  async function getAppDataDir() {
    if (src.toString().includes('http')) {
      setLocalSrc(src.toString())
    } else {
      const covertFileSrcPath = await convertImage(src as string)
      setLocalSrc(covertFileSrcPath)
    }
  }

  React.useEffect(() => {
    getAppDataDir()
  }, [src])

  // If localSrc exists
  return (
    localSrc ?
      <img onLoad={onLoad} src={localSrc} alt="" className={props.className} style={props.style} /> :
      null
  )
}
