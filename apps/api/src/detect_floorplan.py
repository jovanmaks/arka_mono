# File: detect_floorplan.py
import cv2
import numpy as np
import argparse
import os

# Attempt to import ximgproc for thinning
try:
    import cv2.ximgproc
    XIMGPROC_AVAILABLE = True
except ImportError:
    XIMGPROC_AVAILABLE = False

# Fallback: use skimage if ximgproc isn't available
try:
    from skimage.morphology import skeletonize as sk_skeletonize
    SKIMAGE_AVAILABLE = True
except ImportError:
    SKIMAGE_AVAILABLE = False
    sk_skeletonize = None  # for safety

from sklearn.cluster import KMeans

def morphological_thinning(binary_img):
    """
    Perform morphological thinning using either OpenCV's ximgproc.thinning 
    or skimage's skeletonize as a fallback.
    
    :param binary_img: Binary image (uint8, 0 or 255)
    :return: Thinned image (uint8, 0 or 255)
    """
    print("[DEBUG] morphological_thinning input shape:", binary_img.shape)
    if XIMGPROC_AVAILABLE:
        thinned = cv2.ximgproc.thinning(binary_img)
        print("[DEBUG] morphological_thinning ximgproc output shape:", thinned.shape)
        return thinned
    
    elif SKIMAGE_AVAILABLE:
        bool_img = (binary_img > 0)
        skel = sk_skeletonize(bool_img)
        thinned = (skel * 255).astype(np.uint8)
        print("[DEBUG] morphological_thinning skimage output shape:", thinned.shape)
        return thinned
    else:
        raise ImportError("No available thinning method. Install opencv-contrib-python or scikit-image.")

def skeletonize_image(img_path, thresh_val=100):
    """
    Reads a floorplan image, thresholds it, applies morphological denoising,
    and then skeletonizes it using morphological thinning.
    Returns the skeleton image (0 = background, 255 = foreground).
    """
    # 1. Load image in grayscale
    gray = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
    if gray is None:
        raise ValueError(f"Could not open or find the image: {img_path}")
    
    orig_height, orig_width = gray.shape[:2]
    print(f"[DEBUG] Original (H×W): {orig_height} × {orig_width}")

    # 2. Threshold
    _, binary = cv2.threshold(gray, thresh_val, 255, cv2.THRESH_BINARY_INV)
    print("[DEBUG] After threshold shape:", binary.shape)

    # 3. Morphological opening/closing
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    opened = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    print("[DEBUG] After open shape:", opened.shape)
    closed = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel)
    print("[DEBUG] After close shape:", closed.shape)

    # 4. Thinning (skeletonization)
    skel = morphological_thinning(closed)
    print("[DEBUG] After thinning shape:", skel.shape)

    # 5. Resize if needed
    if (skel.shape[0] != orig_height) or (skel.shape[1] != orig_width):
        print("[INFO] Resizing skeleton to match original.")
        skel = cv2.resize(skel, (orig_width, orig_height), interpolation=cv2.INTER_NEAREST)
    print("[DEBUG] Final skeleton shape:", skel.shape)

    # Ensure skeleton is 0 or 255
    skel[skel > 0] = 255

    return skel

def classify_point(neighborhood):
    """
    Classifies a point as corner, endpoint, T-junction, or none.
    """
    pattern = (neighborhood == 255).astype(int)
    center = pattern[1,1]
    if center == 0:
        return 'none'
    
    # Count neighbors
    neighbors = np.sum(pattern) - center
    
    # 8 neighbors in clockwise order
    pixels = [
        pattern[0,1], pattern[0,2], pattern[1,2], pattern[2,2],
        pattern[2,1], pattern[2,0], pattern[1,0], pattern[0,0]
    ]
    
    # Count transitions from 0 to 1
    transitions = 0
    pixels.append(pixels[0])  # wrap-around
    for i in range(8):
        if pixels[i] == 0 and pixels[i+1] == 1:
            transitions += 1
    
    # Logic
    if neighbors == 1:
        return 'endpoint'
    elif transitions == 2:
        if neighbors == 2:
            return 'corner'
        elif neighbors == 3:
            return 't_junction'
    
    return 'none'

def detect_corners(skel, max_corners=500, quality_level=0.001, min_distance=10):
    """
    Use cv2.goodFeaturesToTrack + classify_point to find corners, endpoints, T-junctions.
    Returns a list of (x, y) points.
    """
    corners = cv2.goodFeaturesToTrack(
        skel, 
        maxCorners=max_corners, 
        qualityLevel=quality_level, 
        minDistance=min_distance, 
        blockSize=3
    )
    
    important_points = []
    if corners is not None:
        corners = corners.astype(int)
        for corner in corners:
            x, y = corner.ravel()
            # Check a 3×3 neighborhood
            if 0 < y < skel.shape[0]-1 and 0 < x < skel.shape[1]-1:
                neighborhood = skel[y-1:y+2, x-1:x+2]
                point_type = classify_point(neighborhood)
                if point_type != 'none':
                    important_points.append([x, y])

    # Additional pass for endpoints/T-junctions missed
    height, width = skel.shape
    for y in range(1, height-1):
        for x in range(1, width-1):
            if skel[y, x] == 255:
                neighborhood = skel[y-1:y+2, x-1:x+2]
                point_type = classify_point(neighborhood)
                if point_type in ['endpoint', 't_junction']:
                    # Avoid duplicates if already close
                    if not any(abs(x - px) < min_distance and abs(y - py) < min_distance 
                               for px, py in important_points):
                        important_points.append([x, y])
    
    return important_points

def cluster_points(points, num_clusters=20):
    """
    Clusters corner points using KMeans, returning cluster centers (x, y).
    """
    if len(points) == 0:
        return []

    points_arr = np.array(points, dtype=np.float32)
    k = min(num_clusters, len(points_arr))
    kmeans = KMeans(n_clusters=k, random_state=42).fit(points_arr)
    return kmeans.cluster_centers_

def fit_line_to_clustered_points(image, clustered_points, draw=True):
    """
    Color-code each point based on classify_point:
      Blue=endpoints, Red=corners, Green=T-junction, Orange=others
    """
    if not draw:
        return

    h, w = image.shape[:2]

    for (x_c, y_c) in clustered_points:
        x_c = int(x_c)
        y_c = int(y_c)

        # Get 3×3 patch
        y0, y1 = max(0, y_c - 1), min(h, y_c + 2)
        x0, x1 = max(0, x_c - 1), min(w, x_c + 2)

        neighborhood = image[y0:y1, x0:x1, 0]  # just the first channel
        if neighborhood.shape[0] < 3 or neighborhood.shape[1] < 3:
            point_type = 'none'
        else:
            point_type = classify_point(neighborhood)

        if point_type == 'endpoint':
            color = (255, 0, 0)   # Blue
        elif point_type == 'corner':
            color = (0, 0, 255)   # Red
        elif point_type == 't_junction':
            color = (0, 255, 0)   # Green
        else:
            color = (0, 165, 255) # Orange

        cv2.circle(image, (x_c, y_c), 3, color, -1)

def detect_straight_walls_hough(skel, threshold=50, min_line_length=50, max_line_gap=10):
    """
    Hough transform for lines in the skeleton
    """
    edges = cv2.Canny(skel, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(
        edges, 
        rho=1, 
        theta=np.pi/180,
        threshold=threshold,
        minLineLength=min_line_length,
        maxLineGap=max_line_gap
    )
    if lines is None:
        return []
    return lines.reshape(-1, 4)

def main():
    parser = argparse.ArgumentParser(
        description='Process a floorplan image to detect corners/endpoints/T-junctions.'
    )
    parser.add_argument('input_image', help='Path to input image')
    parser.add_argument('--thresh_val', type=int, default=100, help='Binarization threshold')
    parser.add_argument('--clusters', type=int, default=20, help='Number of clusters for corner points')
    args = parser.parse_args()

    input_image_path = args.input_image
    thresh_val = args.thresh_val
    num_clusters = args.clusters

    # Ensure file exists
    if not os.path.exists(input_image_path):
        print(f"File not found: {input_image_path}")
        return

    # 1. Skeletonize
    skel = skeletonize_image(input_image_path, thresh_val=thresh_val)
    output_dir = os.path.dirname(input_image_path) or '.'

    skel_output_path = os.path.join(output_dir, "skeletonized.png")
    cv2.imwrite(skel_output_path, skel)

    # 2. Find corners
    corners = detect_corners(skel, max_corners=500, quality_level=0.001, min_distance=10)
    print(f"Detected {len(corners)} corners.")

    # 3. KMeans cluster
    clustered_pts = cluster_points(corners, num_clusters=num_clusters)
    print("Clustered corners:\n", clustered_pts)

    # 4. Convert to BGR, draw points
    skel_bgr = cv2.cvtColor(skel, cv2.COLOR_GRAY2BGR)
    fit_line_to_clustered_points(skel_bgr, clustered_pts, draw=True)

    # 5. Hough lines
    lines = detect_straight_walls_hough(skel)
    for (x1, y1, x2, y2) in lines:
        cv2.line(skel_bgr, (x1, y1), (x2, y2), (0, 255, 0), 2)

    # 6. Save annotated
    clustered_output_path = os.path.join(output_dir, "clustered_points.png")
    cv2.imwrite(clustered_output_path, skel_bgr)

    print(f"Processing complete. Results in {output_dir}")
    print("Skeleton:", skel_output_path)
    print("Clustered corners visualization:", clustered_output_path)

if __name__ == "__main__":
    main()
