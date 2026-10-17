"""Genera los archivos finales del logo de Nibble (concepto B, Mordisco) en brand/logo/.

Uso: py -3 brand/src/build_kit.py

El logo es la palabra "nibble" y el mordisco vive en su propia n. La n mordida sola (símbolo)
se usa únicamente donde la palabra no entra: ícono de la app, favicon y avatar.
"""
import math
from pathlib import Path

from build_concepts import ASC, BASE, CY, R, RI, RO, W, XH, arch_d, bar, f, pt

OUT = Path(__file__).resolve().parent.parent / "logo"

VERDE = "#3E9A68"   # Verde Nibble: la n mordida y el símbolo
PINO = "#2F5C4B"    # resto de la palabra ("ibble")
HOJA = "#A6DDB9"    # la n sobre fondos oscuros
CREMA = "#FBF7F0"   # resto de la palabra sobre fondos oscuros


def bitten_arch_d(cx, cy, ro, ri, bottom, bite_r, bite_off, ang=-45):
    """La n: arco con patas de puntas redondas y un mordisco circular en el hombro derecho."""
    rc = (ro - ri) / 2
    yb = bottom - rc
    bite_d = ro + bite_off
    a = (ro ** 2 - bite_r ** 2 + bite_d ** 2) / (2 * bite_d)
    h = math.sqrt(ro ** 2 - a ** 2)
    ux, uy = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    vx, vy = -uy, ux
    p_low = (cx + a * ux + h * vx, cy + a * uy + h * vy)
    p_up = (cx + a * ux - h * vx, cy + a * uy - h * vy)
    return (
        f"M{pt(cx - ro, yb)} V{f(cy)} A{f(ro)} {f(ro)} 0 0 1 {pt(*p_up)} "
        f"A{f(bite_r)} {f(bite_r)} 0 0 0 {pt(*p_low)} "
        f"A{f(ro)} {f(ro)} 0 0 1 {pt(cx + ro, cy)} V{f(yb)} "
        f"A{f(rc)} {f(rc)} 0 0 1 {pt(cx + ri, yb)} V{f(cy)} A{f(ri)} {f(ri)} 0 0 0 {pt(cx - ri, cy)} V{f(yb)} "
        f"A{f(rc)} {f(rc)} 0 0 1 {pt(cx - ro, yb)} Z"
    )


def e_glyph(cx):
    """e geométrica: aro abierto con terminal redonda a 70° y barra que cierra al ras del contorno exterior."""
    ro, ri, rc = RO, RI, W / 2
    o0, i0 = (cx + ro * math.cos(math.radians(70)), CY + ro * math.sin(math.radians(70))), \
             (cx + ri * math.cos(math.radians(70)), CY + ri * math.sin(math.radians(70)))
    bowl = (
        f"M{pt(*o0)} A{f(ro)} {f(ro)} 0 1 1 {pt(cx + ro, CY)} H{f(cx + ri)} "
        f"A{f(ri)} {f(ri)} 0 1 0 {pt(*i0)} A{f(rc)} {f(rc)} 0 0 1 {pt(*o0)} Z"
    )
    t = 13  # media altura de la barra (26, apenas más fina que el trazo, por óptica)
    xe = cx + math.sqrt(ro ** 2 - t ** 2)
    bar_d = f"M{pt(cx - R, CY - t)} H{f(xe)} A{f(ro)} {f(ro)} 0 0 1 {pt(xe, CY + t)} H{f(cx - R)} Z"
    return [f'<path d="{bowl} {bar_d}"/>']  # un solo path (unión nonzero): sin costura en el borde derecho


def b_glyph(c):
    """b en un solo path: palo (termina plano dentro del trazo de la panza) + aro con el hueco a contramano."""
    cx, rc = c + R, W / 2
    stem = f"M{pt(c - rc, CY)} V{f(ASC + rc)} A{f(rc)} {f(rc)} 0 0 1 {pt(c + rc, ASC + rc)} V{f(CY)} Z"
    outer = f"M{pt(cx - RO, CY)} A{f(RO)} {f(RO)} 0 1 1 {pt(cx + RO, CY)} A{f(RO)} {f(RO)} 0 1 1 {pt(cx - RO, CY)} Z"
    inner = f"M{pt(cx - RI, CY)} A{f(RI)} {f(RI)} 0 1 0 {pt(cx + RI, CY)} A{f(RI)} {f(RI)} 0 1 0 {pt(cx - RI, CY)} Z"
    return f'<path d="{stem} {outer} {inner}"/>'


def symbol(thin=False):
    """Símbolo maestro en 256 x 256. Trazo 56 (54 en la versión para fondo oscuro, por irradiación)."""
    return [f'<path d="{bitten_arch_d(128, 124, 96, 42 if thin else 40, 220, 36, 12)}"/>']


def symbol_small():
    """Corte para 16-32 px: llena más el cuadro y el mordisco es más grande para que no desaparezca."""
    return [f'<path d="{bitten_arch_d(128, 122, 106, 44, 230, 46, 14)}"/>']


def wordmark(bitten):
    """'nibble' con el sistema de la marca. Devuelve (elementos de la n, resto, ancho)."""
    axis = W / 2
    if bitten:
        n = [f'<path d="{bitten_arch_d(axis + R, CY, RO, RI, BASE, 20, 6)}"/>']
    else:
        n = [f'<path d="{arch_d(axis, CY, R, W, BASE)}"/>']
    rest = []
    right = axis + 2 * R + W / 2
    # i
    c = right + 26 + W / 2
    rest += [bar(c, XH, BASE, W), f'<circle cx="{f(c)}" cy="76" r="15"/>']
    right = c + W / 2
    # b b: el palo termina dentro de la panza, así la base es la curva limpia del aro
    for k in range(2):
        c = right + (26 if k == 0 else 22) + W / 2
        rest.append(b_glyph(c))
        right = c + R + RO
    # l
    c = right + 22 + W / 2
    rest.append(bar(c, ASC, BASE, W))
    right = c + W / 2
    # e
    cx = right + 22 + RO
    rest += e_glyph(cx)
    return n, rest, cx + RO


def svg(w, h, title, groups):
    """groups: lista de (color, elementos, transform o None)."""
    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f(w)} {f(h)}" width="{f(w)}" height="{f(h)}" '
        f'role="img" aria-labelledby="title">',
        f'  <title id="title">{title}</title>',
    ]
    for fill, els, transform in groups:
        attrs = f' fill="{fill}"' + (f' transform="{transform}"' if transform else "")
        lines.append(f"  <g{attrs}>")
        lines += ["    " + e for e in els]
        lines.append("  </g>")
    lines.append("</svg>")
    return "\n".join(lines) + "\n"


def write(name, w, h, title, groups):
    (OUT / name).write_text(svg(w, h, title, groups), encoding="utf-8")
    print(f"  {name}  ({f(w)} x {f(h)})")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    n_bit, rest, ww = wordmark(bitten=True)

    for suffix, n_color, word_color, thin in (("", VERDE, PINO, False), ("-oscuro", HOJA, CREMA, True)):
        # Logo: la palabra, con la n mordida en Verde Nibble
        write(f"nibble-logo{suffix}.svg", ww + 48, 256, "Nibble",
              [(n_color, n_bit, "translate(24 -8)"), (word_color, rest, "translate(24 -8)")])
        # Símbolo: la misma n mordida, sola (ícono de app, favicon, avatar)
        write(f"nibble-simbolo{suffix}.svg", 256, 256, "Nibble", [(n_color, symbol(thin), None)])

    write("nibble-simbolo-chico.svg", 256, 256, "Nibble", [(VERDE, symbol_small(), None)])


if __name__ == "__main__":
    main()
