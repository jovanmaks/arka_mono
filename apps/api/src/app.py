# File: app.py
import os
import uuid
import numpy as np

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS  # Add this import
from werkzeug.utils import secure_filename
import cv2

# Import your floorplan code
from detect_floorplan import (
    skeletonize_image,
    detect_corners,
    cluster_points,
    detect_straight_walls_hough,
    fit_line_to_clustered_points
)

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"],
    }
})

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'bmp', 'tiff'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return "Hello! Flask is running, and I'm ready to process floorplan images."

@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    response = send_from_directory(UPLOAD_FOLDER, filename)
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response

@app.route('/process-floorplan', methods=['POST'])
def process_floorplan():
    """
    Expects:
      - 'image': File upload
      - 'thresh_val': optional int
      - 'clusters': optional int
    Returns JSON with corners, lines, etc. plus an annotated image path.
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
        file.save(filepath)

        # Parse optional form params
        thresh_val = int(request.form.get('thresh_val', 100))
        clusters = int(request.form.get('clusters', 20))

        # 1. Skeletonize
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

        # 4. Hough lines
        try:
            lines = detect_straight_walls_hough(skel)
            if lines is None:
                lines_list = []
            else:
                lines_list = lines.tolist()  # convert to normal Python list
        except Exception as e:
            return jsonify({"error": f"Hough Transform failed: {str(e)}"}), 500

        # 5. Annotate skeleton
        try:
            skel_bgr = cv2.cvtColor(skel, cv2.COLOR_GRAY2BGR)
            fit_line_to_clustered_points(skel_bgr, clustered_pts, draw=True)

            # Draw lines in green
            for line in lines_list:
                x1, y1, x2, y2 = line
                cv2.line(skel_bgr, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 2)

            # Save annotated image
            clustered_filename = f"{unique_filename}_annotated.png"
            clustered_path = os.path.join(UPLOAD_FOLDER, clustered_filename)
            cv2.imwrite(clustered_path, skel_bgr)
        except Exception as e:
            return jsonify({"error": f"Annotation failed: {str(e)}"}), 500

        # 6. Convert corners & clustered_pts & lines to plain Python ints
        # so jsonify won't complain about np.int64
        corners_py = [[int(x), int(y)] for (x, y) in corners]
        clustered_pts_py = [[int(x), int(y)] for (x, y) in clustered_pts]
        lines_list_py = [
            [int(x1), int(y1), int(x2), int(y2)]
            for (x1, y1, x2, y2) in lines_list
        ]

        return jsonify({
            "status": "success",
            "corners": corners_py,
            "clusteredPoints": clustered_pts_py,
            "lines": lines_list_py,
            "clusteredImagePath": f"uploads/{clustered_filename}"
        })

    else:
        return jsonify({"error": "Unsupported file extension"}), 400

if __name__ == '__main__':
    # Start dev server
    app.run(debug=True, host='0.0.0.0', port=5000, threaded=True)
