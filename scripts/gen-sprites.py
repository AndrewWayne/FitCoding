"""Generate placeholder 256x64 sprite sheets for v0.0.1."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "app" / "src" / "assets" / "sprites"
OUT.mkdir(parents=True, exist_ok=True)


def stick(draw, ox, *, head_y, knee_y, arms_up):
    color = (240, 240, 240, 255)
    # head
    draw.ellipse([ox + 28, head_y, ox + 36, head_y + 8], fill=color)
    # body
    draw.line([(ox + 32, head_y + 8), (ox + 32, head_y + 28)], fill=color, width=2)
    # arms
    arm_y = head_y + 12
    arm_lift = -10 if arms_up else 8
    draw.line([(ox + 32, arm_y), (ox + 22, arm_y + arm_lift)], fill=color, width=2)
    draw.line([(ox + 32, arm_y), (ox + 42, arm_y + arm_lift)], fill=color, width=2)
    # legs
    draw.line([(ox + 32, head_y + 28), (ox + 26, knee_y)], fill=color, width=2)
    draw.line([(ox + 32, head_y + 28), (ox + 38, knee_y)], fill=color, width=2)


def squat_frames():
    img = Image.new("RGBA", (256, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, ky in enumerate([56, 48, 44, 40]):
        stick(d, i * 64, head_y=12 + i * 2, knee_y=ky, arms_up=False)
    img.save(OUT / "squat.png")


def jumping_jack_frames():
    img = Image.new("RGBA", (256, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, up in enumerate([False, True, False, True]):
        stick(d, i * 64, head_y=12, knee_y=56, arms_up=up)
    img.save(OUT / "jumping_jack.png")


def pushup_frames():
    img = Image.new("RGBA", (256, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    color = (240, 240, 240, 255)
    for i, lift in enumerate([0, -3, -6, -3]):
        ox = i * 64
        # head
        d.ellipse([ox + 8, 28 + lift, ox + 16, 36 + lift], fill=color)
        # body
        d.line([(ox + 16, 32 + lift), (ox + 52, 32 + lift)], fill=color, width=2)
        # arm
        d.line([(ox + 24, 32 + lift), (ox + 24, 48)], fill=color, width=2)
        # leg
        d.line([(ox + 52, 32 + lift), (ox + 56, 48)], fill=color, width=2)
    img.save(OUT / "pushup.png")


if __name__ == "__main__":
    squat_frames()
    jumping_jack_frames()
    pushup_frames()
    print("wrote", *(p.name for p in OUT.glob("*.png")))
