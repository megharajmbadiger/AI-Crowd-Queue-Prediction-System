
from django.db import models


class Camera(models.Model):
    camera_id = models.AutoField(primary_key=True)
    camera_name = models.CharField(max_length=100)
    location = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=20, default="active")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.camera_name

    class Meta:
        db_table = "cameras"


class CrowdRecord(models.Model):
    record_id = models.AutoField(primary_key=True)
    camera = models.ForeignKey(Camera, on_delete=models.CASCADE)
    people_count = models.IntegerField(default=0)
    recorded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Crowd: {self.people_count}"

    class Meta:
        db_table = "crowd_records"


class QueueRecord(models.Model):
    queue_id = models.AutoField(primary_key=True)
    camera = models.ForeignKey(Camera, on_delete=models.CASCADE)
    queue_length = models.IntegerField(default=0)
    queue_zone_count = models.IntegerField(default=0)
    estimated_wait_minutes = models.IntegerField(default=0)
    recorded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Queue: {self.queue_length}"

    class Meta:
        db_table = "queue_records"


class Alert(models.Model):
    alert_id = models.AutoField(primary_key=True)
    camera = models.ForeignKey(Camera, on_delete=models.CASCADE)
    alert_type = models.CharField(max_length=100)
    message = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.alert_type

    class Meta:
        db_table = "alerts"
