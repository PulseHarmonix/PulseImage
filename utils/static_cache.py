# utils/static_cache.py
from starlette.responses import Response
from starlette.staticfiles import StaticFiles


class CachedStaticFiles(StaticFiles):
    """StaticFiles variant that adds a Cache-Control header to successful responses."""

    def __init__(self, *args, cache_control: str = "", **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.cache_control = cache_control

    async def get_response(self, path: str, scope) -> Response:
        response = await super().get_response(path, scope)
        if self.cache_control and response.status_code in (200, 304):
            response.headers.setdefault("Cache-Control", self.cache_control)
        return response
