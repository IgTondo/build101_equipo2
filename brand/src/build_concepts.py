"""Genera los SVG de los tres conceptos de logo de Nibble (negro, sin color todavía).

Uso: py -3 brand/src/build_concepts.py

Todo se construye con primitivas: bastones (barras con puntas redondas), aros y arcos.
Unidades: símbolos en 256 x 256; la palabra usa línea base 200, altura x 96 y ascendentes 136.
"""
import math
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "concepts"
INK = "#111111"

# Sistema de la palabra "nibble"
W = 28            # grosor del trazo
R = 35            # radio del eje de las formas redondas
BASE = 200        # línea base
XH = BASE - 96    # altura x
ASC = BASE - 136  # ascendentes (b, l)
CY = BASE - 48    # centro de las formas redondas
RO = R + W / 2    # radio exterior (49: 1 unidad de compensación arriba y abajo)
RI = R - W / 2    # radio interior
GAP_B = 11        # separación entre el palo y la panza en la b "que no se toca" (0,4 del trazo)


def f(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def pt(x, y):
    return f"{f(x)} {f(y)}"


def polar(cx, cy, r, deg):
    """Punto en coordenadas de pantalla (y hacia abajo; 0° = derecha, 90° = abajo)."""
    a = math.radians(deg)
    return cx + r * math.cos(a), cy + r * math.sin(a)


def svg(w, h, title, body):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f(w)} {f(h)}" width="{f(w)}" height="{f(h)}" '
        f'role="img" aria-labelledby="title">\n  <title id="title">{title}</title>\n'
        f'  <g fill="{INK}">\n    ' + "\n    ".join(body) + "\n  </g>\n</svg>\n"
    )


def bar(cx, top, bottom, w):
    """Bastón vertical con puntas redondas."""
    r = w / 2
    return f'<rect x="{f(cx - r)}" y="{f(top)}" width="{f(w)}" height="{f(bottom - top)}" rx="{f(r)}"/>'


def ring(cx, cy, ro, ri):
    """Aro: dos círculos en un path con evenodd."""
    d = (
        f"M{pt(cx - ro, cy)} A{f(ro)} {f(ro)} 0 1 1 {pt(cx + ro, cy)} A{f(ro)} {f(ro)} 0 1 1 {pt(cx - ro, cy)} Z "
        f"M{pt(cx - ri, cy)} A{f(ri)} {f(ri)} 0 1 1 {pt(cx + ri, cy)} A{f(ri)} {f(ri)} 0 1 1 {pt(cx - ri, cy)} Z"
    )
    return f'<path fill-rule="evenodd" d="{d}"/>'


def cut_ring(cx, cy, ro, ri, xc):
    """Aro cortado por la vertical x = xc: queda abierto hacia la izquierda (la panza de la b que no toca el palo)."""
    dyo = math.sqrt(ro ** 2 - (cx - xc) ** 2)
    dyi = math.sqrt(ri ** 2 - (cx - xc) ** 2)
    d = (
        f"M{pt(xc, cy - dyo)} A{f(ro)} {f(ro)} 0 1 1 {pt(xc, cy + dyo)} V{f(cy + dyi)} "
        f"A{f(ri)} {f(ri)} 0 1 0 {pt(xc, cy - dyi)} Z"
    )
    return f'<path d="{d}"/>'


def band(cx, cy, r, w, a0, a1):
    """Trazo de arco de a0 a a1 (horario, en grados) con puntas redondas, como contorno relleno."""
    ro, ri, rc = r + w / 2, r - w / 2, w / 2
    large = 1 if (a1 - a0) > 180 else 0
    o0, o1 = polar(cx, cy, ro, a0), polar(cx, cy, ro, a1)
    i0, i1 = polar(cx, cy, ri, a0), polar(cx, cy, ri, a1)
    d = (
        f"M{pt(*o0)} A{f(ro)} {f(ro)} 0 {large} 1 {pt(*o1)} "
        f"A{f(rc)} {f(rc)} 0 0 1 {pt(*i1)} "
        f"A{f(ri)} {f(ri)} 0 {large} 0 {pt(*i0)} "
        f"A{f(rc)} {f(rc)} 0 0 1 {pt(*o0)} Z"
    )
    return f'<path d="{d}"/>'


def arch_d(left_axis, cy, r, w, base):
    """Arco con dos patas de puntas redondas (la forma de la n). left_axis = eje de la pata izquierda."""
    ro, ri, rc = r + w / 2, r - w / 2, w / 2
    yb = base - rc
    xl_o, xl_i = left_axis - rc, left_axis + rc
    xr_i, xr_o = left_axis + 2 * r - rc, left_axis + 2 * r + rc
    return (
        f"M{pt(xl_o, yb)} V{f(cy)} A{f(ro)} {f(ro)} 0 0 1 {pt(xr_o, cy)} V{f(yb)} "
        f"A{f(rc)} {f(rc)} 0 0 1 {pt(xr_i, yb)} V{f(cy)} A{f(ri)} {f(ri)} 0 0 0 {pt(xl_i, cy)} V{f(yb)} "
        f"A{f(rc)} {f(rc)} 0 0 1 {pt(xl_o, yb)} Z"
    )


def wordmark(separated):
    """La palabra 'nibble' construida con el mismo sistema. Devuelve (elementos, ancho)."""
    els = []
    # n
    axis = W / 2
    els.append(f'<path d="{arch_d(axis, CY, R, W, BASE)}"/>')
    right = axis + 2 * R + W / 2
    # i
    c = right + 26 + W / 2
    els.append(bar(c, XH, BASE, W))
    els.append(f'<circle cx="{f(c)}" cy="76" r="15"/>')
    right = c + W / 2
    # b b
    for k in range(2):
        c = right + (26 if k == 0 else 22) + W / 2
        els.append(bar(c, ASC, BASE, W))
        rc = c + R
        els.append(cut_ring(rc, CY, RO, RI, c + W / 2 + GAP_B) if separated else ring(rc, CY, RO, RI))
        right = rc + RO
    # l
    c = right + 22 + W / 2
    els.append(bar(c, ASC, BASE, W))
    right = c + W / 2
    # e: aro abierto abajo a la derecha + barra horizontal (apenas más fina, por óptica)
    cx = right + 22 + RO
    els.append(band(cx, CY, R, W, 70, 360))
    els.append(f'<rect x="{f(cx - R)}" y="{f(CY - 13)}" width="{f(2 * R)}" height="26"/>')
    right = cx + RO
    return els, right


# ---------------------------------------------------------------- símbolos

def symbol_a():
    """A · No se tocan: la b es un bastón y una panza que no se tocan (corte tipo stencil)."""
    s, w, rb = 76, 44, 52          # eje del palo, trazo, radio del eje de la panza
    return [bar(s, 24, 224, w), cut_ring(s + rb, 150, rb + w / 2, rb - w / 2, s + w / 2 + 16)]


def symbol_b():
    """B · Mordisco: la n de Nibble con un mordisco en el hombro."""
    cx, cy = 128, 124
    ro, ri, rc = 96, 36, 30
    yb = 220 - rc
    bite_r, bite_d, ang = 34, ro + 10, -45
    a = (ro ** 2 - bite_r ** 2 + bite_d ** 2) / (2 * bite_d)
    h = math.sqrt(ro ** 2 - a ** 2)
    ux, uy = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    vx, vy = -uy, ux
    p_low = (cx + a * ux + h * vx, cy + a * uy + h * vy)
    p_up = (cx + a * ux - h * vx, cy + a * uy - h * vy)
    d = (
        f"M{pt(cx - ro, yb)} V{f(cy)} A{f(ro)} {f(ro)} 0 0 1 {pt(*p_up)} "
        f"A{f(bite_r)} {f(bite_r)} 0 0 0 {pt(*p_low)} "
        f"A{f(ro)} {f(ro)} 0 0 1 {pt(cx + ro, cy)} V{f(yb)} "
        f"A{f(rc)} {f(rc)} 0 0 1 {pt(cx + ri, yb)} V{f(cy)} A{f(ri)} {f(ri)} 0 0 0 {pt(cx - ri, cy)} V{f(yb)} "
        f"A{f(rc)} {f(rc)} 0 0 1 {pt(cx - ro, yb)} Z"
    )
    return [f'<path d="{d}"/>']


def symbol_c():
    """C · A la mesa: un bocado sobre un bol, separados."""
    bowl_top, r = 128, 96
    bowl = f'<path d="M{pt(128 - r, bowl_top)} H{f(128 + r)} A{f(r)} {f(r)} 0 0 1 {pt(128 - r, bowl_top)} Z"/>'
    return ['<circle cx="128" cy="70" r="38"/>', bowl]


# ---------------------------------------------------------------- composición

def lockup(symbol_els, word_els, word_w, baseline):
    gap = 24
    dx = 256 + gap
    dy = baseline - BASE
    width = dx + word_w + 32
    body = symbol_els + [f'<g transform="translate({f(dx)} {f(dy)})">'] + ["  " + e for e in word_els] + ["</g>"]
    return width, body


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    concepts = {
        "a": ("No se tocan", symbol_a(), True, 220),
        "b": ("Mordisco", symbol_b(), False, 220),
        "c": ("A la mesa", symbol_c(), False, 222),
    }
    for key, (name, sym, separated, baseline) in concepts.items():
        (OUT / f"{key}-symbol.svg").write_text(svg(256, 256, f"Nibble, concepto {key.upper()}: {name}", sym), encoding="utf-8")
        word, ww = wordmark(separated)
        width, body = lockup(sym, word, ww, baseline)
        (OUT / f"{key}-lockup.svg").write_text(svg(width, 256, f"Nibble, concepto {key.upper()}: {name} (horizontal)", body), encoding="utf-8")
        print(f"{key}: símbolo y horizontal ({f(width)} x 256)")


if __name__ == "__main__":
    main()
