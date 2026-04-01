import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Initialize Django ASGI application early to ensure the AppRegistry
# is populated before importing code that may import ORM models.
django_asgi_app = get_asgi_application()

async def application(scope, receive, send):
    if scope["type"] == "http":
        await django_asgi_app(scope, receive, send)
    elif scope["type"] == "websocket":
        # If you don't need WebSocket support, close the connection
        await send({
            "type": "websocket.close",
            "code": 1000,
        })
    else:
        raise ValueError(f"Unknown scope type: {scope['type']}")