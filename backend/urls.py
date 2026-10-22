
from django.contrib import admin
from django.urls import path
from crowd import views

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", views.home, name="home"),
    path("api/cameras/", views.camera_list, name="camera_list"),
    path("api/crowd-records/", views.crowd_records, name="crowd_records"),
    path("api/queue-records/", views.queue_records, name="queue_records"),
    path("api/alerts/", views.alert_list, name="alert_list"),
    path("api/camera-status/", views.camera_status, name="camera_status"),
]
