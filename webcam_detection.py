
import cv2
import requests
from ultralytics import YOLO

# Django API URLs
API_URL = "http://127.0.0.1:8000/api/crowd-records/"
STATUS_URL = "http://127.0.0.1:8000/api/camera-status/"

# Camera configuration
CAMERA_ID = 1
SEND_INTERVAL_SECONDS = 2

# Queue-zone boundaries (relative to webcam frame size)
ZONE_X1_RATIO = 0.25
ZONE_Y1_RATIO = 0.25
ZONE_X2_RATIO = 0.75
ZONE_Y2_RATIO = 0.90


def send_camera_status(status):
    """Send the webcam's current status to Django."""
    try:
        response = requests.post(
            STATUS_URL,
            json={
                "camera_id": CAMERA_ID,
                "status": status
            },
            timeout=3
        )

        if response.status_code == 200:
            print(f"Camera status updated: {status}")
        else:
            print(
                f"Camera status update failed: "
                f"{response.status_code} - {response.text}"
            )

    except requests.RequestException as error:
        print(f"Could not update camera status: {error}")


def main():
    print("Loading YOLO model...")
    model = YOLO("yolo11n.pt")

    camera = cv2.VideoCapture(0)

    if not camera.isOpened():
        print("Error: Could not open webcam.")
        camera.release()
        return

    # Tell Django that the webcam is running.
    send_camera_status("active")

    print("Webcam started. Press Q to quit.")

    last_sent_time = 0

    try:
        while True:
            success, frame = camera.read()

            if not success:
                print("Could not read a frame from the webcam.")
                break

            height, width = frame.shape[:2]

            # Calculate queue-zone boundaries.
            x1 = int(width * ZONE_X1_RATIO)
            y1 = int(height * ZONE_Y1_RATIO)
            x2 = int(width * ZONE_X2_RATIO)
            y2 = int(height * ZONE_Y2_RATIO)

            # Detect people only (YOLO class 0).
            results = model.predict(
                frame,
                classes=[0],
                conf=0.35,
                verbose=False
            )

            annotated_frame = results[0].plot()
            people_count = len(results[0].boxes)
            queue_count = 0

            # Count people whose detected box center is inside the queue zone.
            for box in results[0].boxes:
                bx1, by1, bx2, by2 = box.xyxy[0].tolist()

                center_x = int((bx1 + bx2) / 2)
                center_y = int((by1 + by2) / 2)

                if x1 <= center_x <= x2 and y1 <= center_y <= y2:
                    queue_count += 1

                    cv2.circle(
                        annotated_frame,
                        (center_x, center_y),
                        5,
                        (0, 255, 255),
                        -1
                    )

            # Draw the queue zone.
            cv2.rectangle(
                annotated_frame,
                (x1, y1),
                (x2, y2),
                (0, 255, 255),
                2
            )

            # Display live counts.
            cv2.putText(
                annotated_frame,
                f"People detected: {people_count}",
                (20, 35),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 255, 0),
                2
            )

            cv2.putText(
                annotated_frame,
                f"People in queue zone: {queue_count}",
                (20, 70),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 255, 255),
                2
            )

            current_time = (
                cv2.getTickCount() / cv2.getTickFrequency()
            )

            # Send crowd and queue counts to Django every 2 seconds.
            if current_time - last_sent_time >= SEND_INTERVAL_SECONDS:
                try:
                    response = requests.post(
                        API_URL,
                        json={
                            "camera_id": CAMERA_ID,
                            "people_count": people_count,
                            "queue_zone_count": queue_count
                        },
                        timeout=3
                    )

                    if response.status_code == 201:
                        print(
                            f"Sent crowd count: {people_count}; "
                            f"queue zone count: {queue_count}"
                        )
                    else:
                        print(
                            f"API error {response.status_code}: "
                            f"{response.text}"
                        )

                except requests.RequestException as error:
                    print(f"Could not reach Django API: {error}")

                last_sent_time = current_time

            cv2.imshow(
                "AI Crowd and Queue-Zone Detection",
                annotated_frame
            )

            # Press Q to stop the webcam.
            if cv2.waitKey(1) & 0xFF == ord("q"):
                print("Q pressed. Stopping webcam...")
                break

    finally:
        camera.release()
        cv2.destroyAllWindows()

        # Tell Django that the webcam has stopped.
        send_camera_status("offline")

        print("Webcam closed.")


if __name__ == "__main__":
    main()
