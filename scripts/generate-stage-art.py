"""Generate the four deterministic raster washes used by the home stage."""

from pathlib import Path
import math
import random

from PIL import Image, ImageDraw, ImageFilter


WIDTH = 1600
HEIGHT = 900
OUT = Path(__file__).resolve().parents[1] / "public" / "stage"


def canvas() -> Image.Image:
    return Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))


def composite(base: Image.Image, layer: Image.Image) -> None:
    base.alpha_composite(layer)


def wash(base: Image.Image, boxes: list[tuple[int, int, int, int]], color: tuple[int, int, int, int], blur: int) -> None:
    layer = canvas()
    draw = ImageDraw.Draw(layer)
    for box in boxes:
        draw.ellipse(box, fill=color)
    composite(base, layer.filter(ImageFilter.GaussianBlur(blur)))


def mountains(base: Image.Image, rng: random.Random, color: tuple[int, int, int, int], baseline: int) -> None:
    layer = canvas()
    draw = ImageDraw.Draw(layer)
    for depth in range(4):
        points = [(460, HEIGHT)]
        x = 430
        while x < WIDTH + 150:
            peak = baseline - depth * 38 - rng.randint(80, 270)
            points.extend([(x, baseline + rng.randint(-15, 25)), (x + rng.randint(80, 170), peak)])
            x += rng.randint(170, 290)
        points.extend([(WIDTH, HEIGHT), (460, HEIGHT)])
        alpha = max(18, color[3] - depth * 13)
        draw.polygon(points, fill=(*color[:3], alpha))
    composite(base, layer.filter(ImageFilter.GaussianBlur(6)))


def grain(base: Image.Image, rng: random.Random, color: tuple[int, int, int]) -> None:
    layer = canvas()
    draw = ImageDraw.Draw(layer)
    for _ in range(750):
        x = rng.randrange(420, WIDTH)
        y = rng.randrange(20, HEIGHT)
        radius = rng.choice((1, 1, 2, 3))
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(*color, rng.randrange(5, 18)))
    composite(base, layer.filter(ImageFilter.GaussianBlur(0.6)))


def save(name: str, image: Image.Image) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    image.save(OUT / f"{name}.webp", "WEBP", quality=88, method=6)


def cold_cicada() -> None:
    rng = random.Random(4107)
    image = canvas()
    mountains(image, rng, (34, 55, 67, 72), 720)
    wash(image, [(1080, 60, 1390, 370)], (151, 174, 181, 42), 26)

    river = canvas()
    draw = ImageDraw.Draw(river)
    for y in range(650, 850, 34):
        draw.arc((500, y - 20, 1510, y + 22), 188, 352, fill=(37, 66, 81, 65), width=3)
    # A receding boat and mast.
    draw.polygon([(950, 666), (1100, 666), (1064, 689), (976, 687)], fill=(27, 39, 43, 135))
    draw.line((1017, 662, 1017, 524), fill=(27, 39, 43, 120), width=5)
    draw.polygon([(1020, 535), (1110, 620), (1020, 633)], fill=(56, 82, 88, 74))
    composite(image, river)

    rain = canvas()
    draw = ImageDraw.Draw(rain)
    for _ in range(180):
        x = rng.randint(450, 1570)
        y = rng.randint(40, 850)
        length = rng.randint(18, 60)
        draw.line((x, y, x - 14, y + length), fill=(71, 101, 116, rng.randint(22, 62)), width=2)
    composite(image, rain.filter(ImageFilter.GaussianBlur(0.35)))
    grain(image, rng, (34, 55, 67))
    save("cold-cicada", image)


def lantern() -> None:
    rng = random.Random(1314)
    image = canvas()
    mountains(image, rng, (42, 32, 28, 42), 770)

    bloom = canvas()
    draw = ImageDraw.Draw(bloom)
    # Branches and sparks echo "flowering trees" without becoming decorative dots.
    root = (1260, 770)
    for branch in range(26):
        angle = math.radians(205 + branch * 5.4 + rng.uniform(-4, 4))
        length = rng.randint(260, 620)
        end = (root[0] + math.cos(angle) * length, root[1] + math.sin(angle) * length)
        draw.line((root, end), fill=(86, 45, 36, 72), width=rng.randint(2, 5))
        for step in (0.45, 0.68, 0.88):
            x = root[0] + (end[0] - root[0]) * step
            y = root[1] + (end[1] - root[1]) * step
            radius = rng.randint(8, 18)
            draw.ellipse((x - radius, y - radius, x + radius, y + radius), outline=(151, 54, 39, 100), width=3)

    # Six actual lanterns, hung from the tree.
    for x, y, scale in [(910, 320, 1.0), (1080, 245, 0.82), (1235, 340, 1.1), (1375, 210, 0.72), (1460, 410, 0.9), (1160, 475, 0.68)]:
        w = int(56 * scale)
        h = int(72 * scale)
        draw.line((x, y - 60, x, y - h // 2), fill=(72, 43, 35, 95), width=3)
        draw.rounded_rectangle((x - w // 2, y - h // 2, x + w // 2, y + h // 2), radius=12, fill=(151, 49, 35, 90), outline=(101, 38, 31, 140), width=3)
        draw.line((x, y + h // 2, x, y + h // 2 + 25), fill=(110, 44, 35, 110), width=2)
    composite(image, bloom.filter(ImageFilter.GaussianBlur(0.7)))

    bridge = canvas()
    draw = ImageDraw.Draw(bridge)
    draw.arc((610, 590, 1490, 990), 190, 350, fill=(53, 38, 33, 92), width=10)
    draw.line((610, 790, 1490, 790), fill=(53, 38, 33, 65), width=4)
    composite(image, bridge)
    grain(image, rng, (91, 43, 33))
    save("lantern", image)


def lotus_dusk() -> None:
    rng = random.Random(1066)
    image = canvas()
    mountains(image, rng, (35, 70, 55, 36), 690)
    wash(image, [(820, 520, 1500, 980), (1180, 460, 1690, 920)], (54, 104, 77, 34), 42)

    water = canvas()
    draw = ImageDraw.Draw(water)
    for y in range(610, 880, 38):
        start = rng.randint(500, 720)
        draw.arc((start, y - 24, 1570, y + 28), 188, 350, fill=(42, 91, 72, 64), width=3)

    # Lotus leaves and two blossoms.
    for x, y, rx, ry in [(770, 720, 100, 34), (960, 760, 132, 45), (1210, 675, 115, 40), (1430, 785, 138, 42), (1110, 850, 150, 45)]:
        draw.ellipse((x - rx, y - ry, x + rx, y + ry), fill=(48, 98, 71, 80), outline=(35, 76, 57, 105), width=3)
        draw.line((x, y, x + rx * 0.7, y - 4), fill=(35, 76, 57, 72), width=2)
    for x, y in [(1035, 610), (1350, 650)]:
        for offset in (-28, -14, 0, 14, 28):
            draw.ellipse((x + offset - 18, y - abs(offset) // 2 - 45, x + offset + 18, y + 12), fill=(151, 92, 90, 74))
        draw.line((x, y + 10, x, y + 120), fill=(41, 80, 58, 78), width=4)

    # Three egrets lifting from the water.
    for x, y, size in [(900, 330, 1.0), (1110, 255, 0.8), (1290, 370, 0.65)]:
        draw.arc((x - 75 * size, y - 30 * size, x, y + 45 * size), 205, 340, fill=(76, 89, 83, 110), width=max(2, int(4 * size)))
        draw.arc((x, y - 30 * size, x + 75 * size, y + 45 * size), 200, 335, fill=(76, 89, 83, 110), width=max(2, int(4 * size)))
    composite(image, water)
    grain(image, rng, (38, 79, 58))
    save("lotus-dusk", image)


def plum_rain() -> None:
    rng = random.Random(8571)
    image = canvas()
    mountains(image, rng, (38, 64, 63, 62), 710)
    wash(image, [(620, 420, 1240, 770), (980, 210, 1720, 680)], (102, 126, 121, 34), 70)

    branch = canvas()
    draw = ImageDraw.Draw(branch)
    points = [(1580, 130), (1370, 250), (1240, 365), (1070, 480), (890, 520)]
    draw.line(points, fill=(42, 47, 45, 115), width=11, joint="curve")
    twigs = [((1380, 245), (1280, 130)), ((1270, 350), (1160, 225)), ((1110, 450), (1030, 320)), ((1490, 180), (1460, 60))]
    for start, end in twigs:
        draw.line((start, end), fill=(42, 47, 45, 100), width=5)
    for x, y in [(1280, 130), (1160, 225), (1030, 320), (1460, 60), (1360, 250), (1100, 440)]:
        for dx, dy in [(-18, 0), (14, -10), (5, 15), (-8, -16), (20, 12)]:
            draw.ellipse((x + dx - 10, y + dy - 8, x + dx + 10, y + dy + 8), fill=(143, 83, 82, 78))
    composite(image, branch.filter(ImageFilter.GaussianBlur(0.4)))

    rain = canvas()
    draw = ImageDraw.Draw(rain)
    for _ in range(145):
        x = rng.randint(480, 1580)
        y = rng.randint(20, 860)
        draw.line((x, y, x - 8, y + rng.randint(24, 56)), fill=(58, 86, 84, rng.randint(18, 48)), width=2)
    composite(image, rain.filter(ImageFilter.GaussianBlur(0.5)))
    grain(image, rng, (42, 72, 69))
    save("plum-rain", image)


if __name__ == "__main__":
    cold_cicada()
    lantern()
    lotus_dusk()
    plum_rain()
