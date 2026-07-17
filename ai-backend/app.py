import os
import cv2
import base64
import time
import numpy as np
import supervision as sv
from ultralytics import YOLO
from flask import Flask, render_template, Response, jsonify, request
from flask_cors import CORS
from werkzeug.utils import secure_filename

# Flask App Initialization
app = Flask(__name__)
CORS(app)  # Allow cross-origin requests (Flutter emulator at 10.0.2.2)

# Configuration
SJ_MODEL_PATH = "best.pt"
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Global variable to store active video source and detection count
current_video_source = "demo.mp4"
detection_count = 0

class SigapJalanVisualizer:
    """SIGAP JALAN Standard Visualization Engine"""
    
    def __init__(self):
        self.model = YOLO(SJ_MODEL_PATH)
        self.box_annotator = sv.BoxAnnotator(
            thickness=2,
            color=sv.Color.from_hex("#0055FF")
        )
        self.label_annotator = sv.LabelAnnotator(
            text_scale=0.7,
            text_thickness=1,
            text_color=sv.Color.WHITE,
            text_padding=10
        )
        
    def process_frame(self, frame, conf=0.25):
        """SIGAP JALAN Standard Processing Pipeline"""
        global detection_count
        results = self.model(frame, conf=conf)[0]
        detections = sv.Detections.from_ultralytics(results)
        
        # Update detection count
        detection_count = len(detections)  # Count the number of detections in the current frame
        
        # Apply SIGAP JALAN Visualization Standards (using a copy to prevent modifying raw buffer)
        annotated_frame = self.box_annotator.annotate(
            scene=frame.copy(),
            detections=detections
        )
        
        # Generate text labels for detections
        labels = []
        if detections.confidence is not None and detections.class_id is not None:
            labels = [
                f"{confidence:.2f}"
                for class_id, confidence
                in zip(detections.class_id, detections.confidence)
            ]
            
        annotated_frame = self.label_annotator.annotate(
            scene=annotated_frame,
            detections=detections,
            labels=labels
        )
        
        return annotated_frame, len(detections)

def generate_frames(conf=0.25):
    global current_video_source
    visualizer = SigapJalanVisualizer()
    
    # Check source
    source = current_video_source
    if isinstance(source, str) and not os.path.exists(source):
        # Fallback to webcam if demo.mp4 is missing
        source = 0
        
    cap = cv2.VideoCapture(source)
    
    while cap.isOpened():
        # Stop stream generator if the user switches source
        if current_video_source != source:
            break
            
        success, frame = cap.read()
        if not success:
            # Loop the video if it's not a webcam
            if isinstance(source, str):
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            else:
                break
        
        output_frame, count = visualizer.process_frame(frame, conf=conf)
        _, buffer = cv2.imencode('.jpg', output_frame)
        frame_bytes = buffer.tobytes()
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
    
    cap.release()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/video_feed')
def video_feed():
    conf = request.args.get('conf', default=0.25, type=float)
    return Response(generate_frames(conf=conf), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/detection_count')
def get_detection_count():
    return jsonify({'detections': detection_count})

@app.route('/set_source', methods=['POST'])
def set_source():
    global current_video_source
    data = request.json
    source_type = data.get('source')
    
    if source_type == 'webcam':
        current_video_source = 0
    elif source_type == 'default':
        current_video_source = "demo.mp4"
    elif source_type == 'uploaded':
        path = os.path.join(app.config['UPLOAD_FOLDER'], 'uploaded_video.mp4')
        if os.path.exists(path):
            current_video_source = path
        else:
            return jsonify({'success': False, 'message': 'No uploaded video found'}), 400
    else:
        return jsonify({'success': False, 'message': 'Invalid source type'}), 400
        
    return jsonify({'success': True, 'current_source': str(current_video_source)})

@app.route('/upload_video', methods=['POST'])
def upload_video():
    global current_video_source
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No selected file'}), 400
        
    filename = secure_filename(file.filename)
    path = os.path.join(app.config['UPLOAD_FOLDER'], 'uploaded_video.mp4')
    file.save(path)
    
    current_video_source = path
    return jsonify({'success': True, 'filename': filename})

@app.route('/upload_image', methods=['POST'])
def upload_image():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    conf = request.form.get('conf', default=0.25, type=float)
        
    # Read image file bytes
    file_bytes = np.frombuffer(file.read(), np.uint8)
    image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    
    if image is None:
        return jsonify({'error': 'Invalid image file'}), 400
        
    # Save the uploaded image to disk for reference and debugging
    debug_path = os.path.join(app.config['UPLOAD_FOLDER'], 'uploaded_image.jpg')
    cv2.imwrite(debug_path, image)
        
    visualizer = SigapJalanVisualizer()
    annotated_image, count = visualizer.process_frame(image, conf=conf)
    
    # Encode processed image to base64
    _, buffer = cv2.imencode('.jpg', annotated_image)
    img_base64 = base64.b64encode(buffer).decode('utf-8')
    
    return jsonify({
        'detections': count,
        'image': f"data:image/jpeg;base64,{img_base64}"
    })

@app.route('/analyze_frame', methods=['POST'])
def analyze_frame():
    """Dedicated endpoint for Flutter dashcam frame analysis.
    Accepts a JPEG frame from the mobile camera, runs YOLO pothole detection,
    and returns detection count + annotated image (base64).
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file part', 'detections': 0}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file', 'detections': 0}), 400

    conf = request.form.get('conf', default=0.3, type=float)

    # Decode image bytes from multipart upload
    file_bytes = np.frombuffer(file.read(), np.uint8)
    image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

    if image is None:
        return jsonify({'error': 'Invalid image data', 'detections': 0}), 400

    # Run YOLO detection
    visualizer = SigapJalanVisualizer()
    annotated_image, count = visualizer.process_frame(image, conf=conf)

    # Encode annotated frame to base64 JPEG
    _, buffer = cv2.imencode('.jpg', annotated_image, [cv2.IMWRITE_JPEG_QUALITY, 75])
    img_base64 = base64.b64encode(buffer).decode('utf-8')

    return jsonify({
        'detections': count,
        'image': f"data:image/jpeg;base64,{img_base64}",
        'confidence_threshold': conf
    })

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0')