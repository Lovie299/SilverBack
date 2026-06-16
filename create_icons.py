from PIL import Image, ImageDraw

# Create colors
GREEN = (44, 95, 45)  # #2c5f2d
WHITE = (255, 255, 255)

# Create adaptive-icon.png (512x512)
img = Image.new('RGB', (512, 512), GREEN)
# img.save('./assets/adaptive-icon.png')

# Create icon.png (512x512)
img.save('./assets/icon.png')

# Create splash.png (1242x2436)
img = Image.new('RGB', (1242, 2436), GREEN)
img.save('./assets/splash.png')

# Create foreground (432x432 with white gorilla footprint or simple shape)
img = Image.new('RGB', (432, 432), WHITE)
draw = ImageDraw.Draw(img)
draw.ellipse([100, 100, 332, 432], fill=GREEN)
img.save('./assets/android-icon-foreground.png')

# Create background (432x432 green)
img = Image.new('RGB', (432, 432), GREEN)
img.save('./assets/android-icon-background.png')

# Create monochrome (432x432 white silhouette)
img = Image.new('RGB', (432, 432), WHITE)
img.save('./assets/android-icon-monochrome.png')

print("✅ All icon files created successfully!")