# File: app.py
import os
import uuid
import numpy as np  # Add this import

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import cv2

# Import your floorplan processing functions
from detect_floorplan import (
    skeletonize_image,
    detect_corners,
    cluster_points,
    detect_straight_walls_hough
)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Directory where uploaded and processed files are stored
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Allowed file extensions
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'bmp', 'tiff'}

def allowed_file(filename):
    """Check if the file has an allowed extension."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    """Health check endpoint."""
    return "Hello! Flask is running, and I'm ready to process floorplan images."

@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    """
    Serve files from the 'uploads' directory.
    This allows the React frontend to access processed images.
    """
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route('/process-floorplan', methods=['POST'])
def process_floorplan():
    """
    Endpoint to process the uploaded floorplan image.
    Expects:
      - 'image': The floorplan image file.
      - 'thresh_val' (optional): Threshold value for binarization.
      - 'clusters' (optional): Number of clusters for corner points.
    Returns:
      - JSON containing the path to the annotated image.
    """
    if 'image' not in request.files:
        return jsonify({"error": "No file part named 'image' in request"}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        unique_filename = f"{uuid.uuid4()}_{filename}"
        filepath = os.path.join(UPLOAD_FOLDER, unique_filename)
        
        # Save the uploaded file
        file.save(filepath)
        
        # Parse optional form parameters
        thresh_val = int(request.form.get('thresh_val', 100))
        clusters = int(request.form.get('clusters', 20))

        # 1. Skeletonize the image
        try:
            skel = skeletonize_image(filepath, thresh_val=thresh_val)
        except Exception as e:
            return jsonify({"error": f"Skeletonization failed: {str(e)}"}), 500
        
        # 2. Detect corners
        try:
            corners = detect_corners(skel, max_corners=500, quality_level=0.001, min_distance=10)
        except Exception as e:
            return jsonify({"error": f"Corner detection failed: {str(e)}"}), 500

        # 3. Cluster corners
        try:
            clustered_pts = cluster_points(corners, num_clusters=clusters)
        except Exception as e:
            return jsonify({"error": f"Clustering failed: {str(e)}"}), 500

        # 4. Detect straight walls using Hough Transform
        try:
            lines = detect_straight_walls_hough(skel)
            if lines is None:
                lines_list = []
            else:
                # Correct tuple unpacking and ensure proper integer conversion
                lines_list = [(int(float(x1)), int(float(y1)), int(float(x2)), int(float(y2))) 
                            for x1, y1, x2, y2 in lines]
        except Exception as e:
            return jsonify({"error": f"Hough Transform failed: {str(e)}"}), 500

        # 5. Create annotated image
        try:
            # Convert skeleton to BGR for colored annotations
            skel_bgr = cv2.cvtColor(skel, cv2.COLOR_GRAY2BGR)

            # Draw detected corners and points
            fit_line_to_clustered_points(skel_bgr, clustered_pts, draw=True)

            # Draw Hough lines in green
            for (x1, y1, x2, y2) in lines_list:
                cv2.line(skel_bgr, (x1, y1), (x2, y2), (0, 255, 0), 2)

            # Save the annotated image
            clustered_filename = f"{unique_filename}_annotated.png"
            clustered_path = os.path.join(UPLOAD_FOLDER, clustered_filename)
            cv2.imwrite(clustered_path, skel_bgr)
        except Exception as e:
            return jsonify({"error": f"Annotation failed: {str(e)}"}), 500

        # Return JSON with the path to the annotated image
        return jsonify({
            "status": "success",
            "corners": corners,
            "clusteredPoints": clustered_pts.tolist() if len(clustered_pts) else [],
            "lines": lines_list,
            "clusteredImagePath": f"uploads/{clustered_filename}"
        })

    else:
        return jsonify({"error": "Unsupported file extension"}), 400

def fit_line_to_clustered_points(image, points, draw=True, color=(0, 0, 255), thickness=2):
    """
    Fit lines to clustered points and optionally draw them on the image.
    Args:
        image: BGR image to draw on
        points: Array of points to fit lines to
        draw: Whether to draw the lines and points
        color: BGR color tuple for drawing
        thickness: Line thickness for drawing
    """
    if len(points) < 2:
        return

    if draw:
        # Draw points as small circles
        for point in points:
            x, y = point
            cv2.circle(image, (int(x), int(y)), 3, color, -1)

if __name__ == '__main__':
    # Start Flask development server
    app.run(debug=True, host='0.0.0.0', port=5000)
