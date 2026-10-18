// Paso "ítems" (C2): la foto con las cajas de la visión y la lista para corregir (nombre, porción, sacar).
// Cada alimento se reconoce por su IconoAlimento y el color de su grupo, en la foto y en la lista.
import { cn } from 'cn'
import { Pencil, Undo2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useId, useState } from 'react'
import { PORCION, type Caja, type Grupo, type ItemDetectado, type Porcion } from '../../../shared/contratos'
import { IconoAlimento } from '../../componentes/IconoAlimento'
import { Button } from '../../componentes/ui/button'
import { Input } from '../../componentes/ui/input'
import { COLOR_GRUPO } from '../../lib/colores'
import { NOMBRE_PORCION } from '../../lib/vocabulario'
import type { ItemEdit } from './modelo'
import { MarcoFoto, RESORTE } from './Piezas'

function cajaValida(c: Caja | null): c is Caja {
  return !!c && c.length === 4 && c.every((v) => Number.isFinite(v)) && c[2] > c[0] && c[3] > c[1]
}

/** Foto con cajas [ymin, xmin, ymax, xmax] de 0 a 1000 como capas en %. Si no hay caja, solo etiquetas debajo. */
export function FotoConCajas({ src, items, original }: { src: string; items: ItemEdit[]; original: ItemDetectado[] }) {
  const porId = new Map(original.map((o) => [o.idTmp, o]))
  const vivos = items
    .filter((it) => !it.borrado)
    .map((it) => ({ it, caja: porId.get(it.idTmp)?.caja ?? null, grupo: porId.get(it.idTmp)?.atributos.grupo }))
  const conCaja = vivos.filter((x) => cajaValida(x.caja))
  const sinCaja = vivos.filter((x) => !cajaValida(x.caja))
  return (
    <figure className="m-0 flex flex-col gap-3">
      <MarcoFoto src={src} alt="Foto del plato">
        {/* Las cajas aparecen una por una (es la lectura de la foto); al sacar un alimento, su caja se va. */}
        <AnimatePresence>
          {conCaja.map(({ it, caja: c, grupo }, i) => cajaValida(c) && (
            <motion.div
              key={it.idTmp}
              aria-hidden="true"
              className="pointer-events-none absolute rounded-xl border-[3px] ring-2 ring-white/75"
              style={{
                top: `${c[0] / 10}%`, left: `${c[1] / 10}%`,
                height: `${(c[2] - c[0]) / 10}%`, width: `${(c[3] - c[1]) / 10}%`,
                borderColor: grupo ? COLOR_GRUPO[grupo].color : 'var(--nb-verde)',
              }}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1, transition: { ...RESORTE, delay: 0.25 + i * 0.16 } }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
            >
              <span className="absolute top-1.5 left-1.5 flex max-w-[calc(100%-0.75rem)] items-center gap-1.5 rounded-full bg-background py-0.5 pr-2.5 pl-0.5 text-xs font-bold text-pino">
                <IconoAlimento nombre={it.preparacion} grupo={grupo} className="size-6 text-sm" />
                <span className="truncate first-letter:uppercase">{it.preparacion}</span>
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </MarcoFoto>
      {sinCaja.length > 0 && (
        <figcaption className="flex flex-wrap justify-center gap-2" aria-hidden="true">
          {sinCaja.map(({ it, grupo }) => (
            <span key={it.idTmp} className="flex items-center gap-1.5 rounded-full border bg-background py-0.5 pr-3 pl-0.5 text-sm font-bold text-pino">
              <IconoAlimento nombre={it.preparacion} grupo={grupo} className="size-7 text-base" />
              <span className="first-letter:uppercase">{it.preparacion}</span>
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  )
}

interface FilaProps {
  item: ItemEdit
  n: number
  grupo?: Grupo
  dudoso: boolean
  alCambiar: (cambio: Partial<ItemEdit>) => void
}

/** Porción servida: tres opciones con un bocado que crece; la elegida lleva el color del grupo del alimento. */
function Porciones({ item, n, grupo, alCambiar }: Omit<FilaProps, 'dudoso'>) {
  const id = useId()
  const color = grupo ? COLOR_GRUPO[grupo] : { color: 'var(--nb-verde)', claro: 'var(--nb-brote)' }
  return (
    <fieldset className="flex min-w-0 flex-col">
      <legend className="mb-2 text-sm text-musgo">
        Porción servida<span className="sr-only"> del alimento {n}</span>
      </legend>
      <div className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
        {PORCION.map((p: Porcion, k) => {
          const activa = item.porcion === p
          return (
            <label
              key={p}
              className="relative flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full select-none has-focus-visible:outline-3 has-focus-visible:outline-verde"
            >
              <input
                type="radio"
                className="sr-only"
                name={`${id}-porcion`}
                value={p}
                checked={activa}
                onChange={() => alCambiar({ porcion: p })}
              />
              {activa && (
                <motion.span
                  layoutId={`${id}-pastilla`}
                  className="absolute inset-0 rounded-full border"
                  style={{ background: color.claro, borderColor: color.color }}
                  transition={RESORTE}
                />
              )}
              <span
                aria-hidden="true"
                className="relative shrink-0 rounded-full"
                style={{ width: 6 + k * 3, height: 6 + k * 3, background: color.color }}
              />
              <span className={cn('relative', activa ? 'text-pino' : 'text-musgo')}>{NOMBRE_PORCION[p]}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function FilaItem({ item, n, grupo, dudoso, alCambiar }: FilaProps) {
  const id = useId()
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(item.preparacion)

  if (item.borrado) {
    return (
      <motion.li layout="position" className="flex items-center gap-3 bg-muted px-4 py-2 first:rounded-t-2xl last:rounded-b-2xl">
        <IconoAlimento nombre={item.preparacion} grupo={grupo} tamano="sm" className="opacity-60 grayscale" />
        <span className="flex min-w-0 flex-1 flex-col leading-snug">
          <s className="truncate text-musgo first-letter:uppercase">{item.preparacion}</s>
          <span className="text-sm text-musgo">Lo sacaste</span>
        </span>
        <Button variant="ghost" className="text-primary" onClick={() => alCambiar({ borrado: false })}>
          <Undo2 aria-hidden="true" /> Deshacer
        </Button>
      </motion.li>
    )
  }

  const guardarNombre = () => {
    const limpio = nombre.trim()
    if (limpio) alCambiar({ preparacion: limpio })
    else setNombre(item.preparacion)
    setEditando(false)
  }

  return (
    <motion.li layout="position" className="flex flex-col gap-3 px-4 pt-4 pb-2">
      <div className="flex min-h-12 items-center gap-3">
        <IconoAlimento nombre={item.preparacion} grupo={grupo} tamano="md" />
        {editando ? (
          <form className="flex-1" onSubmit={(e) => { e.preventDefault(); guardarNombre() }}>
            <label htmlFor={`${id}-nombre`} className="sr-only">Nombre del alimento {n}</label>
            <Input
              id={`${id}-nombre`}
              className="h-12 text-base"
              value={nombre}
              autoFocus
              onChange={(e) => setNombre(e.target.value)}
              onBlur={guardarNombre}
              onKeyDown={(e) => { if (e.key === 'Escape') { setNombre(item.preparacion); setEditando(false) } }}
              enterKeyHint="done"
              autoComplete="off"
            />
          </form>
        ) : (
          <>
            <span className="min-w-0 flex-1 text-lg leading-snug font-bold first-letter:uppercase" id={`${id}-titulo`}>
              {item.preparacion}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="-mr-2 text-musgo"
              aria-label="Cambiar nombre"
              aria-describedby={`${id}-titulo`}
              onClick={() => { setNombre(item.preparacion); setEditando(true) }}
            >
              <Pencil aria-hidden="true" />
            </Button>
          </>
        )}
      </div>
      {dudoso && !editando && (
        <p className="-mt-1 rounded-xl bg-zapallo-claro px-3 py-2 text-sm text-pino">
          No estamos seguros de este. Si no es, cambiale el nombre.
        </p>
      )}
      <Porciones item={item} n={n} grupo={grupo} alCambiar={alCambiar} />
      <Button
        variant="ghost"
        className="-ml-3 self-start text-musgo"
        aria-label={`No estaba en el plato: ${item.preparacion}`}
        onClick={() => alCambiar({ borrado: true })}
      >
        <X aria-hidden="true" /> No estaba en el plato
      </Button>
    </motion.li>
  )
}

export function ListaItems({ items, original, alCambiar }: {
  items: ItemEdit[]
  original: ItemDetectado[]
  alCambiar: (idTmp: string, cambio: Partial<ItemEdit>) => void
}) {
  const porId = new Map(original.map((o) => [o.idTmp, o]))
  return (
    <ol className="flex flex-col divide-y divide-border rounded-2xl border bg-card" aria-label="Alimentos del plato">
      {items.map((it, i) => (
        <FilaItem
          key={it.idTmp}
          item={it}
          n={i + 1}
          grupo={porId.get(it.idTmp)?.atributos.grupo}
          dudoso={(porId.get(it.idTmp)?.confianza ?? 1) < 0.6}
          alCambiar={(c) => alCambiar(it.idTmp, c)}
        />
      ))}
    </ol>
  )
}
