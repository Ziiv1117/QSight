class AppError(Exception):
    def __init__(
        self,
        status_code: int,
        error_code: str,
        message: str,
        inspection_state: str | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.error_code = error_code
        self.message = message
        self.inspection_state = inspection_state


class NotFoundError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(404, "NOT_FOUND", message)


class ConflictError(AppError):
    def __init__(self, message: str, inspection_state: str | None = None) -> None:
        super().__init__(409, "STATE_CONFLICT", message, inspection_state)


class InvalidImageError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(422, "INVALID_IMAGE", message)

