// Paso "ítems" (C2): la foto con las cajas de la visión y la lista para corregir (nombre, porción, sacar).
import { useId, useState } from 'react'
import { PORCION, type Caja, type ItemDetectado, type Porcion } from '../../../shared/contratos'
import { NOMBRE_PORCION } from '../../lib/vocabulario'
import type { ItemEdit } from './modelo'

function cajaValida(c: Caja | null): c is Caja {
  return !!c && c.length === 4 && c.every((v) => Number.isFinite(v)) && c[2] > c[0] && c[3] > c[1]
}

/** Foto con cajas [ymin, xmin, ymax, xmax] de 0 a 1000 como capas en %. Si no hay caja, solo etiquetas debajo. */
export function FotoConCajas({ src, items, original }: { src: string; items: ItemEdit[]; original: ItemDetectado[] }) {
  const caja = new Map(original.map((o) => [o.idTmp, o.caja]))
  const numerados = items.map((it, i) => ({ it, n: i + 1, caja: caja.get(it.idTmp) ?? null }))
  const sinCaja = numerados.filter((x) => !x.it.borrado && !cajaValida(x.caja))
  return (
    <figure className="rg-foto">
      <div className="rg-foto-marco">
        <img src={src} alt="Foto del plato" />
        {numerados.map(({ it, n, caja: c }) => !it.borrado && cajaValida(c) && (
          <div
            key={it.idTmp}
            className="rg-caja"
            aria-hidden="true"
            style={{
              top: `${c[0] / 10}%`, left: `${c[1] / 10}%`,
              height: `${(c[2] - c[0]) / 10}%`, width: `${(c[3] - c[1]) / 10}%`,
            }}
          >
            <span className="rg-caja-etiqueta">{n}. {it.preparacion}</span>
          </div>
        ))}
      </div>
      {sinCaja.length > 0 && (
        <figcaption className="rg-etiquetas" aria-hidden="true">
          {sinCaja.map(({ it, n }) => <span key={it.idTmp} className="rg-etiqueta">{n}. {it.preparacion}</span>)}
        </figcaption>
      )}
    </figure>
  )
}

interface FilaProps {
  item: ItemEdit
  n: number
  dudoso: boolean
  alCambiar: (cambio: Partial<ItemEdit>) => void
}

function FilaItem({ item, n, dudoso, alCambiar }: FilaProps) {
  const id = useId()
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(item.preparacion)

  if (item.borrado) {
    return (
      <li className="rg-item rg-item-borrado">
        <span><s>{item.preparacion}</s> <span className="nb-suave">· lo sacaste</span></span>
        <button type="button" className="rg-boton-texto" onClick={() => alCambiar({ borrado: false })}>
          Deshacer
        </button>
      </li>
    )
  }

  const guardarNombre = () => {
    const limpio = nombre.trim()
    if (limpio) alCambiar({ preparacion: limpio })
    else setNombre(item.preparacion)
    setEditando(false)
  }

  return (
    <li className="rg-item">
      <div className="rg-item-cabeza">
        <span className="rg-numero" aria-hidden="true">{n}</span>
        {editando ? (
          <form className="rg-renombrar" onSubmit={(e) => { e.preventDefault(); guardarNombre() }}>
            <label htmlFor={`${id}-nombre`} className="rg-oculto">Nombre del alimento {n}</label>
            <input
              id={`${id}-nombre`}
              className="rg-input"
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
          <span className="rg-item-nombre" id={`${id}-titulo`}>{item.preparacion}</span>
        )}
      </div>
      {dudoso && !editando && (
        <p className="rg-pista">No estamos seguros de este. Si no es, cambiale el nombre.</p>
      )}
      <fieldset className="rg-grupo">
        <legend className="rg-leyenda-chica">Porción servida</legend>
        <div className="rg-segmentado">
          {PORCION.map((p: Porcion) => (
            <label key={p} className="rg-opcion">
              <input
                type="radio"
                name={`${id}-porcion`}
                value={p}
                checked={item.porcion === p}
                onChange={() => alCambiar({ porcion: p })}
              />
              <span>{NOMBRE_PORCION[p]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="rg-item-acciones">
        {!editando && (
          <button
            type="button"
            className="rg-boton-texto"
            aria-describedby={`${id}-titulo`}
            onClick={() => { setNombre(item.preparacion); setEditando(true) }}
          >
            Cambiar nombre
          </button>
        )}
        <button
          type="button"
          className="rg-boton-texto"
          aria-label={`No estaba en el plato: ${item.preparacion}`}
          onClick={() => alCambiar({ borrado: true })}
        >
          No estaba en el plato
        </button>
      </div>
    </li>
  )
}

export function ListaItems({ items, original, alCambiar }: {
  items: ItemEdit[]
  original: ItemDetectado[]
  alCambiar: (idTmp: string, cambio: Partial<ItemEdit>) => void
}) {
  const confianza = new Map(original.map((o) => [o.idTmp, o.confianza]))
  return (
    <ol className="rg-items" aria-label="Alimentos del plato">
      {items.map((it, i) => (
        <FilaItem
          key={it.idTmp}
          item={it}
          n={i + 1}
          dudoso={(confianza.get(it.idTmp) ?? 1) < 0.6}
          alCambiar={(c) => alCambiar(it.idTmp, c)}
        />
      ))}
    </ol>
  )
}
