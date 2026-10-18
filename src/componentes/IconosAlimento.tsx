// Los dibujos de los alimentos: vectoriales, planos y de pocos trazos, todos en una grilla de 24×24 con el mismo filo
// redondeado (currentColor, que IconoAlimento pone en Pino) y rellenos de la paleta de Nibble y de sus grupos. Se ven
// iguales en cualquier sistema (los emoji no) y se reconocen a 24 px. Cuál dibujo va con cada alimento lo decide
// lib/alimentos.
import type { ReactElement } from 'react'
import type { IconoAlimentoId } from '../lib/alimentos'

// Rellenos: la marca (verde, hoja, zapallo, crema) y los grupos (trigo, frambuesa, cielo), más pocos tonos de comida.
const C = {
  verde: '#3E9A68',
  hoja: '#A6DDB9',
  brote: '#7CC596',
  zapallo: '#F0A673',
  naranja: '#F29A4A',
  trigo: '#F2C063',
  trigoClaro: '#FBE3A6',
  dorado: '#E3A452',
  tostado: '#C98A55',
  chocolate: '#8A5638',
  rojo: '#E5675A',
  frambuesa: '#D9577F',
  rosa: '#F6B7C6',
  amarillo: '#F7D35C',
  cielo: '#9CCBE8',
  cieloClaro: '#DCEEF8',
  blanco: '#FFFFFF',
  crema: '#FFF6E2',
  violeta: '#8E6BB0',
  boniato: '#C2667C',
  papa: '#DDB178',
} as const

const SIN_FILO = { stroke: 'none' } as const

/** El cuenco de arroz, puré, fideos, cereal y sopa: siempre el mismo, cambia lo que lleva adentro. */
const cuenco = <path d="M3.5 12.5h17c0 4.6-3.6 8-8.5 8s-8.5-3.4-8.5-8Z" fill={C.cielo} />

/** Una fruta redonda con hoja (manzana, durazno). */
const redonda = (piel: string) => (
  <>
    <path d="M12 7.5c-1.6-1-5.4-1.4-6.9 1.5-1.9 3.6.3 9.6 3.5 11 1.4.6 2.3.2 3.4-.2 1.1.4 2 .8 3.4.2 3.2-1.4 5.4-7.4 3.5-11-1.5-2.9-5.3-2.5-6.9-1.5Z" fill={piel} />
    <path d="M12 7.5c0-1.6.4-3 1.4-4" fill="none" />
    <path d="M13.2 5.6c.9-1.8 2.9-2.4 4.6-2-.4 1.7-2.4 2.7-4.6 2Z" fill={C.verde} />
  </>
)

/** Un tubérculo (papa, boniato). */
const tuberculo = (piel: string) => (
  <>
    <path d="M4.6 15.6C3.2 12 7 6.6 12.4 5.1c4.6-1.3 8.1 1.1 7.1 4.5-1 3.6-5.8 8.4-10.5 9.1-2.3.4-3.7-.7-4.4-3.1Z" fill={piel} />
    <path d="M9 11.5h.01M13.5 9h.01M12.5 13.5h.01M16.5 10h.01" fill="none" strokeWidth="1.8" />
  </>
)

/** Una rodaja de fruta grande (sandía, melón). */
const rodaja = (cascara: string, pulpa: string, semilla: string) => (
  <>
    <path d="M3 8.5h18a9 9 0 0 1-18 0Z" fill={cascara} />
    <path d="M5.4 8.5h13.2a6.6 6.6 0 0 1-13.2 0Z" fill={pulpa} {...SIN_FILO} />
    <path d="M9 11h.01M12 13h.01M15 11h.01" fill="none" stroke={semilla} strokeWidth="1.8" />
  </>
)

/** Una fruta redonda con piel lisa (naranja, limón). */
const citrico = (piel: string, poro: string) => (
  <>
    <circle cx="12" cy="13" r="7.5" fill={piel} />
    <path d="M9 11h.01M14.5 15.5h.01M10.5 16.5h.01" fill="none" stroke={poro} strokeWidth="1.6" />
    <path d="M12 5.5c.5-1.8 2.3-2.8 4-2.3-.4 1.7-2.2 2.7-4 2.3Z" fill={C.verde} />
  </>
)

const pollo = (
  <>
    <path d="M10.8 13.2 6.6 17.4" strokeWidth="4.2" />
    <path d="M10.8 13.2 6.6 17.4" stroke={C.blanco} strokeWidth="1.8" />
    <circle cx="5.3" cy="17" r="1.7" fill={C.blanco} />
    <circle cx="7" cy="18.7" r="1.7" fill={C.blanco} />
    <path d="M9.6 14.4C6.6 11.4 8.2 4.6 13.6 4c5-.5 7.4 3.9 5.9 7.4-1.5 3.5-6.4 4.5-9.9 3Z" fill={C.dorado} />
  </>
)

const hojas = (
  <>
    <path d="M12 20.5C6 20.5 3.5 15 5 9.5c3.5 0 6 2 7 5 1-3 3.5-5 7-5 1.5 5.5-1 11-7 11Z" fill={C.brote} />
    <path d="M12 20.5c-3-2.5-3.5-9-0-15 3.5 6 3 12.5 0 15Z" fill={C.verde} />
    <path d="M12 9.5v9" fill="none" stroke={C.hoja} strokeWidth="1.2" />
  </>
)

const DIBUJOS: Record<IconoAlimentoId, ReactElement> = {
  // ── Platos y preparaciones
  empanada: (
    <>
      <path d="M3.5 17a8.5 8.5 0 0 1 17 0Z" fill={C.trigo} />
      <path d="M6 16.2a6 6 0 0 1 12 0" fill="none" stroke={C.dorado} strokeWidth="1.6" strokeDasharray="0.1 2.4" />
    </>
  ),
  pizza: (
    <>
      <path d="M12 21 4.6 7.6Q12 3.8 19.4 7.6Z" fill={C.amarillo} />
      <path d="M3.6 6.3Q12 1.8 20.4 6.3l-1 1.9Q12 4.3 4.6 8.2Z" fill={C.tostado} />
      <circle cx="10" cy="10.2" r="1.4" fill={C.rojo} />
      <circle cx="14.2" cy="10.8" r="1.4" fill={C.rojo} />
      <circle cx="12" cy="15" r="1.3" fill={C.rojo} />
    </>
  ),
  tarta: (
    <>
      <path d="M3.5 13.5 18 7.5l2.5 6Z" fill={C.amarillo} />
      <path d="M3.5 13.5h17v4.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1Z" fill={C.trigo} />
      <path d="M17.6 7.7c1 .2 2 1.2 2.6 2.3" fill="none" stroke={C.tostado} strokeWidth="2.4" />
      <path d="M8 16.3h.01M12 16.3h.01M16 16.3h.01" fill="none" stroke={C.dorado} strokeWidth="1.8" />
    </>
  ),
  sandwich: (
    <>
      <path d="M4 16 18.5 6.5 20 16Z" fill={C.trigoClaro} />
      <path d="M4 16h16v1.6c0 .8-.6 1.4-1.4 1.4H5.4C4.6 19 4 18.4 4 17.6Z" fill={C.tostado} />
      <path d="M4.5 14.5c2 .8 3-.8 5 0s3-.8 5 0 3-.8 5 0" fill="none" stroke={C.verde} strokeWidth="1.6" />
    </>
  ),
  hamburguesa: (
    <>
      <path d="M4 10.5C4 6.9 7.6 4.5 12 4.5s8 2.4 8 6Z" fill={C.trigo} />
      <path d="M4 12.5c1.3 1 2.7 1 4 0s2.7-1 4 0 2.7 1 4 0 2.7-1 4 0" fill="none" stroke={C.verde} strokeWidth="2" />
      <rect x="3.5" y="13.5" width="17" height="3" rx="1.5" fill={C.chocolate} />
      <path d="M4.5 17.5h15c0 1.7-1.3 3-3 3h-9c-1.7 0-3-1.3-3-3Z" fill={C.trigo} />
      <path d="M9 7.5h.01M12.5 6.8h.01M15 8.2h.01" fill="none" stroke={C.blanco} strokeWidth="1.6" />
    </>
  ),
  pancho: (
    <>
      <rect x="2.8" y="9.2" width="18.4" height="4.4" rx="2.2" fill={C.frambuesa} />
      <path d="M5.5 11.4c1-.9 2 .9 3 0s2 .9 3 0 2 .9 3 0 2 .9 3 0" fill="none" stroke={C.amarillo} strokeWidth="1.4" />
      <path d="M4 12.5h16c0 3.6-3.6 6-8 6s-8-2.4-8-6Z" fill={C.trigo} />
    </>
  ),
  sopa: (
    <>
      <path d="M8.5 9c-1-1.5 1-2.5 0-4M12 9c-1-1.5 1-2.5 0-4M15.5 9c-1-1.5 1-2.5 0-4" fill="none" stroke={C.cielo} strokeWidth="1.6" />
      <ellipse cx="12" cy="12.5" rx="8.5" ry="1.8" fill={C.zapallo} />
      {cuenco}
    </>
  ),
  panqueque: (
    <>
      <rect x="4" y="15.5" width="16" height="3.5" rx="1.75" fill={C.trigo} />
      <rect x="4.8" y="12" width="14.4" height="3.5" rx="1.75" fill={C.trigo} />
      <rect x="5.6" y="8.5" width="12.8" height="3.5" rx="1.75" fill={C.trigo} />
      <path d="M9 8.5c0-1.5 1.5-2.5 3-2.5s3 1 3 2.5v2" fill={C.chocolate} />
    </>
  ),
  nuggets: (
    <>
      <path d="M8 4.5c2.8-.6 5.5 1 5.7 3.5.2 2.4-1.6 4-4.3 4.2S4.6 11 4.5 8.5C4.4 6.5 5.8 5 8 4.5Z" fill={C.trigo} />
      <path d="M15.5 8.5c2.8-.3 4.8 1.6 4.7 4-.1 2.5-2.3 3.9-4.9 3.8s-4.1-1.9-3.9-4c.2-2 1.7-3.6 4.1-3.8Z" fill={C.dorado} />
      <path d="M8.5 13c2.6-.2 4.6 1.4 4.5 3.7-.1 2.4-2.1 3.8-4.6 3.8S4 19.2 4.1 16.9c.1-2 1.9-3.7 4.4-3.9Z" fill={C.trigo} />
      <path d="M8 7.8h.01M15.5 12.2h.01M8.5 16.8h.01" fill="none" stroke={C.tostado} strokeWidth="1.8" />
    </>
  ),
  milanesa: (
    <>
      <path d="M3.8 13.2c-.3-4 3.6-7.3 8.8-7.6 4.6-.3 7.8 1.7 7.6 5-.1 2.2-1.6 3.4-2.7 4.6-1.6 1.7-3.4 3.4-7 3.4-3.6 0-6.4-1.9-6.7-5.4Z" fill={C.dorado} />
      <path d="M8.5 11h.01M11.5 9h.01M15.8 14.4h.01M11 14.6h.01M7.5 15h.01" fill="none" stroke={C.tostado} strokeWidth="1.9" />
      <circle cx="15.6" cy="9.8" r="2.8" fill={C.amarillo} />
      <path d="M15.6 7.6v4.4M13.4 9.8h4.4" fill="none" stroke={C.blanco} strokeWidth="1" />
    </>
  ),

  // ── Proteínas
  pollo,
  carne: (
    <>
      <path d="M3.8 12.3c0-4.2 3.6-7.3 8.3-7.3 4.4 0 8.1 2.1 8.1 5.8 0 2.4-2 3.4-3.4 4.6-1.6 1.4-2.4 4.1-6.3 4.1-4 0-6.7-3-6.7-7.2Z" fill={C.frambuesa} />
      <circle cx="9.3" cy="11.3" r="2.1" fill={C.crema} />
      <path d="M13.5 8.4c1.6.5 2.8 1.6 3.3 3.1" fill="none" stroke={C.rosa} strokeWidth="1.4" />
    </>
  ),
  pescado: (
    <>
      <path d="M15 9 20.3 5.8v12.4L15 15Z" fill={C.zapallo} />
      <path d="M3.4 12C5.8 7.5 11.4 5.8 16 9.4v5.2C11.4 18.2 5.8 16.5 3.4 12Z" fill={C.cielo} />
      <path d="M8 11h.01" fill="none" strokeWidth="2.2" />
      <path d="M10.8 9.5c.8 1.6.8 3.4 0 5" fill="none" />
    </>
  ),
  huevo: (
    <>
      <path d="M4.6 11C4.4 6.6 8.6 4 12.4 5c2.4.6 3.6 2.5 5.5 3.8 2.3 1.6 2.6 5.8-.2 8.4-2.5 2.3-6.2 3-9.4 2-2.4-.8-3.6-3.6-3.7-8.2Z" fill={C.blanco} />
      <circle cx="11.8" cy="12.3" r="3.3" fill={C.amarillo} />
      <path d="M10.4 11.2a1.8 1.8 0 0 1 1.3-.9" fill="none" stroke={C.blanco} strokeWidth="1.2" />
    </>
  ),

  // ── Cereales, panes y papas
  bastones: (
    <>
      <rect x="6.4" y="4.2" width="2.6" height="10" rx="1.3" fill={C.amarillo} />
      <rect x="9.6" y="2.8" width="2.6" height="10" rx="1.3" fill={C.amarillo} />
      <rect x="12.8" y="3.6" width="2.6" height="10" rx="1.3" fill={C.amarillo} />
      <rect x="15.4" y="5.2" width="2.6" height="9" rx="1.3" fill={C.amarillo} />
      <path d="M5 10.5h14l-1.5 9.4a1.3 1.3 0 0 1-1.3 1.1H7.8a1.3 1.3 0 0 1-1.3-1.1Z" fill={C.rojo} />
      <path d="M9.6 14.2c1.5 1 3.3 1 4.8 0" fill="none" stroke={C.blanco} strokeWidth="1.3" />
    </>
  ),
  pure: (
    <>
      <path d="M5 12.5c0-2.4 1.4-3.9 3-4.3.8-1.8 2.3-2.7 4-2.7s3.2.9 4 2.7c1.6.4 3 1.9 3 4.3Z" fill={C.trigoClaro} />
      <path d="M9.4 9.4c1.6-1.2 3.6-1.2 5.2 0" fill="none" />
      <rect x="10.6" y="5.6" width="3" height="2.4" rx=".6" fill={C.amarillo} />
      {cuenco}
    </>
  ),
  boniato: tuberculo(C.boniato),
  papa: tuberculo(C.papa),
  arroz: (
    <>
      <path d="M5 12.5c0-3.5 3.2-6 7-6s7 2.5 7 6Z" fill={C.blanco} />
      <path d="M8.6 10.3l.9-.5M12 8.8l.9.2M14.8 10.6l.9-.4M11 11.6l.9.1" fill="none" strokeWidth="1.2" />
      {cuenco}
    </>
  ),
  fideos: (
    <>
      <path d="M5 12.5c0-3.5 3.2-6 7-6s7 2.5 7 6Z" fill={C.amarillo} />
      <path d="M7 11.2c1-1.4 2-1.4 3 0s2 1.4 3 0 2-1.4 3 0M8.6 8.8c.9-1.1 1.8-1.1 2.7 0s1.8 1.1 2.7 0" fill="none" stroke={C.dorado} strokeWidth="1.3" />
      {cuenco}
    </>
  ),
  galletita: (
    <>
      <circle cx="12" cy="12" r="8" fill={C.trigo} />
      <path d="M9 8.6h.01M14.6 9.4h.01M8.6 13.6h.01M12.4 12.6h.01M15.4 15h.01M11 16.4h.01" fill="none" stroke={C.chocolate} strokeWidth="2.2" />
    </>
  ),
  medialuna: (
    <>
      <path d="M3.5 15c0-5 3.8-9 8.5-9s8.5 4 8.5 9c-1.2.9-2.6 1-3.8.3C16 12.6 14.2 11 12 11s-4 1.6-4.7 4.3c-1.2.7-2.6.6-3.8-.3Z" fill={C.dorado} />
      <path d="M8.2 7.2 9.6 11.6M12 6v5M15.8 7.2l-1.4 4.4" fill="none" />
    </>
  ),
  torta: (
    <>
      <path d="M5.5 12h13l-1.5 7.6a1.2 1.2 0 0 1-1.2 1H8.2a1.2 1.2 0 0 1-1.2-1Z" fill={C.zapallo} />
      <path d="M10 12.5l.6 7.6M14 12.5l-.6 7.6" fill="none" />
      <path d="M4.8 12c-.8-2.6 1.4-4.6 3.6-4 .8-2 2-3 3.6-3s2.8 1 3.6 3c2.2-.6 4.4 1.4 3.6 4Z" fill={C.rosa} />
      <circle cx="12" cy="4.3" r="1.4" fill={C.rojo} />
    </>
  ),
  pan: (
    <>
      <path d="M6 20v-8C3.4 11 3.8 5 8 5h8c4.2 0 4.6 6 2 7v8Z" fill={C.tostado} />
      <path d="M8 18.4v-7.6c-1.5-.7-1.4-4.2.8-4.2h6.4c2.2 0 2.3 3.5.8 4.2v7.6Z" fill={C.trigoClaro} {...SIN_FILO} />
    </>
  ),
  cereal: (
    <>
      <path d="M4.5 12.5c0-1.8 3.4-3.2 7.5-3.2s7.5 1.4 7.5 3.2Z" fill={C.blanco} />
      <circle cx="8" cy="10.6" r="1.8" fill={C.trigo} />
      <circle cx="12.2" cy="9.6" r="1.8" fill={C.trigo} />
      <circle cx="16.2" cy="10.8" r="1.8" fill={C.trigo} />
      <path d="M8 10.6h.01M12.2 9.6h.01M16.2 10.8h.01" fill="none" strokeWidth="1.4" />
      {cuenco}
    </>
  ),

  // ── Lácteos y dulces
  frasco: (
    <>
      <rect x="6.5" y="3.5" width="11" height="3.5" rx="1" fill={C.verde} />
      <path d="M6 7h12v11.5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 18.5Z" fill={C.tostado} />
      <rect x="8.5" y="11" width="7" height="5" rx="1" fill={C.crema} />
    </>
  ),
  licuado: (
    <>
      <path d="M13 9 15.6 2.6H18" fill="none" />
      <path d="M6.8 6.5h10.4l-1.3 12.8a2 2 0 0 1-2 1.7h-3.8a2 2 0 0 1-2-1.7Z" fill={C.rosa} />
      <path d="M6.8 6.5h10.4" fill="none" strokeWidth="2.4" />
      <circle cx="10" cy="11.5" r="1" fill={C.frambuesa} {...SIN_FILO} />
      <circle cx="13.6" cy="14.6" r="1" fill={C.frambuesa} {...SIN_FILO} />
    </>
  ),
  leche: (
    <>
      <path d="M6.5 4h11l-1.4 15.2a2 2 0 0 1-2 1.8H9.9a2 2 0 0 1-2-1.8Z" fill={C.blanco} />
      <path d="M7.1 4.8h9.8l-.4 4.2H7.5Z" fill={C.cieloClaro} {...SIN_FILO} />
      <path d="M7.5 9h9M6.5 4h11l-1.4 15.2a2 2 0 0 1-2 1.8H9.9a2 2 0 0 1-2-1.8Z" fill="none" />
    </>
  ),
  yogur: (
    <>
      <path d="M6.2 8h11.6l-1.2 11.2a2 2 0 0 1-2 1.8H9.4a2 2 0 0 1-2-1.8Z" fill={C.blanco} />
      <rect x="5" y="5" width="14" height="3.2" rx="1.2" fill={C.cielo} />
      <circle cx="12" cy="14.4" r="2.3" fill={C.rosa} />
    </>
  ),
  queso: (
    <>
      <path d="M3.5 10 15 4.5l5.5 5.5Z" fill={C.trigoClaro} />
      <path d="M3.5 10h17v8.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1Z" fill={C.amarillo} />
      <circle cx="8" cy="14" r="1.6" fill={C.dorado} {...SIN_FILO} />
      <circle cx="14.4" cy="16.2" r="1.2" fill={C.dorado} {...SIN_FILO} />
      <circle cx="16.8" cy="12.6" r=".9" fill={C.dorado} {...SIN_FILO} />
      <circle cx="11.6" cy="8" r=".9" fill={C.dorado} {...SIN_FILO} />
    </>
  ),
  manteca: (
    <>
      <ellipse cx="12" cy="16.5" rx="9" ry="3.5" fill={C.cieloClaro} />
      <path d="M6 9.5 10 6.5h8l-2 3Z" fill={C.trigoClaro} />
      <path d="M6 9.5h10v5.5H6Z" fill={C.amarillo} />
      <path d="M16 9.5l2-3V12l-2 3Z" fill={C.trigo} />
    </>
  ),
  helado: (
    <>
      <path d="M7.5 11 12 21.5 16.5 11Z" fill={C.trigo} />
      <path d="M9.4 13.5l4.6 3M14.6 13.5 10 16.5" fill="none" stroke={C.dorado} strokeWidth="1.2" />
      <path d="M6.6 11.2c-1-3 1-6.7 5.4-6.7s6.4 3.7 5.4 6.7Z" fill={C.rosa} />
    </>
  ),
  chocolate: (
    <>
      <rect x="6" y="3.5" width="12" height="17" rx="1.6" fill={C.chocolate} />
      <path d="M6 9.2h12M6 14.8h12M12 3.5v17" fill="none" />
      <path d="M6 13 18 9.5V20.5H6Z" fill={C.verde} />
    </>
  ),

  // ── Frutas
  manzana: redonda(C.rojo),
  banana: (
    <>
      <path d="M5 8.2c0 7 5.2 12.2 13.2 11 1.3-.2 1.3-1.7 0-1.9-5.8-.9-9.6-4.4-10.2-9.6-.2-1.6-3-1.4-3 .5Z" fill={C.amarillo} />
      <path d="M6.4 7 6 4.6" fill="none" strokeWidth="2.2" />
    </>
  ),
  pera: (
    <>
      <path d="M12 6c-2 0-2.8 2-3.2 4-.3 1.4-3.3 3-3.3 6 0 3 2.8 4.8 6.5 4.8s6.5-1.8 6.5-4.8c0-3-3-4.6-3.3-6C14.8 8 14 6 12 6Z" fill={C.brote} />
      <path d="M12 6c0-1.3.3-2.3 1-3" fill="none" />
    </>
  ),
  naranja: citrico(C.naranja, '#D97F35'),
  limon: citrico(C.amarillo, '#D9B43A'),
  frutilla: (
    <>
      <path d="M5 9.5C5 7.9 6.6 7 8.3 7h7.4C17.4 7 19 7.9 19 9.5c0 4.5-4 11-7 11s-7-6.5-7-11Z" fill={C.rojo} />
      <path d="M9 11h.01M12 12.5h.01M15 11h.01M10.4 15.6h.01M13.6 15.6h.01" fill="none" stroke={C.trigoClaro} strokeWidth="1.6" />
      <path d="M7.4 7.6 9.4 4.4 12 6.4l2.6-2 2 3.2Z" fill={C.verde} />
    </>
  ),
  uva: (
    <>
      <circle cx="9" cy="8.5" r="2.4" fill={C.violeta} />
      <circle cx="14" cy="8.5" r="2.4" fill={C.violeta} />
      <circle cx="11.5" cy="12.6" r="2.4" fill={C.violeta} />
      <circle cx="16.4" cy="12.6" r="2.4" fill={C.violeta} />
      <circle cx="7" cy="12.6" r="2.4" fill={C.violeta} />
      <circle cx="9.3" cy="16.8" r="2.4" fill={C.violeta} />
      <circle cx="14" cy="16.8" r="2.4" fill={C.violeta} />
      <path d="M11.5 6V3" fill="none" />
    </>
  ),
  durazno: redonda(C.zapallo),
  kiwi: (
    <>
      <circle cx="12" cy="12" r="8" fill={C.tostado} />
      <circle cx="12" cy="12" r="6" fill={C.brote} {...SIN_FILO} />
      <circle cx="12" cy="12" r="2" fill={C.trigoClaro} {...SIN_FILO} />
      <path d="M12 7.6h.01M15.1 8.9h.01M16.4 12h.01M15.1 15.1h.01M12 16.4h.01M8.9 15.1h.01M7.6 12h.01M8.9 8.9h.01" fill="none" strokeWidth="1.5" />
    </>
  ),
  sandia: rodaja(C.verde, C.rojo, '#2F5C4B'),
  melon: rodaja(C.brote, C.zapallo, C.crema),
  anana: (
    <>
      <path d="M12 9 9 3.5l3 2 3-2Z" fill={C.verde} />
      <ellipse cx="12" cy="14.5" rx="5.5" ry="6.5" fill={C.trigo} />
      <path d="M8.5 11.5l7 6M8 15.5l5 4.2M10 9.2l7 6M15.5 11.5l-7 6M16 15.5l-5 4.2M14 9.2l-7 6" fill="none" stroke={C.dorado} strokeWidth="1.1" />
    </>
  ),
  palta: (
    <>
      <path d="M12 3.5c-2.4 0-3.5 2.4-4.2 5-.5 1.8-3.3 3.6-3.3 7 0 3.4 3.3 5 7.5 5s7.5-1.6 7.5-5c0-3.4-2.8-5.2-3.3-7-.7-2.6-1.8-5-4.2-5Z" fill={C.verde} />
      <path d="M12 6c-1.6 0-2.3 1.8-2.8 3.6-.4 1.5-2.7 3-2.7 5.8 0 2.6 2.6 3.6 5.5 3.6s5.5-1 5.5-3.6c0-2.8-2.3-4.3-2.7-5.8C14.3 7.8 13.6 6 12 6Z" fill={C.trigoClaro} {...SIN_FILO} />
      <circle cx="12" cy="14.6" r="2.6" fill={C.tostado} />
    </>
  ),

  // ── Verduras y legumbres
  zanahoria: (
    <>
      <path d="M15.4 8.6C15 6 16 4 17.4 3.4M15.4 8.6c2.6-.4 4.6.6 5.1 2.1M15.4 8.6l3.6-3.6" fill="none" stroke={C.verde} strokeWidth="2" />
      <path d="M5 19.5c-.7-.7 2-6.5 5.5-10 1.6-1.6 3.6-1.6 4.8-.4s1.2 3.2-.4 4.8C11.4 17.4 5.7 20.2 5 19.5Z" fill={C.naranja} />
      <path d="M8.6 14l1.4 1M11 11.4l1.4 1" fill="none" />
    </>
  ),
  zapallo: (
    <>
      <path d="M12 7.6c0-1.6.3-2.8 1.4-3.8" fill="none" stroke={C.verde} strokeWidth="2" />
      <path d="M12 7.5c-1.2-.8-3.2-1.1-5 0-3 1.8-3.3 9.2 0 11.6 1.6 1.2 3.5 1.2 5 .4 1.5.8 3.4.8 5-.4 3.3-2.4 3-9.8 0-11.6-1.8-1.1-3.8-.8-5 0Z" fill={C.zapallo} />
      <path d="M12 7.5c-2 2.5-2 9.5 0 12M12 7.5c2 2.5 2 9.5 0 12" fill="none" />
    </>
  ),
  tomate: (
    <>
      <circle cx="12" cy="13" r="7.5" fill={C.rojo} />
      <path d="M8.5 6.8 12 8.4l3.5-1.6-1.8 2.8L12 8.4l-1.7 1.2Z" fill={C.verde} />
      <path d="M12 8.4V5" fill="none" />
      <path d="M8 12a4 4 0 0 1 2-2.5" fill="none" stroke={C.blanco} strokeWidth="1.3" />
    </>
  ),
  brocoli: (
    <>
      <path d="M10 13.5h4l.8 7H9.2Z" fill={C.hoja} />
      <path d="M7 14a3.2 3.2 0 0 1 .4-6.3 4 4 0 0 1 7.6-1.4 3.2 3.2 0 0 1 3.6 4.7A3 3 0 0 1 17 14Z" fill={C.verde} />
    </>
  ),
  hojas,
  choclo: (
    <>
      <path d="M12 3.5c2.6 0 4 3 4 8 0 4.3-1.6 7.5-4 7.5s-4-3.2-4-7.5c0-5 1.4-8 4-8Z" fill={C.amarillo} />
      <path d="M8.3 8.5h7.4M8 12h8M8.4 15.5h7.2M12 3.5V19" fill="none" stroke={C.dorado} strokeWidth="1" />
      <path d="M12 21c-3.4 0-6.2-3.6-6.6-8.6 2.2 1.6 3.8 4.4 4.6 7M12 21c3.4 0 6.2-3.6 6.6-8.6-2.2 1.6-3.8 4.4-4.6 7Z" fill={C.verde} />
    </>
  ),
  arvejas: (
    <>
      <circle cx="7.6" cy="12.4" r="2.1" fill={C.brote} />
      <circle cx="11.6" cy="12" r="2.1" fill={C.brote} />
      <circle cx="15.5" cy="10.6" r="2.1" fill={C.brote} />
      <path d="M3 12.8c3 6.2 13.2 7 18-4.3-5 4.6-13 5.8-18 4.3Z" fill={C.verde} />
    </>
  ),
  legumbres: (
    <>
      <ellipse cx="8.5" cy="9.5" rx="3.8" ry="2.6" transform="rotate(-25 8.5 9.5)" fill={C.tostado} />
      <ellipse cx="15.5" cy="10.5" rx="3.8" ry="2.6" transform="rotate(20 15.5 10.5)" fill={C.frambuesa} />
      <ellipse cx="11.5" cy="16" rx="3.8" ry="2.6" transform="rotate(-8 11.5 16)" fill={C.dorado} />
      <path d="M7.2 9.4c.8.4 1.8.4 2.6-.2M14.4 10.6c.8.1 1.6-.1 2.3-.6M10.2 16.1c.9.2 1.8.1 2.6-.4" fill="none" stroke={C.crema} strokeWidth="1.2" />
    </>
  ),
  pepino: (
    <>
      <rect x="2.8" y="9" width="18.4" height="6" rx="3" transform="rotate(-35 12 12)" fill={C.verde} />
      <path d="M8.5 15.2h.01M11.8 12.6h.01M15 10.3h.01" fill="none" stroke={C.hoja} strokeWidth="1.8" />
    </>
  ),
  morron: (
    <>
      <path d="M12 7.6V5.2c0-.9.6-1.7 1.6-1.7" fill="none" stroke={C.verde} strokeWidth="2" />
      <path d="M6 9.5c0-2 1.6-3 3.2-2.6.9.2 1.8.6 2.8.6s1.9-.4 2.8-.6C16.4 6.5 18 7.5 18 9.5c0 5-1.5 11-4 11-.9 0-1.3-.6-2-.6s-1.1.6-2 .6c-2.5 0-4-6-4-11Z" fill={C.rojo} />
      <path d="M12 8.6v10" fill="none" />
    </>
  ),
  cebolla: (
    <>
      <path d="M12 3.5c.4 2.4 2 3.4 4 4.8 2.3 1.6 3.5 3.6 3.5 6.2 0 3.6-3.4 6-7.5 6s-7.5-2.4-7.5-6c0-2.6 1.2-4.6 3.5-6.2 2-1.4 3.6-2.4 4-4.8Z" fill={C.trigoClaro} />
      <path d="M12 8.5c-2.2 2-2.2 9.5 0 12M12 8.5c2.2 2 2.2 9.5 0 12" fill="none" stroke={C.dorado} strokeWidth="1.2" />
    </>
  ),

  // ── Otros
  jugo: (
    <>
      <path d="M14.5 6V3.6l2.6-1.2" fill="none" />
      <rect x="6.5" y="6" width="11" height="15" rx="1.6" fill={C.naranja} />
      <circle cx="12" cy="14" r="3" fill={C.crema} />
      <path d="M12 12.6v2.8M10.6 14h2.8" fill="none" stroke={C.naranja} strokeWidth="1.2" />
    </>
  ),
  mani: (
    <>
      <path d="M9 4.5c2.6 0 4 2 3.8 4.2-.1 1 .3 1.8 1.4 2.4 2.6 1.4 3.4 4 2.2 6.4-1.3 2.6-4.4 3.4-6.8 2-1.6-.9-2.3-2.4-2.4-3.8 0-1-.4-1.7-1.3-2.3C3.3 11.6 4 4.5 9 4.5Z" fill={C.trigo} />
      <path d="M8 7.8h.01M10 10h.01M12.6 14.4h.01M14.4 16.4h.01" fill="none" stroke={C.dorado} strokeWidth="1.6" />
    </>
  ),
  pochoclo: (
    <>
      <circle cx="8.5" cy="7.6" r="2.4" fill={C.crema} />
      <circle cx="12" cy="6" r="2.4" fill={C.crema} />
      <circle cx="15.5" cy="7.6" r="2.4" fill={C.crema} />
      <path d="M5.5 9.5h13l-1.6 10.4a1.3 1.3 0 0 1-1.3 1.1H8.4a1.3 1.3 0 0 1-1.3-1.1Z" fill={C.blanco} />
      <path d="M9.6 9.8l.6 11M14.4 9.8l-.6 11" fill="none" stroke={C.rojo} strokeWidth="2" />
    </>
  ),
  agua: (
    <>
      <path d="M12 3.5c2.8 4 6 7.5 6 10.9a6 6 0 0 1-12 0C6 11 9.2 7.5 12 3.5Z" fill={C.cielo} />
      <path d="M9.2 14.4a2.8 2.8 0 0 0 2 2.6" fill="none" stroke={C.blanco} strokeWidth="1.4" />
    </>
  ),

  // ── Uno por grupo
  grupo_cereal: (
    <>
      <path d="M12 21V8" fill="none" />
      {[10, 14, 18].map((y) => (
        <g key={y} fill={C.trigo}>
          <path d={`M12 ${y}c-2.6-.4-3.8-2.4-3.8-4.6 2.6.4 3.8 2.4 3.8 4.6Z`} />
          <path d={`M12 ${y}c2.6-.4 3.8-2.4 3.8-4.6-2.6.4-3.8 2.4-3.8 4.6Z`} />
        </g>
      ))}
      <ellipse cx="12" cy="4.6" rx="1.7" ry="2.4" fill={C.trigo} />
    </>
  ),
  grupo_proteina: pollo,
  grupo_verdura: hojas,
  grupo_fruta: (
    <>
      <path d="M8 14.5c.5-4.5 2.5-8 7-10.5M16 14.5c-.5-4-.5-7.5-1-10.5" fill="none" />
      <path d="M15 4c2-1 4.2-.6 5 .8-1.8 1.2-3.8 1.2-5-.8Z" fill={C.verde} />
      <circle cx="7.6" cy="16.4" r="3.4" fill={C.frambuesa} />
      <circle cx="16.2" cy="16.4" r="3.4" fill={C.frambuesa} />
    </>
  ),
  grupo_lacteo: (
    <>
      <path d="M9.5 3.5h5V7l2.5 3.5v8.5a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-8.5L9.5 7Z" fill={C.blanco} />
      <path d="M9.5 3.5h5V6h-5Z" fill={C.cielo} />
      <path d="M7 13h10v4H7Z" fill={C.cieloClaro} />
    </>
  ),
  plato: (
    <>
      <circle cx="12" cy="12.5" r="5.4" fill={C.blanco} />
      <circle cx="12" cy="12.5" r="3" fill="none" stroke={C.hoja} strokeWidth="1.3" />
      <path d="M2.8 4.5v3.8a1.5 1.5 0 0 0 3 0V4.5M4.3 4.5v16M21.2 4.5c-1.6.4-2.4 2.6-2.4 5.4V13h2.4m0-8.5v16" fill="none" />
    </>
  ),
}

/** El dibujo de un alimento: llena el lugar que le dan (IconoAlimento lo centra en su círculo). Decorativo. */
export function DibujoAlimento({ id, className }: { id: IconoAlimentoId; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {DIBUJOS[id]}
    </svg>
  )
}
