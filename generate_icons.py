import os
from PIL import Image

def generate_icons():
    source_image_path = r"C:\Users\nagar\.gemini\antigravity-ide\brain\76e6d151-cd31-4baf-9b04-c83418d5720a\ai_student_logo_1780929411610.png"
    workspace_dir = os.path.dirname(os.path.abspath(__file__))
    target_dir = os.path.join(workspace_dir, "frontend", "public", "icons")
    public_dir = os.path.join(workspace_dir, "frontend", "public")
    
    if not os.path.exists(target_dir):
        os.makedirs(target_dir, exist_ok=True)
        
    sizes = [72, 96, 128, 144, 152, 192, 384, 512]
    
    try:
        with Image.open(source_image_path) as img:
            for size in sizes:
                resized_img = img.resize((size, size), Image.Resampling.LANCZOS)
                output_path = os.path.join(target_dir, f"icon-{size}x{size}.png")
                resized_img.save(output_path, "PNG")
                print(f"Generated {output_path}")
                
            # Also generate Apple touch icon and favicon
            apple_touch = img.resize((180, 180), Image.Resampling.LANCZOS)
            apple_touch.save(os.path.join(target_dir, "apple-touch-icon.png"), "PNG")
            apple_touch.save(os.path.join(public_dir, "apple-touch-icon.png"), "PNG")
            img.resize((64, 64), Image.Resampling.LANCZOS).save(os.path.join(public_dir, "favicon.ico"), format="ICO")
            
        print("All icons generated successfully.")
    except Exception as e:
        print(f"Error generating icons: {e}")

if __name__ == "__main__":
    generate_icons()
