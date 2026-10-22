
import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .models import Camera, CrowdRecord, QueueRecord, Alert


def home(request):
    return JsonResponse({
        "message": "AI Crowd & Queue Prediction System API",
        "status": "running",
        "modules": [
            "Camera Monitoring",
            "Crowd Detection",
            "Queue Prediction",
            "Alert Management",
        ],
    })


def camera_list(request):
    cameras = Camera.objects.all().values(
        "camera_id",
        "camera_name",
        "location",
        "status",
        "created_at",
    )
    return JsonResponse(list(cameras), safe=False)


@csrf_exempt
def camera_status(request):
    if request.method != "POST":
        return JsonResponse(
            {"error": "Method not allowed"},
            status=405,
        )

    try:
        data = json.loads(request.body)
        status = data.get("status")

        if status not in ["active", "offline"]:
            return JsonResponse(
                {"error": "Invalid camera status"},
                status=400,
            )

        camera_id = data.get("camera_id", 1)
        camera = Camera.objects.get(camera_id=camera_id)

        camera.status = status
        camera.save(update_fields=["status"])

        return JsonResponse({
            "camera_id": camera.camera_id,
            "status": camera.status,
        })

    except Camera.DoesNotExist:
        return JsonResponse(
            {"error": "Camera not found"},
            status=404,
        )
    except (ValueError, TypeError, json.JSONDecodeError):
        return JsonResponse(
            {"error": "Invalid request data"},
            status=400,
        )


@csrf_exempt
def crowd_records(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)

            camera_id = data.get("camera_id")
            people_count = int(data.get("people_count", 0))
            queue_zone_count = int(
                data.get(
                    "queue_zone_count",
                    people_count // 2,
                )
            )

            if people_count < 0 or queue_zone_count < 0:
                return JsonResponse(
                    {"error": "Counts cannot be negative"},
                    status=400,
                )

            if queue_zone_count > people_count:
                return JsonResponse(
                    {
                        "error": (
                            "Queue-zone count cannot exceed "
                            "the total people count"
                        )
                    },
                    status=400,
                )

            camera = Camera.objects.get(camera_id=camera_id)

            # Save the total crowd count.
            record = CrowdRecord.objects.create(
                camera=camera,
                people_count=people_count,
            )

            # Calculate queue length from the detected queue zone.
            queue_length = queue_zone_count

            # Assumption: one person is served every two minutes.
            service_rate_per_minute = 0.5

            estimated_wait_minutes = (
                round(queue_length / service_rate_per_minute)
                if queue_length > 0
                else 0
            )

            # Save queue information.
            queue_record = QueueRecord.objects.create(
                camera=camera,
                queue_length=queue_length,
                queue_zone_count=queue_zone_count,
                estimated_wait_minutes=estimated_wait_minutes,
            )

            # Generate an alert when the total crowd exceeds 50.
            alert_generated = people_count > 50

            if alert_generated:
                Alert.objects.create(
                    camera=camera,
                    alert_type="High Crowd",
                    message=(
                        f"Crowd count reached {people_count} people. "
                        "Please monitor the area."
                    ),
                )

            return JsonResponse({
                "record_id": record.record_id,
                "camera_id": camera.camera_id,
                "people_count": record.people_count,
                "queue_id": queue_record.queue_id,
                "queue_length": queue_record.queue_length,
                "queue_zone_count": queue_record.queue_zone_count,
                "estimated_wait_minutes": (
                    queue_record.estimated_wait_minutes
                ),
                "alert_generated": alert_generated,
            }, status=201)

        except Camera.DoesNotExist:
            return JsonResponse(
                {"error": "Camera not found"},
                status=404,
            )
        except (ValueError, TypeError, json.JSONDecodeError):
            return JsonResponse(
                {"error": "Invalid request data"},
                status=400,
            )

    elif request.method == "GET":
        records = CrowdRecord.objects.all().values(
            "record_id",
            "camera_id",
            "people_count",
            "recorded_at",
        )
        return JsonResponse(list(records), safe=False)

    return JsonResponse(
        {"error": "Method not allowed"},
        status=405,
    )


def queue_records(request):
    if request.method != "GET":
        return JsonResponse(
            {"error": "Method not allowed"},
            status=405,
        )

    records = QueueRecord.objects.all().values(
        "queue_id",
        "camera_id",
        "queue_length",
        "queue_zone_count",
        "estimated_wait_minutes",
        "recorded_at",
    )

    return JsonResponse(list(records), safe=False)


def alert_list(request):
    if request.method != "GET":
        return JsonResponse(
            {"error": "Method not allowed"},
            status=405,
        )

    alerts = Alert.objects.all().values(
        "alert_id",
        "camera_id",
        "alert_type",
        "message",
        "created_at",
    )

    return JsonResponse(list(alerts), safe=False)
