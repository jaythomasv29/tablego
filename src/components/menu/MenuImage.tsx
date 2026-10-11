'use client';
import Image from 'next/image';
import { useState } from 'react';
const placeholder = '/images/menu-placeholder.svg';
export default function MenuImage({ src, name, className = '', sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw' }: { src?: string; name: string; className?: string; sizes?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const safe = src && (/^\/(?!\/)/.test(src) || /^https:\/\//.test(src));
  const image = safe && failed !== src ? src : placeholder;
  // Existing staff-entered HTTPS image hosts remain browser-only. Only the
  // explicitly configured Firebase hosts use server image optimization.
  const optimized = image.startsWith('/') || /^https:\/\/(firebasestorage|storage)\.googleapis\.com\//.test(image);
  return <div className={`relative overflow-hidden ${className}`}><Image src={image} alt={name} fill sizes={sizes} unoptimized={!optimized} className="object-cover" onError={() => setFailed(src || '')} /></div>;
}
