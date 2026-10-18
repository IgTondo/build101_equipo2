// Colores con significado (notas/ui-rediseno.md): el grupo de alimentos y el momento del día. Los valores viven en
// src/index.css (--nb-grupo-*, --nb-momento-*); acá se eligen por clave. Las clases de Tailwind van escritas enteras:
// Tailwind las encuentra leyendo el código y no ve las que se arman con template strings.
import type { LucideIcon } from 'lucide-react'
import { Apple, Cookie, Moon, Sun, Sunrise } from 'lucide-react'
import type { Grupo, Momento } from '../../shared/contratos'

export interface ColorDe {
  /** Para SVG y estilos en línea: var(--nb-…) */
  color: string
  claro: string
  /** Clase de fondo con el tono claro (tarjetas, círculos de IconoAlimento) */
  claseClaro: string
}

export const COLOR_GRUPO: Record<Grupo, ColorDe> = {
  cereal_almidon: { color: 'var(--nb-grupo-cereal)', claro: 'var(--nb-grupo-cereal-claro)', claseClaro: 'bg-grupo-cereal-claro' },
  proteina: { color: 'var(--nb-grupo-proteina)', claro: 'var(--nb-grupo-proteina-claro)', claseClaro: 'bg-grupo-proteina-claro' },
  verdura: { color: 'var(--nb-grupo-verdura)', claro: 'var(--nb-grupo-verdura-claro)', claseClaro: 'bg-grupo-verdura-claro' },
  fruta: { color: 'var(--nb-grupo-fruta)', claro: 'var(--nb-grupo-fruta-claro)', claseClaro: 'bg-grupo-fruta-claro' },
  lacteo: { color: 'var(--nb-grupo-lacteo)', claro: 'var(--nb-grupo-lacteo-claro)', claseClaro: 'bg-grupo-lacteo-claro' },
  otro: { color: 'var(--nb-grupo-otro)', claro: 'var(--nb-grupo-otro-claro)', claseClaro: 'bg-grupo-otro-claro' },
}

export interface VisualMomento extends ColorDe {
  icono: LucideIcon
}

/** El "cielo" de cada comida: un ícono y un color. La cena es la única oscura. */
export const VISUAL_MOMENTO: Record<Momento, VisualMomento> = {
  desayuno: { icono: Sunrise, color: 'var(--nb-momento-desayuno)', claro: 'var(--nb-momento-desayuno-claro)', claseClaro: 'bg-momento-desayuno-claro' },
  almuerzo: { icono: Sun, color: 'var(--nb-momento-almuerzo)', claro: 'var(--nb-momento-almuerzo-claro)', claseClaro: 'bg-momento-almuerzo-claro' },
  merienda: { icono: Cookie, color: 'var(--nb-momento-merienda)', claro: 'var(--nb-momento-merienda-claro)', claseClaro: 'bg-momento-merienda-claro' },
  cena: { icono: Moon, color: 'var(--nb-momento-cena)', claro: 'var(--nb-momento-cena-claro)', claseClaro: 'bg-momento-cena-claro' },
  colacion: { icono: Apple, color: 'var(--nb-momento-colacion)', claro: 'var(--nb-momento-colacion-claro)', claseClaro: 'bg-momento-colacion-claro' },
}

/** Colores para series sin significado propio (gráficos de varias líneas): verde, zapallo, cielo, trigo, frambuesa. */
export const SERIES = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']
