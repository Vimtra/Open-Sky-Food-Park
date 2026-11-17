"""Cuts dish, stall and logo images out of the owner's artwork in Assets/.

Run from the project root:  python shared/seed/crop_images.py
Output goes to shared/img/. Assets/ is never modified.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "Assets"
OUT = ROOT / "shared" / "img"

W = "WhatsApp Image 2026-11-14 at "
MENU = W + "1.03.37 AM.jpeg"          # PandemKodi Dhaba menu, 1455x1081
DESSERT = W + "1.03.37 AM (1).jpeg"   # Desi Desserts menu, 1011x1600
FISH = W + "1.32.47 AM.jpeg"          # posters, 1254x1254
MUTTON = W + "1.32.47 AM (1).jpeg"
EGG = W + "1.32.47 AM (2).jpeg"
PANEER = W + "1.32.47 AM (3).jpeg"
CHICKEN = W + "1.32.47 AM (4).jpeg"
LOGO = "Open Sky Food Park logo.jpg"

# (source, box left/top/right/bottom, output path)
CROPS = [
    (LOGO, None, "open-sky-logo.jpg"),
    # PandemKodi Dhaba
    (MENU, (298, 0, 532, 172), "pandemkodi-dhaba/logo.jpg"),
    (MENU, (70, 340, 445, 468), "pandemkodi-dhaba/veg-appetizers.jpg"),
    (MENU, (528, 358, 962, 478), "pandemkodi-dhaba/chicken-ghee-roast.jpg"),
    (MENU, (1015, 338, 1390, 478), "pandemkodi-dhaba/veg-curries.jpg"),
    (MENU, (55, 634, 485, 758), "pandemkodi-dhaba/nonveg-curries.jpg"),
    (MENU, (535, 608, 935, 758), "pandemkodi-dhaba/egg-curries.jpg"),
    (MENU, (985, 618, 1432, 758), "pandemkodi-dhaba/pulka.jpg"),
    (MENU, (300, 870, 660, 1022), "pandemkodi-dhaba/mandi.jpg"),
    (MENU, (950, 858, 1305, 1022), "pandemkodi-dhaba/pulav.jpg"),
    (FISH, (40, 590, 800, 1040), "pandemkodi-dhaba/fish-curry-combo.jpg"),
    (MUTTON, (20, 640, 800, 1110), "pandemkodi-dhaba/mutton-curry-combo.jpg"),
    (EGG, (30, 500, 720, 960), "pandemkodi-dhaba/egg-curry-combo.jpg"),
    (PANEER, (0, 310, 640, 1050), "pandemkodi-dhaba/paneer-butter-masala-combo.jpg"),
    (CHICKEN, (560, 520, 1254, 1110), "pandemkodi-dhaba/dhaba-chicken-curry-combo.jpg"),
    # Desi Desserts
    (DESSERT, (350, 8, 660, 140), "desi-desserts/logo.jpg"),
    (DESSERT, (103, 185, 348, 430), "desi-desserts/royal-falooda.jpg"),
    (DESSERT, (378, 185, 623, 430), "desi-desserts/mango-falooda.jpg"),
    (DESSERT, (655, 185, 900, 430), "desi-desserts/kesar-pista-falooda.jpg"),
    (DESSERT, (108, 478, 342, 712), "desi-desserts/special-falooda.jpg"),
    (DESSERT, (383, 478, 617, 712), "desi-desserts/chikoo-falooda.jpg"),
    (DESSERT, (663, 478, 897, 712), "desi-desserts/choco-caramel.jpg"),
    (DESSERT, (100, 815, 280, 995), "desi-desserts/rose-milk.jpg"),
    (DESSERT, (312, 815, 492, 995), "desi-desserts/badam-milk.jpg"),
    (DESSERT, (513, 815, 693, 995), "desi-desserts/chikoo-shake.jpg"),
    (DESSERT, (727, 815, 907, 995), "desi-desserts/mango-lassi.jpg"),
    (DESSERT, (115, 1085, 350, 1225), "desi-desserts/apricot-delight.jpg"),
    (DESSERT, (395, 1070, 595, 1235), "desi-desserts/chocolate-chip-brownie.jpg"),
    (DESSERT, (655, 1080, 915, 1240), "desi-desserts/gulab-jamun.jpg"),
    (DESSERT, (190, 1286, 470, 1435), "desi-desserts/rasmalai.jpg"),
    (DESSERT, (495, 1280, 798, 1425), "desi-desserts/poornalu.jpg"),
]

# Full posters, downsized, for the promo carousel.
POSTERS = [
    (FISH, "pandemkodi-dhaba/poster-fish-curry.jpg"),
    (MUTTON, "pandemkodi-dhaba/poster-mutton-curry.jpg"),
    (EGG, "pandemkodi-dhaba/poster-egg-curry.jpg"),
    (PANEER, "pandemkodi-dhaba/poster-paneer-butter-masala.jpg"),
    (CHICKEN, "pandemkodi-dhaba/poster-dhaba-chicken-curry.jpg"),
]


def save(im: Image.Image, rel: str, quality: int = 86) -> None:
    dest = OUT / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.convert("RGB").save(dest, "JPEG", quality=quality, optimize=True, progressive=True)


def dessert_cover() -> None:
    """Stall cover for Desi Desserts: the six faloodas from its menu on the menu's own cream ground."""
    im = Image.open(SRC / DESSERT).convert("RGB")
    cream = im.getpixel((60, 300))
    canvas = Image.new("RGB", (900, 600), cream)
    rows = [
        [(103, 185, 348, 430), (378, 185, 623, 430), (655, 185, 900, 430)],
        [(108, 478, 342, 712), (383, 478, 617, 712), (663, 478, 897, 712)],
    ]
    for r, row in enumerate(rows):
        for c, box in enumerate(row):
            tile = im.crop(box)
            x = 60 + c * 270 + (245 - tile.width) // 2
            y = 40 + r * 270 + (245 - tile.height) // 2
            canvas.paste(tile, (x, y))
    save(canvas, "desi-desserts/cover.jpg")


def main() -> None:
    for src, box, rel in CROPS:
        im = Image.open(SRC / src)
        save(im.crop(box) if box else im, rel)
    dessert_cover()
    for src, rel in POSTERS:
        im = Image.open(SRC / src)
        im.thumbnail((900, 900), Image.LANCZOS)
        save(im, rel, quality=82)
    print(f"wrote {len(CROPS) + len(POSTERS) + 1} images to {OUT}")


if __name__ == "__main__":
    main()
